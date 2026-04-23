import { useEffect, useRef, useState } from 'react'
import { getAgent, updateAgent } from '../api'

export default function EditAgentModal({
  agentId,
  agents,
  onClose,
  onSaved,
}) {
  const [selectedId, setSelectedId] = useState(agentId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#888888')
  const [persona, setPersona] = useState('')
  const [description, setDescription] = useState('')
  const [dirty, setDirty] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    let alive = true
    loadedRef.current = false
    setLoading(true)
    ;(async () => {
      try {
        const a = await getAgent(selectedId)
        if (!alive) return
        setName(a.name || '')
        setColor(a.color || '#888888')
        setPersona(a.persona || '')
        setDescription(a.description || '')
        setDirty(false)
      } catch (err) {
        setError(String(err.message || err))
      } finally {
        if (alive) {
          setLoading(false)
          loadedRef.current = true
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [selectedId])

  function switchTo(id) {
    if (id === selectedId) return
    if (
      dirty &&
      !confirm('You have unsaved changes. Switch scholars anyway?')
    ) {
      return
    }
    setSelectedId(id)
  }

  function markDirty(setter) {
    return (v) => {
      setter(v)
      if (loadedRef.current) setDirty(true)
    }
  }

  async function handleSave(e) {
    e?.preventDefault?.()
    setSaving(true)
    setError(null)
    try {
      await updateAgent(selectedId, { name, color, persona, description })
      await onSaved?.()
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  function handleCloseRequest() {
    if (dirty && !confirm('You have unsaved changes. Close anyway?')) return
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleCloseRequest}>
      <div
        className="modal modal-edit-agent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-agent-layout">
          <aside className="edit-agent-sidebar">
            <div className="edit-agent-sidebar-header">Scholars</div>
            {agents?.map((a) => (
              <button
                key={a.id}
                className={
                  'edit-agent-side-item' +
                  (a.id === selectedId ? ' active' : '')
                }
                onClick={() => switchTo(a.id)}
                type="button"
              >
                <span
                  className="edit-agent-side-dot"
                  style={{ background: a.color }}
                />
                <span className="edit-agent-side-name">{a.name}</span>
                {a.id === selectedId && dirty && (
                  <span className="edit-agent-side-dirty">•</span>
                )}
              </button>
            ))}
          </aside>
          <div className="edit-agent-main">
            <div className="edit-agent-header-row">
              <h3>Edit scholar</h3>
              <button
                className="ann-close"
                onClick={handleCloseRequest}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {loading ? (
              <div className="modal-hint">Loading…</div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="edit-agent-row">
                  <label className="edit-agent-label">Name</label>
                  <input
                    className="edit-agent-input"
                    value={name}
                    onChange={(e) => markDirty(setName)(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="edit-agent-row">
                  <label className="edit-agent-label">Color</label>
                  <div className="edit-agent-color-row">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => markDirty(setColor)(e.target.value)}
                      disabled={saving}
                    />
                    <input
                      className="edit-agent-input"
                      value={color}
                      onChange={(e) => markDirty(setColor)(e.target.value)}
                      disabled={saving}
                      style={{ maxWidth: 120 }}
                    />
                  </div>
                </div>
                <div className="edit-agent-row">
                  <label className="edit-agent-label">Short description</label>
                  <input
                    className="edit-agent-input"
                    value={description}
                    onChange={(e) =>
                      markDirty(setDescription)(e.target.value)
                    }
                    disabled={saving}
                    placeholder="One-liner shown when auto-routing picks the best scholar"
                  />
                </div>
                <div className="edit-agent-row">
                  <label className="edit-agent-label">Persona</label>
                  <textarea
                    className="edit-agent-textarea"
                    value={persona}
                    onChange={(e) => markDirty(setPersona)(e.target.value)}
                    disabled={saving}
                    rows={18}
                  />
                  <div className="modal-hint" style={{ marginTop: '0.25rem' }}>
                    The persona is the scholar's system prompt. Describe their
                    training, home literature, canonical debates, the names and
                    works they reference. Second person ("You are…") works best.
                  </div>
                </div>
                <div className="modal-actions">
                  {savedFlash && (
                    <span className="edit-agent-saved">✓ Saved</span>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleCloseRequest}
                    disabled={saving}
                  >
                    Done
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      saving || !dirty || !name.trim() || !persona.trim()
                    }
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {error && <div className="error">{error}</div>}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
