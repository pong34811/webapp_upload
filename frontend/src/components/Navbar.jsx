import { NavLink, useNavigate } from 'react-router-dom'
import { authAPI } from '../api/client'
import { toast } from 'react-toastify'
import { FaUpload, FaHistory, FaCog, FaBook, FaClipboardList, FaSignOutAlt } from 'react-icons/fa'

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
          <NavLink to="/" end className={linkCls}><FaUpload /> <span className="nav-text">อัปโหลด</span></NavLink>
          <NavLink to="/templates" className={linkCls}><FaClipboardList /> <span className="nav-text">เทมเพลต</span></NavLink>
          <NavLink to="/history" className={linkCls}><FaHistory /> <span className="nav-text">ประวัติ</span></NavLink>
          <NavLink to="/settings" className={linkCls}><FaCog /> <span className="nav-text">ตั้งค่า</span></NavLink>
          <NavLink to="/docs" className={linkCls}><FaBook /> <span className="nav-text">คู่มือ</span></NavLink>
        </nav>
        <span className="topbar-spacer" />
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          <FaSignOutAlt /> ออกจากระบบ
        </button>
      </div>
    </header>
  )
}
