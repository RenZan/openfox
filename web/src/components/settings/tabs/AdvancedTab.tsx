import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '../../shared/Button'
import { Toggle } from '../../shared/Toggle'
import { SETTINGS_KEYS } from '../../../stores/settings'
import { useSettingsStoreState } from '../useSettingsStore'

export function AdvancedTab({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation()
  const { settings, loading, getSetting, setSetting } = useSettingsStoreState()

  const disableXmlProtection = settings[SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION] === 'true'
  const showOpenInEditor = settings[SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR] === 'true'
  const dynamicSystemPrompt = settings[SETTINGS_KEYS.LLM_DYNAMIC_SYSTEM_PROMPT] === 'true'
  const isLoading = loading[SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION] ?? false

  const [localToggles, setLocalToggles] = useState({
    xmlProtection: disableXmlProtection,
    openInEditor: showOpenInEditor,
    dynamicPrompt: dynamicSystemPrompt,
  })

  useEffect(() => {
    setLocalToggles({
      xmlProtection: disableXmlProtection,
      openInEditor: showOpenInEditor,
      dynamicPrompt: dynamicSystemPrompt,
    })
  }, [disableXmlProtection, showOpenInEditor, dynamicSystemPrompt])

  useEffect(() => {
    getSetting(SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION)
    getSetting(SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR)
    getSetting(SETTINGS_KEYS.LLM_DYNAMIC_SYSTEM_PROMPT)
  }, [getSetting])

  const handleToggleXmlProtection = () => {
    const newValue = !localToggles.xmlProtection
    setLocalToggles((prev) => ({ ...prev, xmlProtection: newValue }))
    setSetting(SETTINGS_KEYS.LLM_DISABLE_XML_PROTECTION, String(newValue))
  }

  const handleToggleOpenInEditor = () => {
    const newValue = !localToggles.openInEditor
    setLocalToggles((prev) => ({ ...prev, openInEditor: newValue }))
    setSetting(SETTINGS_KEYS.DISPLAY_SHOW_OPEN_IN_EDITOR, String(newValue))
  }

  const handleToggleDynamicSystemPrompt = () => {
    const newValue = !localToggles.dynamicPrompt
    setLocalToggles((prev) => ({ ...prev, dynamicPrompt: newValue }))
    setSetting(SETTINGS_KEYS.LLM_DYNAMIC_SYSTEM_PROMPT, String(newValue))
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
          <div className="flex-1 min-w-0 mr-3">
            <div className="text-sm font-medium text-text-primary">Dynamic System Prompt</div>
            <div className="text-xs text-text-muted mt-0.5">
              Rebuild the system prompt on every turn. When disabled, changes are applied on demand via the context
              header for better cache performance.
            </div>
          </div>
          <Toggle enabled={localToggles.dynamicPrompt} onClick={handleToggleDynamicSystemPrompt} />
        </label>
      </div>
      <hr className="border-border" />
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm font-medium text-text-primary">Disable XML Tool Call Protection</div>
            <div className="text-xs text-text-muted mt-0.5">
              Allow the model to output XML tool call format instead of JSON function calls. Some third-party providers
              may require this.
            </div>
          </div>
          <Toggle enabled={localToggles.xmlProtection} onClick={handleToggleXmlProtection} />
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
          <Toggle enabled={localToggles.openInEditor} onClick={handleToggleOpenInEditor} />
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
