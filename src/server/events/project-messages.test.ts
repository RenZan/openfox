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
})
