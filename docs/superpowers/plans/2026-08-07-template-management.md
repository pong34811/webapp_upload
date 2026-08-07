# Template Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้สร้าง/จัดการ template (title+description+tags) ได้ผ่าน modal ในหน้า Upload และหน้าแยก `/templates`

**Architecture:** เพิ่ม field `title` ใน model `UploadTemplate` + migration + serializer; ด้าน frontend สร้าง `TemplateModal` component เดียว reuse 2 หน้า, แก้ `UploadPage` ให้ใช้ modal แทน input เดิม, สร้างหน้าใหม่ `TemplatesPage` + route + nav

**Tech Stack:** Django REST Framework (backend), React 18 + Vite + Vitest/RTL (frontend)

## Global Constraints

- Backend Python Django 5.2, DRF; run migrations via `backend/manage.py makemigrations uploads && migrate`
- Frontend: React 18, react-router-dom 6, react-toastify; test ผ่าน Vitest (`npm test` ใน `frontend/`)
- API endpoints ใช้ `templateAPI` จาก `frontend/src/api/client.js` — ไม่เพิ่ม dependency ใหม่
- ภาษา UI เป็นภาษาไทยตามหน้าเดิม
- ไม่มี comments ในโค้ด (ตามสไตล์โค้ด base)
- การทดสอบเป็น component test (Vitest + RTL) แบบ `frontend/src/test/*.test.jsx`

---

### Task 1: เพิ่ม field `title` ใน model + migration

**Files:**
- Modify: `backend/uploads/models.py:31-44`
- Create: `backend/uploads/migrations/0005_uploadtemplate_title.py` (generated)

**Interfaces:**
- Consumes: `UploadTemplate` model เดิม (fields: name, description, tags, created_by)
- Produces: `UploadTemplate.title = CharField(max_length=255, blank=True, default="")`

- [ ] **Step 1: แก้ model**

แก้ `backend/uploads/models.py` class `UploadTemplate` (บรรทัด 32) เพิ่ม field:

```python
class UploadTemplate(models.Model):
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    tags = models.TextField(blank=True, default="")
```

- [ ] **Step 2: สร้าง migration**

Run: `python manage.py makemigrations uploads` (ใน `backend/`)
Expected: สร้าง `backend/uploads/migrations/0005_uploadtemplate_title.py`

- [ ] **Step 3: รัน migration**

Run: `python manage.py migrate`
Expected: `Applying uploads.0005_uploadtemplate_title... OK`

- [ ] **Step 4: Commit**

```bash
git add backend/uploads/models.py backend/uploads/migrations/0005_uploadtemplate_title.py
git commit -m "feat: add title field to UploadTemplate model"
```

---

### Task 2: เพิ่ม `title` ใน serializer

**Files:**
- Modify: `backend/uploads/serializers.py:27-31`

**Interfaces:**
- Consumes: `UploadTemplate` (มี field `title` จาก Task 1)
- Produces: `UploadTemplateSerializer.fields = ["id", "name", "title", "description", "tags", "created_at"]` — API `/api/templates/` จะส่ง/รับ `title` แล้ว

- [ ] **Step 1: แก้ serializer**

แก้ `backend/uploads/serializers.py` class `UploadTemplateSerializer`:

```python
class UploadTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadTemplate
        fields = ["id", "name", "title", "description", "tags", "created_at"]
        read_only_fields = ["id", "created_at"]
```

- [ ] **Step 2: ตรวจว่า server ยังรันได้**

