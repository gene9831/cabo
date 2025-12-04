import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { WsAuthGuard } from 'src/guards';
import type {
  AuthedClientSocket,
  ChatMessage,
  ClientSocket,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types';
import { ChatService } from './chat.service';
import { AuthDto, MessageDto, SetUsernameDto } from './dto';

type CallbackParam<T> = T extends (...args: [...infer Args, (res: infer R) => void]) => any ? R : void;

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
)
@UseGuards(WsAuthGuard)
@WebSocketGateway({ path: '/ws', transports: ['websocket'] })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Handle client connection
   */
  handleConnection(client: ClientSocket) {
    const socketId = client.id;
    // Initialize socket data without user (will be set after register/login)
    client.data = {};

    this.logger.log(`Client connected: socketId=${socketId} (awaiting authentication)`);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: ClientSocket) {
    const socketId = client.id;

    const userId = client.data.userId;

    if (!userId) {
      return;
    }

    this.chatService.removeUserConnection(userId, socketId);

    // Remove socket connection from user
    const socketIds = this.chatService.getSocketIds(userId);

    // Notify other clients only if no more connections for the user
    if (socketIds.size === 0) {
      this.server.emit('userLeft', { userId });
    }

    this.logger.log(`Client disconnected: socketId=${socketId}, userId=${userId}`);
  }

  /**
   * Handle auth event from client
   * If id is provided and user exists, login
   * Otherwise, auto-register a new user
   */
  @SubscribeMessage('auth')
  handleAuth(
    @MessageBody() authDto: AuthDto,
    @ConnectedSocket() client: ClientSocket,
  ): CallbackParam<ClientToServerEvents['auth']> {
    const id = authDto.id?.trim();
    const providedUsername = authDto.username?.trim();

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

    if (isNewUser) {
      this.chatService.addUser(user.id, user);
    } else {
      this.chatService.updateUserUsername(user.id, user.username);
    }
    this.chatService.addUserConnection(user.id, client.id);

    // Send message history to the client
    const messages = this.chatService.getMessages();
    client.emit('message', messages);

    // Send online users list to the client
    const onlineUsers = this.chatService.getOnlineUsers();
    client.emit('onlineUsers', { users: onlineUsers });

    client.broadcast.emit('userJoined', { user });

    this.logger.log(
      `User ${isNewUser ? 'registered' : 'logged in'}: socketId=${socketId}, id=${user.id}, username=${user.username}`,
    );

    return {
      id: user.id,
      username: user.username,
    };
  }

  /**
   * Handle message event from client
   */
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() messageDto: MessageDto,
    @ConnectedSocket() client: AuthedClientSocket,
  ): CallbackParam<ClientToServerEvents['message']> {
    const userId = client.data.userId;
    const user = this.chatService.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${client.id}`,
      content: messageDto.content,
      userId: user.id,
      username: user.username,
      timestamp: Date.now(),
    };

    // Save message to service
    this.chatService.addMessage(message);

    // Broadcast message to all clients
    this.server.emit('message', [message]);
  }

  /**
   * Handle setUsername event from client
   */
  @SubscribeMessage('setUsername')
  handleSetUsername(
    @MessageBody() data: SetUsernameDto,
    @ConnectedSocket() client: AuthedClientSocket,
  ): CallbackParam<ClientToServerEvents['setUsername']> {
    const userId = client.data.userId;

    // Update username in service
    this.chatService.updateUserUsername(userId, data.username);

    // Broadcast updated online users list
    const onlineUsers = this.chatService.getOnlineUsers();
    this.server.emit('onlineUsers', { users: onlineUsers });

    return {
      id: userId,
      username: data.username,
    };
  }

  @SubscribeMessage('test')
  handleTest(@MessageBody() data: any): CallbackParam<ClientToServerEvents['test']> {
    return data;
  }
}
