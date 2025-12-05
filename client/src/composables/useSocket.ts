import type { ClientToServerEvents, ServerToClientEvents, User } from 'server/types'
import { io, Socket } from 'socket.io-client'
import { computed, onUnmounted, ref } from 'vue'

const USER_ID_KEY = 'chat_user_id'

/**
 * Get stored user ID from localStorage
 */
function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY)
}

/**
 * Save user ID to localStorage
 */
function saveUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId)
}

/**
 * Composable for socket connection and authentication
 * Only handles connection and auth logic, not UI-related business logic
 */
export function useSocket() {
  const socket = ref<Socket<ServerToClientEvents, ClientToServerEvents>>(
    io({
      path: '/ws',
      transports: ['websocket'],
    }),
  )
  const currentUserId = ref<string | null>(null)
  const onlineUsers = ref<User[]>([])
  const currentUser = computed(() => {
    return onlineUsers.value.find((u) => u.id === currentUserId.value)
  })

  // Handle connection event and perform authentication
  socket.value.on('connect', () => {
    const storedId = getStoredUserId()
    socket.value.emit('auth', { id: storedId || undefined }, (user) => {
      currentUserId.value = user.id
      saveUserId(user.id)
    })
  })

  // Handle disconnect event
  socket.value.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  socket.value.on('onlineUsers', (data) => {
    onlineUsers.value = data.users
  })

  socket.value.on('userJoined', (data) => {
    const userExists = onlineUsers.value.some((u) => u.id === data.user.id)
    if (!userExists) {
      onlineUsers.value.push(data.user)
    }
  })

  socket.value.on('userLeft', (data) => {
    onlineUsers.value = onlineUsers.value.filter((u) => u.id !== data.userId)
  })

  socket.value.on('userUpdated', (data) => {
    const user = onlineUsers.value.find((u) => u.id === data.user.id)
    if (user) {
      user.username = data.user.username
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect()
    }
  })

  return {
    socket,
    currentUser,
    onlineUsers,
  }
}