Run: `python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Commit**

```bash
git add backend/uploads/serializers.py
git commit -m "feat: expose title in UploadTemplateSerializer"
```

---

### Task 3: สร้าง `TemplateModal` component

**Files:**
- Create: `frontend/src/components/TemplateModal.jsx`
- Test: `frontend/src/test/template_modal.test.jsx`

**Interfaces:**
- Consumes: `templateAPI` (`create`, `update`) จาก `frontend/src/api/client.js`
- Produces: component export default `TemplateModal`
  - props: `open` (bool), `mode` (`'create'`|`'edit'`), `initial` (object `{name, title, description, tags}` หรือ `null`), `templates` (array สำหรับเช็คชื่อซ้ำ), `onSaved(template)`, `onClose()`
  - พฤติกรรม: mode create ฟอร์มว่าง (ถ้า initial มีค่า → prefill), ชื่อ required, ถ้าชื่อซ้ำ template เดิมในรายการ (mode create) → เรียก `templateAPI.update` แทน create; โหมด edit เรียก update
  - render: ถ้า `open` เป็น false → return `null`

- [ ] **Step 1: เขียน test ที่ล้ม**

สร้าง `frontend/src/test/template_modal.test.jsx`:

```jsx
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
    render(<TemplateModal open mode="create" initial={null} templates={[]} onSaved={() => {}} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(templateAPI.create).not.toHaveBeenCalled()
    expect(screen.getByText('กรุณาใส่ชื่อเทมเพลต')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npm test` (ใน `frontend/`)
Expected: FAIL — `TemplateModal` import ไม่ได้ (ยังไม่มีไฟล์)

- [ ] **Step 3: เขียน component**

สร้าง `frontend/src/components/TemplateModal.jsx`:

```jsx
import { useState } from 'react'
import { toast } from 'react-toastify'
import { templateAPI } from '../api/client'

export default function TemplateModal({ open, mode, initial, templates, onSaved, onClose }) {
  const [name, setName] = useState(initial?.name || '')
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [tags, setTags] = useState(initial?.tags || '')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('กรุณาใส่ชื่อเทมเพลต'); return }
    const payload = { name: name.trim(), title, description, tags }
    const existing = mode === 'create' ? templates.find((t) => t.name === name.trim()) : null
    try {
      const res = existing ? await templateAPI.update(existing.id, payload) : mode === 'edit'
        ? await templateAPI.update(initial.id, payload)
        : await templateAPI.create(payload)
      onSaved(res.data)
    } catch { toast.error('บันทึกเทมเพลตไม่สำเร็จ') }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{mode === 'edit' ? 'แก้ไขเทมเพลต' : 'บันทึกเทมเพลต'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="tpl-name">ชื่อเทมเพลต</label>
            <input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-title">Title (ชื่อคลิป)</label>
            <input id="tpl-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-desc">คำอธิบาย</label>
            <textarea id="tpl-desc" className="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tpl-tags">แท็ก</label>
            <textarea id="tpl-tags" className="textarea" rows={3} value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: เพิ่ม CSS modal**

เพิ่มที่ท้าย `frontend/src/styles.css`:

```css
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal {
  background: #fff; border-radius: 8px; padding: 24px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
}
.modal-title { margin: 0 0 16px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npm test`
Expected: ทุก test PASS (5 ตัวใน template_modal.test.jsx)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TemplateModal.jsx frontend/src/test/template_modal.test.jsx frontend/src/styles.css
git commit -m "feat: add TemplateModal component with tests"
```

---

### Task 4: ใช้ TemplateModal ในหน้า Upload

**Files:**
- Modify: `frontend/src/pages/UploadPage.jsx:17-20,60-79,121-179`
- Test: `frontend/src/test/upload_multi.test.jsx` (mock templateAPI มีอยู่แล้ว)

**Interfaces:**
- Consumes: `TemplateModal` (Task 3), `templateAPI` (มีอยู่), state `templates`
- Produces: หน้า Upload — ปุ่ม "บันทึกเทมเพลต" เปิด modal, prefill จาก task แรก, chip เทมเพลตมีปุ่มแก้ไข + apply เติม title, modal บันทึกแล้ว update `templates` state

- [ ] **Step 1: เขียน test ที่ล้ม**

เพิ่ม test ใน `frontend/src/test/upload_multi.test.jsx` (ใน describe `UploadPage batch`):

```jsx
it('applyTemplate fills title, description and tags into tasks', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <UploadPage />
      <ToastContainer />
    </MemoryRouter>
  )
  await selectDest(user, 'youtube')
  await user.upload(fileInput(), fileList(['a.mp4']))
  const tpl = { id: 5, name: 'Kpop', title: 'T', description: 'D', tags: 'G' }
  // templateAPI.list ม็อคให้คืน [tpl] ก่อน — ปรับ mock ที่ line 20 ให้
  // ใช้ templateAPI.list.mockResolvedValue({ data: [tpl] }) แทน [](default)
  const chips = screen.getAllByRole('button', { name: /Kpop/ })
  await user.click(chips[0])
  expect(screen.getByPlaceholderText('ใช้ชื่อไฟล์')).toHaveValue('T')
  expect(screen.getByPlaceholderText('คำอธิบาย')).toHaveValue('D')
  expect(screen.getByPlaceholderText('แท็ก')).toHaveValue('G')
})
```

**หมายเหตุ:** ต้องแก้ mock `templateAPI.list` ที่ line 19-24 ของไฟล์ ให้รับ `mockResolvedValue({ data: [] })` เป็น default แล้ว test ข้างบน override ด้วย `templateAPI.list.mockResolvedValue({ data: [tpl] })` ก่อน render

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npm test`
Expected: FAIL — `applyTemplate` ยังไม่เติม title (ค่าควรเป็น '')

- [ ] **Step 3: แก้ `applyTemplate` + เพิ่ม modal state**

แก้ `frontend/src/pages/UploadPage.jsx`:

```jsx
// state — เพิ่ม (หลัง line 20)
const [tplModalOpen, setTplModalOpen] = useState(false)
const [tplModalMode, setTplModalMode] = useState('create')
const [tplModalInitial, setTplModalInitial] = useState(null)
```

```jsx
// replace applyTemplate (lines 60-63)
const applyTemplate = (tpl) => {
  setTasks((prev) => prev.map((t) => ({
    ...t,
    title: tpl.title || t.title,
    description: tpl.description || t.description,
    tags: tpl.tags || t.tags,
  })))
  toast.success(`ใช้เทมเพลต: ${tpl.name}`)
}
```

```jsx
// replace saveAsTemplate + deleteTemplate (lines 64-79) — ลบ saveAsTemplate, เก็บ deleteTemplate ไว้
const deleteTemplate = async (id) => {
  try {
    await templateAPI.remove(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  } catch { toast.error('ลบเทมเพลตไม่สำเร็จ') }
}

const openTplModal = (tpl = null) => {
  const first = tasks[0] || {}
  setTplModalMode(tpl ? 'edit' : 'create')
  setTplModalInitial(tpl || { name: '', title: first.title || '', description: first.description || '', tags: first.tags || '' })
  setTplModalOpen(true)
}

const handleTplSaved = (saved) => {
  setTemplates((prev) => [...prev.filter((t) => t.id !== saved.id), saved])
  setTplModalOpen(false)
}
```

- [ ] **Step 4: แก้ JSX bulk bar + chips**

แก้ `frontend/src/pages/UploadPage.jsx` bulk bar (lines 163-165) — เอา input "ชื่อเทมเพลต" + ปุ่ม "บันทึกเทมเพลต" ออก แทนด้วยปุ่มเปิด modal:

```jsx
<span className="bulk-sep" />
<button type="button" className="btn btn-ghost btn-sm" onClick={() => openTplModal()}>บันทึกเทมเพลต</button>
```

และลบ state `tplName`/`tplDesc`/`tplTags` (lines 18-20) ออกทั้งหมด

แก้ chip (lines 170-175) เพิ่มปุ่มแก้ไข:

```jsx
<span key={tpl.id} className="tpl-chip">
  <button type="button" className="tpl-chip-btn" onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
  <button type="button" className="tpl-chip-x" onClick={() => openTplModal(tpl)} aria-label={`แก้ไข ${tpl.name}`}>✎</button>
  <button type="button" className="tpl-chip-x" onClick={() => deleteTemplate(tpl.id)} aria-label={`ลบ ${tpl.name}`}>✕</button>
</span>
```

เพิ่ม TemplateModal หลัง `</div>` ของ tpl-bar (ก่อน `<div className="table-wrap"...`):

```jsx
<TemplateModal
  open={tplModalOpen}
  mode={tplModalMode}
  initial={tplModalInitial}
  templates={templates}
  onSaved={handleTplSaved}
  onClose={() => setTplModalOpen(false)}
/>
```

และเพิ่ม import:

```jsx
import TemplateModal from '../components/TemplateModal'
```

- [ ] **Step 5: รัน test ทั้งหมด**

Run: `npm test`
Expected: test ใหม่ PASS + test เดิมทั้งหมด PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/UploadPage.jsx frontend/src/test/upload_multi.test.jsx
git commit -m "feat: use TemplateModal in upload page with title apply"
```

---

### Task 5: สร้างหน้า `/templates` + route + nav

**Files:**
- Create: `frontend/src/pages/TemplatesPage.jsx`
- Test: `frontend/src/test/templates_page.test.jsx`
- Modify: `frontend/src/App.jsx:29-31`
- Modify: `frontend/src/components/Navbar.jsx:24-27`

**Interfaces:**
- Consumes: `TemplateModal` (Task 3), `templateAPI`, `TemplatePage` ไม่ใช่ — หน้าใหม่
- Produces: route `path="templates"` → `TemplatesPage`, nav link "เทมเพลต", component `TemplatesPage` (ตาราง + ปุ่มสร้าง/แก้/ลบ)

- [ ] **Step 1: เขียน test ที่ล้ม**

สร้าง `frontend/src/test/templates_page.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastContainer } from 'react-toastify'
import TemplatesPage from '../pages/TemplatesPage'

