import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { templateAPI } from '../api/client'
import TemplateModal from '../components/TemplateModal'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [modal, setModal] = useState({ open: false, mode: 'create', initial: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { templateAPI.list().then((res) => setTemplates(res.data)) }, [])

  const handleSaved = (saved) => {
    setTemplates((prev) => [...prev.filter((t) => t.id !== saved.id), saved])
    setModal({ open: false, mode: 'create', initial: null })
  }

  const handleDelete = async () => {
    try {
      await templateAPI.remove(confirmDelete.id)
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id))
      setConfirmDelete(null)
      toast.success('ลบเทมเพลตแล้ว')
    } catch { toast.error('ลบเทมเพลตไม่สำเร็จ') }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">เทมเพลต</h2>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, mode: 'create', initial: null })}>สร้างเทมเพลต</button>
      </div>
      <div className="card card-pad">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Title</th>
                <th>คำอธิบาย</th>
                <th>แท็ก</th>
                <th>สร้างเมื่อ</th>
                <th style={{ width: 88 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="cell-title">{t.name}</td>
                  <td>{t.title}</td>
                  <td>{t.description}</td>
                  <td>{t.tags}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, mode: 'edit', initial: t })}>แก้ไข</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <TemplateModal
        open={modal.open}
        mode={modal.mode}
        initial={modal.initial}
        templates={templates}
        onSaved={handleSaved}
        onClose={() => setModal({ open: false, mode: 'create', initial: null })}
      />
      {confirmDelete && (
        <div className="tpl-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tpl-modal-title">ลบเทมเพลต "{confirmDelete.name}"?</h3>
            <div className="tpl-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
