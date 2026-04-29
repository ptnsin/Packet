import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import { usePacketChart } from '../hooks/usePacketChart.js'
import styles from './DashboardPage.module.css'

const API_BASE = '/api'

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
    } catch {}
  }, [authHeaders, logout, navigate])

  const loadPackets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/packets/history?limit=20`, { headers: authHeaders() })
      const data = await res.json()
      setPackets(data.data || [])
    } catch {}
  }, [authHeaders])

  useEffect(() => {
    loadStats()
    loadPackets()

    // Socket.io
    let socket
    try {
      const token = localStorage.getItem('token')
      // Dynamic import so build doesn't break if socket.io is unavailable
      import('socket.io-client').then(({ io }) => {
        socket = io({ auth: { token } })
        socket.on('packet-received', (packet) => {
          loadStats()
          loadPackets()
          pushPoint(packet.isEncrypted)
        })
        socket.on('security-alert', (data) => {
          showAlert(data.message || 'Security Alert: พบ packet ที่น่าสงสัย')
        })
      }).catch(() => {})
    } catch {}

    const interval = setInterval(() => {
      loadStats()
      loadPackets()
    }, 15000)

    return () => {
      clearInterval(interval)
      socket?.disconnect()
      clearTimeout(alertTimerRef.current)
    }
  }, [loadStats, loadPackets, pushPoint])

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
                  <td>{new Date(p.timestamp).toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td>{p.sourceIp}</td>
                  <td>{p.destIp}</td>
                  <td><span className={styles.proto}>{p.protocol}</span></td>
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
