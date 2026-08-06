// frontend/src/test/oauth.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import SettingsPage from '../pages/SettingsPage'
import { oauthAPI, facebookAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return {
    ...actual,
    destinationAPI: { ...actual.destinationAPI, list: vi.fn().mockResolvedValue({ data: [] }) },
    oauthAPI: { start: vi.fn() },
    facebookAPI: { extend: vi.fn().mockResolvedValue({ data: { destinations: [1] } }) },
    authAPI: { ...actual.authAPI, me: vi.fn().mockResolvedValue({ data: { username: 'admin' } }) },
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
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-success' }, origin: window.location.origin }))
    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อ YouTube สำเร็จ')).toBeInTheDocument()
    })
  })

  it('extends the Facebook token and shows success', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/วาง Facebook Token/), 'EAAxxx')
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Facebook' }))
    await waitFor(() => {
      expect(facebookAPI.extend).toHaveBeenCalledWith('EAAxxx')
      expect(screen.getByText('เชื่อมต่อ Facebook สำเร็จ (1 Page)')).toBeInTheDocument()
    })
  })
})
