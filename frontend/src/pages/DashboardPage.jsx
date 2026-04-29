import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import { usePacketChart } from '../hooks/usePacketChart.js'
import styles from './DashboardPage.module.css'

const API_BASE = '/api'

// ✅ helper ป้องกัน Invalid Date crash
function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts) // แสดงค่าดิบถ้า parse ไม่ได้
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function protocolColor(proto = '') {
  const p = proto.toLowerCase()
  if (p.includes('tls') || p.includes('ssl')) return styles.protoTls
  if (p.includes('http')) return styles.protoHttp
  if (p.includes('dns')) return styles.protoDns
  if (p.includes('udp')) return styles.protoUdp
  if (p.includes('tcp')) return styles.protoTcp
  return styles.proto
}

export default function DashboardPage() {
  const { authHeaders, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({ total: 0, encrypted: 0, plain: 0 })
  const [packets, setPackets] = useState([])
  const [alert, setAlert] = useState(null)

  const canvasRef = useRef(null)
  const { pushPoint } = usePacketChart(canvasRef)
  const alertTimerRef = useRef(null)

  function showAlert(msg) {
    setAlert(msg)
    clearTimeout(alertTimerRef.current)
    alertTimerRef.current = setTimeout(() => setAlert(null), 6000)
  }

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/packets/stats`, { headers: authHeaders() })
      if (res.status === 401) { logout(); navigate('/login'); return }
      const data = await res.json()
      setStats(data)
    } catch { }
  }, [authHeaders, logout, navigate])

  const loadPackets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/packets/history?limit=20`, { headers: authHeaders() })
      const data = await res.json()
      setPackets(data.data || [])
    } catch { }
  }, [authHeaders])

  useEffect(() => {
    loadStats()
    loadPackets()

    let socket
    import('socket.io-client').then(({ io }) => {
      const token = localStorage.getItem('token')
      socket = io('http://localhost:5000', { auth: { token } })

      socket.on('packet-received', (newPacket) => {
        setPackets(prev => [newPacket, ...prev].slice(0, 20))

        setStats(prev => ({
          ...prev,
          total: prev.total + 1,
          encrypted: newPacket.isEncrypted ? prev.encrypted + 1 : prev.encrypted,
          plain: !newPacket.isEncrypted ? prev.plain + 1 : prev.plain,
        }))

        pushPoint(newPacket.isEncrypted)
      })

      socket.on('security-alert', (data) => {
        showAlert(`${data.message} | จาก ${data.src}`)
      })
    }).catch((err) => {
      console.warn('socket.io-client load failed:', err)
    })

    const interval = setInterval(() => {
      loadStats()
      loadPackets()
    }, 15000)

    return () => {
      clearInterval(interval)
      socket?.disconnect()
      clearTimeout(alertTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const encPct = stats.total ? Math.round((stats.encrypted / stats.total) * 100) : 0

  return (
    <div>
      <Navbar live />

      {alert && (
        <div className={styles.alertBanner}>
          <span>⚠</span>
          <span>{alert}</span>
          <span className={styles.alertClose} onClick={() => setAlert(null)}>✕</span>
        </div>
      )}

      <div className={styles.main}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Packets</div>
            <div className={`${styles.statValue} ${styles.cTotal}`}>{stats.total.toLocaleString()}</div>
            <div className={styles.statSub}>all captured</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Encrypted</div>
            <div className={`${styles.statValue} ${styles.cEnc}`}>{stats.encrypted.toLocaleString()}</div>
            <div className={styles.statSub}>{encPct}% of total</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Plain</div>
            <div className={`${styles.statValue} ${styles.cPlain}`}>{stats.plain.toLocaleString()}</div>
            <div className={styles.statSub}>{100 - encPct}% of total</div>
          </div>
        </div>

        <div className={styles.sectionTitle}>Packet Activity (Real-time)</div>
        <div className={styles.chartWrap}>
          <canvas ref={canvasRef} />
        </div>

        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitle}>Recent Packets</div>
            <span className={styles.badgeCount}>{packets.length} rows</span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source IP</th>
                <th>Dest IP</th>
                <th>Protocol</th>
                <th>Length</th>
                <th>Enc</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((p, i) => (
                <tr key={i}>
                  {/* ✅ ใช้ formatTimestamp แทน — ป้องกัน RangeError: Invalid time value */}
                  <td>{formatTimestamp(p.timestamp)}</td>
                  <td>{p.sourceIp}</td>
                  <td>{p.destIp}</td>
                  <td><span className={protocolColor(p.protocol)}>{p.protocol}</span></td>
                  <td>{p.length}</td>
                  <td className={p.isEncrypted ? styles.encYes : styles.encNo}>
                    {p.isEncrypted ? 'YES' : 'NO'}
                  </td>
                </tr>
              ))}
              {packets.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>ยังไม่มีข้อมูล</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}