import { useState, useRef } from 'react'
import { toast } from 'react-toastify'
import { importAPI, destinationAPI, uploadAPI } from '../api/client'

/* ─── step constants ─── */
const STEP_PICK_FILE   = 0
const STEP_PICK_SHEET  = 1
const STEP_REVIEW      = 2
const STEP_UPLOADING   = 3

export default function ImportPage() {
  /* general */
  const [step, setStep] = useState(STEP_PICK_FILE)
  const [file, setFile] = useState(null)

  /* step 1 – sheet picker */
  const [sheets, setSheets] = useState([])
  const [loadingSheets, setLoadingSheets] = useState(false)

  /* step 2 – review */
  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [sheetName, setSheetName] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  /* destinations */
  const [destinations, setDestinations] = useState([])
  const [selectedDestIds, setSelectedDestIds] = useState([])

  /* upload jobs */
  const [jobs, setJobs] = useState([])
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef(null)

  /* ──────────────────── helpers ──────────────────── */
  const buildFileForm = () => {
    const fd = new FormData()
    fd.append('file', file)
    return fd
  }

  const updateRow = (rowIdx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)))

  const removeRow = (rowIdx) =>
    setRows((prev) => prev.filter((_, i) => i !== rowIdx))

  /* ──────────────────── step 0 → pick file ──────────────────── */
  const handleFileChange = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.xlsx')) {
      toast.error('กรุณาเลือกไฟล์ .xlsx เท่านั้น')
      return
    }
    setFile(f)
    setLoadingSheets(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await importAPI.sheets(fd)
      if (!res.data.sheets || res.data.sheets.length === 0) {
        toast.error('ไม่พบ Sheet ในไฟล์')
        setLoadingSheets(false)
        return
      }
      setSheets(res.data.sheets)
      setStep(STEP_PICK_SHEET)
    } catch (err) {
      toast.error(err.response?.data?.error || 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setLoadingSheets(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /* ──────────────────── step 1 → pick sheet ──────────────────── */
  const handleSelectSheet = async (name) => {
    setSheetName(name)
    setLoadingPreview(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('sheet_name', name)
      const res = await importAPI.preview(fd)
      setRows(res.data.rows || [])
      setTotalRows(res.data.total_rows || 0)
      /* also load destinations */
      const destRes = await destinationAPI.list()
      setDestinations(destRes.data || [])
      setStep(STEP_REVIEW)
    } catch (err) {
      toast.error(err.response?.data?.error || 'โหลด preview ไม่สำเร็จ')
    } finally {
      setLoadingPreview(false)
    }
  }

  /* ──────────────────── step 2 → start upload ──────────────────── */
  const handleStartUpload = async () => {
    if (selectedDestIds.length === 0) {
      toast.error('กรุณาเลือกปลายทางอย่างน้อย 1 ช่อง')
      return
    }
    const validRows = rows.filter((r) => !r.errors?.length)
    if (validRows.length === 0) {
      toast.error('ไม่มีรายการที่ถูกต้องให้อัปโหลด')
      return
    }

    setUploading(true)
    setStep(STEP_UPLOADING)

    /* Build jobs: each row × each destination */
    const destNames = Object.fromEntries(destinations.map((d) => [d.id, d.name]))
    const combos = selectedDestIds.flatMap((did) =>
      validRows.map((r) => ({ did, row: r }))
    )

    const results = await Promise.allSettled(
      combos.map(async ({ did, row }) => {
        const fd = new FormData()
        fd.append('destination_id', did)
        fd.append('title', row.title || row.filename || '')
        fd.append('description', row.description || '')
        fd.append('tags', row.tags || '')
        fd.append('privacy', row.privacy || 'private')
        if (row.scheduled_time) fd.append('scheduled_time', row.scheduled_time)
        /* We don't have an actual video file for Excel import, so we store
           the metadata as a placeholder upload job.  The user must later
           associate actual files.  For now we create the job record only. */
        const res = await uploadAPI.create(fd)
        return res.data
      })
    )

    const newJobs = results.map((r, i) => {
      const ok = r.status === 'fulfilled'
      const combo = combos[i]
      return {
        id: ok ? r.value.id : null,
        title: combo.row.title || combo.row.filename || '',
        destName: destNames[combo.did],
        status: ok ? r.value.status : 'failed',
        progress: 0,
        error: ok ? '' : (r.reason?.response?.data?.error || 'อัปโหลดล้มเหลว'),
      }
    })

    setJobs(newJobs)
    const okCount = newJobs.filter((j) => j.status !== 'failed').length
    const failCount = newJobs.length - okCount
    toast.success(
      `สร้าง ${okCount} รายการสำเร็จ` +
        (failCount > 0 ? `, ${failCount} รายการล้มเหลว` : '')
    )
    setUploading(false)
  }

  /* ──────────────────── render helpers ──────────────────── */
  const handleBackToFile = () => {
    setStep(STEP_PICK_FILE)
    setFile(null)
    setSheets([])
    setRows([])
  }

  const handleBackToSheets = () => {
    setStep(STEP_PICK_SHEET)
    setRows([])
  }

  /* ──────────────────── JSX ──────────────────── */
  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Import จาก Excel</h2>
      </div>

      {/* ─── STEP 0: pick file ─── */}
      {step === STEP_PICK_FILE && (
        <div className="card card-pad">
          <p style={{ marginBottom: 12 }}>
            เลือกไฟล์ <strong>.xlsx</strong> ที่มีรายการวิดีโอที่ต้องการอัปโหลด
          </p>
          <div className="field">
            <label htmlFor="excel-file">ไฟล์ Excel (.xlsx)</label>
            <input
              id="excel-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={loadingSheets}
            />
          </div>
          {loadingSheets && <p className="hint">กำลังอ่านไฟล์...</p>}
        </div>
      )}

      {/* ─── STEP 1: pick sheet ─── */}
      {step === STEP_PICK_SHEET && (
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleBackToFile}>
              ← เลือกไฟล์ใหม่
            </button>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              ไฟล์: {file?.name}
            </span>
          </div>
          <p style={{ marginBottom: 12 }}>พบ {sheets.length} Sheet — เลือก Sheet ที่ต้องการนำเข้า:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sheets.map((s) => (
              <button
                key={s.name}
                className="btn btn-ghost"
                onClick={() => handleSelectSheet(s.name)}
                disabled={loadingPreview}
              >
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--muted)' }}>
                  ({s.columns.length} columns)
                </span>
              </button>
            ))}
          </div>
          {loadingPreview && <p className="hint" style={{ marginTop: 12 }}>กำลังโหลด preview...</p>}
        </div>
      )}

      {/* ─── STEP 2: review rows ─── */}
      {step === STEP_REVIEW && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleBackToSheets}>
              ← เลือก Sheet ใหม่
            </button>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              Sheet: <strong>{sheetName}</strong> — {rows.length} รายการ (จาก {totalRows} ทั้งหมด)
            </span>
          </div>

          {/* destination picker */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="field">
              <label>เลือกช่องปลายทาง (เลือกได้หลายช่อง)</label>
              <div className="dest-list">
                {destinations.map((d) => (
                  <label
                    key={d.id}
                    className={`dest-chip ${selectedDestIds.includes(d.id) ? 'dest-chip-active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDestIds.includes(d.id)}
                      onChange={(e) =>
                        setSelectedDestIds((prev) =>
                          e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)
                        )
                      }
                    />
                    <span>{d.platform} - {d.name}</span>
                  </label>
                ))}
                {destinations.length === 0 && (
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                    ยังไม่มีปลายทาง — กรุณาเพิ่มในหน้าตั้งค่าก่อน
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* rows table */}
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>ไฟล์วิดีโอ</th>
                  <th>video_title</th>
                  <th>description</th>
                  <th>tags</th>
                  <th>privacy</th>
                  <th>กำหนดเวลา</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={r.errors?.length ? { background: 'var(--danger-bg)' } : {}}>
                    <td className="cell-mono">{r.row}</td>
                    <td className="cell-title" style={{ maxWidth: 200, wordBreak: 'break-all', fontSize: 13 }}>
                      {r.filename || <span style={{ color: 'var(--danger)' }}>ไม่มี</span>}
                    </td>
                    <td>
                      <input
                        className="input"
                        value={r.title}
                        onChange={(e) => updateRow(i, { title: e.target.value })}
                      />
                    </td>
                    <td className="textarea-cell">
                      <textarea
                        className="textarea"
                        rows={3}
                        value={r.description}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        value={r.tags}
                        onChange={(e) => updateRow(i, { tags: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="select"
                        value={r.privacy}
                        onChange={(e) => updateRow(i, { privacy: e.target.value })}
                      >
                        <option value="public">สาธารณะ</option>
                        <option value="private">ส่วนตัว</option>
                        <option value="unlisted">ไม่ระบุชื่อ</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="datetime-local"
                        value={r.scheduled_time ? r.scheduled_time.slice(0, 16) : ''}
                        onChange={(e) => updateRow(i, { scheduled_time: e.target.value })}
                        style={{ minWidth: 150 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removeRow(i)}
                        aria-label={`ลบแถว ${r.row}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.some((r) => r.errors?.length) && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 14 }}>
              ⚠️ มีรายการที่มีข้อผิดพลาด (แถวสีแดง) — ระบบจะข้ามรายการที่ filename ว่าง
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            onClick={handleStartUpload}
            disabled={selectedDestIds.length === 0 || rows.length === 0}
          >
            เริ่มอัปโหลด ({rows.filter((r) => !r.errors?.length).length * selectedDestIds.length} รายการ)
          </button>
        </>
      )}

      {/* ─── STEP 3: uploading / results ─── */}
      {step === STEP_UPLOADING && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h3>ผลการอัปโหลด</h3>
          </div>
          {jobs.length === 0 && !uploading && (
            <div className="empty">
              <p className="empty-text">ไม่มีรายการ</p>
            </div>
          )}
          {jobs.map((j, i) => (
            <div key={`${j.id || i}`} className="job">
              <div className="job-head">
                <span className="job-name">
                  {j.title} → {j.destName}
                </span>
                <span
                  className={`badge badge-${
                    j.status === 'success'
                      ? 'success'
                      : j.status === 'failed'
                        ? 'failed'
                        : j.status === 'pending'
                          ? 'pending'
                          : 'uploading'
                  }`}
                >
                  {j.status === 'success'
                    ? 'สำเร็จ'
                    : j.status === 'failed'
                      ? 'ล้มเหลว'
                      : j.status}
                </span>
              </div>
              {j.error && <p className="job-err">{j.error}</p>}
            </div>
          ))}
          <button
            className="btn btn-ghost"
            style={{ marginTop: 16 }}
            onClick={() => {
              setStep(STEP_PICK_FILE)
              setFile(null)
              setSheets([])
              setRows([])
              setJobs([])
              setSelectedDestIds([])
            }}
          >
            ← Import ไฟล์ใหม่
          </button>
        </>
      )}
    </div>
  )
}
