import { useEffect, useState } from 'react'
import { authAPI } from '../api/client'

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking') // checking | ok | denied

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setState('denied')
      return
    }
    authAPI
      .me()
      .then(() => active && setState('ok'))
      .catch(() => {
        localStorage.removeItem('auth_token')
        active && setState('denied')
      })
    return () => {
      active = false
    }
  }, [])

  if (state === 'checking') return null
  if (state === 'denied') {
    window.location.hash = '#/login'
    return null
  }
  return children
}
