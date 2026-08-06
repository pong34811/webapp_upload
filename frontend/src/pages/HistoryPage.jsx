import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { uploadAPI } from '../api/client'

const STATUS_LABEL = {
  pending: 'รอดำเนินการ',
  uploading: 'กำลังอัปโหลด',
  success: 'สำเร็จ',
  failed: 'ล้มเหลว',
  scheduled: 'ตั้งเวลาแล้ว',
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { uploadAPI.list().then((res) => setJobs(res.data)) }, [])

  const filtered = jobs.filter((j) => {
    if (statusFilter && j.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(j.title || '').toLowerCase().includes(q) && !(j.destination_name || '').toLowerCase().includes(q) && !(j.filename || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleRetry = async (id) => {
    try {
      await uploadAPI.retry(id)
      toast.success('ลองใหม่แล้ว — กำลังอัปโหลด')
      uploadAPI.list().then((res) => setJobs(res.data))
    } catch { toast.error('ลองใหม่ไม่สำเร็จ') }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">ประวัติการอัปโหลด</h2>
      </div>
      {jobs.length === 0 ? (
        <div className="card empty">
          <p className="empty-title">ยังไม่มีประวัติการอัปโหลด</p>
          <p className="empty-text">อัปโหลดวิดีโอชิ้นแรกของคุณเพื่อเริ่มใช้งาน</p>
        </div>
      ) : (
        <>
          <div className="filter-bar card card-pad">
            <input className="input input-sm" placeholder="ค้นหาชื่อคลิป / ปลายทาง..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="uploading">กำลังอัปโหลด</option>
              <option value="success">สำเร็จ</option>
              <option value="failed">ล้มเหลว</option>
              <option value="scheduled">ตั้งเวลาแล้ว</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ชื่อคลิป</th>
                  <th>Member Platform Upload</th>
                  <th>สถานะ</th>
                  <th>ความคืบหน้า</th>
                  <th>เวลาสร้าง</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>ไม่พบข้อมูล</td></tr>
                ) : filtered.map((job) => (
                  <tr key={job.id}>
                    <td className="cell-title">{job.title}</td>
                    <td>{job.destination_name}</td>
                    <td><span className={`badge badge-${job.status}`}>{STATUS_LABEL[job.status]}</span></td>
                    <td>{job.progress}%</td>
                    <td className="cell-mono">{new Date(job.created_at).toLocaleString()}</td>
                    <td>
                      {job.status === 'failed' && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRetry(job.id)}>ลองใหม่</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
