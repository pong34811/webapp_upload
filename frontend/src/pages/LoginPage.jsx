import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authAPI } from '../api/client'
import { FaUser, FaLock, FaSignInAlt, FaUpload } from 'react-icons/fa'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.login(username, password)
      const token = res.data.token
      if (!token) {
        toast.error('เข้าสู่ระบบล้มเหลว ไม่ได้รับ token')
        return
      }
      localStorage.setItem('auth_token', token)
      toast.success('เข้าสู่ระบบสำเร็จ')
      window.location.hash = '#/'
      window.location.reload()
    } catch {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card card-pad" style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
          display: 'inline-grid', placeItems: 'center',
          color: '#fff', fontSize: 24, marginBottom: 16,
          boxShadow: '0 4px 14px rgba(79, 110, 247, 0.3)'
        }}>
          <FaUpload />
        </div>
        <h2 style={{ marginBottom: 4 }}>Web Upload</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          เข้าสู่ระบบผู้ดูแล
        </p>
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="field">
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <div style={{ position: 'relative' }}>
              <FaUser style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--faint)', fontSize: 14
              }} />
              <input
                id="username"
                className="input"
                type="text"
                placeholder="ชื่อผู้ใช้"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <FaLock style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--faint)', fontSize: 14
              }} />
              <input
                id="password"
                className="input"
                type="password"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ marginTop: 8 }}>
            <FaSignInAlt />
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}
