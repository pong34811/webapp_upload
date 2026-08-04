import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, uploadAPI } from '../api/client'
import ProgressBar from '../components/ProgressBar'

const ACTIVE = ['pending', 'uploading']
const JOB_LABEL = { pending: 'รอดำเนินการ', uploading: 'กำลังอัปโหลด', success: 'สำเร็จ', failed: 'ล้มเหลว' }
let keySeq = 0

export default function UploadPage() {
  const [destinations, setDestinations] = useState([])
  const [destinationId, setDestinationId] = useState('')
  const [tasks, setTasks] = useState([])
  const [jobs, setJobs] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    destinationAPI.list().then((res) => setDestinations(res.data))
  }, [])

  useEffect(() => {
    if (!uploading) return
    const interval = setInterval(async () => {
      const active = jobs.filter((j) => ACTIVE.includes(j.status))
      if (active.length === 0) {
        clearInterval(interval)
        setUploading(false)
        return
      }
      const updates = await Promise.all(
        active.map(async (j) => {
          const res = await uploadAPI.get(j.id)
          return { id: j.id, ...res.data }
        })
      )
      setJobs((prev) =>
        prev.map((j) => {
          const u = updates.find((x) => x.id === j.id)
          return u ? { ...j, status: u.status, progress: u.progress, error_message: u.error_message } : j
        })
      )
    }, 1500)
    return () => clearInterval(interval)
  }, [uploading, jobs])

  const addFiles = (fileList) => {
    const newTasks = [...fileList].map((file) => ({
      key: `${Date.now()}-${keySeq++}`,
      file,
      title: '',
      description: '',
      tags: '',
      privacy: 'private',
      scheduledTime: '',
    }))
    setTasks((prev) => [...prev, ...newTasks])
  }

  const updateTask = (key, patch) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  }

  const removeTask = (key) => {
    setTasks((prev) => prev.filter((t) => t.key !== key))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (tasks.length === 0 || !destinationId) {
      toast.error('กรุณาเลือกไฟล์และปลายทาง')
      return
    }
    setUploading(true)
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        const formData = new FormData()
        formData.append('file', task.file)
        formData.append('destination_id', destinationId)
        formData.append('title', task.title || task.file.name)
        formData.append('description', task.description)
        formData.append('tags', task.tags)
        formData.append('privacy', task.privacy)
        if (task.scheduledTime) formData.append('scheduled_time', task.scheduledTime)
        const res = await uploadAPI.create(formData)
        return res.data
      })
    )
    const newJobs = results.map((r, i) => {
      const ok = r.status === 'fulfilled'
      return {
        filename: tasks[i].file.name,
        id: ok ? r.value.id : null,
        status: ok ? r.value.status : 'failed',
        progress: 0,
        error_message: ok ? '' : (r.reason?.response?.data?.error || 'อัปโหลดล้มเหลว'),
      }
    })
    setJobs(newJobs)
    setTasks([])
    if (newJobs.every((j) => j.status === 'failed')) setUploading(false)
  }

  const handleCancel = async (id) => {
    await uploadAPI.cancel(id)
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'failed', error_message: 'cancelled' } : j)))
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">อัปโหลดวิดีโอ</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="destination">Member Platform Upload</label>
            <select id="destination" className="select" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required>
              <option value="">เลือก Member Platform Upload</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>{d.platform} - {d.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="file">ไฟล์วิดีโอ</label>
            <div className="dropzone">
              <input id="file" type="file" accept=".mp4,.mov,.avi,.mkv,.webm" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              <span className="dropzone-icon">🎬</span>
              <p className="dropzone-title">เลือกไฟล์วิดีโอ (เลือกหลายไฟล์ได้)</p>
              <p className="dropzone-hint">ลากไฟล์หรือคลิกเลือก — แต่ละไฟล์กลายเป็น task ที่กรอกข้อมูลแยกได้</p>
            </div>
          </div>
        </div>

        {tasks.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ไฟล์</th>
                  <th>video_title</th>
                  <th>description</th>
                  <th>tags</th>
                  <th>ความเป็นส่วนตัว</th>
                  <th>กำหนดเวลา</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.key}>
                    <td className="cell-title" style={{ whiteSpace: 'nowrap' }}>{t.file.name}</td>
                    <td>
                      <input className="input" placeholder="ใช้ชื่อไฟล์" value={t.title} onChange={(e) => updateTask(t.key, { title: e.target.value })} />
                    </td>
                    <td className="textarea-cell">
                      <textarea className="textarea" rows={4} placeholder="คำอธิบาย" value={t.description} onChange={(e) => updateTask(t.key, { description: e.target.value })} />
                    </td>
                    <td className="textarea-cell">
                      <textarea className="textarea" rows={3} placeholder="แท็ก" value={t.tags} onChange={(e) => updateTask(t.key, { tags: e.target.value })} />
                    </td>
                    <td>
                      <select className="select" value={t.privacy} onChange={(e) => updateTask(t.key, { privacy: e.target.value })}>
                        <option value="public">สาธารณะ</option>
                        <option value="private">ส่วนตัว</option>
                        <option value="unlisted">ไม่ระบุชื่อ</option>
                      </select>
                    </td>
                    <td>
                      <input className="input" type="datetime-local" value={t.scheduledTime} onChange={(e) => updateTask(t.key, { scheduledTime: e.target.value })} style={{ minWidth: 150 }} />
                    </td>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => removeTask(t.key)} aria-label={`ลบ ${t.file.name}`}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {jobs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {jobs.map((j, i) => (
              <div key={`${j.filename}-${i}`} className="job">
                <div className="job-head">
                  <span className="job-name">{j.filename}</span>
                  <span className={`badge badge-${j.status === 'success' ? 'success' : j.status === 'failed' ? 'failed' : j.status === 'pending' ? 'pending' : 'uploading'}`}>
                    {JOB_LABEL[j.status] || j.status}
                  </span>
                </div>
                {ACTIVE.includes(j.status) && (
                  <>
                    <ProgressBar percent={j.progress} />
                    <button type="button" onClick={() => handleCancel(j.id)} className="btn btn-danger btn-sm" style={{ marginTop: 10 }}>
                      ยกเลิก
                    </button>
                  </>
                )}
                {j.status === 'failed' && j.error_message && <p className="job-err">{j.error_message}</p>}
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={uploading} className="btn btn-primary btn-block">
          {uploading ? 'กำลังอัปโหลด...' : `เริ่มอัปโหลด (${tasks.length} รายการ)`}
        </button>
      </form>
    </div>
  )
}