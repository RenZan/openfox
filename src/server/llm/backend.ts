/**
 * LLM Backend capabilities and display names.
 * Supports vLLM, SGLang, Ollama, and llama.cpp inference engines.
 */

export type Backend = 'vllm' | 'sglang' | 'ollama' | 'llamacpp' | 'opencode-go' | 'unknown'

export interface BackendCapabilities {
  /** Whether chat_template_kwargs with enable_thinking works (vLLM/SGLang) */
  supportsChatTemplateKwargs: boolean
  /** Whether top_k parameter is supported in OpenAI-compatible mode */
  supportsTopK: boolean
}

const BACKEND_CAPABILITIES: Record<Backend, BackendCapabilities> = {
  vllm: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
  },
  sglang: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
  },
  ollama: {
    supportsChatTemplateKwargs: false,
    supportsTopK: false,
  },
  llamacpp: {
    supportsChatTemplateKwargs: false,
    supportsTopK: true,
  },
  'opencode-go': {
    supportsChatTemplateKwargs: false,
    supportsTopK: true,
  },
  unknown: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
  },
}

export function getBackendCapabilities(backend: Backend): BackendCapabilities {
  return BACKEND_CAPABILITIES[backend]
}

/** Display name for each backend */
export function getBackendDisplayName(backend: Backend): string {
  switch (backend) {
    case 'vllm':
      return 'vLLM'
    case 'sglang':
      return 'SGLang'
    case 'ollama':
      return 'Ollama'
    case 'llamacpp':
      return 'llama.cpp'
    case 'opencode-go':
      return 'OpenCode Go'
    case 'unknown':
      return 'Unknown'
  }
}
