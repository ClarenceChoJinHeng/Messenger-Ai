import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';

export type StatusMode = 'auto' | 'online' | 'away' | 'offline';
export type Presence = 'online' | 'away' | 'offline';
type Activity = 'active' | 'idle';

// The live side of the app: who's connected, their status, and pushing events to them.
// Every connected browser tab is one "socket". Each user's sockets join a room called user:<id>,
// so emitToUser() reaches all of that person's open tabs at once.
@Injectable()
export class RealtimeService {
  server: Server | null = null; // set by the gateway when it starts

  private readonly sockets = new Map<number, Map<string, Activity>>(); // user → (socket → active/idle)
  private readonly modes = new Map<number, StatusMode>(); // status setting of connected users

  constructor(private readonly prisma: PrismaService) {}

  emitToUser(userId: number, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  // ---- presence (online / away / offline) ----

  // The status other people see
  presenceOf(userId: number, mode: string): Presence {
    const tabs = this.sockets.get(userId);
    if (!tabs?.size || mode === 'offline') return 'offline'; // not connected, or "appear offline"
    if (mode === 'online' || mode === 'away') return mode; // set by hand
    // auto: online if any tab is being used, otherwise away
    return [...tabs.values()].includes('active') ? 'online' : 'away';
  }

  // For API answers: what to show for a user, given their saved settings
  publicPresence(user: { id: number; isBot: boolean; statusMode: string; lastSeenAt: Date | null }) {
    if (user.isBot) return { status: 'online' as Presence, lastSeenAt: null };
    return { status: this.presenceOf(user.id, user.statusMode), lastSeenAt: user.lastSeenAt };
  }

  async connect(userId: number, socketId: string) {
    const first = !this.sockets.has(userId);
    if (first) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { statusMode: true } });
      this.modes.set(userId, (user?.statusMode as StatusMode) ?? 'auto');
      this.sockets.set(userId, new Map());
    }
    const before = this.currentPresence(userId);
    this.sockets.get(userId)!.set(socketId, 'active');
    await this.announceIfChanged(userId, before);
  }

  async disconnect(userId: number, socketId: string) {
    const tabs = this.sockets.get(userId);
    if (!tabs) return;
    const before = this.currentPresence(userId);
    tabs.delete(socketId);
    if (!tabs.size) {
      this.sockets.delete(userId);
      // Remember when they left (not while they "appear offline": that would give them away)
      if (this.modes.get(userId) !== 'offline') {
        await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      }
      this.modes.delete(userId);
    }
    await this.announceIfChanged(userId, before);
  }

  async setActivity(userId: number, socketId: string, activity: Activity) {
    const tabs = this.sockets.get(userId);
    if (!tabs?.has(socketId)) return;
    const before = this.currentPresence(userId);
    tabs.set(socketId, activity);
    await this.announceIfChanged(userId, before);
  }

  // Called when the user picks a status on the website
  async setMode(userId: number, mode: StatusMode) {
    if (!this.sockets.has(userId)) return; // not connected: nothing live to update
    const before = this.currentPresence(userId);
    if (mode === 'offline' && before !== 'offline') {
      // going invisible: freeze "last seen" at this moment
      await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    }
    this.modes.set(userId, mode);
    await this.announceIfChanged(userId, before);
  }

  private currentPresence(userId: number): Presence {
    return this.presenceOf(userId, this.modes.get(userId) ?? 'auto');
  }

  // Tell everyone who can see this user (people who added them, people they've chatted with)
  private async announceIfChanged(userId: number, before: Presence) {
    const status = this.currentPresence(userId);
    if (status === before) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } });
    const payload = { userId, status, lastSeenAt: user?.lastSeenAt ?? null };
    for (const id of await this.audienceOf(userId)) this.emitToUser(id, 'presence', payload);
    this.emitToUser(userId, 'presence', payload); // and the user's own other tabs
  }

  async audienceOf(userId: number): Promise<number[]> {
    const [addedMe, iAdded, sentTo, receivedFrom] = await Promise.all([
      this.prisma.contact.findMany({ where: { contactId: userId }, select: { ownerId: true } }),
      this.prisma.contact.findMany({ where: { ownerId: userId }, select: { contactId: true } }),
      this.prisma.message.groupBy({ by: ['receiverId'], where: { senderId: userId } }),
      this.prisma.message.groupBy({ by: ['senderId'], where: { receiverId: userId } }),
    ]);
    const ids = new Set([
      ...addedMe.map((c) => c.ownerId),
      ...iAdded.map((c) => c.contactId),
      ...sentTo.map((m) => m.receiverId),
      ...receivedFrom.map((m) => m.senderId),
    ]);
    ids.delete(userId);
    return [...ids].filter((id) => this.sockets.has(id)); // only people who are connected right now
  }
}
