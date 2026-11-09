import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ChangeEmailDto, ChangePasswordDto } from './account.dto.js';

const LINK_LIFETIME_MS = 60 * 60 * 1000; // links work for 1 hour
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

// We store only a hash of the token. If the database leaks, the links in people's inboxes stay useless.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async requestEmailChange(userId: number, body: ChangeEmailDto) {
    const user = await this.checkPassword(userId, body.password);
    const newEmail = body.newEmail.trim().toLowerCase();

    if (newEmail === user.email.toLowerCase()) throw new BadRequestException('That is already your email.');
    if (await this.prisma.user.findUnique({ where: { email: newEmail } })) {
      throw new ConflictException('That email is already registered!');
    }

    const token = await this.createPending(userId, 'email', newEmail);
    // The link goes to the NEW address: that proves the person owns it
    await this.mail.send(
      newEmail,
      'Confirm your new email for Messenger AI',
      `Hi ${user.username},\n\nClick this link to make ${newEmail} your Messenger AI email:\n${FRONTEND_URL}/confirm-change?token=${token}\n\nThe link works for 1 hour. If you didn't ask for this, ignore this email.`,
    );
    // And a heads-up to the OLD address, in case someone else is in the account
    await this.mail.send(
      user.email,
      'Someone asked to change your Messenger AI email',
      `Hi ${user.username},\n\nA change of your email to ${newEmail} was requested. If this wasn't you, change your password now.`,
    );
    return { message: `We sent a confirmation link to ${newEmail}.` };
  }

  async requestPasswordChange(userId: number, body: ChangePasswordDto) {
    const user = await this.checkPassword(userId, body.currentPassword);

    if (body.newPassword === user.username) {
      throw new BadRequestException('Password cannot be the same as your Username!');
    }
    if (await bcrypt.compare(body.newPassword, user.password)) {
      throw new BadRequestException('The new password must be different from the current one.');
    }

    // Store the HASH of the new password, so even this waiting row never holds the real one
    const token = await this.createPending(userId, 'password', await bcrypt.hash(body.newPassword, 10));
    await this.mail.send(
      user.email,
      'Confirm your new Messenger AI password',
      `Hi ${user.username},\n\nClick this link to switch to your new password:\n${FRONTEND_URL}/confirm-change?token=${token}\n\nThe link works for 1 hour. If you didn't ask for this, ignore this email: your password stays the same.`,
    );
    return { message: `We sent a confirmation link to ${user.email}.` };
  }

  async confirm(token: string) {
    const pending = await this.prisma.pendingChange.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!pending || pending.expiresAt < new Date()) {
      throw new BadRequestException('This link is invalid or has expired. Please ask for a new one.');
    }

    if (pending.type === 'email') {
      // Someone could have taken the address in the meantime
      const taken = await this.prisma.user.findUnique({ where: { email: pending.newValue } });
      if (taken && taken.id !== pending.userId) throw new ConflictException('That email is already registered!');
      await this.prisma.user.update({ where: { id: pending.userId }, data: { email: pending.newValue } });
      await this.notifications.add(pending.userId, 'security', 'Email changed', `Your email is now ${pending.newValue}.`, '/profile');
    } else {
      await this.prisma.user.update({
        where: { id: pending.userId },
        // tokenVersion + 1 → every device gets logged out, including anyone who knew the old password
        data: { password: pending.newValue, tokenVersion: { increment: 1 } },
      });
      await this.notifications.add(pending.userId, 'security', 'Password changed', "All devices were logged out. If this wasn't you, change it again now.", '/profile');
    }

    // A link works once
    await this.prisma.pendingChange.deleteMany({ where: { userId: pending.userId, type: pending.type } });
    return { type: pending.type };
  }

  // Throws if the password is wrong. 403, not 401: the user IS logged in, they just typed it wrong
  private async checkPassword(userId: number, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(password, user.password))) {
      throw new ForbiddenException('Your current password is wrong.');
    }
    return user;
  }

  private async createPending(userId: number, type: 'email' | 'password', newValue: string) {
    const token = randomBytes(32).toString('base64url'); // 256 random bits: impossible to guess
    // Only the newest request counts
    await this.prisma.pendingChange.deleteMany({ where: { userId, type } });
    await this.prisma.pendingChange.create({
      data: { userId, type, newValue, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS) },
    });
    return token;
  }
}
