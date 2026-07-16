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

## การใช้งาน
1. เข้าสู่ระบบด้วย Admin
2. ไปหน้า **ตั้งค่า** เพื่อเพิ่มช่อง YouTube / เพจ Facebook (วาง Access Token)
3. ไปหน้า **อัปโหลด** เลือกปลายทาง, เลือกไฟล์, กรอกข้อมูล, กดอัปโหลด
4. ดูสถานะในหน้า **ประวัติ**

## Production (build เข้า Django)
```bash
cd frontend
npm run build
# ก๊อป dist/ เข้า backend/uploads/static แล้วให้ Django เสิร์ฟ
```
