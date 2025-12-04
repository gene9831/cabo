import { Injectable } from '@nestjs/common';
import type { ChatMessage } from '../types';
import { UserService } from '../user/user.service';

@Injectable()
export class ChatService {
  // In-memory storage for messages
  private messages: ChatMessage[] = [];

  // Map userId (UUID) to Set of socketIds (supports multiple connections per user)
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly userService: UserService) {}

  /**
   * Add a new message to the chat
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);
  }

  /**
   * Get all messages
   */
  getMessages(): ChatMessage[] {
    return this.messages;
  }

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

  getOnlineUsers() {
    const onlineUserIds = this.getUserIds();
    return this.userService.users({ where: { id: { in: onlineUserIds } } });
  }
}
