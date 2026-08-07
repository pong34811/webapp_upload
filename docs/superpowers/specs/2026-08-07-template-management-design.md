# ระบบสร้าง/จัดการ Template — Design

วันที่: 2026-08-07
สถานะ: อนุมัติโดยผู้ใช้งาน

## ปัญหา

ผู้ใช้ติดระบบ template: เวลากด "บันทึกเทมเพลต" ในหน้า Upload มีช่องกรอกแค่ชื่อ ไม่มีช่อง description/tags จึงบันทึกได้แค่ชื่อ แล้วกดใช้ template ไม่ได้ผล ทำให้สับสน

## โซลูชัน

เทมเพลตเก็บ **title + description + tags** มี UI สองที่:
1. **หน้า Upload** — modal ฟอร์มสร้าง/แก้ไข (prefill จาก task ปัจจุบัน) เปิดจากปุ่ม "บันทึกเทมเพลต" และจากปุ่มแก้ไขที่ chip
2. **หน้าใหม่ `/templates`** — สร้าง/ดู/แก้/ลบ template ทั้งหมดโดยไม่ต้องมีไฟล์

## Backend

### Model `UploadTemplate` (uploads/models.py)
- เพิ่ม field: `title = models.CharField(max_length=255, blank=True, default="")`
- fields เดิม: name, description, tags, created_by, created_at, updated_at — ไม่เปลี่ยน

### Serializer `UploadTemplateSerializer`
- เพิ่ม `title` เข้า `fields`

### Migration
- สร้าง migration ใหม่สำหรับ field `title`

### API
- `/api/templates/` CRUD เดิมใช้ได้ทั้งหมด ไม่ต้องแก้ views/urls

## Frontend

### Component ใหม่: `TemplateModal.jsx`
- โมดาลเดียวใช้ร่วม 2 หน้า
- props: `open`, `mode` (`create`|`edit`), `initial` (ค่าตั้งต้น), `onSaved(template)`, `onClose`
- ฟิลด์: ชื่อ (required), title, คำอธิบาย, แท็ก
- ชื่อซ้ำ → แสดง error จาก server (400) เป็น toast
- โหมด create: ชื่อซ้ำที่มีอยู่ → เปลี่ยนเป็น save ทับ (update)
- เรียก `templateAPI.create` หรือ `templateAPI.update`

### หน้า Upload (`UploadPage.jsx`)
- **แทนที่** flow บันทึกอินไลน์เดิม: เอา input "ชื่อเทมเพลต" + ปุ่ม "บันทึกเทมเพลต" (บรรทัด 163-165) ออกจาก bulk bar และลบ state `tplName`/`tplDesc`/`tplTags` (บรรทัด 18-20) — เปลี่ยนเป็นปุ่มที่เปิด TemplateModal
- ปุ่ม "บันทึกเทมเพลต": เปิด TemplateModal โหมด create, prefill จาก task แรก (title/description/tags)
- chip เทมเพลต: กด apply → **เปลี่ยน `applyTemplate` (บรรทัด 60-63) ให้เติม title ด้วย** (ตอนนี้เติมแค่ description+tags) + ปุ่ม ✕ ลบ ตามเดิม
- เพิ่มปุ่มแก้ไขที่ chip → เปิด TemplateModal โหมด edit (initial จาก template)
- ชื่อซ้ำ→update: เก็บ logic เดิมจาก `saveAsTemplate` (เช็ค `templates.find(name)` แล้วเรียก update/create) ย้ายเข้า TemplateModal
- หลัง onSaved → update รายการ chips จาก response

### หน้าใหม่ `TemplatesPage.jsx` (route `/templates`)
- ตาราง: ชื่อ, title, description, tags, สร้างเมื่อ, การจัดการ (แก้ไข/ลบ)
- ปุ่ม "สร้างเทมเพลต" → TemplateModal โหมด create ฟอร์มว่าง
- ปุ่มแก้ไข → TemplateModal โหมด edit
- ปุ่มลบ → confirm ลบ
- nav: เพิ่ม "เทมเพลต" ใน Navbar (ระหว่าง อัปโหลด/ประวัติ)

### Routes (`App.jsx`)
- เพิ่ม `<Route path="templates" element={<TemplatesPage />} />` ในกลุ่ม protected (ก่อน `docs`)

### Data flow
- ทั้งสองหน้าดึง/ส่งผ่าน `templateAPI` (`/api/templates/`)
- หน้า Upload reload chips หลัง save/delete

## Error handling
- ชื่อ required (browser validation)
- server error 400 → toast
- ลบ/แก้ล้มเหลว → toast

## Testing
- Component test (Vitest + RTL):
  - modal เปิดด้วย prefill ถูกต้อง
  - บันทึก (create) เรียก API ถูก
  - แก้ไข (edit) เรียก API ถูก
  - ชื่อซ้ำ → ไปเป็น update
- Backend test: serializer มี title

## Non-goals (YAGNI)
- ค้นหา/กรอง template
- privacy/schedule ใน template (แต่ละงานเวลา/สิทธิ์ไม่เหมือนกัน)
- แชร์ template ระหว่างผู้ใช้
