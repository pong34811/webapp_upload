import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { oauthAPI } from '../api/client'

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

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'oauth-success') {
        toast.success('เชื่อมต่อช่อง YouTube สำเร็จ กรุณาตรวจสอบข้อมูลแล้วบันทึก')
        onClose()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const handleConnectGoogle = async () => {
    const res = await oauthAPI.start()
    window.open(res.data.auth_url, '_blank', 'width=600,height=700')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="modal">
        <h3 style={{ marginBottom: 16 }}>{destination ? 'แก้ไข Member Platform Upload' : 'เพิ่ม Member Platform Upload'}</h3>
        <div className="field">
          <label htmlFor="platform">แพลตฟอร์ม</label>
          <select id="platform" className="select" name="platform" value={form.platform} onChange={handleChange}>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="name">ชื่อ</label>
          <input id="name" className="input" name="name" placeholder="ชื่อ (เช่น ช่อง A)" value={form.name} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="access_token">Access Token</label>
          <input id="access_token" className="input" name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} />
        </div>
        {form.platform === 'youtube' && (
          <div className="field">
            <button type="button" className="btn btn-ghost" onClick={handleConnectGoogle}>เชื่อมต่อ Google</button>
          </div>
        )}
        {form.platform === 'facebook' && (
          <div className="field">
            <label htmlFor="page_id">Page ID</label>
            <input id="page_id" className="input" name="page_id" placeholder="Page ID" value={form.page_id} onChange={handleChange} required />
          </div>
        )}
        <div className="modal-row">
          <button type="submit" className="btn btn-primary">บันทึก</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        </div>
      </form>
    </div>
  )
}
