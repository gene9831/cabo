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
import { AuthDto, MessageDto, SetUsernameDto } from './dto';
import { WsService } from './ws.service';

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
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(WsGateway.name);

  constructor(private readonly wsService: WsService) {}

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

    this.wsService.removeUserConnection(userId, socketId);

    // Remove socket connection from user
    const socketIds = this.wsService.getSocketIds(userId);

    // If user was sitting and has no more connections, remove from sitting users
    if (socketIds.size === 0) {
      if (this.wsService.isUserSitting(userId)) {
        this.wsService.unsitUser(userId);
        this.server.emit('sittingUsers', { userIds: this.wsService.getSittingUserIds() });
      }
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
    let user = id ? await this.wsService.getUser(id) : null;
    const isNewUser = !user;

    // Create new user if not found
    if (!user) {
      user = await this.wsService.createUser(providedUsername);
    }

    // Store user id in socket data
    client.data.userId = user.id;

    this.wsService.addUserConnection(user.id, client.id);

    // Send message history to the client
    const messages = await this.wsService.getMessages();
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

    const onlineUsers = await this.wsService.getOnlineUsers();
    client.emit('onlineUsers', { users: onlineUsers });
    client.broadcast.emit('userJoined', { user });

    // Send latest active game data if exists
    const activeGame = await this.wsService.getLatestActiveGame();
    if (activeGame) {
      client.emit('gameData', { game: activeGame });
    }

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
    const user = await this.wsService.getUserOrThrow(client.data.userId);

    const message = await this.wsService.addMessage(user.id, data.content);

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
    const user = await this.wsService.getUserOrThrow(client.data.userId);

    // Update username in service
    const updatedUser = await this.wsService.udpateUsername(user.id, data.username);

    // Notify other clients about the updated user
    this.server.emit('userUpdated', { user: updatedUser });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
    };
  }

  /**
   * Handle sit event from client
   */
  @SubscribeMessage('sit')
  async handleSit(@ConnectedSocket() client: AuthedClientSocket): Promise<CallbackParam<ClientToServerEvents['sit']>> {
    const user = await this.wsService.getUserOrThrow(client.data.userId);

    // Check if user is already sitting
    if (this.wsService.isUserSitting(user.id)) {
      throw new WsException('User is already sitting');
    }

    // Add user to sitting users
    this.wsService.sitUser(user.id);

    // Broadcast to all clients
    this.server.emit('sittingUsers', { userIds: this.wsService.getSittingUserIds() });

    this.logger.log(`User sat down: userId=${user.id}, username=${user.username}`);

    return { success: true };
  }

  /**
   * Handle unsit event from client
   */
  @SubscribeMessage('unsit')
  async handleUnsit(
    @ConnectedSocket() client: AuthedClientSocket,
  ): Promise<CallbackParam<ClientToServerEvents['unsit']>> {
    const user = await this.wsService.getUserOrThrow(client.data.userId);

    // Check if user is sitting
    if (!this.wsService.isUserSitting(user.id)) {
      throw new WsException('User is not sitting');
    }

    // Remove user from sitting users
    this.wsService.unsitUser(user.id);

    // Broadcast to all clients
    this.server.emit('sittingUsers', { userIds: this.wsService.getSittingUserIds() });

    this.logger.log(`User stood up: userId=${user.id}, username=${user.username}`);

    return { success: true };
  }

  /**
   * Handle gameStart event from client
   */
  @SubscribeMessage('gameStart')
  async handleGameStart(
    @ConnectedSocket() client: AuthedClientSocket,
  ): Promise<CallbackParam<ClientToServerEvents['gameStart']>> {
    const user = await this.wsService.getUserOrThrow(client.data.userId);

    if (!this.wsService.isUserSitting(user.id)) {
      throw new WsException('User is not sitting');
    }

    // Verify that 2-4 users are sitting
    if (!this.wsService.canStartGame()) {
      throw new WsException('Game can only be started with 2-4 sitting users');
    }

    // Get sitting user IDs
    const sittingUserIds = this.wsService.getSittingUserIds();

    // Create game
    const game = await this.wsService.createGame(sittingUserIds);
    // Extract gameId with proper type (Prisma returns string for id)
    const gameId = game.id;

    this.logger.log(`Game started: gameId=${gameId}, players=${sittingUserIds.length}`);

    return { success: true, gameId };
  }

  @SubscribeMessage('test')
  handleTest(@MessageBody() data: any): CallbackParam<ClientToServerEvents['test']> {
    // throw new WsException('Custom error in test');
    return data;
  }
}
