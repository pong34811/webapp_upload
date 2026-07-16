import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authAPI } from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.login(username, password)
      toast.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h2>เข้าสู่ระบบผู้ดูแล</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
