import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  User,
} from 'shared-types';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

type Client = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

type AuthedClient = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData & { userId: string }
>;

@WebSocketGateway({ path: '/ws' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(private readonly chatService: ChatService) {}

  /**
   * Check if socket is authenticated
   */
  private isAuthenticated(client: Client): client is AuthedClient {
    return Boolean(client.data.userId);
  }

  /**
   * Handle client connection
   */
  handleConnection(client: Client) {
    const socketId = client.id;
    // Initialize socket data without user (will be set after register/login)
    client.data = {};

    console.log(
      `${new Date().toLocaleString()} Client connected: socketId=${socketId} (awaiting authentication)`,
    );
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Client) {
    const socketId = client.id;

    if (!this.isAuthenticated(client)) {
      console.log(
        `${new Date().toLocaleString()} Client disconnected: socketId=${socketId} (not authenticated)`,
      );
      return;
    }

    const userId = client.data.userId;

    this.chatService.removeUserSocket(userId, socketId);

    // Remove socket connection from user
    const socketIds = this.chatService.getSocketIds(userId);

    // Notify other clients only if no more connections for the user
    if (socketIds.size === 0) {
      this.server.emit('userLeft', { userId });
    }

    console.log(
      `${new Date().toLocaleString()} Client disconnected: socketId=${socketId}, userId=${userId}`,
    );
  }

  /**
   * Handle login event from client
   * If id is provided and user exists, login
   * Otherwise, auto-register a new user
   */
  @SubscribeMessage('login')
  handleLogin(
    client: Client,
    data: { id?: string; username?: string },
    callback: (response: User | { error: string }) => void,
  ) {
    // Check if already authenticated
    if (this.isAuthenticated(client)) {
      callback({ error: 'Already authenticated' });
      return;
    }

    const id = data.id?.trim();
    const providedUsername = data.username?.trim();

    // Try to get existing user if id provided
    let user = id ? this.chatService.getUser(id) : undefined;
    const isNewUser = !user;

    // Create new user if not found
    if (!user) {
      const userId = randomUUID();
      const username = providedUsername || `Guest-${userId.slice(0, 6)}`;
      user = {
        id: userId,
        username,
      };
    }

    // Store user id in socket data
    client.data.userId = user.id;

    const socketId = client.id;

    // Add user to service
    this.chatService.addUser(user.id, socketId, user);

    // Send message history to the client
    const messages = this.chatService.getMessages();
    messages.forEach((msg) => {
      client.emit('message', msg);
    });

    // Send online users list to the client
    const onlineUsers = this.chatService.getOnlineUsers();
    client.emit('onlineUsers', { users: onlineUsers });

    client.broadcast.emit('userJoined', { user });

    console.log(
      `${new Date().toLocaleString()} User ${isNewUser ? 'registered' : 'logged in'}: socketId=${socketId}, id=${user.id}, username=${user.username}`,
    );

    // Return response via callback
    callback({
      id: user.id,
      username: user.username,
    });
  }

  /**
   * Handle message event from client
   */
  @SubscribeMessage('message')
  handleMessage(client: Client, data: { content: string }) {
    // Check authentication
    if (!this.isAuthenticated(client)) {
      console.warn(
        `${new Date().toLocaleString()} Unauthenticated message attempt from socketId=${client.id}`,
      );
      return;
    }

    const userId = client.data.userId;
    const user = this.chatService.getUser(userId);
    if (!user) {
      console.warn(
        `${new Date().toLocaleString()} User not found for userId=${userId}`,
      );
      return;
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${client.id}`,
      content: data.content,
      userId: user.id,
      username: user.username,
      timestamp: Date.now(),
    };

    // Save message to service
    this.chatService.addMessage(message);

    // Broadcast message to all clients
    this.server.emit('message', message);
  }

  /**
   * Handle setUsername event from client
   */
  @SubscribeMessage('setUsername')
  handleSetUsername(client: Client, data: { username: string }) {
    // Check authentication
    if (!this.isAuthenticated(client)) {
      console.warn(
        `${new Date().toLocaleString()} Unauthenticated setUsername attempt from socketId=${client.id}`,
      );
      return;
    }

    const userId = client.data.userId;

    // Update username in service
    this.chatService.updateUserUsername(userId, data.username);

    // Broadcast updated online users list
    const onlineUsers = this.chatService.getOnlineUsers();
    this.server.emit('onlineUsers', { users: onlineUsers });
  }

  /**
   * Handle join event from client
   */
  @SubscribeMessage('join')
  handleJoin(client: Client) {
    // Check authentication
    if (!this.isAuthenticated(client)) {
      console.warn(
        `${new Date().toLocaleString()} Unauthenticated join attempt from socketId=${client.id}`,
      );
      return;
    }

    // Send current state to the client
    const messages = this.chatService.getMessages();
    messages.forEach((msg) => {
      client.emit('message', msg);
    });

    const onlineUsers = this.chatService.getOnlineUsers();
    client.emit('onlineUsers', { users: onlineUsers });
  }
}
