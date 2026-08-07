import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import FacebookTokenPage from '../pages/FacebookTokenPage'
import { facebookAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return { ...actual, facebookAPI: { extend: vi.fn().mockResolvedValue({}) } }
})

function mockOpener() {
  const opener = { postMessage: vi.fn() }
  Object.defineProperty(window, 'opener', { value: opener, writable: true, configurable: true })
  return opener
}

describe('FacebookTokenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = '#access_token=EAAtest123'
    vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  it('extends the token from the hash and notifies the opener', async () => {
    const opener = mockOpener()
    render(<FacebookTokenPage />)
    await waitFor(() => expect(facebookAPI.extend).toHaveBeenCalledWith('EAAtest123'))
    expect(opener.postMessage).toHaveBeenCalledWith({ type: 'fb-oauth-success', message: '' }, window.location.origin)
  })

  it('reports error when no token in hash', async () => {
    const opener = mockOpener()
    window.location.hash = ''
    render(<FacebookTokenPage />)
    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith(
      { type: 'fb-oauth-error', message: 'ไม่ได้รับ token จาก Facebook' }, window.location.origin
    ))
  })
})