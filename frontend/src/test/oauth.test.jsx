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
    facebookAPI: { authUrl: vi.fn(), extend: vi.fn().mockResolvedValue({}) },
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

  it('opens the Facebook dialog popup when clicking connect facebook', async () => {
    facebookAPI.authUrl.mockResolvedValue({ data: { auth_url: 'https://www.facebook.com/v25.0/dialog/oauth?response_type=token' } })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Facebook' }))
    await waitFor(() => {
      expect(facebookAPI.authUrl).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith('https://www.facebook.com/v25.0/dialog/oauth?response_type=token', '_blank', expect.any(String))
    })
    openSpy.mockRestore()
  })
})
