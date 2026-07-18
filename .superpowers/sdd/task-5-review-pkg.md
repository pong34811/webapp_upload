0b91152 feat: add YouTube OAuth connect button on SettingsPage

 frontend/src/api/client.js          |  4 +++
 frontend/src/pages/SettingsPage.jsx | 31 +++++++++++++++++++-
 frontend/src/test/oauth.test.jsx    | 56 +++++++++++++++++++++++++++++++++++++
 3 files changed, 90 insertions(+), 1 deletion(-)

diff --git a/frontend/src/api/client.js b/frontend/src/api/client.js
index 4eb9d26..a538d28 100644
--- a/frontend/src/api/client.js
+++ b/frontend/src/api/client.js
@@ -34,20 +34,24 @@ export const authAPI = {
   me: () => api.get('/auth/me/'),
 }
 
 export const destinationAPI = {
   list: () => api.get('/destinations/'),
   create: (data) => api.post('/destinations/', data),
   update: (id, data) => api.put(`/destinations/${id}/`, data),
   remove: (id) => api.delete(`/destinations/${id}/`),
 }
 
+export const oauthAPI = {
+  start: () => api.get('/oauth/youtube/start/'),
+}
+
 export const uploadAPI = {
   create: (formData, onProgress) =>
     api.post('/uploads/', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
       onUploadProgress: (e) => {
         if (e.lengthComputable && onProgress) {
           onProgress(Math.round((e.loaded / e.total) * 30))
         }
       },
     }),
diff --git a/frontend/src/pages/SettingsPage.jsx b/frontend/src/pages/SettingsPage.jsx
index b4250ce..bb36d5d 100644
--- a/frontend/src/pages/SettingsPage.jsx
+++ b/frontend/src/pages/SettingsPage.jsx
@@ -1,27 +1,53 @@
 import { useState, useEffect } from 'react'
 import { toast } from 'react-toastify'
-import { destinationAPI } from '../api/client'
+import { destinationAPI, oauthAPI } from '../api/client'
 import DestinationForm from '../components/DestinationForm'
 
 export default function SettingsPage() {
   const [destinations, setDestinations] = useState([])
   const [showForm, setShowForm] = useState(false)
   const [editing, setEditing] = useState(null)
+  const [connecting, setConnecting] = useState(false)
 
   const load = async () => {
     const res = await destinationAPI.list()
     setDestinations(res.data)
   }
 
   useEffect(() => { load() }, [])
 
+  useEffect(() => {
+    const onMsg = (e) => {
+      if (e.data?.type === 'oauth-success') {
+        toast.success('เชื่อมต่อ YouTube สำเร็จ')
+        load()
+      } else if (e.data?.type === 'oauth-error') {
+        toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
+      }
+      setConnecting(false)
+    }
+    window.addEventListener('message', onMsg)
+    return () => window.removeEventListener('message', onMsg)
+  }, [])
+
+  const handleConnect = async () => {
+    setConnecting(true)
+    try {
+      const res = await oauthAPI.start()
+      window.open(res.data.auth_url, '_blank', 'width=600,height=700')
+    } catch {
+      toast.error('ไม่สามารถเริ่มการเชื่อมต่อได้')
+      setConnecting(false)
+    }
+  }
+
   const handleSubmit = async (form) => {
     try {
       if (editing) {
         await destinationAPI.update(editing.id, form)
         toast.success('อัปเดตเรียบร้อย')
       } else {
         await destinationAPI.create(form)
         toast.success('เพิ่มเรียบร้อย')
       }
       setShowForm(false)
@@ -37,20 +63,23 @@ export default function SettingsPage() {
     await destinationAPI.remove(id)
     toast.success('ปิดการใช้งานแล้ว')
     load()
   }
 
   return (
     <div>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
         <h2>จัดการตั้งค่าช่องทาง</h2>
         <button onClick={() => { setEditing(null); setShowForm(true) }}>เพิ่ม</button>
+        <button onClick={handleConnect} disabled={connecting}>
+          {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
+        </button>
       </div>
       <table style={{ width: '100%', borderCollapse: 'collapse' }}>
         <thead>
           <tr style={{ borderBottom: '2px solid #ddd' }}>
             <th style={{ padding: 8, textAlign: 'left' }}>แพลตฟอร์ม</th>
             <th style={{ padding: 8, textAlign: 'left' }}>ชื่อ</th>
             <th style={{ padding: 8, textAlign: 'left' }}>Token</th>
             <th style={{ padding: 8 }}>การจัดการ</th>
           </tr>
         </thead>
diff --git a/frontend/src/test/oauth.test.jsx b/frontend/src/test/oauth.test.jsx
new file mode 100644
index 0000000..94fa299
--- /dev/null
+++ b/frontend/src/test/oauth.test.jsx
@@ -0,0 +1,56 @@
+// frontend/src/test/oauth.test.jsx
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { MemoryRouter } from 'react-router-dom'
+import { ToastContainer } from 'react-toastify'
+import 'react-toastify/dist/ReactToastify.css'
+import SettingsPage from '../pages/SettingsPage'
+import { oauthAPI } from '../api/client'
+
+vi.mock('../api/client', async () => {
+  const actual = await vi.importActual('../api/client')
+  return {
+    ...actual,
+    oauthAPI: { start: vi.fn() },
+  }
+})
+
+function renderPage() {
+  return render(
+    <MemoryRouter>
+      <SettingsPage />
+      <ToastContainer />
+    </MemoryRouter>
+  )
+}
+
+describe('SettingsPage OAuth connect', () => {
+  beforeEach(() => { vi.clearAllMocks() })
+
+  it('opens a popup to the Google auth URL when clicking connect', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://accounts.google.com/auth' } })
+    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const user = userEvent.setup()
+    renderPage()
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
+    await waitFor(() => {
+      expect(oauthAPI.start).toHaveBeenCalled()
+      expect(openSpy).toHaveBeenCalledWith('https://accounts.google.com/auth', '_blank', expect.any(String))
+    })
+    openSpy.mockRestore()
+  })
+
+  it('reloads destinations and shows success on oauth-success message', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
+    vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const user = userEvent.setup()
+    renderPage()
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
+    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
+    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-success' } }))
+    await waitFor(() => {
+      expect(screen.getByText('เชื่อมต่อ YouTube สำเร็จ')).toBeInTheDocument()
+    })
+  })
+})
