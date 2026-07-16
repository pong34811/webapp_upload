export default function ProgressBar({ percent }) {
  return (
    <div style={{ width: '100%', background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
      <div
        style={{
          width: `${percent}%`,
          background: '#4caf50',
          height: 24,
          textAlign: 'center',
          color: '#fff',
          lineHeight: '24px',
          fontSize: 12,
          transition: 'width 0.3s',
        }}
      >
        {percent}%
      </div>
    </div>
  )
}
