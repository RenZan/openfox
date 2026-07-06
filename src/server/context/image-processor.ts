import type { StoredEvent, TurnEvent } from '../events/types.js'
import type { Attachment } from '../../shared/types.js'
import { describeImageFromDataUrl } from '../llm/vision-fallback.js'
import type { VisionBackend } from '../llm/vision-fallback.js'
import { createHash } from 'node:crypto'
import { getRuntimeConfig } from '../runtime-config.js'

export async function loadVisionModelFromGlobalConfig(): Promise<
  { baseUrl: string; model: string; timeout: number; backend: VisionBackend } | undefined
> {
  try {
    const { loadGlobalConfig, getVisionFallback } = await import('../../cli/config.js')
    const runtimeConfig = getRuntimeConfig()
    const mode = runtimeConfig.mode ?? 'production'
    const globalConfig = await loadGlobalConfig(mode)
    const fallback = getVisionFallback(globalConfig)
    if (fallback?.enabled && fallback.model) {
      return {
        baseUrl: fallback.url,
        model: fallback.model,
        timeout: fallback.timeout * 1000,
        backend: fallback.backend ?? 'ollama',
      }
    }
  } catch {
    // Global config not available
  }
  return undefined
}

export interface ImageProcessorOptions {
  modelSupportsVision: boolean
  visionModel?: {
    baseUrl: string
    model: string
    timeout: number
    backend: VisionBackend
  }
  signal?: AbortSignal
  onEvent?: (event: TurnEvent) => void
}

export interface ProcessContextResult {
  events: StoredEvent[]
  descriptions: Map<string, string>
}

const descriptionCache = new Map<string, string>()

export function clearImageDescriptionCache(): void {
  descriptionCache.clear()
}

function contentHash(data: string): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

function isImageAttachment(att: Attachment): boolean {
  return att.mimeType.startsWith('image/')
}

function hasImageMetadata(result: { metadata?: Record<string, unknown> }): boolean {
  const meta = result.metadata
  if (!meta) return false
  const dataUrl = meta['dataUrl']
  const mimeType = meta['mimeType']
  return typeof dataUrl === 'string' && typeof mimeType === 'string' && (mimeType as string).startsWith('image/')
}

function buildImageDescription(filename: string | undefined, description: string): string {
  return `[Image: ${filename || 'image'} - description: ${description}]`
}

function buildImagePlaceholder(filename: string | undefined): string {
  return `[Image: ${filename || 'image'}]`
}

async function describeAttachment(
  att: Attachment,
  messageId: string,
  options: ImageProcessorOptions,
  descriptions: Map<string, string>,
): Promise<string> {
  const cacheKey = contentHash(att.data)
  if (descriptionCache.has(cacheKey)) {
    const cached = descriptionCache.get(cacheKey)!
    descriptions.set(att.id, cached)
    return cached
  }

  if (options.visionModel) {
    const startData: { messageId: string; attachmentId: string; filename?: string } = {
      messageId,
      attachmentId: att.id,
    }
    if (att.filename !== undefined) {
      startData.filename = att.filename
    }
    options.onEvent?.({ type: 'vision_fallback.start', data: startData })

    const description = await describeImageFromDataUrl(att.data, options.visionModel, {
      context: att.filename ? `File: ${att.filename}` : undefined,
      signal: options.signal,
    })

    descriptionCache.set(cacheKey, description)
    descriptions.set(att.id, description)

    options.onEvent?.({ type: 'vision_fallback.done', data: { messageId, attachmentId: att.id, description } })

    return description
  }

  const placeholder = buildImagePlaceholder(att.filename)
  descriptions.set(att.id, placeholder)
  return placeholder
}

async function describeToolResultImage(
  dataUrl: string,
  filename: string | undefined,
  toolCallId: string,
  messageId: string,
  options: ImageProcessorOptions,
  descriptions: Map<string, string>,
): Promise<string> {
  const cacheKey = contentHash(dataUrl)
  if (descriptionCache.has(cacheKey)) {
    const cached = descriptionCache.get(cacheKey)!
    descriptions.set(toolCallId, cached)
    return cached
  }

  if (options.visionModel) {
    const startData: { messageId: string; attachmentId: string; filename?: string } = {
      messageId,
      attachmentId: toolCallId,
    }
    if (filename !== undefined) {
      startData.filename = filename
    }
    options.onEvent?.({ type: 'vision_fallback.start', data: startData })

    const description = await describeImageFromDataUrl(dataUrl, options.visionModel, {
      context: filename ? `File: ${filename}` : undefined,
      signal: options.signal,
    })

    descriptionCache.set(cacheKey, description)
    descriptions.set(toolCallId, description)

    options.onEvent?.({
      type: 'vision_fallback.done',
      data: { messageId, attachmentId: toolCallId, description },
    })

    return description
  }

  const placeholder = buildImagePlaceholder(filename)
  descriptions.set(toolCallId, placeholder)
  return placeholder
}

export async function processContextImages(
  events: StoredEvent[],
  options: ImageProcessorOptions,
): Promise<ProcessContextResult> {
  if (options.modelSupportsVision) {
    return { events, descriptions: new Map() }
  }

  const descriptions = new Map<string, string>()
  const modifiedEvents: StoredEvent[] = events.map((event) => structuredClone(event))

  for (const event of modifiedEvents) {
    if (event.type === 'message.start') {
      const data = event.data as Extract<TurnEvent, { type: 'message.start' }>['data']
      if (!data.attachments || data.attachments.length === 0) continue

      const imageAtts = data.attachments.filter(isImageAttachment)
      if (imageAtts.length === 0) continue

      let content = data.content ?? ''
      for (const att of imageAtts) {
        const description = await describeAttachment(att, data.messageId, options, descriptions)
        content += `\n${buildImageDescription(att.filename, description)}`
      }

      ;(data as { content?: string }).content = content
      delete (data as { attachments: unknown }).attachments
    }

    if (event.type === 'tool.result') {
      const data = event.data as Extract<TurnEvent, { type: 'tool.result' }>['data']
      if (!data.result.metadata || !hasImageMetadata(data.result)) continue

      const meta = data.result.metadata
      const dataUrl = meta['dataUrl'] as string
      const path = meta['path'] as string | undefined

      const description = await describeToolResultImage(
        dataUrl,
        path,
        data.toolCallId,
        data.messageId,
        options,
        descriptions,
      )

      data.result.output = buildImageDescription(path, description)
      delete data.result.metadata
    }
  }

  return { events: modifiedEvents, descriptions }
}
