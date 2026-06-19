import { useState, useEffect } from 'react'
import { authFetch } from '../../../lib/api'
import type { Backend } from '../../../stores/config'
import { PlusLgIcon, PlusMdIcon, TrashIcon } from '../../shared/icons'
import { getBackendDisplayName, type ProviderInfo } from '../types'

const COMMON_PORTS = [8000, 11434, 8080]

const PRESETS = [{ name: 'OpenCode Go', url: 'https://opencode.ai/zen/go/v1', backend: 'opencode-go' as const }]

interface ConnectLLMStepProps {
  onNext: (data: { providers: ProviderInfo[] }) => void
}

export function ConnectLLMStep({ onNext }: ConnectLLMStepProps) {
  const [existingProviders, setExistingProviders] = useState<ProviderInfo[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customApiKey, setCustomApiKey] = useState('')
  const [customBackend, setCustomBackend] = useState<Backend>('auto')
  const [customIsLocal, setCustomIsLocal] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; model?: string; error?: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [editedName, setEditedName] = useState('')

  useEffect(() => {
    fetchExistingProviders()
  }, [])

  async function fetchExistingProviders() {
    try {
      const response = await authFetch('/api/providers')
      if (response.ok) {
        const data = (await response.json()) as {
          providers: Array<{
            id: string
            name: string
            url: string
            backend: Backend
            apiKey?: string
            isLocal?: boolean
          }>
        }
        const mapped = data.providers.map((p) => ({
          id: p.id,
          name: p.name,
          url: p.url,
          backend: p.backend,
          model: null,
          apiKey: p.apiKey,
          isLocal: p.isLocal,
        }))
        setExistingProviders(mapped)
        setProviders(mapped)
      }
    } catch {
      /* empty */
    }
  }

  async function testConnection(url: string) {
    setTesting(true)
    setTestResult(null)

    const skipBackendDetection = customBackend !== 'auto'

    try {
      const response = await authFetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, skipBackendDetection }),
      })
      const data = (await response.json()) as {
        success: boolean
        backend?: Backend
        model?: string | null
        error?: string
      }

      if (data.success) {
        if (!skipBackendDetection) {
          setCustomBackend(data.backend ?? 'auto')
        }
        setTestResult({ success: true, model: data.model ?? undefined })
      } else {
        setTestResult({ success: false, error: data.error ?? 'Connection failed' })
      }
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : 'Connection failed' })
    }

    setTesting(false)
  }

  function addProvider() {
    if (!customUrl) return

    const name = customName || `Provider ${providers.length + 1}`
    const newProvider: ProviderInfo = {
      id: `temp-${Date.now()}`,
      name,
      url: customUrl,
      backend: testResult?.success ? customBackend : 'auto',
      model: testResult?.success ? (testResult.model ?? null) : null,
      apiKey: customApiKey || undefined,
      isLocal: customIsLocal || undefined,
    }

    setProviders([...providers, newProvider])
    setCustomName('')
    setCustomUrl('')
    setCustomApiKey('')
    setTestResult(null)
  }

  function removeProvider(id: string) {
    setRemoving(id)
    const isExisting = existingProviders.some((p) => p.id === id)

    if (isExisting) {
      authFetch(`/api/providers/${id}`, { method: 'DELETE' })
        .then(() => {
          setProviders(providers.filter((p) => p.id !== id))
          setExistingProviders(existingProviders.filter((p) => p.id !== id))
          setRemoving(null)
        })
        .catch(() => {
          setRemoving(null)
        })
    } else {
      setProviders(providers.filter((p) => p.id !== id))
      setRemoving(null)
    }
  }

  async function handleSubmit() {
    for (const provider of providers) {
      if (provider.id.startsWith('temp-') || !existingProviders.some((e) => e.id === provider.id)) {
        const response = await authFetch('/api/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: provider.name,
            url: provider.url,
            backend: provider.backend,
            model: provider.model,
            apiKey: provider.apiKey,
            isLocal: provider.isLocal,
          }),
        })
        if (!response.ok) {
          console.error('Failed to add provider', provider)
        }
      }
    }

    const validProviders = providers.filter((p) => !p.id.startsWith('temp-'))
    onNext({ providers: validProviders })
  }

  const hasProviders = providers.length > 0

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-text-primary mb-2">LLM Providers</h2>
      <p className="text-text-secondary mb-8">Manage your LLM server connections</p>

      <div className="space-y-4">
        {providers.length > 0 ? (
          <div className="space-y-2">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between bg-bg-secondary rounded-lg p-4 border border-border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-accent-primary/25 text-accent-primary rounded text-xs font-medium">
                      {getBackendDisplayName(provider.backend)}
                    </span>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={provider.isLocal ?? false}
                        onChange={(e) => {
                          const newIsLocal = e.target.checked
                          setProviders(
                            providers.map((p) =>
                              p.id === provider.id ? { ...p, isLocal: newIsLocal || undefined } : p,
                            ),
                          )
                          if (!provider.id.startsWith('temp-')) {
                            authFetch(`/api/providers/${provider.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ isLocal: newIsLocal }),
                            }).catch(() => {})
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-border bg-bg-secondary accent-accent-primary"
                      />
                      <span className={provider.isLocal ? 'text-accent-success' : 'text-text-muted'}>local</span>
                    </label>
                    {editingProviderId === provider.id ? (
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setProviders(providers.map((p) => (p.id === provider.id ? { ...p, name: editedName } : p)))
                            setEditingProviderId(null)
                          }
                          if (e.key === 'Escape') setEditingProviderId(null)
                        }}
                        onBlur={() => {
                          setProviders(providers.map((p) => (p.id === provider.id ? { ...p, name: editedName } : p)))
                          setEditingProviderId(null)
                        }}
                        className="px-2 py-0.5 bg-bg-primary border border-accent-primary rounded text-text-primary text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-text-primary font-medium cursor-pointer hover:text-accent-primary"
                        onClick={() => {
                          setEditingProviderId(provider.id)
                          setEditedName(provider.name)
                        }}
                        title="Click to edit"
                      >
                        {provider.name}
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-sm mt-1">{provider.url}</p>
                  {provider.model && <p className="text-text-secondary text-xs mt-0.5">Model: {provider.model}</p>}
                </div>
                <button
                  onClick={() => removeProvider(provider.id)}
                  disabled={removing === provider.id}
                  className="p-2 text-text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Remove provider"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-bg-secondary rounded-lg p-8 text-center border border-border">
            <p className="text-text-muted">No providers configured yet</p>
          </div>
        )}

        {showAddForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (customUrl) addProvider()
            }}
            className="space-y-4 p-4 bg-bg-tertiary rounded-lg"
          >
            <div>
              <label className="block text-sm text-text-secondary mb-2">Service Presets</label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => {
                      setCustomName(preset.name)
                      setCustomUrl(preset.url)
                      setCustomBackend(preset.backend)
                      setTestResult(null)
                    }}
                    className={`p-2 rounded border text-center text-sm transition-colors ${
                      customUrl === preset.url
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-border hover:border-text-muted text-text-secondary'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">Local Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {COMMON_PORTS.map((port) => (
                  <button
                    type="button"
                    key={port}
                    onClick={() => {
                      setCustomName('')
                      setCustomUrl(`http://localhost:${port}`)
                      setCustomBackend('auto')
                      setTestResult(null)
                    }}
                    className={`p-2 rounded border text-center text-sm transition-colors ${
                      customUrl === `http://localhost:${port}`
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-border hover:border-text-muted text-text-secondary'
                    }`}
                  >
                    localhost:{port}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Or enter address manually</label>
              <input
                type="text"
                name="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value)
                  setTestResult(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    testConnection(customUrl)
                  }
                }}
                placeholder="http://localhost:8000"
                data-testid="onboarding-provider-url-input"
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Provider name (optional)</label>
              <input
                type="text"
                name="name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addProvider()
                  }
                }}
                placeholder="My LLM Server"
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">API key (optional)</label>
              <input
                type="password"
                name="apiKey"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customIsLocal}
                onChange={(e) => setCustomIsLocal(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-bg-secondary accent-accent-primary"
              />
              <span className="text-sm text-text-secondary">This is a local provider</span>
            </label>

            {testResult && (
              <div className={`p-3 rounded-lg ${testResult.success ? 'bg-accent-primary/10' : 'bg-red-500/10'}`}>
                {testResult.success ? (
                  <p className="text-accent-primary font-medium">
                    ✓ Connected to {getBackendDisplayName(customBackend)}
                    {testResult.model && ` (${testResult.model})`}
                  </p>
                ) : (
                  <p className="text-red-500">{testResult.error}</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => testConnection(customUrl)}
                disabled={!customUrl || testing}
                data-testid="onboarding-test-connection-button"
                className="flex-1 px-4 py-2 bg-bg-secondary border border-border rounded-lg hover:border-text-muted disabled:opacity-50"
              >
                {testing ? <PlusMdIcon className="w-4 h-4" /> : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={!customUrl}
                data-testid="onboarding-add-provider-submit-button"
                className="flex-1 px-4 py-2 bg-accent-primary text-text-primary rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {testResult?.success ? 'Add Provider ✓' : 'Add Provider'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setCustomName('')
                setCustomUrl('')
                setCustomApiKey('')
                setCustomIsLocal(false)
                setTestResult(null)
              }}
              className="w-full text-center text-text-muted hover:text-text-secondary text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            data-testid="onboarding-add-provider-button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bg-secondary border border-dashed border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
          >
            <PlusLgIcon className="w-4 h-4" />
            Add Provider
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!hasProviders}
          data-testid="onboarding-continue-button"
          className="w-full mt-6 px-6 py-3 bg-accent-primary text-text-primary rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
