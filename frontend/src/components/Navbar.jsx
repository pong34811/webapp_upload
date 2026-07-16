import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api/client'
import { toast } from 'react-toastify'

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authAPI.logout()
    toast.success('ออกจากระบบแล้ว')
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', gap: 20, padding: '12px 20px', background: '#1a1a2e', color: '#fff' }}>
      <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>อัปโหลด</Link>
      <Link to="/history" style={{ color: '#fff', textDecoration: 'none' }}>ประวัติ</Link>
      <Link to="/settings" style={{ color: '#fff', textDecoration: 'none' }}>ตั้งค่า</Link>
      <button onClick={handleLogout} style={{ marginLeft: 'auto', background: 'none', color: '#fff', border: '1px solid #fff', padding: '4px 12px', cursor: 'pointer' }}>
        ออกจากระบบ
      </button>
    </nav>
  )
}
