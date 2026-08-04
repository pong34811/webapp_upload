import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import UploadPage from '../pages/UploadPage'

vi.mock('../api/client', () => ({
  destinationAPI: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 1, platform: 'youtube', name: 'Ch A' }] }),
  },
  uploadAPI: {
    create: vi.fn(),
    get: vi.fn().mockResolvedValue({ data: { status: 'success', progress: 100, error_message: '' } }),
    cancel: vi.fn(),
  },
  authAPI: {},
  oauthAPI: {},
}))

import { uploadAPI } from '../api/client'

function fileList(names) {
  return names.map((n) => new File(['x'.repeat(4)], n, { type: 'video/mp4' }))
}

function fileInput() {
  const form = screen.getByRole('button', { name: /เริ่มอัปโหลด/ }).closest('form')
  return form.querySelector('input[type=file]')
}

describe('UploadPage batch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows one editable task per selected file', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <UploadPage />
        <ToastContainer />
      </MemoryRouter>
    )
    await waitFor(() => screen.getAllByRole('combobox').length >= 1)
    await user.upload(fileInput(), fileList(['a.mp4', 'b.mp4', 'c.mp4']))
    expect(screen.getByText('a.mp4')).toBeInTheDocument()
    expect(screen.getByText('b.mp4')).toBeInTheDocument()
    expect(screen.getByText('c.mp4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เริ่มอัปโหลด (3 รายการ)' })).toBeInTheDocument()
  })

  it('creates one upload job per task on submit, each with its own metadata', async () => {
    uploadAPI.create.mockResolvedValue({ data: { id: 99, status: 'pending' } })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <UploadPage />
        <ToastContainer />
      </MemoryRouter>
    )
    await waitFor(() => screen.getAllByRole('combobox').length >= 1)
    await user.selectOptions(screen.getAllByRole('combobox')[0], '1')
    await user.upload(fileInput(), fileList(['a.mp4', 'b.mp4']))
    // กรอก title ต่างกันต่อ task (table รายบรรทัด)
    const titleInputs = screen.getAllByPlaceholderText('ใช้ชื่อไฟล์')
    await user.type(titleInputs[0], 'Video A')
    await user.type(titleInputs[1], 'Video B')
    await user.click(screen.getByRole('button', { name: 'เริ่มอัปโหลด (2 รายการ)' }))

    await waitFor(() => expect(uploadAPI.create).toHaveBeenCalledTimes(2))
    const formData = uploadAPI.create.mock.calls[0][0]
    expect(formData.get('title')).toBe('Video A')
    const formData2 = uploadAPI.create.mock.calls[1][0]
    expect(formData2.get('title')).toBe('Video B')
  })

  it('removes a task from the batch', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <UploadPage />
        <ToastContainer />
      </MemoryRouter>
    )
    await waitFor(() => screen.getAllByRole('combobox').length >= 1)
    await user.upload(fileInput(), fileList(['a.mp4', 'b.mp4']))
    const removeButtons = screen.getAllByRole('button', { name: /ลบ/ })
    await user.click(removeButtons[0])
    expect(screen.queryByText('a.mp4')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เริ่มอัปโหลด (1 รายการ)' })).toBeInTheDocument()
  })
})