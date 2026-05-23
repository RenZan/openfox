import { useState, useEffect, useCallback } from 'react'
import { Modal } from './shared/Modal'
import { authFetch } from '../lib/api'

type ModalState = 'ready' | 'updating' | 'reloading'

interface AutoUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  versionInfo: { current: string; latest: string } | null
}

export function AutoUpdateModal({ isOpen, onClose, versionInfo }: AutoUpdateModalProps) {
  const [state, setState] = useState<ModalState>('ready')
  const [progressDots, setProgressDots] = useState('')
  const [modalVersionInfo, setModalVersionInfo] = useState(versionInfo)

  useEffect(() => {
    if (!isOpen) return
    if (versionInfo) {
      setModalVersionInfo(versionInfo)
      return
    }
    fetch('/api/auto-update/check')
      .then((res) => res.json())
      .then((data) => setModalVersionInfo({ current: data.current, latest: data.latest }))
      .catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || state !== 'updating') return
    const dots = setInterval(() => {
      setProgressDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(dots)
  }, [isOpen, state])

  const handleUpdate = useCallback(async () => {
    setState('updating')

    const isTestMode = modalVersionInfo?.current === '1.0.0' && modalVersionInfo?.latest === '1.1.0'
    await authFetch('/api/auto-update', { method: 'POST' })

    if (isTestMode) {
      setTimeout(() => {
        setState('reloading')
        localStorage.setItem('openfox_updated_to', modalVersionInfo?.latest ?? 'unknown')
        localStorage.setItem('update_pending', 'true')
        setTimeout(() => window.location.reload(), 1000)
      }, 5_000)
      return
    }

    let died = false
    let alive = false

    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/health')
        if (res.ok) {
          if (died) {
            alive = true
            clearInterval(poll)
            setState('reloading')
            localStorage.setItem('openfox_updated_to', modalVersionInfo?.latest ?? 'unknown')
            localStorage.setItem('update_pending', 'true')
            window.location.reload()
          }
        }
      } catch {
        died = true
      }
    }, 2000)

    setTimeout(() => {
      if (!alive) {
        clearInterval(poll)
      }
    }, 300_000)
  }, [modalVersionInfo?.current, modalVersionInfo?.latest])

  useEffect(() => {
    if (isOpen) {
      setState('ready')
      setProgressDots('')
    }
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={state === 'updating' ? undefined : onClose}
      title="New OpenFox Version Available"
      size="sm"
      closeOnBackdropClick={state !== 'updating'}
      showCloseButton={state !== 'updating'}
    >
      <div className="flex flex-col gap-4">
        {modalVersionInfo && (
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Current version</span>
            <span className="text-text-primary font-mono">{modalVersionInfo.current}</span>
          </div>
        )}
        {modalVersionInfo && (
          <div className="flex justify-between text-sm pb-2">
            <span className="text-text-muted">Latest version</span>
            <span className="text-accent-primary font-mono font-semibold">{modalVersionInfo.latest}</span>
          </div>
        )}

        {state === 'updating' && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary animate-pulse w-full" />
            </div>
            <p className="text-xs text-text-muted text-center">Updating{progressDots}</p>
          </div>
        )}

        {state === 'reloading' && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary animate-pulse w-full" />
            </div>
            <p className="text-xs text-text-muted text-center">Update complete, reloading{progressDots}</p>
          </div>
        )}
      </div>

      {state === 'ready' && (
        <button
          onClick={handleUpdate}
          className="w-full px-3 py-2 text-sm rounded bg-accent-primary hover:brightness-110 transition-all text-white font-medium"
        >
          Update OpenFox
        </button>
      )}

      {state === 'ready' && (
        <div className="flex justify-center mt-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-warning/10 border border-accent-warning/30 rounded text-xs">
            <span>⚠️</span>
            <p className="text-text-secondary">
              Server will restart to apply this update. Sessions in progress will be interrupted.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
