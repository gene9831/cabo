import type { ClientToServerEvents, ServerToClientEvents } from 'shared-types'
import { io, Socket } from 'socket.io-client'

/**
 * Create socket connection
 */
export function createSocket(): Socket<
  ServerToClientEvents,
  ClientToServerEvents
> {
  // Create socket connection without auth
  return io({
    path: '/ws',
    transports: ['websocket'],
  })
}
