import { useState, useEffect } from 'react'

export default function DestinationForm({ destination, onSubmit, onClose }) {
  const [form, setForm] = useState({
    platform: 'youtube',
    name: '',
    access_token: '',
    page_id: '',
  })

  useEffect(() => {
    if (destination) {
      setForm({
        platform: destination.platform,
        name: destination.name,
        access_token: destination.access_token,
        page_id: destination.page_id || '',
      })
    }
  }, [destination])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8, width: 400 }}>
        <h3>{destination ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมาย'}</h3>
        <div style={{ marginBottom: 12 }}>
          <select name="platform" value={form.platform} onChange={handleChange} style={{ width: '100%', padding: 8 }}>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input name="name" placeholder="ชื่อ (เช่น ช่อง A)" value={form.name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
        </div>
        {form.platform === 'facebook' && (
          <div style={{ marginBottom: 12 }}>
            <input name="page_id" placeholder="Page ID" value={form.page_id} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ flex: 1, padding: 8 }}>บันทึก</button>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 8 }}>ยกเลิก</button>
        </div>
      </form>
    </div>
  )
}
