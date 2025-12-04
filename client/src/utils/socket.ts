import type { ClientToServerEvents, ServerToClientEvents } from 'server/types'
import { io, Socket } from 'socket.io-client'

/**
 * Create socket connection
 */
export function createSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  // Create socket connection without auth
  return io({
    path: '/ws',
    transports: ['websocket'],
  })
}
