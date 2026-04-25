/**
 * History-Scan Injection Tests
 *
 * Tests for the new history-scan based mode reminder injection:
 * - Scans current context window events for existing auto-prompt messages
 * - No duplicate in same window
 * - Injects after compaction (new window)
 * - Injects on agent switch
 * - Queued messages with different agents work independently
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getEventStore } from '../events/store.js'
import { getCurrentContextWindowId } from '../events/index.js'
import type { AgentDefinition } from '../agents/types.js'
import { loadAllAgentsDefault } from '../agents/registry.js'

vi.mock('../events/store.js', () => ({
  getEventStore: vi.fn(),
}))

vi.mock('../events/index.js', () => ({
  getEventStore: vi.fn(() => (globalThis as any).__mockEventStore),
  getCurrentContextWindowId: vi.fn(() => (globalThis as any).__mockWindowId ?? 'window-1'),
}))

vi.mock('../agents/registry.js', () => ({
  loadAllAgentsDefault: vi.fn(),
  findAgentById: vi.fn((id: string, agents: AgentDefinition[]) => agents.find(a => a.metadata.id === id)),
}))

function createEventStore(events: any[] = []) {
  const _events: any[] = [...events]
  return {
    _events,
    append: vi.fn((_: string, event: any) => {
      _events.push(event)
      return { seq: _events.length }
    }),
    getEvents: vi.fn().mockReturnValue(_events),
    getLatestSnapshot: vi.fn().mockReturnValue(undefined),
    cleanupOldEvents: vi.fn(),
    getLatestSeq: vi.fn().mockReturnValue(0),
    deleteSession: vi.fn(),
  }
}

function createSessionManager(state: any) {
  return {
    requireSession: vi.fn(() => state['current']),
    getCurrentWindowMessages: vi.fn(() => state['current'].messages ?? []),
    getContextState: vi.fn(() => ({
      currentTokens: 0,
      maxTokens: 200000,
      compactionCount: 0,
      dangerZone: false,
      canCompact: false,
    })),
    setCurrentContextSize: vi.fn(),
    addTokensUsed: vi.fn(),
    compactContext: vi.fn(),
    getLspManager: vi.fn(() => ({ name: 'lsp' })),
    updateExecutionState: vi.fn(),
    addMessage: vi.fn(),
    addAssistantMessage: vi.fn(),
    updateMessage: vi.fn(),
    updateMessageStats: vi.fn(),
    drainAsapMessages: vi.fn(() => []),
  }
}

const plannerAgent: AgentDefinition = {
  metadata: { id: 'planner', name: 'Planner', description: '', allowedTools: [], subagent: false },
  prompt: '# Plan Mode\nPlan carefully',
}

const builderAgent: AgentDefinition = {
  metadata: { id: 'builder', name: 'Builder', description: '', allowedTools: [], subagent: false },
  prompt: '# Build Mode\nBuild carefully',
}

const allAgents = [plannerAgent, builderAgent]

// Import the history scan function under test
// We'll test it directly as a pure function
import { hasReminderInCurrentWindow } from './orchestrator.js'

describe('History-Scan Injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasReminderInCurrentWindow', () => {
    it('returns true when current window has matching agent reminder', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-1',
          },
        },
      ]

      const result = hasReminderInCurrentWindow(events, 'window-1', 'Plan Mode')
      expect(result).toBe(true)
    })

    it('returns false when current window has no reminder', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'user-1',
            role: 'user',
            content: 'Hello',
            contextWindowId: 'window-1',
          },
        },
      ]

      const result = hasReminderInCurrentWindow(events, 'window-1', 'Plan Mode')
      expect(result).toBe(false)
    })

    it('returns false when reminder is in a different window (compacted out)', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-0', // Old window
          },
        },
        {
          type: 'context.compacted',
          data: {
            newContextWindowId: 'window-1',
          },
        },
      ]

      const result = hasReminderInCurrentWindow(events, 'window-1', 'Plan Mode')
      expect(result).toBe(false)
    })

    it('returns false when reminder is for a different agent', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-1',
          },
        },
      ]

      // Looking for builder reminder, but only planner exists
      const result = hasReminderInCurrentWindow(events, 'window-1', 'Build Mode')
      expect(result).toBe(false)
    })

    it('returns false for events without contextWindowId when current window is set', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            // No contextWindowId - pre-dates windows
          },
        },
      ]

      // Events without contextWindowId belong to the initial window
      // If current window is 'window-1', they don't match
      const result = hasReminderInCurrentWindow(events, 'window-1', 'Plan Mode')
      expect(result).toBe(false)
    })

    it('returns true for events without contextWindowId when current window is undefined', () => {
      const events = [
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
          },
        },
      ]

      // No current window means we look at all events
      const result = hasReminderInCurrentWindow(events, undefined, 'Plan Mode')
      expect(result).toBe(true)
    })
  })

  describe('injectModeReminderIfNeeded with history scan', () => {
    function setupMockStore(events: any[] = []) {
      const store = createEventStore(events)
      ;(globalThis as any).__mockEventStore = store
      return store
    }

    afterEach(() => {
      delete (globalThis as any).__mockEventStore
      delete (globalThis as any).__mockWindowId
    })

    it('injects reminder when no existing reminder in window', async () => {
      setupMockStore([
        {
          type: 'message.start',
          data: {
            messageId: 'user-1',
            role: 'user',
            content: 'Do the plan',
            contextWindowId: 'window-1',
          },
        },
      ])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'plan',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [{ id: 'user-1', role: 'user', content: 'Do the plan' }],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')
      injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'planner', allAgents)

      const eventStore = (globalThis as any).__mockEventStore
      const reminderCall = eventStore.append.mock.calls.find(([, event]: any) =>
        event.type === 'message.start' &&
        event.data.messageKind === 'auto-prompt' &&
        event.data.content?.includes('<system-reminder>')
      )

      expect(reminderCall).toBeDefined()
      expect((reminderCall![1] as any).data.content).toContain('Plan Mode')
    })

    it('does NOT inject when reminder already exists in same window', async () => {
      setupMockStore([
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-1',
          },
        },
      ])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'plan',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')
      injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'planner', allAgents)

      const eventStore = (globalThis as any).__mockEventStore
      const reminderCalls = eventStore.append.mock.calls.filter(([, event]: any) =>
        event.type === 'message.start' &&
        event.data.messageKind === 'auto-prompt'
      )

      expect(reminderCalls).toHaveLength(0)
    })

    it('injects builder reminder when planner reminder exists (agent switch)', async () => {
      setupMockStore([
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-1',
          },
        },
      ])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'build',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')
      injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'builder', allAgents)

      const eventStore = (globalThis as any).__mockEventStore
      const reminderCall = eventStore.append.mock.calls.find(([, event]: any) =>
        event.type === 'message.start' &&
        event.data.messageKind === 'auto-prompt' &&
        event.data.content?.includes('Build Mode')
      )

      expect(reminderCall).toBeDefined()
    })

    it('injects after compaction (reminder in old window)', async () => {
      setupMockStore([
        {
          type: 'message.start',
          data: {
            messageId: 'reminder-1',
            role: 'user',
            messageKind: 'auto-prompt',
            content: '<system-reminder>\n# Plan Mode\nPlan carefully\n</system-reminder>',
            isSystemGenerated: true,
            contextWindowId: 'window-0',
          },
        },
        {
          type: 'context.compacted',
          data: {
            newContextWindowId: 'window-1',
          },
        },
      ])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)
      ;(globalThis as any).__mockWindowId = 'window-1'

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'plan',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')
      injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'planner', allAgents)

      const eventStore = (globalThis as any).__mockEventStore
      const reminderCall = eventStore.append.mock.calls.find(([, event]: any) =>
        event.type === 'message.start' &&
        event.data.messageKind === 'auto-prompt' &&
        event.data.content?.includes('Plan Mode')
      )

      expect(reminderCall).toBeDefined()
    })

    it('does NOT call updateExecutionState (no lastModeWithReminder tracking)', async () => {
      setupMockStore([])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'plan',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')
      injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'planner', allAgents)

      expect(sessionManager.updateExecutionState).not.toHaveBeenCalled()
    })

    it('no duplicate reminders across multiple turns in same window', async () => {
      setupMockStore([])
      vi.mocked(loadAllAgentsDefault).mockResolvedValue(allAgents)

      const state: any = {
        current: {
          id: 'session-1',
          phase: 'plan',
          isRunning: true,
          criteria: [],
          executionState: null,
          messages: [],
        },
      }
      const sessionManager = createSessionManager(state)

      const { injectModeReminderIfNeeded } = await import('./orchestrator.js')

      for (let i = 0; i < 4; i++) {
        injectModeReminderIfNeeded(sessionManager as any, 'session-1', 'planner', allAgents)
      }

      const eventStore = (globalThis as any).__mockEventStore
      const reminderCalls = eventStore.append.mock.calls.filter(([, event]: any) =>
        event.type === 'message.start' &&
        event.data.messageKind === 'auto-prompt' &&
        event.data.content?.includes('<system-reminder>')
      )

      expect(reminderCalls).toHaveLength(1)
    })
  })
})
