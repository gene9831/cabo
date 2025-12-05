<script setup lang="ts">
import type { ChatMessage } from 'server/types'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useSocket } from '../composables/useSocket'

// Use socket composable for connection and authentication
const { socket, currentUser, onlineUsers } = useSocket()

const messages = ref<ChatMessage[]>([])
const messageInput = ref('')
const usernameInput = ref('')
const isEditingUsername = ref(false)
const shouldSaveUsername = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const sittingUserIds = ref<string[]>([])

onMounted(() => {
  if (!socket.value) return

  // UI-related business logic event handlers
  socket.value.on('message', (message) => {
    messages.value.push(message)
  })

  socket.value.on('allMessages', (allMessages) => {
    messages.value = allMessages
    scrollToBottom('instant')
  })

  socket.value.on('userUpdated', (data) => {
    for (const message of messages.value) {
      if (message.userId === data.user.id) {
        message.username = data.user.username
      }
    }
  })

  socket.value.on('sittingUsers', (data) => {
    sittingUserIds.value = data.userIds
  })

  socket.value.on('exception', (error) => {
    console.error('Socket exception:', error)
  })
})

const sendMessage = () => {
  if (!socket.value || !messageInput.value.trim()) return
  socket.value.emit('message', { content: messageInput.value.trim() })
  messageInput.value = ''
}

// Get sitting users from onlineUsers
const sittingUsers = computed(() => {
  return onlineUsers.value.filter((user) => sittingUserIds.value.includes(user.id))
})

// Check if current user is sitting
const isCurrentUserSitting = computed(() => {
  if (!currentUser.value) return false
  return sittingUserIds.value.includes(currentUser.value.id)
})

// Check if can start game (2-4 sitting users)
const canStartGame = computed(() => {
  const count = sittingUsers.value.length
  return count >= 2 && count <= 4
})

// Handle sit/unsit
const handleSit = () => {
  if (!socket.value) return
  if (isCurrentUserSitting.value) {
    socket.value.emit('unsit', {}, (res) => {
      if (!res.success) {
        console.error('Failed to stand up')
      }
    })
  } else {
    socket.value.emit('sit', {}, (res) => {
      if (!res.success) {
        console.error('Failed to sit down')
      }
    })
  }
}

// Handle start game
const handleStartGame = () => {
  if (!socket.value || !canStartGame.value) return
  socket.value.emit('gameStart', {}, (res) => {
    if (!res.success) {
      console.error('Failed to start game')
    }
  })
}

const startEditingUsername = () => {
  if (!currentUser.value) return
  usernameInput.value = currentUser.value.username
  isEditingUsername.value = true
  shouldSaveUsername.value = false
}

const updateUsername = () => {
  const username = usernameInput.value.trim()
  if (!socket.value || !username) {
    isEditingUsername.value = false
    shouldSaveUsername.value = false
    return
  }
  socket.value.emit('setUsername', { username: username })
  isEditingUsername.value = false
  usernameInput.value = ''
  shouldSaveUsername.value = false
}

const cancelEditingUsername = () => {
  isEditingUsername.value = false
  usernameInput.value = ''
  shouldSaveUsername.value = false
}

const handleUsernameBlur = () => {
  if (shouldSaveUsername.value) {
    updateUsername()
  } else {
    cancelEditingUsername()
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const scrollToBottom = (scrollBehavior: 'smooth' | 'instant' = 'smooth') => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: scrollBehavior,
      })
    }
  })
}

watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)
</script>

<template>
  <div class="h-[calc(100vh-500px)] flex items-center justify-center">
    <div class="flex flex-col items-center gap-6">
      <!-- Sitting users display -->
      <div class="flex gap-4">
        <div
          v-for="user in sittingUsers"
          :key="user.id"
          class="px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-center min-w-[120px]"
        >
          <div class="font-semibold text-gray-800">{{ user.username }}</div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3 items-center">
        <button
          v-if="currentUser"
          :class="[
            'px-6 py-3 rounded-lg font-medium transition-colors shadow-sm',
            isCurrentUserSitting
              ? 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
              : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700',
          ]"
          @click="handleSit"
        >
          {{ isCurrentUserSitting ? 'Stand Up' : 'Sit Down' }}
        </button>
        <button
          :disabled="!canStartGame"
          :class="[
            'px-6 py-3 rounded-lg font-medium transition-colors shadow-sm',
            canStartGame
              ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed',
          ]"
          @click="handleStartGame"
        >
          Start Game
        </button>
      </div>
    </div>
  </div>

  <div class="fixed bottom-0 left-0 right-0 h-[500px] border-t border-gray-200 bg-white flex shadow-2xl">
    <div class="w-56 border-r border-gray-200 p-6 flex flex-col bg-gray-50">
      <div v-if="currentUser" class="flex-1">
        <div
          v-if="!isEditingUsername"
          class="cursor-pointer group transition-all duration-200"
          @click="startEditingUsername"
        >
          <div class="text-xs text-gray-400 mb-2 uppercase tracking-wide">Username</div>
          <div class="font-bold text-xl break-all text-gray-800 group-hover:text-blue-600 transition-colors mb-2">
            {{ currentUser.username }}
          </div>
          <div class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</div>
        </div>
        <div v-else class="flex flex-col gap-3">
          <div class="text-xs text-gray-400 uppercase tracking-wide">Edit Username</div>
          <input
            v-model="usernameInput"
            type="text"
            class="px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            autofocus
            @keyup.enter="updateUsername"
            @keyup.esc="cancelEditingUsername"
            @blur="handleUsernameBlur"
          />
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
              @mousedown="shouldSaveUsername = true"
              @click="updateUsername"
            >
              Save
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
              @click="cancelEditingUsername"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-gray-400 text-sm animate-pulse">Connecting...</div>
      </div>
      <div v-if="currentUser" class="text-xs text-gray-400 mt-auto pt-4">{{ onlineUsers.length }} online</div>
    </div>

    <div class="flex-1 flex flex-col bg-white">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 bg-white">
        <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
          <div class="text-gray-400 text-center">
            <div class="text-lg mb-2">💬</div>
            <div>No messages yet. Start chatting!</div>
          </div>
        </div>
        <div v-for="message in messages" :key="message.id" class="my-2">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="font-semibold text-sm text-gray-700">{{ message.username }}</span>
            <span class="text-xs text-gray-400">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="text-gray-800 text-sm">{{ message.content }}</div>
        </div>
      </div>

      <div class="p-3 flex gap-2 bg-white border-t border-gray-200">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Type a message..."
          class="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm"
          @keyup.enter="sendMessage"
        />
        <button
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md text-sm"
          @click="sendMessage"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>
