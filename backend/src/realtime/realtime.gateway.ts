import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyAccessToken } from '../auth/verify-token.js';
import { RealtimeService } from './realtime.service.js';
import { RelationsService } from '../social/relations.service.js';

// The WebSocket door. Browsers connect here (same port as the API) with their login token,
// then get pushed messages, "typing…", status changes and notifications instantly.
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly relations: RelationsService,
  ) {}

  afterInit(server: Server) {
    this.realtime.server = server;

    // Checked during the handshake, BEFORE the connection is accepted (same check as AuthGuard).
    // A bad token never gets connected, not even for a moment.
    server.use((client, next) => {
      const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : '';
      if (!token) return next(new Error('session-expired'));
      verifyAccessToken(this.jwt, this.prisma, token)
        .then((user) => {
          if (!user) return next(new Error('session-expired'));
          client.data.userId = user.sub;
          next();
        })
        .catch(() => next(new Error('session-expired')));
    });
  }

  async handleConnection(client: Socket) {
    const userId = client.data.userId as number | undefined;
    if (!userId) return void client.disconnect(true); // can't happen after the check above, but be safe
    await client.join(`user:${userId}`);
    await this.realtime.connect(userId, client.id);
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) await this.realtime.disconnect(client.data.userId, client.id);
  }

  // The browser reports "active" (being used) or "idle" (5 min untouched, or tab hidden)
  @SubscribeMessage('activity')
  async activity(@ConnectedSocket() client: Socket, @MessageBody() body: { state?: string }) {
    if (!client.data.userId || (body?.state !== 'active' && body?.state !== 'idle')) return;
    await this.realtime.setActivity(client.data.userId, client.id, body.state);
  }

  // "I'm typing to user X" / "I stopped": passed straight on to X's open tabs
  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() client: Socket, @MessageBody() body: { to?: unknown; typing?: unknown }) {
    const from = client.data.userId as number | undefined;
    if (!from || !Number.isInteger(body?.to) || body.to === from) return;
    if (await this.relations.blockedEitherWay(from, body.to as number)) return; // nothing passes a block
    this.realtime.emitToUser(body.to as number, 'typing', { from, typing: body.typing === true });
  }
}
