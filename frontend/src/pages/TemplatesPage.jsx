import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { templateAPI } from '../api/client'
import TemplateModal from '../components/TemplateModal'
import { FaClipboardList, FaPlus, FaPencilAlt, FaTrash, FaCalendar } from 'react-icons/fa'

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
        <h2 className="page-title"><FaClipboardList style={{ marginRight: 10, verticalAlign: 'middle', color: 'var(--accent)' }} />เทมเพลต</h2>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, mode: 'create', initial: null })}>
          <FaPlus /> สร้างเทมเพลต
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">📝</span>
          <p className="empty-title">ยังไม่มีเทมเพลต</p>
          <p className="empty-text">สร้างเทมเพลตเพื่อบันทึกข้อมูลที่ใช้บ่อย</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Title</th>
                <th>คำอธิบาย</th>
                <th>แท็ก</th>
                <th>สร้างเมื่อ</th>
                <th style={{ width: 100 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="cell-title">{t.name}</td>
                  <td className="cell-truncate" title={t.title}>{t.title}</td>
                  <td className="cell-truncate" title={t.description}>{t.description}</td>
                  <td className="cell-truncate" title={t.tags}>{t.tags}</td>
                  <td className="cell-date">{new Date(t.created_at).toLocaleString('th-TH')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, mode: 'edit', initial: t })}>
                        <FaPencilAlt /> แก้ไข
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t)}>
                        <FaTrash /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
            <h3 className="tpl-modal-title">🗑️ ลบเทมเพลต "{confirmDelete.name}"?</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 16px' }}>การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <div className="tpl-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}><FaTrash /> ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
