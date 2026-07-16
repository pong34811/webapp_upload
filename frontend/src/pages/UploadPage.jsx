import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, uploadAPI } from '../api/client'
import ProgressBar from '../components/ProgressBar'

export default function UploadPage() {
  const [destinations, setDestinations] = useState([])
  const [destinationId, setDestinationId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [privacy, setPrivacy] = useState('private')
  const [scheduledTime, setScheduledTime] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [jobStatus, setJobStatus] = useState('')
  const [jobId, setJobId] = useState(null)
  const pollingRef = useRef(null)

  useEffect(() => {
    destinationAPI.list().then((res) => setDestinations(res.data))
  }, [])

  useEffect(() => {
    if (jobId && (jobStatus === 'uploading' || jobStatus === 'pending')) {
      pollingRef.current = setInterval(async () => {
        const res = await uploadAPI.get(jobId)
        setProgress(res.data.progress)
        setJobStatus(res.data.status)
        if (res.data.status === 'success') {
          clearInterval(pollingRef.current)
          toast.success('อัปโหลดสำเร็จ')
          setUploading(false)
        } else if (res.data.status === 'failed') {
          clearInterval(pollingRef.current)
          toast.error(res.data.error_message || 'อัปโหลดล้มเหลว')
          setUploading(false)
        }
      }, 1500)
    }
    return () => clearInterval(pollingRef.current)
  }, [jobId, jobStatus])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !destinationId || !title) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setUploading(true)
    setProgress(0)
    setJobStatus('uploading')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('destination_id', destinationId)
    formData.append('title', title)
    formData.append('description', description)
    formData.append('tags', tags)
    formData.append('privacy', privacy)
    if (scheduledTime) formData.append('scheduled_time', scheduledTime)

    try {
      const res = await uploadAPI.create(formData, (p) => setProgress(p))
      setJobId(res.data.id)
      setJobStatus(res.data.status)
    } catch (err) {
      toast.error(err.response?.data?.error || 'อัปโหลดล้มเหลว')
      setUploading(false)
    }
  }

  const handleCancel = async () => {
    if (jobId) {
      await uploadAPI.cancel(jobId)
      toast.success('ยกเลิกแล้ว')
      setUploading(false)
      setJobStatus('')
      setProgress(0)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>อัปโหลดวิดีโอ</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} style={{ width: '100%', padding: 8 }} required>
            <option value="">เลือกเป้าหมาย</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>{d.platform} - {d.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="file" accept=".mp4,.mov,.avi,.mkv,.webm" onChange={(e) => setFile(e.target.files[0])} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input placeholder="ชื่อคลิป" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <textarea placeholder="คำอธิบาย" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: 8, height: 80 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input placeholder="แท็ก (คั่นด้วยเครื่องหมายคอมมา)" value={tags} onChange={(e) => setTags(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} style={{ width: '100%', padding: 8 }}>
            <option value="public">สาธารณะ</option>
            <option value="private">ส่วนตัว</option>
            <option value="unlisted">ไม่ระบุชื่อ</option>
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="datetime-local" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} style={{ width: '100%', padding: 8 }} />
          <small style={{ color: '#666' }}> ปล่อยว่างหากต้องการอัปโหลดทันที</small>
        </div>

        {uploading && (
          <div style={{ marginBottom: 12 }}>
            <ProgressBar percent={progress} />
            <button type="button" onClick={handleCancel} style={{ marginTop: 8, background: '#f44336', color: '#fff', border: 'none', padding: '6px 16px', cursor: 'pointer' }}>
              ยกเลิกการอัปโหลด
            </button>
          </div>
        )}

        <button type="submit" disabled={uploading} style={{ width: '100%', padding: 10, background: uploading ? '#ccc' : '#4caf50', color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>
          {uploading ? 'กำลังอัปโหลด...' : 'เริ่มอัปโหลด'}
        </button>
      </form>
    </div>
  )
}
