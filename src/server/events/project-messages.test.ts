import { describe, expect, it } from 'vitest'
import { projectMessagesForDisplay } from './project-messages.js'
import type { Message } from '../../shared/types.js'

function makeMessage(overrides: Partial<Message> & Pick<Message, 'id' | 'role'>): Message {
  return {
    content: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('projectMessagesForDisplay', () => {
  it('returns all messages when maxVisibleItems is larger than item count', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user' }),
      makeMessage({ id: 'm2', role: 'assistant' }),
      makeMessage({ id: 'm3', role: 'user' }),
    ]
    const result = projectMessagesForDisplay(messages, 100)
    expect(result.messages).toEqual(messages)
    expect(result.totalMessageCount).toBe(3)
    expect(result.hiddenDisplayItemCount).toBe(0)
  })

  it('returns all messages when maxVisibleItems is 0 or negative', () => {
    const messages: Message[] = [makeMessage({ id: 'm1', role: 'user' })]
    expect(projectMessagesForDisplay(messages, 0).messages).toEqual(messages)
    expect(projectMessagesForDisplay(messages, -1).messages).toEqual(messages)
  })

  it('projects only the last N items', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'old' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'middle' }),
      makeMessage({ id: 'm3', role: 'user', content: 'new' }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.id).toBe('m3')
    expect(result.totalMessageCount).toBe(3)
    expect(result.totalDisplayItemCount).toBe(3)
    expect(result.hiddenDisplayItemCount).toBe(2)
  })

  it('includes tool messages belonging to visible assistant messages', () => {
    const messages: Message[] = [
      makeMessage({ id: 'a1', role: 'assistant', toolCalls: [{ id: 'tc1', name: 'ls', arguments: {} }] }),
      makeMessage({ id: 't1', role: 'tool', toolCallId: 'tc1', content: 'file1\nfile2' }),
      makeMessage({ id: 'u2', role: 'user', content: 'new question' }),
      makeMessage({ id: 'a2', role: 'assistant', content: 'answer' }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.id).toBe('a2')
    expect(result.totalMessageCount).toBe(4)
    expect(result.totalDisplayItemCount).toBe(3)
    expect(result.hiddenDisplayItemCount).toBe(2)
  })

  it('groups sub-agent messages into a single display item', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'do it' }),
      makeMessage({ id: 'a1', role: 'assistant', content: 'step1', subAgentId: 'agent1', subAgentType: 'explorer' }),
      makeMessage({ id: 'a2', role: 'assistant', content: 'step2', subAgentId: 'agent1', subAgentType: 'explorer' }),
      makeMessage({ id: 'a3', role: 'assistant', content: 'done' }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.id).toBe('a3')
    expect(result.totalDisplayItemCount).toBe(3)
    expect(result.hiddenDisplayItemCount).toBe(2)
  })

  it('includes all sub-agent messages when group is visible', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'old' }),
      makeMessage({ id: 'm2', role: 'user', content: 'latest' }),
      makeMessage({ id: 'c1', role: 'assistant', content: 'r1', subAgentId: 'agent1', subAgentType: 'explorer' }),
      makeMessage({ id: 'c2', role: 'assistant', content: 'r2', subAgentId: 'agent1', subAgentType: 'explorer' }),
    ]
    const result = projectMessagesForDisplay(messages, 2)
    expect(result.messages).toHaveLength(3)
    expect(result.messages.map((m) => m.id)).toEqual(['m2', 'c1', 'c2'])
    expect(result.totalDisplayItemCount).toBe(3)
    expect(result.hiddenDisplayItemCount).toBe(1)
  })

  it('handles empty messages array', () => {
    const result = projectMessagesForDisplay([], 10)
    expect(result.messages).toEqual([])
    expect(result.totalMessageCount).toBe(0)
    expect(result.totalDisplayItemCount).toBe(0)
    expect(result.hiddenDisplayItemCount).toBe(0)
  })

  it('truncates long message content when projecting', () => {
    const longContent = 'A'.repeat(15_000)
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'first' }),
      makeMessage({ id: 'm2', role: 'user', content: longContent }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.id).toBe('m2')
    expect(result.messages[0]!.content.length).toBeLessThan(longContent.length)
    expect(result.messages[0]!.content).toContain('...')
  })

  it('does not truncate content when all items are visible', () => {
    const longContent = 'A'.repeat(15_000)
    const messages: Message[] = [makeMessage({ id: 'm1', role: 'user', content: longContent })]
    const result = projectMessagesForDisplay(messages, 5)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.content.length).toBe(longContent.length)
  })

  it('truncates tool call result output when projecting', () => {
    const longOutput = 'O'.repeat(8_000)
    const messages: Message[] = [
      makeMessage({ id: 'u1', role: 'user', content: 'first' }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        toolCalls: [
          {
            id: 'tc1',
            name: 'run_command',
            arguments: { command: 'echo hi' },
            result: { success: true, output: longOutput, durationMs: 10, truncated: false },
          },
        ],
      }),
      makeMessage({ id: 't1', role: 'tool', toolCallId: 'tc1', content: '' }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    const msg = result.messages.find((m) => m.id === 'a1')
    expect(msg).toBeDefined()
    expect(msg?.toolCalls?.[0]?.result?.output?.length).toBeLessThan(longOutput.length)
    expect(msg?.toolCalls?.[0]?.result?.output).toContain('...')
  })

  it('truncates tool call arguments when projecting', () => {
    const longArgs = { data: 'X'.repeat(3_000) }
    const messages: Message[] = [
      makeMessage({ id: 'u1', role: 'user', content: 'first' }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        toolCalls: [{ id: 'tc1', name: 'run_command', arguments: longArgs }],
      }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    const msg = result.messages.find((m) => m.id === 'a1')
    expect(msg).toBeDefined()
    expect(JSON.stringify(msg?.toolCalls?.[0]?.arguments).length).toBeLessThan(JSON.stringify(longArgs).length)
  })

  it('truncates tool result output even when tool call is on a different message', () => {
    const longOutput = 'R'.repeat(7_000)
    const messages: Message[] = [
      makeMessage({ id: 'u1', role: 'user', content: 'run test' }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        toolCalls: [
          {
            id: 'tc1',
            name: 'run_command',
            arguments: { command: 'test' },
            result: { success: true, output: longOutput, durationMs: 10, truncated: false },
          },
        ],
      }),
      makeMessage({ id: 't1', role: 'tool', toolCallId: 'tc1', content: '' }),
      makeMessage({ id: 'u2', role: 'user', content: 'done' }),
    ]
    const result = projectMessagesForDisplay(messages, 1)
    const remaining = result.messages.filter((m) => m.id !== 't1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.id).toBe('u2')
  })
})