const templates = [
  { id: 1, name: 'A', title: 'TA', description: 'DA', tags: 'GA', created_at: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'B', title: 'TB', description: 'DB', tags: 'GB', created_at: '2026-08-02T00:00:00Z' },
]

vi.mock('../api/client', () => ({
  templateAPI: {
    list: vi.fn().mockResolvedValue({ data: templates }),
    create: vi.fn().mockResolvedValue({ data: templates[0] }),
    update: vi.fn().mockResolvedValue({ data: templates[0] }),
    remove: vi.fn().mockResolvedValue({}),
  },
}))

import { templateAPI } from '../api/client'

describe('TemplatesPage', () => {
  beforeEach(() => vi.clearAllMocks())

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
    await user.click(screen.getAllByLabelText(/ลบ/)[0])
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }))
    await waitFor(() => expect(templateAPI.remove).toHaveBeenCalledWith(1))
  })
})
```

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npm test`
Expected: FAIL — import `TemplatesPage` ไม่ได้ (ยังไม่มีไฟล์)

- [ ] **Step 3: เขียน TemplatesPage**

สร้าง `frontend/src/pages/TemplatesPage.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { templateAPI } from '../api/client'
import TemplateModal from '../components/TemplateModal'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [modal, setModal] = useState({ open: false, mode: 'create', initial: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { templateAPI.list().then((res) => setTemplates(res.data)) }, [])

  const handleSaved = (saved) => {
    setTemplates((prev) => [...prev.filter((t) => t.id !== saved.id), saved])
    setModal({ open: false, mode: 'create', initial: null })
  }

  const handleDelete = async () => {
    try {
      await templateAPI.remove(confirmDelete.id)
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id))
      setConfirmDelete(null)
      toast.success('ลบเทมเพลตแล้ว')
    } catch { toast.error('ลบเทมเพลตไม่สำเร็จ') }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">เทมเพลต</h2>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, mode: 'create', initial: null })}>สร้างเทมเพลต</button>
      </div>
      <div className="card card-pad">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Title</th>
                <th>คำอธิบาย</th>
                <th>แท็ก</th>
                <th>สร้างเมื่อ</th>
                <th style={{ width: 88 }}></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="cell-title">{t.name}</td>
                  <td>{t.title}</td>
                  <td>{t.description}</td>
                  <td>{t.tags}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, mode: 'edit', initial: t })}>แก้ไข</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <TemplateModal
        open={modal.open}
        mode={modal.mode}
        initial={modal.initial}
        templates={templates}
        onSaved={handleSaved}
        onClose={() => setModal({ open: false, mode: 'create', initial: null })}
      />
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">ลบเทมเพลต "{confirmDelete.name}"?</h3>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: เพิ่ม route + nav**

แก้ `frontend/src/App.jsx` — เพิ่ม import และ route:

```jsx
import TemplatesPage from './pages/TemplatesPage'
```

```jsx
<Route path="history" element={<HistoryPage />} />
<Route path="templates" element={<TemplatesPage />} />
<Route path="docs" element={<DocsPage />} />
```

แก้ `frontend/src/components/Navbar.jsx` — เพิ่ม link หลัง "อัปโหลด":

```jsx
<NavLink to="/" end className={linkCls}>อัปโหลด</NavLink>
<NavLink to="/templates" className={linkCls}>เทมเพลต</NavLink>
<NavLink to="/history" className={linkCls}>ประวัติ</NavLink>
```

- [ ] **Step 5: รัน test ทั้งหมด**

Run: `npm test`
Expected: test ทั้งหมด (template_modal, templates_page, upload_multi, oauth, functional, facebook_token, destination_form_oauth) PASS

- [ ] **Step 6: รัน build ตรวจ syntax**

Run: `npm run build`
Expected: build สำเร็จไม่มี error

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/TemplatesPage.jsx frontend/src/test/templates_page.test.jsx frontend/src/App.jsx frontend/src/components/Navbar.jsx
git commit -m "feat: add templates management page with route and nav"
```

