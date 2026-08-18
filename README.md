# Web Upload

เว็บแอปสำหรับอัปโหลดคลิปวิดีโอไปยัง YouTube และ Facebook Page
สำหรับผู้ดูแลระบบ (Admin) คนเดียว รันในเครื่อง/LAN

## Tech Stack
- Backend: Django + Django REST Framework + SQLite
- Frontend: Vite + React
- YouTube Data API v3, Facebook Graph API

## โครงสร้าง
```
web_upload/
├── backend/   # Django project
└── frontend/  # Vite + React
```

## เริ่มต้นใช้งาน (Development)

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # สร้าง Admin
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
เปิด http://localhost:5173 (API ถูก proxy ไป backend :8000 อัตโนมัติ)

## ทดสอบ (Testing)

```bash
# Backend — ใช้ pytest (แทน manage.py test)
cd backend
python -m pytest

# Frontend — ใช้ vitest
cd frontend
npm test
```

## การใช้งาน
1. เข้าสู่ระบบด้วย Admin
2. ไปหน้า **ตั้งค่า** เพื่อเพิ่มช่อง YouTube / เพจ Facebook (วาง Access Token)
3. ไปหน้า **อัปโหลด** เลือกปลายทาง, เลือกไฟล์, กรอกข้อมูล, กดอัปโหลด
4. ดูสถานะในหน้า **ประวัติ**

## Production / Local-run (serve frontend จาก Django)
ใช้เมื่อต้องการรันแบบ single machine โดยไม่ต้องใช้ Vite dev server:

1. รัน build script จาก `backend/`:
   - Windows: `powershell -ExecutionPolicy Bypass -File build_spa.ps1`
   - macOS/Linux: `bash build_spa.sh`
2. เริ่ม Django: `python manage.py runserver`
3. เปิด http://localhost:8000 — SPA จะถูกเสิร์ฟจาก Django โดยตรง

Build script จะรัน `npm install && npm run build` ใน `frontend/` แล้วคัดลอก `frontend/dist/` เข้า `backend/uploads/static/spa/` Django จะ serve `index.html` และ catch-all route สำหรับ client-side paths (`/uploads`, `/settings` ฯลฯ)

### จำกัด CORS สำหรับ Production
`CORS_ALLOW_ALL_ORIGINS = True` ใช้ได้ใน dev mode สำหรับ production จริงให้แก้ไขใน `backend/core/settings.py`:
```python
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ["https://your-host"]
```

## ตั้งค่า YouTube OAuth

1. ใน Google Cloud Console สร้าง OAuth 2.0 Client ID (ประเภท Web application)
2. เพิ่ม Authorized redirect URI: `http://<host>/api/oauth/youtube/callback/`
   (ตอนพัฒนาใช้ `http://localhost:8000/api/oauth/youtube/callback/`)
3. ใน Django Admin (`/admin`) เพิ่ม YouTubeAppConfig ด้วย client_id, client_secret, redirect_uri จากข้อ 2
4. ที่หน้า "จัดการตั้งค่าช่องทาง" กด "เชื่อมต่อ YouTube" และล็อกอินบัญชี Google
5. ช่องจะถูกเพิ่มพร้อม token ที่ต่ออายุอัตโนมัติ
