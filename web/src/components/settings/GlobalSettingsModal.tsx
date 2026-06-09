import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'wouter'
import { Modal } from '../shared/SelfContainedModal'
import { Button } from '../shared/Button'
import { SETTINGS_KEYS } from '../../stores/settings'
import { NotificationSettings } from './NotificationSettings'
import { SkillsContent } from './SkillsModal'
import { KvCacheWarning } from '../shared/KvCacheWarning'
import { ThemeEditor } from './ThemeEditor'
import { useSettingsStoreState } from './useSettingsStore'
import {
  parseKeybindings,
  formatKeybinding,
  getKeyFromEvent,
  DEFAULT_KEYBINDINGS,
  type KeyBinding,
} from '../../lib/keybindings'

interface GlobalSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'instructions' | 'skills' | 'notifications' | 'display' | 'keybindings' | 'advanced'

export function GlobalSettingsModal({ isOpen, onClose }: GlobalSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('instructions')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="xl" minHeight="500px">
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div className="flex border-b border-border mb-4 -mt-1">
          <TabButton
            label="Instructions"
            active={activeTab === 'instructions'}
            onClick={() => setActiveTab('instructions')}
          />
          <TabButton label="Skills" active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
          <TabButton
            label="Notifications"
            active={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
          />
          <TabButton label="Display" active={activeTab === 'display'} onClick={() => setActiveTab('display')} />
          <TabButton
            label="Shortcuts"
            active={activeTab === 'keybindings'}
            onClick={() => setActiveTab('keybindings')}
          />
          <TabButton label="Advanced" active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')} />
        </div>

        {/* Tab content */}
        {activeTab === 'instructions' && <InstructionsTab isOpen={isOpen} />}
        {activeTab === 'skills' && <SkillsContent isOpen={isOpen} />}
        {activeTab === 'notifications' && (
          <div className="max-h-[60vh] overflow-y-auto">
            <NotificationSettings />
          </div>
        )}
        {activeTab === 'display' && <DisplayTab />}
        {activeTab === 'keybindings' && <KeybindingsTab />}
        {activeTab === 'advanced' && <AdvancedTab onClose={onClose} />}
      </div>
    </Modal>
  )
}

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-accent-primary' : 'bg-bg-tertiary'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function AdvancedTab({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation()
  const { settings, loading, getSetting, setSetting } = useSettingsStoreState()

  const disableXmlProtection = settings[SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION] === 'true'
  const showOpenInEditor = settings[SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR] === 'true'
  const isLoading = loading[SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION] ?? false

  useEffect(() => {
    getSetting(SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION)
    getSetting(SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR)
  }, [getSetting])

  const handleToggleXmlProtection = async () => {
    const newValue = String(!disableXmlProtection)
    await setSetting(SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION, newValue)
  }

  const handleToggleOpenInEditor = async () => {
    const newValue = String(!showOpenInEditor)
    await setSetting(SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR, newValue)
  }

  function handleLaunchOnboarding() {
    onClose()
    navigate('/onboarding')
  }

  if (isLoading) {
    return <div className="text-sm text-text-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm font-medium text-text-primary">Disable XML Tool Call Protection</div>
            <div className="text-xs text-text-muted mt-0.5">
              Allow the model to output XML tool call format instead of JSON function calls. Some third-party providers
              may require this.
            </div>
          </div>
          <Toggle enabled={disableXmlProtection} onClick={handleToggleXmlProtection} />
        </label>
      </div>
      <hr className="border-border" />
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Integrations</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm text-text-primary">Show "Open in VSCode" links</div>
            <div className="text-xs text-text-muted mt-0.5">
              Display a link on file reads to open the file directly in VS Code.
            </div>
          </div>
          <Toggle enabled={showOpenInEditor} onClick={handleToggleOpenInEditor} />
        </label>
      </div>
      <hr className="border-border" />
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Onboarding</h3>
        <p className="text-sm text-text-muted mb-4">
          Reset your OpenFox setup and go through the initial configuration again.
        </p>
        <Button variant="secondary" onClick={handleLaunchOnboarding}>
          Launch Onboarding
        </Button>
      </div>
    </div>
  )
}

function ThemePicker() {
  return <ThemeEditor />
}

