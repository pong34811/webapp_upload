import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, uploadAPI, templateAPI } from '../api/client'
import ProgressBar from '../components/ProgressBar'

const ACTIVE = ['pending', 'uploading']
const JOB_LABEL = { pending: 'รอดำเนินการ', uploading: 'กำลังอัปโหลด', success: 'สำเร็จ', failed: 'ล้มเหลว' }
let keySeq = 0

export default function UploadPage() {
  const [destinations, setDestinations] = useState([])
  const [destinationIds, setDestinationIds] = useState([])
  const [tasks, setTasks] = useState([])
  const [jobs, setJobs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tplName, setTplName] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplTags, setTplTags] = useState('')
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  useEffect(() => { destinationAPI.list().then((res) => setDestinations(res.data)) }, [])

  useEffect(() => { templateAPI.list().then((res) => setTemplates(res.data)) }, [])

  useEffect(() => {
    if (!uploading) return
    const interval = setInterval(async () => {
      const active = jobs.filter((j) => ACTIVE.includes(j.status))
      if (active.length === 0) { clearInterval(interval); setUploading(false); return }
      const updates = await Promise.all(active.map(async (j) => { const res = await uploadAPI.get(j.id); return { id: j.id, ...res.data } }))
      setJobs((prev) => prev.map((j) => { const u = updates.find((x) => x.id === j.id); return u ? { ...j, status: u.status, progress: u.progress, error_message: u.error_message } : j }))
    }, 1500)
    return () => clearInterval(interval)
  }, [uploading, jobs])

  const addFiles = useCallback((fileList) => {
    const newTasks = [...fileList].map((file) => ({
      key: `${Date.now()}-${keySeq++}`, file, title: '', description: '', tags: '', privacy: 'private', scheduledTime: '',
    }))
    setTasks((prev) => [...prev, ...newTasks])
  }, [])

  // Drag-and-drop handlers
  const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.types.includes('Files')) setDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false) }
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation() }
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }

  const updateTask = (key, patch) => setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  const removeTask = (key) => setTasks((prev) => prev.filter((t) => t.key !== key))

  // Bulk edit
  const bulkPrivacy = (val) => setTasks((prev) => prev.map((t) => ({ ...t, privacy: val })))
  const bulkTags = (val) => setTasks((prev) => prev.map((t) => ({ ...t, tags: val })))

  // Templates
  const applyTemplate = (tpl) => {
    setTasks((prev) => prev.map((t) => ({ ...t, description: tpl.description || t.description, tags: tpl.tags || t.tags })))
    toast.success(`ใช้เทมเพลต: ${tpl.name}`)
  }
  const saveAsTemplate = async () => {
    if (!tplName.trim()) { toast.error('กรุณาใส่ชื่อเทมเพลต'); return }
    const existing = templates.find((t) => t.name === tplName.trim())
    const payload = { name: tplName.trim(), description: tplDesc, tags: tplTags }
    try {
      const res = existing ? await templateAPI.update(existing.id, payload) : await templateAPI.create(payload)
      setTemplates((prev) => [...prev.filter((t) => t.id !== res.data.id), res.data])
      setTplName(''); setTplDesc(''); setTplTags(''); toast.success('บันทึกเทมเพลตแล้ว')
    } catch { toast.error('บันทึกเทมเพลตไม่สำเร็จ') }
  }
  const deleteTemplate = async (id) => {
    try {
      await templateAPI.remove(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch { toast.error('ลบเทมเพลตไม่สำเร็จ') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (tasks.length === 0 || destinationIds.length === 0) { toast.error('กรุณาเลือกไฟล์และปลายทาง'); return }
    setUploading(true)
    const destNames = Object.fromEntries(destinations.map((d) => [d.id, d.name]))
    const combos = destinationIds.flatMap((did) => tasks.map((task) => ({ did, task })))
    const results = await Promise.allSettled(combos.map(async ({ did, task }) => {
      const formData = new FormData()
      formData.append('file', task.file)
      formData.append('destination_id', did)
      formData.append('title', task.title || task.file.name)
      formData.append('description', task.description)
      formData.append('tags', task.tags)
      formData.append('privacy', task.privacy)
      if (task.scheduledTime) formData.append('scheduled_time', task.scheduledTime)
      const res = await uploadAPI.create(formData)
      return res.data
    }))
    const newJobs = results.map((r, i) => {
      const ok = r.status === 'fulfilled'
      return { filename: combos[i].task.file.name, destination_name: destNames[combos[i].did], id: ok ? r.value.id : null, status: ok ? r.value.status : 'failed', progress: 0, error_message: ok ? '' : (r.reason?.response?.data?.error || 'อัปโหลดล้มเหลว') }
    })
    setJobs(newJobs); setTasks([])
    if (newJobs.every((j) => j.status === 'failed')) setUploading(false)
  }

  const handleRetry = async (id) => {
    try {
      const res = await uploadAPI.retry(id)
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: res.data.status, progress: 0, error_message: '' } : j))
      setUploading(true)
      toast.success('ลองใหม่แล้ว')
    } catch { toast.error('ลองใหม่ไม่สำเร็จ') }
  }

  const handleCancel = async (id) => {
    await uploadAPI.cancel(id)
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'failed', error_message: 'cancelled' } : j)))
  }

  return (
    <div onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      <div className="page-head">
        <h2 className="page-title">อัปโหลดวิดีโอ</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="field">
            <label htmlFor="destination">Member Platform Upload (เลือกได้หลายช่อง)</label>
            <div className="dest-list">
              {destinations.map((d) => (
                <label key={d.id} className={`dest-chip ${destinationIds.includes(d.id) ? 'dest-chip-active' : ''}`}>
                  <input type="checkbox" checked={destinationIds.includes(d.id)}
                    onChange={(e) => setDestinationIds((prev) => e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id))} />
                  <span>{d.platform} - {d.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="file">ไฟล์วิดีโอ</label>
            <div className={`dropzone ${dragging ? 'dropzone-active' : ''}`} ref={fileRef}>
              <input id="file" type="file" accept=".mp4,.mov,.avi,.mkv,.webm" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              <span className="dropzone-icon">🎬</span>
              <p className="dropzone-title">{dragging ? 'วางไฟล์ที่นี่' : 'เลือกไฟล์วิดีโอ (เลือกหลายไฟล์ได้)'}</p>
              <p className="dropzone-hint">{dragging ? 'ปล่อยเพื่อเพิ่มไฟล์' : 'ลากไฟล์มาวางหรือคลิกเลือก — แต่ละไฟล์กลายเป็น task ที่กรอกข้อมูลแยกได้'}</p>
            </div>
          </div>
        </div>

        {tasks.length > 0 && (
          <>
            {/* Bulk edit bar */}
            <div className="bulk-bar card card-pad">
              <span className="bulk-label">ตั้งค่าทั้งหมด:</span>
              <select className="select select-sm" onChange={(e) => bulkPrivacy(e.target.value)} defaultValue="">
                <option value="" disabled>ความเป็นส่วนตัว</option>
                <option value="public">สาธารณะ</option>
                <option value="private">ส่วนตัว</option>
                <option value="unlisted">ไม่ระบุชื่อ</option>
              </select>
              <input className="input input-sm" placeholder="แท็ก (ตั้งค่าทั้งหมด)" onBlur={(e) => { if (e.target.value) bulkTags(e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter') { bulkTags(e.target.value); e.target.blur() } }} />
              <span className="bulk-sep" />
              <input className="input input-sm" placeholder="ชื่อเทมเพลต" value={tplName} onChange={(e) => setTplName(e.target.value)} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={saveAsTemplate}>บันทึกเทมเพลต</button>
            </div>

            {templates.length > 0 && (
              <div className="tpl-bar">
                {templates.map((tpl) => (
                  <span key={tpl.id} className="tpl-chip">
                    <button type="button" className="tpl-chip-btn" onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
                    <button type="button" className="tpl-chip-x" onClick={() => deleteTemplate(tpl.id)} aria-label={`ลบ ${tpl.name}`}>✕</button>
                  </span>
                ))}
              </div>
            )}

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
                      <td className="cell-title" style={{ whiteSpace: 'nowrap' }}>
                        {t.file.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(t.file)} className="video-preview" muted preload="metadata" onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0 }} />
                        ) : null}
                        <span className="file-name">{t.file.name}</span>
                      </td>
                      <td><input className="input" placeholder="ใช้ชื่อไฟล์" value={t.title} onChange={(e) => updateTask(t.key, { title: e.target.value })} /></td>
                      <td className="textarea-cell"><textarea className="textarea" rows={4} placeholder="คำอธิบาย" value={t.description} onChange={(e) => updateTask(t.key, { description: e.target.value })} /></td>
                      <td className="textarea-cell"><textarea className="textarea" rows={3} placeholder="แท็ก" value={t.tags} onChange={(e) => updateTask(t.key, { tags: e.target.value })} /></td>
                      <td>
                        <select className="select" value={t.privacy} onChange={(e) => updateTask(t.key, { privacy: e.target.value })}>
                          <option value="public">สาธารณะ</option>
                          <option value="private">ส่วนตัว</option>
                          <option value="unlisted">ไม่ระบุชื่อ</option>
                        </select>
                      </td>
                      <td><input className="input" type="datetime-local" value={t.scheduledTime} onChange={(e) => updateTask(t.key, { scheduledTime: e.target.value })} style={{ minWidth: 150 }} /></td>
                      <td><button type="button" className="icon-btn" onClick={() => removeTask(t.key)} aria-label={`ลบ ${t.file.name}`}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {jobs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {jobs.map((j, i) => (
              <div key={`${j.filename}-${i}`} className="job">
                <div className="job-head">
                  <span className="job-name">{j.filename}{j.destination_name ? ` → ${j.destination_name}` : ''}</span>
                  <span className={`badge badge-${j.status === 'success' ? 'success' : j.status === 'failed' ? 'failed' : j.status === 'pending' ? 'pending' : 'uploading'}`}>
                    {JOB_LABEL[j.status] || j.status}
                  </span>
                </div>
                {ACTIVE.includes(j.status) && (
                  <>
                    <ProgressBar percent={j.progress} />
                    <button type="button" onClick={() => handleCancel(j.id)} className="btn btn-danger btn-sm" style={{ marginTop: 10 }}>ยกเลิก</button>
                  </>
                )}
                {j.status === 'failed' && (
                  <>
                    {j.error_message && <p className="job-err">{j.error_message}</p>}
                    <button type="button" onClick={() => handleRetry(j.id)} className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}>ลองใหม่</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={uploading} className="btn btn-primary btn-block">
          {uploading ? 'กำลังอัปโหลด...' : `เริ่มอัปโหลด (${tasks.length * destinationIds.length} รายการ)`}
        </button>
      </form>
    </div>
  )
}
