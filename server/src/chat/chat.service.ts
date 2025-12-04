import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { MessageService } from '../message/message.service';
import { UserService } from '../user/user.service';
import { Message, User } from 'src/generated/prisma/client';

@Injectable()
export class ChatService {
  // Map userId (UUID) to Set of socketIds (supports multiple connections per user)
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly userService: UserService,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Add a socket connection for a user
   */
  addUserConnection(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Remove a socket connection from a user
   * If this is the last socket for the user, remove the user entirely
   */
  removeUserConnection(userId: string, socketId: string): void {
    const socketSet = this.userSockets.get(userId);
    if (socketSet) {
      socketSet.delete(socketId);
      if (socketSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  getUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get all socket IDs for a user UUID
   */
  getSocketIds(userId: string): Set<string> {
    return this.userSockets.get(userId) || new Set();
  }

  getUser(userId: string) {
    return this.userService.user({ id: userId });
  }

  async getUserOrThrow(userId: string) {
    const user = await this.getUser(userId);
    if (!user) {
      throw new WsException('User not found');
    }
    return user;
  }

  getOnlineUsers() {
    const onlineUserIds = this.getUserIds();
    return this.userService.users({ where: { id: { in: onlineUserIds } } });
  }

  createUser(username?: string) {
    const userId = randomUUID();
    const name = username || `Guest-${userId.slice(0, 6)}`;
    return this.userService.createUser({ id: userId, username: name });
  }

  udpateUsername(userId: string, username: string) {
    return this.userService.updateUser({
      where: { id: userId },
      data: { username: username },
    });
  }

  /**
   * Add a new message to the chat
   */
  addMessage(userId: string, content: string) {
    return this.messageService.createMessage(
      {
        content: content,
        user: { connect: { id: userId } },
      },
      { user: true },
    ) as Promise<Message & { user: User }>;
  }

  /**
   * Get all messages
   */
  getMessages() {
    return this.messageService.messages({
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: true,
      },
    }) as Promise<(Message & { user: User })[]>;
  }
}