---

### Task 6: ตรวจสอบด้วยสายตา (manual QA)

**Files:**
- (ไม่มีไฟล์ — verification)

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1-5

- [ ] **Step 1: รัน server ทั้งคู่**

Run: `python manage.py runserver 8000` (backend) + `npm run dev` (frontend) — ถ้ายังรันอยู่ ข้ามได้

- [ ] **Step 2: เปิดหน้า /templates**

Open: `http://localhost:5173/templates`
Expected: เห็นตาราง template ("katy404" ที่มีอยู่ + อื่น ๆ), ปุ่ม "สร้างเทมเพลต", แก้ไข/ลบ ทำงาน

- [ ] **Step 3: ทดสอบสร้าง template ใหม่**

คลิก "สร้างเทมเพลต" → กรอกชื่อ/title/desc/tags → บันทึก → ตรวจเห็นรายการใหม่ในตาราง

- [ ] **Step 4: ทดสอบหน้า Upload**

ไป `/` → เลือกไฟล์ → กรอก title/desc/tags ใน task → กด "บันทึกเทมเพลต" → ตรวจว่า modal prefill มาจาก task → บันทึก → กด chip template → ตรวจว่า title/desc/tags เติมลง task ทั้งหมด

- [ ] **Step 5: ทดสอบแก้ไข/ลบ template**

