# Task 6: DestinationForm connect button (entry B)

**Files:**
- Modify: `frontend/src/components/DestinationForm.jsx` (add "เชื่อมต่อ Google" button + popup handling)
- Test: `frontend/src/test/destination_form_oauth.test.jsx`

**Interfaces:**
- Consumes: `oauthAPI.start()` (Task 5); `onSubmit`/form state already in the component.
- Produces: when platform=youtube, show "เชื่อมต่อ Google"; on success message, show a success toast (the backend already created/updated the Destination with tokens on callback — the form is an alternative path that lets the user edit the name and save).

- [ ] **Step1: Write the failing test**

NOTE: the plan had typos (`mockResolvedValue`→`mockResolvedValue`, `screen`→`sceen`); use CORRECT names below (authoritative):

```javascript
// frontend/src/test/destination_form_oauth.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DestinationForm from '../components/DestinationForm'
import { oauthAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return { ...actual, oauthAPI: { start: vi.fn() } }
})

describe('DestinationForm OAuth button', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows connect button for youtube and submits form', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
    vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DestinationForm destination={null} onSubmit={onSubmit} onClose={() => {}} />
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Google' }))
    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'oauth-success' },
    }))
    await user.type(screen.getByPlaceholderText('ชื่อ (เช่น ช่อง A)'), 'ช่องใหม่')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})
```

- [ ] **Step2: Run test to verify it fails**

Run: `cd frontend && cmd /c "npm test"`
Expected: FAIL — "เชื่อมต่อ Google" button not found.

- [ ] **Step3: Write minimal implementation**

In `frontend/src/components/DestinationForm.jsx`, import `oauthAPI` and add a connect handler + message listener. Inside the youtube-only block add the button:
```jsx
{form.platform === 'youtube' && (
  <>
    <div style={{ marginBottom: 12 }}>
      <button type="button" onClick={handleConnectGoogle}>เชื่อมต่อ Google</button>
    </div>
    {/* existing client_id / secret / refresh_token inputs */}
  </>
)}
```

Add handler + listener (import `oauthAPI` from '../api/client'; ensure `useEffect` is imported from 'react'):
```javascript
useEffect(() => {
  const onMsg = (e) => {
    if (e.data?.type === 'oauth-success') {
      toast.success('เชื่อมต่อช่อง YouTube สำเร็จ กรุณาตรวจสอบข้อมูลแล้วบันทึก')
    }
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}, [])

const handleConnectGoogle = async () => {
  const res = await oauthAPI.start()
  window.open(res.data.auth_url, '_blank', 'width=600,height=700')
}
```
Note: Because the backend creates/updates the Destination directly on callback, entry B is an alternative path; the form still lets the user edit the name and save. Keep behavior simple and consistent with entry A.

- [ ] **Step4: Run test to verify it passes**

Run: `cd frontend && cmd /c "npm test"`
Expected: PASS (new test). Full suite still green.

- [ ] **Step5: Commit**

```bash
git add frontend/src/components/DestinationForm.jsx frontend/src/test/destination_form_oauth.test.jsx
git commit -m "feat: add YouTube OAuth connect button in DestinationForm"
```
