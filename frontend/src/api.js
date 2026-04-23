const BASE = '/api'

async function j(url, opts) {
  const r = await fetch(url, opts)
  if (!r.ok) throw new Error(`${opts?.method || 'GET'} ${url} failed: ${await r.text()}`)
  return r.json()
}

export const listAgents = () => j(`${BASE}/agents`)
export const listDocuments = () => j(`${BASE}/documents`)
export const listConversations = (docId) => j(`${BASE}/conversations/${docId}`)
export const listAnnotations = (docId) => j(`${BASE}/annotations/${docId}`)
export const listMessageAnnotations = (docId) =>
  j(`${BASE}/message-annotations/doc/${docId}`)

export const documentFileUrl = (docId) => `${BASE}/documents/${docId}/file`

export async function uploadDocument(file, title, author) {
  const fd = new FormData()
  fd.append('file', file)
  if (title) fd.append('title', title)
  if (author) fd.append('author', author)
  return j(`${BASE}/documents`, { method: 'POST', body: fd })
}

export const ask = (payload) =>
  j(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const reply = (payload) =>
  j(`${BASE}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const createAnnotation = (payload) =>
  j(`${BASE}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const deleteAnnotation = (id) =>
  j(`${BASE}/annotations/${id}`, { method: 'DELETE' })

export const createMessageAnnotation = (payload) =>
  j(`${BASE}/message-annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const deleteMessageAnnotation = (id) =>
  j(`${BASE}/message-annotations/${id}`, { method: 'DELETE' })

export const createAgent = (description) =>
  j(`${BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })

export const getAgent = (id) => j(`${BASE}/agents/${id}`)

export const updateAgent = (id, payload) =>
  j(`${BASE}/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
