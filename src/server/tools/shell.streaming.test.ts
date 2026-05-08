import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { EventStore } from '../events/store.js'
import { createToolProgressHandler } from '../chat/tool-streaming.js'

describe('run_command output streaming', () => {
  let db: Database.Database
  let eventStore: EventStore
  const sessionId = 'test-session-streaming'

  beforeEach(() => {
    db = new Database(':memory:')
    eventStore = new EventStore(db)
  })

  afterEach(() => {
    db.close()
  })

  it('should stream output chunks as they arrive, not all at once', () => {
    const handler = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)

    handler('[stdout] first line\n')
    handler('[stdout] second line\n')
    handler('[stdout] third line\n')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(3)
    expect(events[0]!.type).toBe('tool.output')
    expect(events[0]!.data).toEqual({
      messageId: 'msg-1',
      toolCallId: 'call-1',
      stream: 'stdout',
      content: 'first line\n',
    })
    expect(events[1]!.data).toEqual({
      messageId: 'msg-1',
      toolCallId: 'call-1',
      stream: 'stdout',
      content: 'second line\n',
    })
    expect(events[2]!.data).toEqual({
      messageId: 'msg-1',
      toolCallId: 'call-1',
      stream: 'stdout',
      content: 'third line\n',
    })
  })

  it('should stream stdout and stderr separately in order', () => {
    const handler = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)

    handler('[stdout] stdout chunk 1\n')
    handler('[stderr] stderr chunk 1\n')
    handler('[stdout] stdout chunk 2\n')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(3)
    expect(events[0]!.data).toMatchObject({
      stream: 'stdout',
      content: 'stdout chunk 1\n',
    })
    expect(events[1]!.data).toMatchObject({
      stream: 'stderr',
      content: 'stderr chunk 1\n',
    })
    expect(events[2]!.data).toMatchObject({
      stream: 'stdout',
      content: 'stdout chunk 2\n',
    })
  })

  it('should preserve message ordering with sequence numbers', () => {
    const handler = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)

    handler('[stdout] chunk 1\n')
    handler('[stdout] chunk 2\n')
    handler('[stdout] chunk 3\n')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(3)
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3])
    expect((events[0]!.data as any).content).toBe('chunk 1\n')
    expect((events[1]!.data as any).content).toBe('chunk 2\n')
    expect((events[2]!.data as any).content).toBe('chunk 3\n')
  })

  it('should handle multiple tool calls with different callIds', () => {
    const handler1 = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)
    const handler2 = createToolProgressHandler(eventStore, 'msg-1', 'call-2', sessionId)

    handler1('[stdout] from call 1\n')
    handler2('[stdout] from call 2\n')
    handler1('[stdout] another from call 1\n')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(3)
    expect((events[0]!.data as any).toolCallId).toBe('call-1')
    expect((events[1]!.data as any).toolCallId).toBe('call-2')
    expect((events[2]!.data as any).toolCallId).toBe('call-1')
  })

  it('should ignore malformed progress messages', () => {
    const handler = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)

    handler('not a valid format')
    handler('[stdout] valid output\n')
    handler('[invalid] wrong prefix')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(1)
    expect((events[0]!.data as any).content).toBe('valid output\n')
  })

  it('should stream output before tool result in correct order', () => {
    const handler = createToolProgressHandler(eventStore, 'msg-1', 'call-1', sessionId)

    handler('[stdout] streaming output 1\n')
    handler('[stdout] streaming output 2\n')

    const events = eventStore.getEvents(sessionId)

    expect(events).toHaveLength(2)
    expect(events[0]!.type).toBe('tool.output')
    expect(events[1]!.type).toBe('tool.output')
    expect((events[0]!.data as any).content).toBe('streaming output 1\n')
    expect((events[1]!.data as any).content).toBe('streaming output 2\n')
  })
})
