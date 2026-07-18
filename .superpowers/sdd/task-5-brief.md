# Task 5: Frontend API client + SettingsPage connect button (entry A)

**Files:**
- Modify: `frontend/src/api/client.js` (add `oauthAPI`)
- Modify: `frontend/src/pages/SettingsPage.jsx` (add "เชื่อมต่อ YouTube" button + popup handling)
- Test: `frontend/src/test/oauth.test.jsx`

**Interfaces:**
- Consumes: backend `GET /api/oauth/youtube/start/` (Task 4).
- Produces: `oauthAPI.start()` returning the auth URL; SettingsPage opens a popup and, on `oauth-success` message, reloads the destination list and shows a success toast.

- [ ] **Step1: Write the failing test**

NOTE: the plan text has typos in the test code (`mockResolvedValue`→`mockResolvedValue`, `screen`→`sceen`, `react-toastify`→`react-toastify`). Use the CORRECT names below (this is the authoritative version):

```javascript
// frontend/src/test/oauth.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import SettingsPage from '../pages/SettingsPage'
import { oauthAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return {
    ...actual,
    oauthAPI: { start: vi.fn() },
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
      <ToastContainer />
    </MemoryRouter>
  )
}

describe('SettingsPage OAuth connect', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('opens a popup to the Google auth URL when clicking connect', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://accounts.google.com/auth' } })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
    await waitFor(() => {
      expect(oauthAPI.start).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith('https://accounts.google.com/auth', '_blank', expect.any(String))
    })
    openSpy.mockRestore()
  })

  it('reloads destinations and shows success on oauth-success message', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
    vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-success' } }))
    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อ YouTube สำเร็จ')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step2: Run test to verify it fails**

Run: `cd frontend && cmd /c "npm test"`
Expected: FAIL — button "เชื่อมต่อ YouTube" not found / `oauthAPI.start` not called.

- [ ] **Step3: Write minimal implementation**

In `frontend/src/api/client.js`, add inside the exported object (after `uploadAPI`):
```javascript
export const oauthAPI = {
  start: () => api.get('/oauth/youtube/start/'),
}
```

In `frontend/src/pages/SettingsPage.jsx`, import `oauthAPI` and add a connect handler + message listener. Add `import { oauthAPI } from '../api/client'` near the other imports. Inside the component add:
```javascript
const [connecting, setConnecting] = useState(false)

useEffect(() => {
  const onMsg = (e) => {
    if (e.data?.type === 'oauth-success') {
      toast.success('เชื่อมต่อ YouTube สำเร็จ')
      load()
    } else if (e.data?.type === 'oauth-error') {
      toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
    }
    setConnecting(false)
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}, [])

const handleConnect = async () => {
  setConnecting(true)
  try {
    const res = await oauthAPI.start()
    window.open(res.data.auth_url, '_blank', 'width=600,height=700')
  } catch {
    toast.error('ไม่สามารถเริ่มการเชื่อมต่อได้')
    setConnecting(false)
  }
}
```
(SettingsPage already imports useState/useEffect? It imports `useState, useEffect` from 'react' — if not, add them.)

Add the button in the header row (next to "เพิ่ม"):
```jsx
<button onClick={handleConnect} disabled={connecting}>
  {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
</button>
```

- [ ] **Step4: Run test to verify it passes**

Run: `cd frontend && cmd /c "npm test"`
Expected: PASS (both new tests).

- [ ] **Step5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/pages/SettingsPage.jsx frontend/src/test/oauth.test.jsx
git commit -m "feat: add YouTube OAuth connect button on SettingsPage"
```
