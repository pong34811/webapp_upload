c96146b feat: add YouTube OAuth connect button in DestinationForm

 frontend/src/components/DestinationForm.jsx       | 22 +++++++++++++-
 frontend/src/test/destination_form_oauth.test.jsx | 36 +++++++++++++++++++++++
 2 files changed, 57 insertions(+), 1 deletion(-)

diff --git a/frontend/src/components/DestinationForm.jsx b/frontend/src/components/DestinationForm.jsx
index da4eb86..0963385 100644
--- a/frontend/src/components/DestinationForm.jsx
+++ b/frontend/src/components/DestinationForm.jsx
@@ -1,11 +1,13 @@
 import { useState, useEffect } from 'react'
+import { toast } from 'react-toastify'
+import { oauthAPI } from '../api/client'
 
 export default function DestinationForm({ destination, onSubmit, onClose }) {
   const [form, setForm] = useState({
     platform: 'youtube',
     name: '',
     access_token: '',
     page_id: '',
     client_id: '',
     client_secret: '',
     refresh_token: '',
@@ -22,43 +24,61 @@ export default function DestinationForm({ destination, onSubmit, onClose }) {
         client_secret: destination.client_secret || '',
         refresh_token: destination.refresh_token || '',
       })
     }
   }, [destination])
 
   const handleChange = (e) => {
     setForm({ ...form, [e.target.name]: e.target.value })
   }
 
+  useEffect(() => {
+    const onMsg = (e) => {
+      if (e.data?.type === 'oauth-success') {
+        toast.success('เชื่อมต่อช่อง YouTube สำเร็จ กรุณาตรวจสอบข้อมูลแล้วบันทึก')
+      }
+    }
+    window.addEventListener('message', onMsg)
+    return () => window.removeEventListener('message', onMsg)
+  }, [])
+
+  const handleConnectGoogle = async () => {
+    const res = await oauthAPI.start()
+    window.open(res.data.auth_url, '_blank', 'width=600,height=700')
+  }
+
   const handleSubmit = (e) => {
     e.preventDefault()
     onSubmit(form)
   }
 
   return (
     <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
       <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8, width: 400 }}>
         <h3>{destination ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมาย'}</h3>
         <div style={{ marginBottom: 12 }}>
           <select name="platform" value={form.platform} onChange={handleChange} style={{ width: '100%', padding: 8 }}>
             <option value="youtube">YouTube</option>
             <option value="facebook">Facebook</option>
           </select>
         </div>
         <div style={{ marginBottom: 12 }}>
           <input name="name" placeholder="ชื่อ (เช่น ช่อง A)" value={form.name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
         </div>
         <div style={{ marginBottom: 12 }}>
-          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
+          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
         </div>
         {form.platform === 'youtube' && (
           <>
+            <div style={{ marginBottom: 12 }}>
+              <button type="button" onClick={handleConnectGoogle}>เชื่อมต่อ Google</button>
+            </div>
             <div style={{ marginBottom: 12 }}>
               <input name="client_id" placeholder="Client ID (optional)" value={form.client_id} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
             </div>
             <div style={{ marginBottom: 12 }}>
               <input name="client_secret" placeholder="Client Secret (optional)" value={form.client_secret} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
             </div>
             <div style={{ marginBottom: 12 }}>
               <input name="refresh_token" placeholder="Refresh Token (optional)" value={form.refresh_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
             </div>
           </>
diff --git a/frontend/src/test/destination_form_oauth.test.jsx b/frontend/src/test/destination_form_oauth.test.jsx
new file mode 100644
index 0000000..de459a2
--- /dev/null
+++ b/frontend/src/test/destination_form_oauth.test.jsx
@@ -0,0 +1,36 @@
+// frontend/src/test/destination_form_oauth.test.jsx
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { MemoryRouter } from 'react-router-dom'
+import DestinationForm from '../components/DestinationForm'
+import { oauthAPI } from '../api/client'
+
+vi.mock('../api/client', async () => {
+  const actual = await vi.importActual('../api/client')
+  return { ...actual, oauthAPI: { start: vi.fn() } }
+})
+
+describe('DestinationForm OAuth button', () => {
+  beforeEach(() => { vi.clearAllMocks() })
+
+  it('shows connect button for youtube and submits form', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
+    vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const onSubmit = vi.fn()
+    const user = userEvent.setup()
+    render(
+      <MemoryRouter>
+        <DestinationForm destination={null} onSubmit={onSubmit} onClose={() => {}} />
+      </MemoryRouter>
+    )
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Google' }))
+    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
+    window.dispatchEvent(new MessageEvent('message', {
+      data: { type: 'oauth-success' },
+    }))
+    await user.type(screen.getByPlaceholderText('ชื่อ (เช่น ช่อง A)'), 'ช่องใหม่')
+    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
+    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
+  })
+})
