import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-toastify'
import { FaFileExcel, FaUpload, FaRocket, FaVideo, FaFile } from 'react-icons/fa'
import { destinationAPI, uploadAPI, templateAPI, importAPI } from '../api/client'
import ProgressBar from '../components/ProgressBar'
import TemplateModal from '../components/TemplateModal'

const ACTIVE = ['pending', 'uploading']
const JOB_LABEL = { pending: 'รอดำเนินการ', uploading: 'กำลังอัปโหลด', success: 'สำเร็จ', failed: 'ล้มเหลว' }
let keySeq = 0

/* ─── Excel import steps ─── */
const EXCEL_STEP_FILE  = 'file'
const EXCEL_STEP_SHEET = 'sheet'
const EXCEL_STEP_REVIEW = 'review'

export default function UploadPage() {
  const [destinations, setDestinations] = useState([])
  const [destinationIds, setDestinationIds] = useState([])
  const [tasks, setTasks] = useState([])
  const [jobs, setJobs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tplModalOpen, setTplModalOpen] = useState(false)
  const [tplModalMode, setTplModalMode] = useState('create')
  const [tplModalInitial, setTplModalInitial] = useState(null)
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  /* ─── Excel import state ─── */
  const [excelOpen, setExcelOpen] = useState(false)
  const [excelStep, setExcelStep] = useState(EXCEL_STEP_FILE)
  const [excelFile, setExcelFile] = useState(null)
  const [excelSheets, setExcelSheets] = useState([])
  const [excelRows, setExcelRows] = useState([])
  const [excelSheetName, setExcelSheetName] = useState('')
  const [excelSkipped, setExcelSkipped] = useState(0)
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelPath, setExcelPath] = useState('')
  const excelInputRef = useRef(null)

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
    const incoming = [...fileList]
    setTasks((prev) => {
      const matched = []
      const unmatched = []
      for (const file of incoming) {
        const droppedBase = file.name.toLowerCase()
        // Try to match with an Excel task that has no file yet
        const excelIdx = prev.findIndex((t) => {
          if (!t.fromExcel || t.file || !t.excelFilename) return false
          const excelBase = t.excelFilename.split(/[\/\\]/).pop().toLowerCase()
          return droppedBase === excelBase || droppedBase.includes(excelBase) || excelBase.includes(droppedBase)
        })
        if (excelIdx !== -1) {
          matched.push({ idx: excelIdx, file })
        } else {
          unmatched.push(file)
        }
      }
      let updated = [...prev]
      for (const { idx, file } of matched) {
        updated[idx] = { ...updated[idx], file }
      }
      const newTasks = unmatched.map((file) => ({
        key: `${Date.now()}-${keySeq++}`, file, title: '', description: '', tags: '', privacy: 'private', scheduledTime: '',
      }))
      if (matched.length > 0) {
        toast.success(`จับคู่ไฟล์กับรายการ Excel ได้ ${matched.length} ไฟล์`)
      }
      return [...updated, ...newTasks]
    })
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
    setTasks((prev) => prev.map((t) => ({
      ...t,
      title: tpl.title || t.title,
      description: tpl.description || t.description,
      tags: tpl.tags || t.tags,
    })))
    toast.success(`ใช้เทมเพลต: ${tpl.name}`)
  }
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

  /* ──────────── Excel import handlers ──────────── */
  const openExcelImport = () => {
    setExcelOpen(true)
    setExcelStep(EXCEL_STEP_FILE)
    setExcelFile(null)
    setExcelSheets([])
    setExcelRows([])
    setExcelSheetName('')
    setExcelPath('')
  }

  const closeExcelImport = () => {
    setExcelOpen(false)
    setExcelStep(EXCEL_STEP_FILE)
    setExcelFile(null)
    setExcelSheets([])
    setExcelRows([])
    if (excelInputRef.current) excelInputRef.current.value = ''
  }

  const loadExcelFromPath = async (path) => {
    if (!path.trim()) { toast.error('กรุณาใส่ path ไฟล์'); return }
    setExcelLoading(true)
    try {
      const res = await importAPI.sheetsByPath(path.trim())
      if (!res.data.sheets || res.data.sheets.length === 0) {
        toast.error('ไม่พบ Sheet ในไฟล์')
        return
      }
      setExcelSheets(res.data.sheets)
      setExcelFile({ name: res.data.display_name || path })
      setExcelStep(EXCEL_STEP_SHEET)
    } catch (err) {
      toast.error(err.response?.data?.error || 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setExcelLoading(false)
    }
  }

  const handleExcelFilePick = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.xlsx')) {
      toast.error('กรุณาเลือกไฟล์ .xlsx เท่านั้น')
      return
    }
    setExcelFile(f)
    setExcelLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await importAPI.sheets(fd)
      if (!res.data.sheets || res.data.sheets.length === 0) {
        toast.error('ไม่พบ Sheet ในไฟล์')
        return
      }
      setExcelSheets(res.data.sheets)
      setExcelStep(EXCEL_STEP_SHEET)
    } catch (err) {
      toast.error(err.response?.data?.error || 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setExcelLoading(false)
      if (excelInputRef.current) excelInputRef.current.value = ''
    }
  }

  const handleExcelSheetPick = async (name) => {
    setExcelSheetName(name)
    setExcelLoading(true)
    try {
      let res
      if (excelFile?.path) {
        // Loaded from disk path
        res = await importAPI.previewByPath(excelFile.path, name)
      } else if (excelFile instanceof File) {
        // Uploaded via browser
        const fd = new FormData()
        fd.append('file', excelFile)
        fd.append('sheet_name', name)
        res = await importAPI.preview(fd)
      } else {
        res = await importAPI.previewByPath(excelPath, name)
      }
      setExcelRows(res.data.rows || [])
      setExcelSkipped(res.data.skipped_non_upload || 0)
      setExcelStep(EXCEL_STEP_REVIEW)
    } catch (err) {
      toast.error(err.response?.data?.error || 'โหลด preview ไม่สำเร็จ')
    } finally {
      setExcelLoading(false)
    }
  }

  const updateExcelRow = (idx, patch) =>
    setExcelRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const removeExcelRow = (idx) =>
    setExcelRows((prev) => prev.filter((_, i) => i !== idx))

  const handleExcelConfirm = () => {
    const validRows = excelRows.filter((r) => !r.errors?.length && r.filename)
    if (validRows.length === 0) {
      toast.error('ไม่มีรายการที่ถูกต้องให้เพิ่ม')
      return
    }
    // Convert Excel rows to tasks (without actual file objects — they'll have filename as reference)
    const newTasks = validRows.map((r) => ({
      key: `excel-${Date.now()}-${keySeq++}`,
      file: null,
      excelFilename: r.filename || '',
      excelFilePath: r.filename_full || '',
      fileFound: r.file_found || false,
      title: r.title || '',
      description: r.description || '',
      tags: r.tags || '',
      privacy: r.privacy || 'private',
      scheduledTime: r.scheduled_time ? r.scheduled_time.slice(0, 16) : '',
      fromExcel: true,
    }))
    setTasks((prev) => [...prev, ...newTasks])
    toast.success(`เพิ่ม ${validRows.length} รายการจาก Excel แล้ว`)
    closeExcelImport()
  }

  /* ──────────── Submit upload ──────────── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (tasks.length === 0 || destinationIds.length === 0) { toast.error('กรุณาเลือกไฟล์และปลายทาง'); return }
    setUploading(true)
    const destNames = Object.fromEntries(destinations.map((d) => [d.id, d.name]))
    const combos = destinationIds.flatMap((did) => tasks.map((task) => ({ did, task })))
    const results = await Promise.allSettled(combos.map(async ({ did, task }) => {
      const formData = new FormData()
      if (task.file) {
        formData.append('file', task.file)
      } else if (task.excelFilePath) {
        formData.append('file_path', task.excelFilePath)
      } else {
        return { _skipped: true, task }
      }
      formData.append('destination_id', did)
      formData.append('title', task.title || (task.file ? task.file.name : task.excelFilename || ''))
      formData.append('description', task.description)
      formData.append('tags', task.tags)
      formData.append('privacy', task.privacy)
      if (task.scheduledTime) formData.append('scheduled_time', task.scheduledTime)
      const res = await uploadAPI.create(formData)
      return res.data
    }))
    const skippedCount = results.filter((r) => r.status === 'fulfilled' && r.value?._skipped).length
    const newJobs = results.filter((r) => !(r.status === 'fulfilled' && r.value?._skipped)).map((r, i) => {
      const ok = r.status === 'fulfilled'
      const t = combos[i].task
      return {
        filename: t.file ? t.file.name : (t.excelFilename || t.title || ''),
        destination_name: destNames[combos[i].did],
        id: ok ? r.value.id : null,
        status: ok ? r.value.status : 'failed',
        progress: 0,
        error_message: ok ? '' : (r.reason?.response?.data?.error || 'อัปโหลดล้มเหลว'),
      }
    })
    if (skippedCount > 0) {
      toast.warn(`ข้าม ${skippedCount} รายการที่ยังไม่มีไฟล์วิดีโอ`)
    }
    setJobs(newJobs); setTasks([])
    if (newJobs.every((j) => j.status === 'failed')) setUploading(false)
  }

  const handleRetry = async (id) => {
    try {
      const res = await uploadAPI.retry(id)
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, id: res.data.id, status: res.data.status, progress: 0, error_message: '' } : j))
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
        <h2 className="page-title"><FaUpload style={{ marginRight: 10, verticalAlign: 'middle', color: 'var(--accent)' }} />อัปโหลดวิดีโอ</h2>
        <button type="button" className="btn btn-ghost" onClick={openExcelImport}>
          <FaFileExcel style={{ fontSize: 18, marginRight: 6, verticalAlign: 'middle', color: '#217346' }} />
          Export Excel
        </button>
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
              <span className="dropzone-icon"><FaVideo style={{ color: 'var(--accent)', fontSize: 36 }} /></span>
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
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTplModal()}>บันทึกเทมเพลต</button>
            </div>

            {templates.length > 0 && (
              <div className="tpl-bar">
                {templates.map((tpl) => (
                  <span key={tpl.id} className="tpl-chip">
                    <button type="button" className="tpl-chip-btn" onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
                    <button type="button" className="tpl-chip-x" onClick={() => openTplModal(tpl)} aria-label={`แก้ไข ${tpl.name}`}>✎</button>
                    <button type="button" className="tpl-chip-x" onClick={() => deleteTemplate(tpl.id)} aria-label={`ลบ ${tpl.name}`}>✕</button>
                  </span>
                ))}
              </div>
            )}

            <TemplateModal
              open={tplModalOpen}
              mode={tplModalMode}
              initial={tplModalInitial}
              templates={templates}
              onSaved={handleTplSaved}
              onClose={() => setTplModalOpen(false)}
            />

            <div className="table-wrap" style={{ marginBottom: 20 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th><FaFile style={{ marginRight: 4, verticalAlign: 'middle' }} />ไฟล์</th>
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
                        {t.file && t.file.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(t.file)} className="video-preview" muted preload="metadata" onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0 }} />
                        ) : null}
                        <span className="file-name">
                          {t.file ? t.file.name : t.excelFilename}
                          {t.fromExcel && <span className="badge badge-pending" style={{ marginLeft: 6, fontSize: 11 }}>Excel</span>}
                        </span>
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
                      <td><button type="button" className="icon-btn" onClick={() => removeTask(t.key)} aria-label={`ลบ`}>✕</button></td>
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

        <button type="submit" disabled={uploading || tasks.every((t) => !t.file && !t.excelFilePath)} className="btn btn-primary btn-block" style={{ padding: '14px 20px', fontSize: '1rem' }}>
          <FaRocket />
          {uploading ? 'กำลังอัปโหลด...' : `เริ่มอัปโหลด (${tasks.filter((t) => t.file || t.excelFilePath).length * destinationIds.length} รายการ)`}
        </button>
        {tasks.some((t) => !t.file && !t.excelFilePath) && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--warning)', textAlign: 'center' }}>
            ⚠️ มี {tasks.filter((t) => !t.file && !t.excelFilePath).length} รายการที่ยังไม่มีไฟล์วิดีโอ — ลากไฟล์มาวางเพื่อจับคู่อัตโนมัติ
          </p>
        )}
      </form>

      {/* ──────── Excel Import Modal ──────── */}
      {excelOpen && (
        <div className="tpl-modal-overlay" onClick={closeExcelImport}>
          <div className="tpl-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="tpl-modal-title"><FaFileExcel style={{ fontSize: 22, marginRight: 6, verticalAlign: 'middle', color: '#217346' }} /> Export Excel (.xlsx)</h3>

            {/* Step: pick file */}
            {excelStep === EXCEL_STEP_FILE && (
              <>
                <p style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
                  เลือกไฟล์ <strong>.xlsx</strong> ที่มีรายการวิดีโอ
                </p>
                {/* Path input */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    className="input"
                    placeholder="C:\\Users\\...\\file.xlsx"
                    value={excelPath}
                    onChange={(e) => setExcelPath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') loadExcelFromPath(excelPath) }}
                    disabled={excelLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => loadExcelFromPath(excelPath)}
                    disabled={excelLoading || !excelPath.trim()}
                  >
                    เปิด
                  </button>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, margin: '8px 0' }}>— หรือ —</div>
                {/* File picker */}
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleExcelFilePick}
                  disabled={excelLoading}
                />
                {excelLoading && <p className="hint">กำลังอ่านไฟล์...</p>}
              </>
            )}

            {/* Step: pick sheet */}
            {excelStep === EXCEL_STEP_SHEET && (
              <>
                <p style={{ marginBottom: 4, color: 'var(--muted)', fontSize: 14 }}>
                  ไฟล์: <strong>{excelFile?.name}</strong>
                </p>
                <p style={{ marginBottom: 12 }}>พบ {excelSheets.length} Sheet — เลือก Sheet ที่ต้องการ:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {excelSheets.map((s) => (
                    <button key={s.name} className="btn btn-ghost" onClick={() => handleExcelSheetPick(s.name)} disabled={excelLoading}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--muted)' }}>({s.columns.length} cols)</span>
                    </button>
                  ))}
                </div>
                {excelLoading && <p className="hint" style={{ marginTop: 8 }}>กำลังโหลด preview...</p>}
              </>
            )}

            {/* Step: review rows */}
            {excelStep === EXCEL_STEP_REVIEW && (
              <>
                <p style={{ marginBottom: 4, color: 'var(--muted)', fontSize: 14 }}>
                  Sheet: <strong>{excelSheetName}</strong> — {excelRows.length} รายการ
                  {excelSkipped > 0 && (
                    <span style={{ marginLeft: 8, color: 'var(--faint)' }}>
                      (ข้าม {excelSkipped} รายการที่ไม่ใช่ WAIT_UPLOAD)
                    </span>
                  )}
                </p>
                <div className="table-wrap" style={{ maxHeight: 350, overflow: 'auto', marginBottom: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>ไฟล์วิดีโอ</th>
                        <th>title</th>
                        <th>description</th>
                        <th>tags</th>
                        <th>privacy</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.map((r, i) => (
                        <tr key={i} style={r.errors?.length ? { background: 'var(--danger-bg)' } : {}}>
                          <td className="cell-mono" style={{ fontSize: 12 }}>{r.row}</td>
                          <td style={{ maxWidth: 160, wordBreak: 'break-all', fontSize: 13 }}>
                            {r.filename ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: r.file_found ? 'var(--success)' : 'var(--warning)' }}>
                                  {r.file_found ? '✅' : '⚠️'}
                                </span>
                                {r.filename}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--danger)' }}>ไม่มี</span>
                            )}
                          </td>
                          <td>
                            <input className="input" style={{ fontSize: 13 }} value={r.title}
                              onChange={(e) => updateExcelRow(i, { title: e.target.value })} />
                          </td>
                          <td className="textarea-cell">
                            <textarea className="textarea" rows={2} style={{ fontSize: 13 }} value={r.description}
                              onChange={(e) => updateExcelRow(i, { description: e.target.value })} />
                          </td>
                          <td>
                            <input className="input" style={{ fontSize: 13 }} value={r.tags}
                              onChange={(e) => updateExcelRow(i, { tags: e.target.value })} />
                          </td>
                          <td>
                            <select className="select" style={{ fontSize: 13 }} value={r.privacy}
                              onChange={(e) => updateExcelRow(i, { privacy: e.target.value })}>
                              <option value="public">สาธารณะ</option>
                              <option value="private">ส่วนตัว</option>
                              <option value="unlisted">ไม่ระบุชื่อ</option>
                            </select>
                          </td>
                          <td>
                            <button type="button" className="icon-btn" onClick={() => removeExcelRow(i)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {excelRows.some((r) => r.errors?.length) && (
                  <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>
                    ⚠️ รายการสีแดงมีข้อผิดพลาด — ระบบจะข้ามรายการที่ filename ว่าง
                  </p>
                )}
              </>
            )}

            <div className="tpl-modal-actions">
              <button className="btn btn-ghost" onClick={closeExcelImport}>ยกเลิก</button>
              {excelStep === EXCEL_STEP_SHEET && (
                <button className="btn btn-ghost" onClick={() => { setExcelStep(EXCEL_STEP_FILE); setExcelFile(null); setExcelSheets([]) }}>
                  ← เลือกไฟล์ใหม่
                </button>
              )}
              {excelStep === EXCEL_STEP_REVIEW && (
                <>
                  <button className="btn btn-ghost" onClick={() => { setExcelStep(EXCEL_STEP_SHEET); setExcelRows([]) }}>
                    ← เลือก Sheet ใหม่
                  </button>
                  <button className="btn btn-primary" onClick={handleExcelConfirm} disabled={excelRows.filter((r) => !r.errors?.length && r.filename).length === 0}>
                    เพิ่ม {excelRows.filter((r) => !r.errors?.length && r.filename).length} รายการ
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
