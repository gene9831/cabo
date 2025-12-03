<script setup lang="ts">
import type { ChatMessage, ClientToServerEvents, ServerToClientEvents, User } from 'shared-types'
import { Socket } from 'socket.io-client'
import { onMounted, onUnmounted, ref } from 'vue'
import { createSocket } from '../utils/socket'

const socket = ref<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
const messages = ref<ChatMessage[]>([])
const messageInput = ref('')
const usernameInput = ref('')
const onlineUsers = ref<User[]>([])
const currentUser = ref<User | null>(null)

// LocalStorage key for user id
const USER_ID_KEY = 'chat_user_id'

function getStoredUserId() {
  return localStorage.getItem(USER_ID_KEY)
}

function saveUserId(userId: string) {
  localStorage.setItem(USER_ID_KEY, userId)
}

// Initialize socket connection
onMounted(() => {
  socket.value = createSocket()

  // Listen for connection and handle authentication
  socket.value.on('connect', () => {
    if (!socket.value) return

    console.log('Socket connected, starting authentication...')

    // Get stored user id from localStorage
    const storedId = getStoredUserId()

    // Execute login (will auto-register if id not provided or user not found)
    socket.value.emit('login', { id: storedId || undefined }, (response: User | { error: string }) => {
      if ('error' in response) {
        console.error('Login failed:', response.error)
        // Clear invalid stored id
        if (storedId) {
          localStorage.removeItem('chat_user_id')
        }
        return
      }

      currentUser.value = response
      // Save user id to localStorage
      saveUserId(response.id)

      console.log(`Authentication successful: id=${response.id}, username=${response.username}`)
    })
  })

  // Listen for disconnection
  socket.value.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  // Listen for messages
  socket.value.on('message', (message) => {
    messages.value.push(message)
  })

  // Listen for online users updates
  socket.value.on('onlineUsers', (data) => {
    onlineUsers.value = data.users
  })

  // Listen for user joined
  socket.value.on('userJoined', (data) => {
    // Update online users if needed
    const userExists = onlineUsers.value.some((u) => u.id === data.user.id)
    if (!userExists) {
      onlineUsers.value.push(data.user)
    }
  })

  // Listen for user left
  socket.value.on('userLeft', (data) => {
    // Remove user from online users list
    onlineUsers.value = onlineUsers.value.filter((u) => u.id !== data.userId)
  })
})

// Cleanup on unmount
onUnmounted(() => {
  if (socket.value) {
    socket.value.disconnect()
  }
})

// Send message
const sendMessage = () => {
  if (!socket.value || !messageInput.value.trim()) return

  socket.value.emit('message', { content: messageInput.value.trim() })
  messageInput.value = ''
}

// Update username
const updateUsername = () => {
  if (!socket.value || !usernameInput.value.trim()) return

  socket.value.emit('setUsername', { username: usernameInput.value.trim() })
  usernameInput.value = ''
}

// Format timestamp
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<template>
  <div class="flex flex-col h-screen max-w-4xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Chat</h1>

    <!-- Current user info -->
    <div v-if="currentUser" class="mb-4 p-2 border rounded bg-blue-50">
      <p class="text-sm">
        Logged in as:
        <span class="font-semibold">{{ currentUser.username }}</span>
      </p>
    </div>

    <!-- Username update -->
    <div v-if="currentUser" class="mb-4 p-4 border rounded">
      <label class="block mb-2 text-sm">Update username (optional):</label>
      <div class="flex gap-2">
        <input
          v-model="usernameInput"
          type="text"
          placeholder="Enter new username"
          class="flex-1 px-3 py-2 border rounded"
          @keyup.enter="updateUsername"
        />
        <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" @click="updateUsername">
          Update
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div class="flex-1 overflow-y-auto border rounded p-4 mb-4 bg-gray-50">
      <div v-if="messages.length === 0" class="text-gray-500 text-center">No messages yet. Start chatting!</div>
      <div v-for="message in messages" :key="message.id" class="mb-3 p-2 bg-white rounded shadow-sm">
        <div class="flex justify-between items-start mb-1">
          <span class="font-semibold text-sm">
            {{ message.username || `User ${message.userId.slice(0, 6)}` }}
          </span>
          <span class="text-xs text-gray-500">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="text-gray-800">{{ message.content }}</div>
      </div>
    </div>

    <!-- Message input -->
    <div class="flex gap-2">
      <input
        v-model="messageInput"
        type="text"
        placeholder="Type a message..."
        class="flex-1 px-3 py-2 border rounded"
        @keyup.enter="sendMessage"
      />
      <button class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" @click="sendMessage">Send</button>
    </div>

    <!-- Online users count -->
    <div class="mt-2 text-sm text-gray-500">Online: {{ onlineUsers.length }}</div>
  </div>
</template>
