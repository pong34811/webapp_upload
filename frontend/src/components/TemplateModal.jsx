import { useState } from 'react'
import { toast } from 'react-toastify'
import { templateAPI } from '../api/client'

export default function TemplateModal({ open, mode, initial, templates, onSaved, onClose }) {
  const [name, setName] = useState(initial?.name || '')
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [tags, setTags] = useState(initial?.tags || '')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('กรุณาใส่ชื่อเทมเพลต'); return }
    const payload = { name: name.trim(), title, description, tags }
    const existing = mode === 'create' ? templates.find((t) => t.name === name.trim()) : null
    try {
      const res = existing ? await templateAPI.update(existing.id, payload) : mode === 'edit'
        ? await templateAPI.update(initial.id, payload)
        : await templateAPI.create(payload)
      onSaved(res.data)
    } catch { toast.error('บันทึกเทมเพลตไม่สำเร็จ') }
  }

  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="tpl-modal-title">{mode === 'edit' ? 'แก้ไขเทมเพลต' : 'บันทึกเทมเพลต'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="tpl-name">ชื่อเทมเพลต</label>
            <input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-title">Title (ชื่อคลิป)</label>
            <input id="tpl-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-desc">คำอธิบาย</label>
            <textarea id="tpl-desc" className="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-tags">แท็ก</label>
            <textarea id="tpl-tags" className="textarea" rows={3} value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="tpl-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  )
}
