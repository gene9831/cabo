// User information
export interface User {
  id: string
  username: string
}

// Chat message structure
export interface ChatMessage {
  id: string
  content: string
  userId: string
  username?: string
  timestamp: number
}

// Client to Server Events
export interface ClientToServerEvents {
  // Login with existing id, or auto-register if id not provided
  login: (data: { id?: string; username?: string }, callback: (response: User | { error: string }) => void) => void
  // Send a chat message
  message: (data: { content: string }) => void
  // Set username for the user
  setUsername: (data: { username: string }) => void
  // Join the chat room
  join: () => void
}

// Server to Client Events
export interface ServerToClientEvents {
  // Receive a chat message
  message: (data: ChatMessage) => void
  // User joined notification
  userJoined: (data: { user: User }) => void
  // User left notification
  userLeft: (data: { userId: string }) => void
  // Online users list
  onlineUsers: (data: { users: User[] }) => void
}

// Socket data (for storing user info in socket)
export interface SocketData {
  userId?: string // Optional, set after login (only stores id, username from userData)
}
