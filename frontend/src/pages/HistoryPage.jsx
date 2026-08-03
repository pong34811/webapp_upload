import { useState, useEffect } from 'react'
import { uploadAPI } from '../api/client'

const STATUS_LABEL = {
  pending: 'รอดำเนินการ',
  uploading: 'กำลังอัปโหลด',
  success: 'สำเร็จ',
  failed: 'ล้มเหลว',
  scheduled: 'ตั้งเวลาแล้ว',
}

const STATUS_COLOR = {
  pending: '#ff9800',
  uploading: '#2196f3',
  success: '#4caf50',
  failed: '#f44336',
  scheduled: '#9c27b0',
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    uploadAPI.list().then((res) => setJobs(res.data))
  }, [])

  return (
    <div>
      <h2>ประวัติการอัปโหลด</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>ชื่อคลิป</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Member Platform Upload</th>
            <th style={{ padding: 8, textAlign: 'left' }}>สถานะ</th>
            <th style={{ padding: 8, textAlign: 'left' }}>ความคืบหน้า</th>
            <th style={{ padding: 8, textAlign: 'left' }}>เวลาสร้าง</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{job.title}</td>
              <td style={{ padding: 8 }}>{job.destination_name}</td>
              <td style={{ padding: 8 }}>
                <span style={{ color: STATUS_COLOR[job.status], fontWeight: 'bold' }}>
                  {STATUS_LABEL[job.status]}
                </span>
              </td>
              <td style={{ padding: 8 }}>{job.progress}%</td>
              <td style={{ padding: 8 }}>{new Date(job.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
