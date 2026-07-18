import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { authAPI } from '../api/client'

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking') // checking | ok | denied

  useEffect(() => {
    let active = true
    authAPI
      .me()
      .then(() => active && setState('ok'))
      .catch(() => active && setState('denied'))
    return () => {
      active = false
    }
  }, [])

  if (state === 'checking') return null
  if (state === 'denied') return <Navigate to="/login" replace />
  return children
}
