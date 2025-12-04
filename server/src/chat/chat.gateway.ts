import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { WsAuthGuard } from 'src/guards';
import type { AuthedClientSocket, ClientSocket, ClientToServerEvents, ServerToClientEvents } from '../types';
import { ChatService } from './chat.service';
import { AuthDto, MessageDto, SetUsernameDto } from './dto';

type CallbackParam<T> = T extends (...args: [...infer Args, (res: infer R) => void]) => any ? R : void;

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => {
      return new WsException(errors.flatMap((error) => Object.values(error.constraints || {})).join(', '));
    },
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
  async handleAuth(
    @MessageBody() data: AuthDto,
    @ConnectedSocket() client: ClientSocket,
  ): Promise<CallbackParam<ClientToServerEvents['auth']>> {
    const id = data.id?.trim();
    const providedUsername = data.username?.trim();

    // Try to get existing user if id provided
    let user = id ? await this.chatService.getUser(id) : null;
    const isNewUser = !user;

    // Create new user if not found
    if (!user) {
      user = await this.chatService.createUser(providedUsername);
    }

    // Store user id in socket data
    client.data.userId = user.id;

    this.chatService.addUserConnection(user.id, client.id);

    // Send message history to the client
    const messages = await this.chatService.getMessages();
    client.emit(
      'allMessages',
      messages.map((message) => ({
        id: message.id.toString(),
        content: message.content,
        userId: message.userId,
        username: message.user.username,
        timestamp: message.updatedAt.getTime(),
      })),
    );

    const onlineUsers = await this.chatService.getOnlineUsers();
    client.emit('onlineUsers', { users: onlineUsers });
    client.broadcast.emit('userJoined', { user });

    this.logger.log(
      `User ${isNewUser ? 'registered' : 'logged in'}: socketId=${client.id}, id=${user.id}, username=${user.username}`,
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
  async handleMessage(
    @MessageBody() data: MessageDto,
    @ConnectedSocket() client: AuthedClientSocket,
  ): Promise<CallbackParam<ClientToServerEvents['message']>> {
    const user = await this.chatService.getUserOrThrow(client.data.userId);

    const message = await this.chatService.addMessage(user.id, data.content);

    this.server.emit('message', {
      id: message.id.toString(),
      content: message.content,
      userId: message.userId,
      username: message.user.username,
      timestamp: message.updatedAt.getTime(),
    });
  }

  /**
   * Handle setUsername event from client
   */
  @SubscribeMessage('setUsername')
  async handleSetUsername(
    @MessageBody() data: SetUsernameDto,
    @ConnectedSocket() client: AuthedClientSocket,
  ): Promise<CallbackParam<ClientToServerEvents['setUsername']>> {
    const user = await this.chatService.getUserOrThrow(client.data.userId);

    // Update username in service
    const updatedUser = await this.chatService.udpateUsername(user.id, data.username);

    // Notify other clients about the updated user
    this.server.emit('userUpdated', { user: updatedUser });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
    };
  }

  @SubscribeMessage('test')
  handleTest(@MessageBody() data: any): CallbackParam<ClientToServerEvents['test']> {
    // throw new WsException('Custom error in test');
    return data;
  }
}
