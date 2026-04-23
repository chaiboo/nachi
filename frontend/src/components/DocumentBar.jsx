import { useRef, useState } from 'react'
import { uploadDocument } from '../api'
import Logo from './Logo'

export default function DocumentBar({
  documents,
  currentDocId,
  setCurrentDocId,
  refreshDocuments,
  annotationCount = 0,
  onOpenAnnotations,
  theme,
  onToggleTheme,
}) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Title/author auto-detected server-side from PDF metadata.
      const doc = await uploadDocument(file, null, null)
      await refreshDocuments()
      setCurrentDocId(doc.id)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const current = documents.find((d) => d.id === currentDocId)

  return (
    <div className="doc-bar">
      <div className="doc-brand">
        <Logo size={26} />
        <span>Nachi</span>
      </div>
      <div className="doc-picker">
        <select
          className="doc-select"
          value={currentDocId || ''}
          onChange={(e) => setCurrentDocId(e.target.value || null)}
        >
          <option value="">— Select document —</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}{d.author ? ` · ${d.author}` : ''}
            </option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          className="doc-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Upload a new PDF"
        >
          {uploading ? '…' : '+ Upload'}
        </button>
      </div>
      {current && current.author && (
        <div className="doc-author muted">by {current.author}</div>
      )}
      <div className="doc-spacer" />
      {currentDocId && (
        <button
          className="doc-ann-btn"
          onClick={onOpenAnnotations}
          title="Highlights & notes"
        >
          ✎ Annotations
          {annotationCount > 0 && (
            <span className="doc-ann-count">{annotationCount}</span>
          )}
        </button>
      )}
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  )
}
