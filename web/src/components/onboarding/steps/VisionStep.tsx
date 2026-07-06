import { useState, useEffect } from 'react'
import { authFetch } from '../../../lib/api'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import { CheckIcon, ClipboardIcon } from '../../shared/icons'

interface VisionStepProps {
  onNext: (data: {
    visionFallback?: { enabled: boolean; url: string; model: string; timeout: number; backend: 'ollama' | 'openai' }
  }) => void
}

export function VisionStep({ onNext }: VisionStepProps) {
  const [enabled, setEnabled] = useState(false)
  const [url, setUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState('qwen3.5:0.8b')
  const [backend, setBackend] = useState<'ollama' | 'openai'>('ollama')
  const { copied, copy } = useCopyToClipboard()

  useEffect(() => {
    authFetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.visionFallback) {
          setEnabled(data.visionFallback.enabled)
          setUrl(data.visionFallback.url)
          setModel(data.visionFallback.model)
          if (data.visionFallback.backend) {
            setBackend(data.visionFallback.backend)
          }
        }
      })
      .catch(() => {})
  }, [])

  function handleFinish(skip: boolean) {
    if (skip) {
      onNext({})
      return
    }

    onNext({
      visionFallback: {
        enabled,
        url,
        model,
        timeout: 120,
        backend,
      },
    })
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-text-primary mb-2">Vision (Optional)</h2>
      <p className="text-text-secondary mb-8">Configure a vision model for non-vision models</p>

      <div className="space-y-6">
        <div className="bg-bg-secondary rounded-lg p-4 border border-border">
          <p className="text-text-secondary text-sm mb-2">
            You need a server with a vision model. Choose your backend type below.
          </p>
          <p className="text-text-secondary text-sm mb-2">For Ollama:</p>
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:underline text-sm"
          >
            Download Ollama
          </a>
          <div className="mt-3 p-2 bg-bg-primary rounded border border-border flex items-center justify-between gap-2">
            <code className="text-text-secondary text-xs">ollama pull qwen3.5:0.8b</code>
            <button
              onClick={() => copy('ollama pull qwen3.5:0.8b')}
              className="text-text-muted hover:text-text-primary transition-colors"
              title="Copy"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-accent-primary" /> : <ClipboardIcon className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-text-secondary text-sm mt-3">
            For OpenAI-compatible servers (vLLM, sglang, llama.cpp): use the <strong>OpenAI</strong> backend type.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 rounded border-border bg-bg-secondary text-accent-primary focus:ring-accent-primary"
          />
          <span className="text-text-primary">Enable vision fallback for non-vision models</span>
        </label>

        {enabled && (
          <div className="space-y-4 pl-8">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Backend type</label>
              <select
                value={backend}
                onChange={(e) => setBackend(e.target.value as 'ollama' | 'openai')}
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="ollama">Ollama</option>
                <option value="openai">OpenAI-compatible (vLLM, sglang, llama.cpp)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Vision server URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={backend === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000/v1'}
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Vision model name</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={backend === 'ollama' ? 'qwen3.5:0.8b' : 'qwen3.5-27b'}
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => handleFinish(true)}
            data-testid="onboarding-skip-button"
            className="text-text-muted hover:text-text-secondary text-sm underline"
          >
            Skip for now
          </button>
          <button
            onClick={() => handleFinish(false)}
            className="px-6 py-3 bg-accent-primary text-text-primary rounded-lg font-medium hover:bg-accent-primary/90 transition-colors"
          >
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  )
}
