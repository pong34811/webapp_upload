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