function DisplayTab() {
  const { settings, loading, getSetting, setSetting } = useSettingsStoreState()
  const isLoading = loading[SETTINGS_KEYS.DISPLAY_SHOW_THINKING] ?? false

  const toggles = [
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_THINKING,
      label: 'Show thinking blocks',
      description: 'Display AI reasoning content in the feed',
    },
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_VERBOSE_TOOL_OUTPUT,
      label: 'Show expanded tool output',
      description: 'Always show full tool call details instead of compact view',
    },
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_STATS,
      label: 'Show stats bar',
      description: 'Display model, tokens, and timing information',
    },
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_AGENT_DEFINITIONS,
      label: 'Show agent definitions',
      description: 'Display agent definition injections in the feed',
    },
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_WORKFLOW_BARS,
      label: 'Show workflow bars',
      description: 'Display workflow start and end markers',
    },
    {
      key: SETTINGS_KEYS.DISPLAY_SHOW_SYNTAX_HIGHLIGHTING,
      label: 'Show syntax highlighting',
      description: 'Nicer formatting, but very slow - does not affect red/green diff coloring',
    },
  ] as const

  const localValues = Object.fromEntries(toggles.map((t) => [t.key, settings[t.key] ?? 'true'])) as Record<
    (typeof toggles)[number]['key'],
    string
  >
  const [local, setLocal] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(toggles.map((t) => [t.key, localValues[t.key] === 'true'])),
  )

  useEffect(() => {
    toggles.forEach((t) => getSetting(t.key))
  }, [getSetting])

  useEffect(() => {
    setLocal(Object.fromEntries(toggles.map((t) => [t.key, localValues[t.key] === 'true'])))
  }, [JSON.stringify(localValues)])

  const handleToggle = async (key: string) => {
    const newValue = String(!local[key as keyof typeof local])
    setLocal((prev) => ({ ...prev, [key]: !prev[key as keyof typeof local] }))
    await setSetting(key, newValue)
  }

  if (isLoading) {
    return <div className="text-sm text-text-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <ThemePicker />
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-4">Feed Display</h3>
        <div className="space-y-4">
          {toggles.map(({ key, label, description }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-text-primary">{label}</div>
                <div className="text-xs text-text-muted">{description}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  local[key] ? 'bg-accent-primary' : 'bg-bg-tertiary'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    local[key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function KeybindingsTab() {
  const { settings, loading, getSetting, setSetting } = useSettingsStoreState()
  const raw = settings[SETTINGS_KEYS.KEYBINDINGS]
  const isLoading = loading[SETTINGS_KEYS.KEYBINDINGS] ?? false
  const config = parseKeybindings(raw)
  const [recording, setRecording] = useState<string | null>(null)

  useEffect(() => {
    getSetting(SETTINGS_KEYS.KEYBINDINGS)
  }, [getSetting])

  const actions: Array<{ id: string; label: string; binding: KeyBinding }> = [
    { id: 'terminalToggle', label: 'Toggle Terminal', binding: config.terminalToggle },
    { id: 'quickAction', label: 'Quick Action', binding: config.quickAction },
    ...config.agentSwitching.map((b, i) => ({
      id: `agentSwitching.${i}`,
      label: `Switch to Agent ${i + 1}`,
      binding: b,
    })),
  ]

  const handleStartRecording = (id: string) => {
    setRecording(id)
  }

  const handleBindingRecorded = useCallback(
    (newBinding: KeyBinding) => {
      if (!recording) return
      const current = parseKeybindings(raw)
      const updated = structuredClone(current)

      if (recording.startsWith('agentSwitching.')) {
        const index = parseInt(recording.split('.')[1]!, 10)
        updated.agentSwitching[index] = newBinding
      } else if (recording === 'terminalToggle') {
        updated.terminalToggle = newBinding
      } else if (recording === 'quickAction') {
        updated.quickAction = newBinding
      }

      setRecording(null)
      setSetting(SETTINGS_KEYS.KEYBINDINGS, JSON.stringify(updated))
    },
    [recording, raw, setSetting],
  )

  const handleReset = () => {
    setSetting(SETTINGS_KEYS.KEYBINDINGS, JSON.stringify(DEFAULT_KEYBINDINGS))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-primary">Keyboard Shortcuts</h3>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-bg-tertiary transition-colors disabled:opacity-30"
        >
          Reset to defaults
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading...</div>
      ) : (
        <div className="space-y-1">
          {actions.map((action) => (
            <KeybindingRow
              key={action.id}
              label={action.label}
              binding={action.binding}
              isRecording={recording === action.id}
              onStartRecording={() => handleStartRecording(action.id)}
              onBindingRecorded={handleBindingRecorded}
              onCancelRecording={() => setRecording(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function KeybindingRow({
  label,
  binding,
  isRecording,
  onStartRecording,
  onBindingRecorded,
  onCancelRecording,
}: {
  label: string
  binding: KeyBinding
  isRecording: boolean
  onStartRecording: () => void
  onBindingRecorded: (binding: KeyBinding) => void
  onCancelRecording: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastPressRef = useRef<number>(0)
  const lastKeyRef = useRef<string>('')

  useEffect(() => {
    if (!isRecording) return

    const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta'])
    let pendingModifiers: Array<'ctrl' | 'meta' | 'alt' | 'shift'> = []

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        onCancelRecording()
        return
      }

      if (MODIFIERS.has(e.key)) {
        if (e.ctrlKey && !pendingModifiers.includes('ctrl')) pendingModifiers.push('ctrl')
        if (e.metaKey && !pendingModifiers.includes('meta')) pendingModifiers.push('meta')
        if (e.altKey && !pendingModifiers.includes('alt')) pendingModifiers.push('alt')
        if (e.shiftKey && !pendingModifiers.includes('shift')) pendingModifiers.push('shift')
        return
      }

      if (pendingModifiers.length > 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        const modifiers: Array<'ctrl' | 'meta' | 'alt' | 'shift'> = [...pendingModifiers]
        if (e.ctrlKey && !modifiers.includes('ctrl')) modifiers.push('ctrl')
        if (e.metaKey && !modifiers.includes('meta')) modifiers.push('meta')
        if (e.altKey && !modifiers.includes('alt')) modifiers.push('alt')
        if (e.shiftKey && !modifiers.includes('shift')) modifiers.push('shift')

        onBindingRecorded({ type: 'chord', key: getKeyFromEvent(e), modifiers })
        return
      }

      const now = Date.now()
      const recordedKey = getKeyFromEvent(e)
      if (recordedKey === lastKeyRef.current && now - lastPressRef.current < 400) {
        onBindingRecorded({ type: 'double-press', key: recordedKey, threshold: 300 })
        return
      }

      lastPressRef.current = now
      lastKeyRef.current = recordedKey
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') pendingModifiers = pendingModifiers.filter((m) => m !== 'ctrl')
      if (e.key === 'Shift') pendingModifiers = pendingModifiers.filter((m) => m !== 'shift')
      if (e.key === 'Alt') pendingModifiers = pendingModifiers.filter((m) => m !== 'alt')
      if (e.key === 'Meta') pendingModifiers = pendingModifiers.filter((m) => m !== 'meta')
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isRecording, onBindingRecorded, onCancelRecording])

  return (
    <div
      ref={ref}
      className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
        isRecording ? 'bg-accent-primary/10 ring-1 ring-accent-primary' : 'hover:bg-bg-tertiary'
      }`}
    >
      <span className="text-sm text-text-primary">{label}</span>
      <div className="flex items-center gap-2">
        {isRecording ? (
          <span className="text-xs text-accent-primary font-medium animate-pulse">Press shortcut...</span>
        ) : (
          <button
            type="button"
            onClick={onStartRecording}
            className="px-2 py-0.5 text-xs font-mono bg-bg-tertiary text-text-secondary rounded border border-border hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            {formatKeybinding(binding)}
          </button>
        )}
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-accent-primary text-accent-primary'
          : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'
      }`}
    >
      {label}
    </button>
  )
}

function InstructionsTab({ isOpen }: { isOpen: boolean }) {
  const { settings, loading, getSetting, setSetting } = useSettingsStoreState()
  const globalInstructions = settings[SETTINGS_KEYS.GLOBAL_INSTRUCTIONS] ?? ''
  const isLoading = loading[SETTINGS_KEYS.GLOBAL_INSTRUCTIONS] ?? false

  const [localValue, setLocalValue] = useState(globalInstructions)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getSetting(SETTINGS_KEYS.GLOBAL_INSTRUCTIONS)
    }
  }, [isOpen, getSetting])

  useEffect(() => {
    setLocalValue(globalInstructions)
    setIsDirty(false)
  }, [globalInstructions])

  const handleSave = async () => {
    setSaving(true)
    await setSetting(SETTINGS_KEYS.GLOBAL_INSTRUCTIONS, localValue)
    setSaving(false)
    setIsDirty(false)
  }

  const handleDiscard = () => {
    setLocalValue(globalInstructions)
    setIsDirty(false)
  }

  const isBusy = isLoading || saving

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Global Instructions</label>
        <p className="text-sm text-text-muted mb-2">
          These instructions are injected into every prompt, regardless of project.
        </p>
        <textarea
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value)
            setIsDirty(true)
          }}
          placeholder="Enter global instructions that apply to all projects..."
          className="w-full min-h-80 px-3 py-2 bg-bg-tertiary border border-border rounded text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-accent-primary"
          disabled={isBusy}
        />
      </div>

      {isDirty && <KvCacheWarning />}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleDiscard} disabled={!isDirty}>
          Discard
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!isDirty || isBusy}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
