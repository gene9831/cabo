import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Message, User } from 'src/generated/prisma/client';
import { MessageService } from '../message/message.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Game, GamePhase } from '../types/game';
import { UserService } from '../user/user.service';

@Injectable()
export class WsService {
  // Map userId (UUID) to Set of socketIds (supports multiple connections per user)
  private userSockets: Map<string, Set<string>> = new Map();
  // Set of userIds who are currently sitting
  private sittingUsers: Set<string> = new Set();

  constructor(
    private readonly userService: UserService,
    private readonly messageService: MessageService,
    private readonly prisma: PrismaService,
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

  /**
   * Add a user to the sitting users set
   */
  sitUser(userId: string): void {
    this.sittingUsers.add(userId);
  }

  /**
   * Remove a user from the sitting users set
   */
  unsitUser(userId: string): void {
    this.sittingUsers.delete(userId);
  }

  /**
   * Check if a user is sitting
   */
  isUserSitting(userId: string): boolean {
    return this.sittingUsers.has(userId);
  }

  /**
   * Get all sitting user IDs
   */
  getSittingUserIds(): string[] {
    return Array.from(this.sittingUsers);
  }

  /**
   * Get the count of sitting users
   */
  getSittingUserCount(): number {
    return this.sittingUsers.size;
  }

  /**
   * Check if game can be started (requires 2-4 sitting users)
   */
  canStartGame(): boolean {
    const count = this.getSittingUserCount();
    return count >= 2 && count <= 4;
  }

  /**
   * Create a new game with the given user IDs
   * Initializes Game record with default values and creates Player records
   */
  async createGame(userIds: string[]) {
    const initialPhase: GamePhase = { type: 'SETUP' };

    // Create game with initial state
    const game = await this.prisma.game.create({
      data: {
        status: 'PLAYING',
        currentPlayerIndex: 0,
        round: 0,
        deck: [],
        discardPile: [],
        phase: initialPhase,
        scores: [],
        players: {
          create: userIds.map((userId) => ({
            userId: userId,
            hand: [],
            peekedAtSetup: false,
          })),
        },
      },
    });

    // Clear sitting users after game is created
    this.sittingUsers.clear();

    return game;
  }

  /**
   * Get the most recent unended game (status is 'PLAYING' or 'PAUSED')
   * Returns null if no active game exists
   */
  async getLatestActiveGame() {
    const game = await this.prisma.game.findFirst({
      where: {
        status: {
          in: ['PLAYING', 'PAUSED'],
        },
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!game) {
      return null;
    }

    // Transform Prisma game to Game interface format
    return {
      id: game.id,
      status: game.status as Game['status'],
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      playerIds: game.players.map((p) => p.userId),
      currentPlayerIndex: game.currentPlayerIndex,
      deck: game.deck as unknown as Game['deck'],
      discardPile: game.discardPile as unknown as Game['discardPile'],
      round: game.round,
      phase: game.phase as unknown as Game['phase'],
      scores: game.scores as unknown as Game['scores'],
    };
  }
}
