import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, oauthAPI, facebookAPI } from '../api/client'
import DestinationForm from '../components/DestinationForm'

export default function SettingsPage() {
  const [destinations, setDestinations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [fbBusy, setFbBusy] = useState(false)

  const load = async () => {
    const res = await destinationAPI.list()
    setDestinations(res.data)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'fb-oauth-success') {
        toast.success('เชื่อมต่อ Facebook สำเร็จ')
        load()
      } else if (e.data?.type === 'fb-oauth-error') {
        toast.error('เชื่อมต่อ Facebook ล้มเหลว: ' + (e.data.message || ''))
      } else if (e.data?.type === 'oauth-success') {
        toast.success('เชื่อมต่อ YouTube สำเร็จ')
        load()
      } else if (e.data?.type === 'oauth-error') {
        toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
      }
      setConnecting(false)
      setFbBusy(false)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await oauthAPI.start()
      window.open(res.data.auth_url, '_blank', 'width=600,height=700')
    } catch {
      toast.error('ไม่สามารถเริ่มการเชื่อมต่อได้')
      setConnecting(false)
    }
  }

  const handleFbConnect = async () => {
    setFbBusy(true)
    try {
      const res = await facebookAPI.authUrl()
      window.open(res.data.auth_url, '_blank', 'width=600,height=700')
    } catch (e) {
      toast.error('เชื่อมต่อไม่สำเร็จ: ' + (e.response?.data?.error || 'ลองอีกครั้ง'))
      setFbBusy(false)
    }
  }

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await destinationAPI.update(editing.id, form)
        toast.success('อัปเดตเรียบร้อย')
      } else {
        await destinationAPI.create(form)
        toast.success('เพิ่มเรียบร้อย')
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('ต้องการปิดการใช้งานใช่หรือไม่?')) return
    await destinationAPI.remove(id)
    toast.success('ปิดการใช้งานแล้ว')
    load()
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">จัดการตั้งค่าช่องทาง</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>เพิ่ม</button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 8 }}>เชื่อมต่อ Facebook (Page)</h3>
        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          กดปุ่มเพื่อเข้า Facebook login → ระบบบันทึก token ให้อัตโนมัติ (~60 วัน) พร้อมยืดอายุต่อได้ไม่ต้องเข้าเว็บ dev
        </p>
        <button className="btn btn-primary" onClick={handleFbConnect} disabled={fbBusy}>
          {fbBusy ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ Facebook'}
        </button>
      </div>
      {destinations.length === 0 ? (
        <div className="card empty">
          <p className="empty-title">ยังไม่มีช่องทางที่เชื่อมต่อ</p>
          <p className="empty-text">เพิ่มช่อง YouTube หรือ Facebook เพื่อเริ่มอัปโหลด</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>แพลตฟอร์ม</th>
                <th>ชื่อ</th>
                <th>Token</th>
                <th style={{ textAlign: 'right' }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => (
                <tr key={d.id}>
                  <td>{d.platform}</td>
                  <td className="cell-title">{d.name}</td>
                  <td className="cell-mono">{String(d.access_token).slice(0, 20)}...</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(d); setShowForm(true) }} style={{ marginRight: 8 }}>แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}>ปิดใช้งาน</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <DestinationForm destination={editing} onSubmit={handleSubmit} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}
