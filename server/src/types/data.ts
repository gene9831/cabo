export interface User {
  id: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  username: string;
  timestamp: number;
}
