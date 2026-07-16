import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, oauthAPI } from '../api/client'
import DestinationForm from '../components/DestinationForm'

export default function SettingsPage() {
  const [destinations, setDestinations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const load = async () => {
    const res = await destinationAPI.list()
    setDestinations(res.data)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === 'oauth-success') {
        toast.success('เชื่อมต่อ YouTube สำเร็จ')
        load()
      } else if (e.data?.type === 'oauth-error') {
        toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
      }
      setConnecting(false)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>จัดการตั้งค่าช่องทาง</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}>เพิ่ม</button>
        <button onClick={handleConnect} disabled={connecting}>
          {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>แพลตฟอร์ม</th>
            <th style={{ padding: 8, textAlign: 'left' }}>ชื่อ</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Token</th>
            <th style={{ padding: 8 }}>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{d.platform}</td>
              <td style={{ padding: 8 }}>{d.name}</td>
              <td style={{ padding: 8 }}>{String(d.access_token).slice(0, 20)}...</td>
              <td style={{ padding: 8, textAlign: 'center' }}>
                <button onClick={() => { setEditing(d); setShowForm(true) }} style={{ marginRight: 8 }}>แก้ไข</button>
                <button onClick={() => handleDelete(d.id)}>ปิดใช้งาน</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showForm && <DestinationForm destination={editing} onSubmit={handleSubmit} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}
