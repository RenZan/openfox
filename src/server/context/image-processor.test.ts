import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processContextImages, clearImageDescriptionCache } from './image-processor.js'
import type { StoredEvent, TurnEvent } from '../events/types.js'
import type { Attachment } from '../../shared/types.js'

vi.mock('../llm/vision-fallback.js', () => ({
  describeImageFromDataUrl: vi.fn().mockImplementation(async (dataUrl: string) => {
    if (dataUrl.includes('error')) throw new Error('API error')
    return 'A screenshot showing a terminal with error messages'
  }),
  VisionModelConfig: {},
}))

function makeEvent(
  overrides: Partial<StoredEvent> & { type: StoredEvent['type']; data: StoredEvent['data'] },
): StoredEvent {
  return {
    seq: 1,
    timestamp: Date.now(),
    sessionId: 'test-session',
    ...overrides,
  } as StoredEvent
}

const imageAttachment: Attachment = {
  id: 'att-1',
  filename: 'screenshot.png',
  mimeType: 'image/png',
  size: 1024,
  data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
}

const imageAttachment2: Attachment = {
  id: 'att-2',
  filename: 'diagram.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
}

describe('processContextImages', () => {
  beforeEach(() => {
    clearImageDescriptionCache()
    vi.clearAllMocks()
  })

  it('returns events as-is when model supports vision', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const result = await processContextImages(events, { modelSupportsVision: true })

    expect(result.events).toEqual(events)
    expect(result.descriptions.size).toBe(0)
  })

  it('replaces images with placeholder when no vision model configured', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const result = await processContextImages(events, { modelSupportsVision: false })

    expect(result.events).not.toEqual(events)
    const msgStart = result.events[0]!
    expect(msgStart.type).toBe('message.start')
    const data = msgStart.data as Extract<TurnEvent, { type: 'message.start' }>['data']
    expect(data.attachments).toBeUndefined()
    expect(data.content).toContain('[Image: screenshot.png]')
    expect(result.descriptions.size).toBe(1)
  })

  it('describes images via vision model when configured', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const { describeImageFromDataUrl } = await import('../llm/vision-fallback.js')

    const result = await processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    expect(describeImageFromDataUrl).toHaveBeenCalledWith(
      imageAttachment.data,
      { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
      expect.objectContaining({ context: 'File: screenshot.png' }),
    )

    const msgStart = result.events[0]!
    expect(msgStart.type).toBe('message.start')
    const data = msgStart.data as Extract<TurnEvent, { type: 'message.start' }>['data']
    expect(data.attachments).toBeUndefined()
    expect(data.content).toContain(
      '[Image: screenshot.png - description: A screenshot showing a terminal with error messages]',
    )
    expect(result.descriptions.get('att-1')).toBe('A screenshot showing a terminal with error messages')
  })

  it('caches descriptions by content hash across multiple calls', async () => {
    const { describeImageFromDataUrl } = await import('../llm/vision-fallback.js')

    const events1: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    await processContextImages(events1, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    expect(describeImageFromDataUrl).toHaveBeenCalledTimes(1)

    const events2: StoredEvent[] = [
      makeEvent({
        seq: 3,
        type: 'message.start',
        data: {
          messageId: 'msg-2',
          role: 'user',
          content: 'Again?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 4, type: 'message.done', data: { messageId: 'msg-2' } }),
    ]

    await processContextImages(events2, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    expect(describeImageFromDataUrl).toHaveBeenCalledTimes(1)
  })

  it('handles tool result images from read_file', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: { messageId: 'msg-1', role: 'assistant', contextWindowId: 'window-1' },
      }),
      makeEvent({
        seq: 2,
        type: 'tool.call',
        data: {
          messageId: 'msg-1',
          toolCall: { id: 'call-1', name: 'read_file', arguments: { path: '/test/image.png' } },
        },
      }),
      makeEvent({
        seq: 3,
        type: 'tool.result',
        data: {
          messageId: 'msg-1',
          toolCallId: 'call-1',
          result: {
            success: true,
            output: '[Image: /test/image.png (image/png, 1024 bytes)]',
            durationMs: 10,
            truncated: false,
            metadata: {
              mimeType: 'image/png',
              size: 1024,
              base64Data:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              dataUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              path: '/test/image.png',
            },
          },
        },
      }),
      makeEvent({ seq: 4, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const result = await processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    const toolResult = result.events[2]!
    expect(toolResult.type).toBe('tool.result')
    const trData = toolResult.data as Extract<TurnEvent, { type: 'tool.result' }>['data']
    expect(trData.result.output).toContain(
      '[Image: /test/image.png - description: A screenshot showing a terminal with error messages]',
    )
    expect(trData.result.metadata).toBeUndefined()
  })

  it('handles multiple images in a single message', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'Compare these',
          attachments: [imageAttachment, imageAttachment2],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const result = await processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    const msgStart = result.events[0]!
    const data = msgStart.data as Extract<TurnEvent, { type: 'message.start' }>['data']
    expect(data.attachments).toBeUndefined()
    expect(data.content).toContain('[Image: screenshot.png - description:')
    expect(data.content).toContain('[Image: diagram.jpg - description:')
    expect(result.descriptions.size).toBe(2)
  })

  it('handles messages without attachments', async () => {
    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: { messageId: 'msg-1', role: 'user', content: 'Hello', contextWindowId: 'window-1' },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const result = await processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
    })

    expect(result.events).toEqual(events)
    expect(result.descriptions.size).toBe(0)
  })

  it('handles abort signal gracefully', async () => {
    const { describeImageFromDataUrl } = await import('../llm/vision-fallback.js')
    vi.mocked(describeImageFromDataUrl).mockImplementation(async (_dataUrl, _visionModel, options) => {
      try {
        await new Promise<void>((_resolve, reject) => {
          if (options?.signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'))
            return
          }
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
        return 'never reached'
      } catch {
        return '[Image description timed out]'
      }
    })

    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    const abortController = new AbortController()
    const resultPromise = processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
      signal: abortController.signal,
    })

    abortController.abort()

    const result = await resultPromise
    const msgStart = result.events[0]!
    const data = msgStart.data as Extract<TurnEvent, { type: 'message.start' }>['data']
    expect(data.content).toContain('[Image: screenshot.png - description: [Image description timed out]')

    vi.mocked(describeImageFromDataUrl).mockReset()
  })

  it('emits vision_fallback.start and vision_fallback.done events', async () => {
    const { describeImageFromDataUrl } = await import('../llm/vision-fallback.js')
    vi.mocked(describeImageFromDataUrl).mockResolvedValue('A screenshot showing a terminal with error messages')

    const onEvent = vi.fn()

    const events: StoredEvent[] = [
      makeEvent({
        seq: 1,
        type: 'message.start',
        data: {
          messageId: 'msg-1',
          role: 'user',
          content: 'What is in this image?',
          attachments: [imageAttachment],
          contextWindowId: 'window-1',
        },
      }),
      makeEvent({ seq: 2, type: 'message.done', data: { messageId: 'msg-1' } }),
    ]

    await processContextImages(events, {
      modelSupportsVision: false,
      visionModel: { baseUrl: 'http://localhost:11434', model: 'llava', timeout: 30000, backend: 'ollama' },
      onEvent,
    })

    expect(onEvent).toHaveBeenCalledWith({
      type: 'vision_fallback.start',
      data: { messageId: 'msg-1', attachmentId: 'att-1', filename: 'screenshot.png' },
    })
    expect(onEvent).toHaveBeenCalledWith({
      type: 'vision_fallback.done',
      data: { messageId: 'msg-1', attachmentId: 'att-1', description: expect.any(String) },
    })
  })
})
