import { Injectable } from '@nestjs/common';
import type { ChatMessage, User } from 'shared-types';

@Injectable()
export class ChatService {
  // In-memory storage for messages
  private messages: ChatMessage[] = [];

  // Map userId (UUID) to Set of socketIds (supports multiple connections per user)
  private userSockets: Map<string, Set<string>> = new Map();

  // Map userId (UUID) to User data
  private userData: Map<string, User> = new Map();

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
   * Add a user (UUID) with a socket connection
   */
  addUser(userId: string, socketId: string, user: User): void {
    // Add socketId to user's socket set
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    // Store or update user data
    this.userData.set(userId, user);
  }

  /**
   * Get user by UUID
   */
  getUser(userId: string): User | undefined {
    return this.userData.get(userId);
  }

  /**
   * Check if user exists by UUID
   */
  userExists(userId: string): boolean {
    return this.userData.has(userId);
  }

  /**
   * Get all socket IDs for a user UUID
   */
  getSocketIds(userId: string): Set<string> {
    return this.userSockets.get(userId) || new Set();
  }

  /**
   * Update user username by UUID
   */
  updateUserUsername(userId: string, username: string): void {
    const user = this.userData.get(userId);
    if (user) {
      const updatedUser: User = {
        ...user,
        username,
      };
      this.userData.set(userId, updatedUser);
    }
  }

  /**
   * Remove a socket connection from a user
   * If this is the last socket for the user, remove the user entirely
   */
  removeUserSocket(userId: string, socketId: string): void {
    const socketSet = this.userSockets.get(userId);
    if (socketSet) {
      socketSet.delete(socketId);
    }
  }

  /**
   * Get all online users (unique by UUID, not by socket)
   */
  getOnlineUsers(): User[] {
    return Array.from(this.userData.values());
  }

  /**
   * Get user count (unique users by UUID)
   */
  getUserCount(): number {
    return this.userData.size;
  }
}
