import '@testing-library/jest-dom'

// jsdom ไม่มี URL.createObjectURL — mock สำหรับ video preview
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}
