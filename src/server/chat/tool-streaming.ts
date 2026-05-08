/**
 * Tool streaming utilities
 *
 * Handles conversion of tool onProgress callbacks to tool.output events.
 * Used for streaming shell command output to the client in real-time.
 */

import type { EventStore } from '../events/store.js'

export interface ParsedProgress {
  stream: 'stdout' | 'stderr'
  content: string
}

/**
 * Parse a progress message from the shell tool.
 * Shell tool emits messages in format: "[stdout] content" or "[stderr] content"
 *
 * @returns Parsed progress or null if format doesn't match
 */
export function parseProgressMessage(message: string): ParsedProgress | null {
  const match = message.match(/^\[(stdout|stderr)\] (.*)$/s)
  if (!match) return null

  return {
    stream: match[1] as 'stdout' | 'stderr',
    content: match[2]!,
  }
}

/**
 * Create an onProgress handler that emits tool.output events to EventStore.
 *
 * @param eventStore - The EventStore instance to emit events to
 * @param messageId - The assistant message ID this tool call belongs to
 * @param callId - The tool call ID
 * @param sessionId - The session ID
 * @returns Progress handler function to pass to tool context
 */
export function createToolProgressHandler(
  eventStore: EventStore,
  messageId: string,
  callId: string,
  sessionId: string,
): (message: string) => void {
  return (message: string) => {
    const parsed = parseProgressMessage(message)
    if (!parsed) return

    eventStore.append(sessionId, {
      type: 'tool.output',
      data: { messageId, toolCallId: callId, stream: parsed.stream, content: parsed.content },
    })
  }
}
