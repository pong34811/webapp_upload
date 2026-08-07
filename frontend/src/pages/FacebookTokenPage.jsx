import { useEffect } from 'react'
import { facebookAPI } from '../api/client'

export default function FacebookTokenPage() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('access_token')
    const done = (type, message = '') => {
      if (window.opener) window.opener.postMessage({ type, message }, window.location.origin)
      window.close()
    }
    if (!token) { done('fb-oauth-error', 'ไม่ได้รับ token จาก Facebook'); return }
    ;(async () => {
      try {
        await facebookAPI.extend(token)
        done('fb-oauth-success')
      } catch (e) {
        done('fb-oauth-error', e.response?.data?.error || 'บันทึก token ล้มเหลว')
      }
    })()
  }, [])
  return <p style={{ padding: 40, fontFamily: 'sans-serif' }}>กำลังประมวลผล...</p>
}