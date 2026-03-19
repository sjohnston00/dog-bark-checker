import type { EventEmitter } from 'events'

export interface StreamSession {
  id: string
  emitter: EventEmitter
  stop: () => void
}

// Module-level singleton — persists for the lifetime of the server process
export const sessions = new Map<string, StreamSession>()
