import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from 'react-toastify'
import TemplateModal from '../components/TemplateModal'

vi.mock('../api/client', () => ({
  templateAPI: {
    create: vi.fn().mockResolvedValue({ data: { id: 1, name: 'T', title: 'X', description: 'D', tags: 'G' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 1, name: 'T', title: 'X', description: 'D', tags: 'G' } }),
  },
}))

import { templateAPI } from '../api/client'

const existing = [{ id: 9, name: 'Old', title: '', description: '', tags: '' }]

describe('TemplateModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when closed', () => {
    const { container } = render(<TemplateModal open={false} mode="create" initial={null} templates={[]} onSaved={() => {}} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('prefills fields from initial on create mode', () => {
    render(<TemplateModal open mode="create" initial={{ name: 'Pre', title: 'T1', description: 'D1', tags: 'G1' }} templates={[]} onSaved={() => {}} onClose={() => {}} />)
    expect(screen.getByLabelText('ชื่อเทมเพลต')).toHaveValue('Pre')
    expect(screen.getByLabelText('Title (ชื่อคลิป)')).toHaveValue('T1')
    expect(screen.getByLabelText('คำอธิบาย')).toHaveValue('D1')
    expect(screen.getByLabelText('แท็ก')).toHaveValue('G1')
  })

  it('creates a new template with all fields', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <>
        <TemplateModal open mode="create" initial={null} templates={existing} onSaved={onSaved} onClose={() => {}} />
        <ToastContainer />
      </>
    )
    await user.type(screen.getByLabelText('ชื่อเทมเพลต'), 'NewT')
    await user.type(screen.getByLabelText('Title (ชื่อคลิป)'), 'NewTitle')
    await user.type(screen.getByLabelText('คำอธิบาย'), 'NewDesc')
    await user.type(screen.getByLabelText('แท็ก'), 'NewTags')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(() => expect(templateAPI.create).toHaveBeenCalledWith({ name: 'NewT', title: 'NewTitle', description: 'NewDesc', tags: 'NewTags' }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it('duplicate name in create mode calls update instead of create', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <>
        <TemplateModal open mode="create" initial={null} templates={[{ id: 9, name: 'Dup', title: '', description: '', tags: '' }]} onSaved={onSaved} onClose={() => {}} />
        <ToastContainer />
      </>
    )
    await user.type(screen.getByLabelText('ชื่อเทมเพลต'), 'Dup')
    await user.type(screen.getByLabelText('คำอธิบาย'), 'D2')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(() => expect(templateAPI.update).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'Dup', description: 'D2' })))
    expect(templateAPI.create).not.toHaveBeenCalled()
  })

  it('requires a name', async () => {
    const user = userEvent.setup()
    render(
      <>
        <TemplateModal open mode="create" initial={null} templates={[]} onSaved={() => {}} onClose={() => {}} />
        <ToastContainer />
      </>
    )
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(templateAPI.create).not.toHaveBeenCalled()
    expect(screen.getByText('กรุณาใส่ชื่อเทมเพลต')).toBeInTheDocument()
  })
})
