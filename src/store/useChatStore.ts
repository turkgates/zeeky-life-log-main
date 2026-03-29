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
  scrollPosition: number
  setMessages: (messages: ChatMessage[]) => void
  prependMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setLoaded: (loaded: boolean) => void
  setOffset: (offset: number) => void
  setHasMore: (hasMore: boolean) => void
  setScrollPosition: (pos: number) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoaded: false,
  offset: 0,
  hasMore: false,
  scrollPosition: 0,
  setMessages: (messages) => set({ messages }),
  prependMessages: (older) => set((state) => ({ messages: [...older, ...state.messages] })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setLoaded: (isLoaded) => set({ isLoaded }),
  setOffset: (offset) => set({ offset }),
  setHasMore: (hasMore) => set({ hasMore }),
  setScrollPosition: (scrollPosition) => set({ scrollPosition }),
  clearMessages: () => set({ messages: [], isLoaded: false }),
}))
