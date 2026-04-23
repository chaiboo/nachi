import { useState } from 'react'
import { createAgent } from '../api'

export default function NewAgentModal({ onClose, onCreated }) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    try {
      const agent = await createAgent(description.trim())
      onCreated(agent)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New scholar</h3>
        <p className="modal-hint">
          Describe the scholar you want in one or two sentences. Claude will
          draft a full persona from it.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            autoFocus
            placeholder="e.g. A media theorist specializing in televangelism and the political economy of religious broadcasting."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={loading}
          />
          <div className="modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !description.trim()}
            >
              {loading ? 'Drafting…' : 'Create'}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="modal-footnote muted">
            Takes ~25–30s. The persona file lands in <code>backend/agents/</code>
            — you can edit it directly.
          </div>
        </form>
      </div>
    </div>
  )
}
