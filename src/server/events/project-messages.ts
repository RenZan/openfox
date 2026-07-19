import type { Message } from '../../shared/types.js'

export interface ProjectedMessagesResult {
  messages: Message[]
  totalMessageCount: number
  totalDisplayItemCount: number
  hiddenDisplayItemCount: number
}

interface DisplayItem {
  messageIds: string[]
}

function buildDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = []
  let currentGroup: string[] | null = null
  let lastCtxId: string | undefined

  for (const msg of messages) {
    if (msg.role === 'tool') continue

    if (msg.contextWindowId && lastCtxId && msg.contextWindowId !== lastCtxId) {
      if (currentGroup) {
        items.push({ messageIds: currentGroup })
        currentGroup = null
      }
      items.push({ messageIds: [] })
    }
    lastCtxId = msg.contextWindowId

    if (msg.subAgentId && msg.subAgentType) {
      if (currentGroup !== null) {
        currentGroup.push(msg.id)
      } else {
        currentGroup = [msg.id]
      }
    } else {
      if (currentGroup) {
        items.push({ messageIds: currentGroup })
        currentGroup = null
      }
      items.push({ messageIds: [msg.id] })
    }
  }

  if (currentGroup) {
    items.push({ messageIds: currentGroup })
  }

  return items
}

export function projectMessagesForDisplay(messages: Message[], maxVisibleItems: number): ProjectedMessagesResult {
  const totalMessageCount = messages.length
  const items = buildDisplayItems(messages)
  const totalDisplayItemCount = items.length

  if (maxVisibleItems <= 0 || maxVisibleItems >= items.length) {
    return {
      messages,
      totalMessageCount,
      totalDisplayItemCount,
      hiddenDisplayItemCount: 0,
    }
  }

  const selectedItems = items.slice(-maxVisibleItems)

  const selectedMsgIds = new Set<string>()
  for (const item of selectedItems) {
    for (const id of item.messageIds) {
      selectedMsgIds.add(id)
    }
  }

  const toolCallIdsBySource = new Map<string, string>()
  for (const msg of messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        toolCallIdsBySource.set(tc.id, msg.id)
      }
    }
  }

  const projectedMessages: Message[] = []
  for (const msg of messages) {
    if (msg.role === 'tool') {
      const parentId = toolCallIdsBySource.get(msg.toolCallId ?? '')
      if (parentId && selectedMsgIds.has(parentId)) {
        projectedMessages.push(msg)
      }
    } else if (selectedMsgIds.has(msg.id)) {
      projectedMessages.push(msg)
    }
  }

  return {
    messages: projectedMessages,
    totalMessageCount,
    totalDisplayItemCount,
    hiddenDisplayItemCount: totalDisplayItemCount - maxVisibleItems,
  }
}
