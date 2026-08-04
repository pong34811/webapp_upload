import { useState, useEffect } from 'react'
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

  useEffect(() => {
    uploadAPI.list().then((res) => setJobs(res.data))
  }, [])

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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อคลิป</th>
                <th>Member Platform Upload</th>
                <th>สถานะ</th>
                <th>ความคืบหน้า</th>
                <th>เวลาสร้าง</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="cell-title">{job.title}</td>
                  <td>{job.destination_name}</td>
                  <td><span className={`badge badge-${job.status}`}>{STATUS_LABEL[job.status]}</span></td>
                  <td>{job.progress}%</td>
                  <td className="cell-mono">{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
