import { NavLink, useNavigate } from 'react-router-dom'
import { authAPI } from '../api/client'
import { toast } from 'react-toastify'

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authAPI.logout()
    toast.success('ออกจากระบบแล้ว')
    navigate('/login')
  }

  const linkCls = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">▲</span>
          Web Upload
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end className={linkCls}>อัปโหลด</NavLink>
          <NavLink to="/templates" className={linkCls}>เทมเพลต</NavLink>
          <NavLink to="/history" className={linkCls}>ประวัติ</NavLink>
          <NavLink to="/settings" className={linkCls}>ตั้งค่า</NavLink>
          <NavLink to="/docs" className={linkCls}>คู่มือ</NavLink>
        </nav>
        <span className="topbar-spacer" />
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">ออกจากระบบ</button>
      </div>
    </header>
  )
}
