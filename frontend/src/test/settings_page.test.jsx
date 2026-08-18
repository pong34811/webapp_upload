import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SettingsPage from '../pages/SettingsPage'

const baseDest = (overrides = {}) => ({
  id: 1,
  platform: 'facebook',
  name: 'Katy404',
  access_token: 'EAAWtesttoken',
  page_id: '123',
  token_expires_at: null,
  data_access_expires_at: null,
  created_at: '2026-08-03T08:59:51Z',
  updated_at: '2026-08-10T08:38:35Z',
  ...overrides,
})

vi.mock('../api/client', () => ({
  destinationAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  oauthAPI: {
    start: vi.fn(),
  },
  facebookAPI: {
    authUrl: vi.fn(),
  },
}))

import { destinationAPI } from '../api/client'

describe('SettingsPage expiry column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWith = (destinations) => {
    destinationAPI.list.mockResolvedValue({ data: destinations })
    render(<SettingsPage />)
  }

  it('shows the "(data access)" label when only data_access_expires_at is set', async () => {
    renderWith([baseDest({ data_access_expires_at: '2026-11-05T10:13:39+07:00' })])
    const row = await screen.findByRole('row', { name: /Katy404/ })
    expect(within(row).getByText(/data access/)).toBeInTheDocument()
    expect(within(row).queryByText('ไม่มีวันหมดอายุ')).not.toBeInTheDocument()
    // tooltip explains what the date means
    expect(screen.getByTitle('วันหมดอายุการเข้าถึงข้อมูล (data access)')).toBeInTheDocument()
  })

  it('shows token expiry without the data-access label when both dates are set', async () => {
    renderWith([baseDest({
      token_expires_at: '2026-10-01T00:00:00+07:00',
      data_access_expires_at: '2026-11-05T10:13:39+07:00',
    })])
    const row = await screen.findByRole('row', { name: /Katy404/ })
    expect(within(row).queryByText(/data access/)).not.toBeInTheDocument()
    expect(within(row).queryByText('ไม่มีวันหมดอายุ')).not.toBeInTheDocument()
  })

  it('shows token expiry without the data-access label when only token_expires_at is set', async () => {
    renderWith([baseDest({ token_expires_at: '2026-10-01T00:00:00+07:00' })])
    const row = await screen.findByRole('row', { name: /Katy404/ })
    expect(within(row).queryByText(/data access/)).not.toBeInTheDocument()
    expect(within(row).queryByText('ไม่มีวันหมดอายุ')).not.toBeInTheDocument()
  })

  it('shows "ไม่มีวันหมดอายุ" when neither expiry field is set', async () => {
    renderWith([baseDest({})])
    const row = await screen.findByRole('row', { name: /Katy404/ })
    expect(within(row).getByText('ไม่มีวันหมดอายุ')).toBeInTheDocument()
  })
})
