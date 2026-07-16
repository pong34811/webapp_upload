import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: 20 }}>
        <Outlet />
      </div>
    </div>
  )
}