กดแก้ไขที่ chip → แก้ชื่อ → บันทึก → ตรวจ chip อัปเดต; กด ✕ ลบ → ตรวจ chip หาย

- [ ] **Step 6: Commit งานค้างจากรอบก่อน (ถ้าผ่าน QA)**

```bash
git add frontend/src/pages/DocsPage.jsx frontend/public/docs/ frontend/src/styles.css backend/uploads/admin.py frontend/src/App.jsx frontend/src/components/Navbar.jsx
git commit -m "feat: add setup docs page, template admin, screenshots"
```

---

## Self-Review

**1. Spec coverage:**
- title ใน model/migration/serializer → Task 1-2 ✓
- TemplateModal (create/edit, prefill, duplicate name→update, name required) → Task 3 ✓
- UploadPage: modal แทน input เดิม, applyTemplate เติม title, ปุ่มแก้ไข chip → Task 4 ✓
- หน้า /templates + route + nav → Task 5 ✓
- Error handling: toast ทุกจุด ✓
- Testing: component tests ทุก task ✓

**2. Placeholder scan:** ไม่มี "TBD/TODO" — ทุก step มีโค้ด/คำสั่งครบ

**3. Type consistency:** `templateAPI.create/update/remove` ใช้ signature เดียวกันกับ `client.js` เดิม; `TemplateModal` props `open/mode/initial/templates/onSaved/onClose` สอดคล้องทั้ง Task 3, 4, 5; test mock `{ data: ... }` ตรงกับ axios response ของ `client.js`
