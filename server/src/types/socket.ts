import { DefaultEventsMap, Socket } from 'socket.io';
import type { ChatMessage, User } from './data';
import type { AuthDto, MessageDto, SetUsernameDto } from './dto';

// Client to Server Events
export interface ClientToServerEvents {
  // Auth with existing id, or auto-register if id not provided
  auth: (data: AuthDto, callback?: (user: User) => void) => void;
  // Send a chat message
  message: (data: MessageDto) => void;
  // Set username for the user
  setUsername: (data: SetUsernameDto, callback?: (user: User) => void) => void;

  test: (data: any, callback?: (res: any) => void) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  exception: (error: unknown) => void;
  // Receive a chat message
  message: (data: ChatMessage) => void;
  // Receive all chat messages
  allMessages: (data: ChatMessage[]) => void;
  // User joined notification
  userJoined: (data: { user: User }) => void;
  // User left notification
  userLeft: (data: { userId: string }) => void;
  // User updated notification
  userUpdated: (data: { user: User }) => void;
  // Online users list
  onlineUsers: (data: { users: User[] }) => void;
}

// Socket data (for storing user info in socket)
export interface SocketData {
  userId?: string; // Optional, set after login (only stores id, username from userData)
}

export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

export type AuthedClientSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  Omit<SocketData, 'userId'> & { userId: string }
>;
