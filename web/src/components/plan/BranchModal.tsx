import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { authFetch } from '../../lib/api'
import { useModalState } from '../../hooks/useModalState'
import { ModalShell } from '../shared/ModalShell'
import { BranchIcon } from '../shared/icons'
import { CreateInputSection } from '../shared/CreateInputSection'

interface BranchModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

interface BranchInfo {
  name: string
  current: boolean
}

export function BranchModal({ isOpen, onClose, sessionId }: BranchModalProps) {
  const refreshSession = useSessionStore((s) => s.loadSession)
  const {
    busy,
    setBusy,
    error,
    setError,
    loading,
    setLoading,
    newName,
    setNewName,
    handleClose,
    canCreate,
    resetState,
  } = useModalState(onClose)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [sourceBranch, setSourceBranch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const allBranches = useMemo(() => {
    const local = branches.map((b) => b.name)
    const combined = [...new Set([...local, ...remoteBranches])]
    return combined.sort()
  }, [branches, remoteBranches])

  const filteredSuggestions = useMemo(() => {
    if (!sourceBranch) return []
    const q = sourceBranch.toLowerCase()
    return allBranches.filter((b) => b.toLowerCase().includes(q)).slice(0, 10)
  }, [sourceBranch, allBranches])

  useEffect(() => {
    if (!isOpen) return
    resetState()
    setSourceBranch('')
    setBranches([])
    setRemoteBranches([])
    authFetch(`/api/sessions/${sessionId}/branches`)
      .then((r) => r.json())
      .then((data: { branches: BranchInfo[]; remoteBranches: string[] }) => {
        setBranches(data.branches)
        setRemoteBranches(data.remoteBranches)
        setLoading(false)
      })
      .catch(() => {
        setBranches([])
        setRemoteBranches([])
        setLoading(false)
      })
  }, [isOpen, sessionId, resetState, setLoading])

  const handleSwitch = useCallback(
    async (branchName: string) => {
      setError(null)
      setBusy(true)
      try {
        const res = await authFetch(`/api/sessions/${sessionId}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: branchName }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to switch branch' }))
          setError(err.error)
          setBusy(false)
          return
        }
        await refreshSession(sessionId)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to switch branch')
        setBusy(false)
      }
    },
    [sessionId, refreshSession, onClose, setError, setBusy],
  )

  const handleCreate = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const body: Record<string, string> = { name: newName.trim() }
      if (sourceBranch) body.sourceBranch = sourceBranch
      const res = await authFetch(`/api/sessions/${sessionId}/checkout-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create branch' }))
        setError(err.error)
        setBusy(false)
        return
      }
      await refreshSession(sessionId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create branch')
      setBusy(false)
    }
  }, [newName, sourceBranch, sessionId, refreshSession, onClose, setError, setBusy])

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} title="Switch Branch" busy={busy} loading={loading}>
      <div>
        {branches.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-text-primary mb-2">Branches</p>
            <div className="max-h-48 overflow-y-auto space-y-0.5 bg-bg-tertiary/30 rounded p-2">
              {branches.map((b) => (
                <button
                  key={b.name}
                  onClick={() => {
                    if (!b.current) handleSwitch(b.name)
                  }}
                  disabled={busy}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-2 ${
                    b.current
                      ? 'bg-accent-primary/10 text-accent-primary cursor-default'
                      : 'hover:bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  <BranchIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono truncate">{b.name}</span>
                  {b.current && <span className="ml-auto text-xs text-text-muted">(current)</span>}
                  {!b.current && <span className="ml-auto text-xs text-accent-primary">Switch</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <CreateInputSection
          icon={<BranchIcon />}
          title="Create new branch"
          placeholder="feature/my-branch"
          buttonLabel="Create Branch"
          value={newName}
          onChange={setNewName}
          onCreate={handleCreate}
          canCreate={canCreate}
          busy={busy}
        />

        {newName.trim() && (
          <div className="mt-2 relative">
            <label className="text-xs text-text-muted mb-1 block">Source branch (optional)</label>
            <div className="relative">
              <BranchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={sourceBranch}
                onChange={(e) => {
                  setSourceBranch(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="origin/main (default)"
                className="w-full text-sm bg-bg-primary border border-border-default rounded pl-8 pr-2 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-bg-primary border border-border-default rounded shadow-lg">
                {filteredSuggestions.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSourceBranch(b)
                      setShowSuggestions(false)
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary font-mono"
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-accent-error bg-accent-error/10 p-2 rounded">{error}</p>}
      </div>
    </ModalShell>
  )
}
