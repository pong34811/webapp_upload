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
      const me = await authAPI.me()
      if (!me.data.username) {
        toast.error('เข้าสู่ระบบล้มเหลว ไม่ได้รับ session')
        return
      }
      toast.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card card-pad">
        <h2 style={{ marginBottom: 16 }}>เข้าสู่ระบบผู้ดูแล</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <input
              id="username"
              className="input"
              type="text"
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}
