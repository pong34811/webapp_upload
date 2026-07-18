import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import LoginPage from '../pages/LoginPage'
import Navbar from '../components/Navbar'
import DestinationForm from '../components/DestinationForm'

function renderWithToast(ui) {
  return render(
    <MemoryRouter>
      {ui}
      <ToastContainer position="top-right" autoClose={3000} />
    </MemoryRouter>
  )
}

vi.mock('../api/client', () => ({
  authAPI: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
  destinationAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  uploadAPI: {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    cancel: vi.fn(),
  },
  default: {},
}))

import { authAPI } from '../api/client'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders username and password fields with a submit button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('ชื่อผู้ใช้')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('calls authAPI.login with entered credentials on submit', async () => {
    authAPI.login.mockResolvedValue({ data: {} })
    authAPI.me.mockResolvedValue({ data: { username: 'admin' } })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    await user.type(screen.getByPlaceholderText('ชื่อผู้ใช้'), 'admin')
    await user.type(screen.getByPlaceholderText('รหัสผ่าน'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith('admin', 'secret123')
    })
  })

  it('shows an error toast when login fails', async () => {
    authAPI.login.mockRejectedValue(new Error('bad'))
    const user = userEvent.setup()
    renderWithToast(<LoginPage />)
    await user.type(screen.getByPlaceholderText('ชื่อผู้ใช้'), 'admin')
    await user.type(screen.getByPlaceholderText('รหัสผ่าน'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    await waitFor(() => {
      expect(screen.getByText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')).toBeInTheDocument()
    })
  })
})

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders navigation links', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('อัปโหลด')).toBeInTheDocument()
    expect(screen.getByText('ประวัติ')).toBeInTheDocument()
    expect(screen.getByText('ตั้งค่า')).toBeInTheDocument()
    expect(screen.getByText('ออกจากระบบ')).toBeInTheDocument()
  })

  it('calls authAPI.logout when logout button is clicked', async () => {
    authAPI.logout.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))
    await waitFor(() => {
      expect(authAPI.logout).toHaveBeenCalled()
    })
  })
})

describe('DestinationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows OAuth fields (client_id, client_secret, refresh_token) for YouTube', () => {
    render(
      <MemoryRouter>
        <DestinationForm destination={null} onSubmit={() => {}} onClose={() => {}} />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('Client ID (optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Client Secret (optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Refresh Token (optional)')).toBeInTheDocument()
  })

  it('hides OAuth fields and shows Page ID for Facebook', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DestinationForm destination={null} onSubmit={() => {}} onClose={() => {}} />
      </MemoryRouter>
    )
    await user.selectOptions(screen.getByRole('combobox'), 'facebook')
    expect(screen.queryByPlaceholderText('Client ID (optional)')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Page ID')).toBeInTheDocument()
  })

  it('submits the form with entered values', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DestinationForm destination={null} onSubmit={onSubmit} onClose={() => {}} />
      </MemoryRouter>
    )
    await user.type(screen.getByPlaceholderText('ชื่อ (เช่น ช่อง A)'), 'ช่อง A')
    await user.type(screen.getByPlaceholderText('Access Token'), 'tok123')
    await user.type(screen.getByPlaceholderText('Client ID (optional)'), 'cid')
    await user.type(screen.getByPlaceholderText('Refresh Token (optional)'), 'rtok')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })
    const payload = onSubmit.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: 'ช่อง A',
      access_token: 'tok123',
      client_id: 'cid',
      refresh_token: 'rtok',
      platform: 'youtube',
    })
  })
})
