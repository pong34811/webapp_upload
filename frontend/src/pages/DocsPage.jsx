import { useState } from 'react'

const steps = [
  {
    n: 1,
    title: 'สร้าง Facebook App',
    img: '/docs/step1-create-app.png',
    body: [
      'เข้าที่ https://developers.facebook.com/apps/ แล้วกด "สร้างแอป" (Create App)',
      'เลือกประเภท "ธุรกิจ" (Business)',
      'กรอกชื่อแอป (เช่น webapp_upload) + อีเมลติดต่อ แล้วกด "สร้างแอป"',
    ],
  },
  {
    n: 2,
    title: 'เปิดกรณีการใช้งาน "Pages API"',
    img: '/docs/step2-pages-api.png',
    body: [
      'ในหน้า Dashboard ของแอป กด "เพิ่มกรณีการใช้งาน" (Add Use Case)',
      'เลือก "จัดการทุกอย่างบนเพจของคุณ" (Pages API) → ปรับแต่ง (Customize)',
      'ในแท็บ สิทธิ์การอนุญาตและฟีเจอร์: เช็คว่ามี pages_manage_posts, pages_show_list, pages_read_engagement อยู่',
      'ถ้ายังไม่มี ให้กด "เพิ่ม" (Add) แล้วรอสถานะเป็น "พร้อมทดสอบ" (Development Access / Ready to test)',
    ],
  },
{
    n: 3,
    title: 'นำ App ID และ App Secret',
    img: '/docs/step3-app-secret.png',
    body: [
      'เมนูซ้าย: การตั้งค่าแอพ → ข้อมูลพื้นฐาน (App Settings → Basic)',
      'App ID → ตัวเลขชุดแรกของหน้า',
      'App Secret → กด "แสดง" (Show) เพื่อดูค่า',
      'เก็บ 2 ค่านี้ไว้ (ห้ามแชร์ App Secret)',
    ],
  },
  {
    n: 4,
    title: 'ตั้งค่า Facebook Config ใน Django Admin',
    img: '/docs/step4-django-admin.png',
    body: [
      'เข้า Django Admin: http://localhost:8000/admin/providers/facebookconfig/add/',
      'Client Id → ใส่ App ID จากข้อ 3',
      'Client Secret → ใส่ App Secret จากข้อ 3',
      'Redirect Uri → ใส่ http://localhost:5173/facebook-token/',
      'IsActive → tick true',
      'กด "บันทึก" (Save)',
    ],
  },
  {
    n: 5,
    title: 'เข้าสู่ในหน้าเว็บแอป',
    img: '/docs/step5-connect.png',
    body: [
      'เข้าหน้า "ตั้งค่า" ในเว็บแอป แล้วกดปุ่ม "เชื่อมต่อ Facebook"',
      'ล็อกอิน/ยืนยันสิทธิ์ใน popup → ระบบยืดอายุ token เป็น ~60 วัน และบันทึก Page ให้อัตโนมัติ',
    ],
  },
]

function StepImage({ src, alt }) {
  const [missing, setMissing] = useState(false)
  if (missing) {
    return (
      <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 12 }}>
        วาง screenshot ที่: <code className="code">{src}</code> (ในโฟลเดอร์ frontend/public)
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      style={{ maxWidth: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 12, display: 'block' }}
    />
  )
}

export default function DocsPage() {
  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">คู่มือตั้งค่า Facebook Config</h2>
      </div>
      <p className="card-sub">ขั้นตอนตั้งแต่ขอ Facebook API บน developers.facebook.com จนถึงตั้งค่าใน Django Admin</p>
      {steps.map((s) => (
        <div className="card card-pad" key={s.n} style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 10px' }}>
            <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', marginRight: 10 }}>{s.n}</span>
            {s.title}
          </h3>
          <StepImage src={s.img} alt={`ขั้นตอนที่ ${s.n}: ${s.title}`} />
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            {s.body.map((b, i) => <li key={i}>{b}</li>)}
          </ol>
        </div>
      ))}
      <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--ink)' }}>หมายเหตุ:</strong> เมื่อ deploy ขึ้น production ให้เปลี่ยน FRONTEND_URL ใน backend/core/settings.py (หรือ env) ให้ตรงกับโดเมนจริง พร้อมอัปเดต Redirect URI ทั้งในแอป Facebook และ Django Admin ให้ตรงกัน
        </p>
      </div>
    </div>
  )
}