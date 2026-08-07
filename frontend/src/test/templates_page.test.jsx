import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from 'react-toastify'
import TemplatesPage from '../pages/TemplatesPage'

const mockTemplates = [
  { id: 1, name: 'A', title: 'TA', description: 'DA', tags: 'GA', created_at: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'B', title: 'TB', description: 'DB', tags: 'GB', created_at: '2026-08-02T00:00:00Z' },
]

vi.mock('../api/client', () => ({
  templateAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

import { templateAPI } from '../api/client'

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    templateAPI.list.mockResolvedValue({ data: mockTemplates })
    templateAPI.create.mockResolvedValue({ data: mockTemplates[0] })
    templateAPI.update.mockResolvedValue({ data: mockTemplates[0] })
    templateAPI.remove.mockResolvedValue({})
  })

  it('lists all templates', async () => {
    render(
      <>
        <TemplatesPage />
        <ToastContainer />
      </>
    )
    expect(await screen.findByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('TA')).toBeInTheDocument()
  })

  it('creates a template from the page', async () => {
    const user = userEvent.setup()
    render(
      <>
        <TemplatesPage />
        <ToastContainer />
      </>
    )
    await screen.findByText('A')
    await user.click(screen.getByRole('button', { name: 'สร้างเทมเพลต' }))
    await user.type(screen.getByLabelText('ชื่อเทมเพลต'), 'NewT')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(() => expect(templateAPI.create).toHaveBeenCalled())
  })

  it('deletes a template after confirm', async () => {
    const user = userEvent.setup()
    render(
      <>
        <TemplatesPage />
        <ToastContainer />
      </>
    )
    await screen.findByText('A')
    await user.click(screen.getAllByText('ลบ')[0])
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }))
    await waitFor(() => expect(templateAPI.remove).toHaveBeenCalledWith(1))
  })
})
