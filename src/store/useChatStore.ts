import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ChatStore {
  messages: ChatMessage[]
  isLoaded: boolean
  offset: number
  hasMore: boolean
  setMessages: (messages: ChatMessage[]) => void
  prependMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setLoaded: (loaded: boolean) => void
  setOffset: (offset: number) => void
  setHasMore: (hasMore: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoaded: false,
  offset: 0,
  hasMore: false,
  setMessages: (messages) => set({ messages }),
  prependMessages: (older) => set((state) => ({ messages: [...older, ...state.messages] })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setLoaded: (isLoaded) => set({ isLoaded }),
  setOffset: (offset) => set({ offset }),
  setHasMore: (hasMore) => set({ hasMore }),
}))
