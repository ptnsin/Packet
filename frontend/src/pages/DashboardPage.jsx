import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import { usePacketChart } from '../hooks/usePacketChart.js'
import styles from './DashboardPage.module.css'

const API_BASE = '/api'
const PROTOCOL_OPTIONS = ['', 'tls', 'http', 'dns', 'tcp', 'udp', 'ssh', 'ftp']

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts)
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

  const [stats, setStats]         = useState({ total: 0, encrypted: 0, plain: 0 })
  const [packets, setPackets]     = useState([])
  const [alert, setAlert]         = useState(null)
  const [exporting, setExporting] = useState(null)
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  // ── Filter state ── ตรงกับ query params ที่ backend รองรับทุกตัว
  const [filters, setFilters] = useState({
    protocol: '', encrypted: '', src: '', dst: '', startDate: '', endDate: '',
  })
  const [filterOpen, setFilterOpen] = useState(false)
  const [isFiltered, setIsFiltered] = useState(false)

  const canvasRef     = useRef(null)
  const { pushPoint } = usePacketChart(canvasRef)
  const alertTimerRef = useRef(null)
  const isFilteredRef = useRef(false) // ใช้ใน socket closure

  function showAlert(msg) {
    setAlert(msg)
    clearTimeout(alertTimerRef.current)
    alertTimerRef.current = setTimeout(() => setAlert(null), 6000)
  }

  function buildQuery(f, page = 1, limit = 20) {
    const p = new URLSearchParams({ page, limit })
    if (f.protocol)      p.set('protocol',  f.protocol)
    if (f.encrypted !== '') p.set('encrypted', f.encrypted)
    if (f.src)           p.set('src',       f.src)
    if (f.dst)           p.set('dst',       f.dst)
    if (f.startDate)     p.set('startDate', f.startDate)
    if (f.endDate)       p.set('endDate',   f.endDate)
    return p.toString()
  }

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/packets/stats`, { headers: authHeaders() })
      if (res.status === 401) { logout(); navigate('/login'); return }
      setStats(await res.json())
    } catch { }
  }, [authHeaders, logout, navigate])

  const loadPackets = useCallback(async (f, page = 1) => {
    try {
      const res  = await fetch(`${API_BASE}/packets/history?${buildQuery(f, page)}`, { headers: authHeaders() })
      const data = await res.json()
      setPackets(data.data || [])
      setPagination(data.pagination || { total: 0, page: 1, totalPages: 1 })
    } catch { }
  }, [authHeaders]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApplyFilter() {
    const active = Object.values(filters).some(v => v !== '')
    setIsFiltered(active)
    isFilteredRef.current = active
    loadPackets(filters, 1)
    setFilterOpen(false)
  }

  function handleResetFilter() {
    const empty = { protocol: '', encrypted: '', src: '', dst: '', startDate: '', endDate: '' }
    setFilters(empty)
    setIsFiltered(false)
    isFilteredRef.current = false
    loadPackets(empty, 1)
    setFilterOpen(false)
  }

  async function handleExport(format) {
    setExporting(format)
    try {
      const res = await fetch(
        format === 'pdf' ? `${API_BASE}/packets/report` : `${API_BASE}/packets/export?format=${format}`,
        { headers: authHeaders() }
      )
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `packets_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch { showAlert('Export ไม่สำเร็จ กรุณาลองใหม่') }
    finally  { setExporting(null) }
  }

  useEffect(() => {
    const empty = { protocol: '', encrypted: '', src: '', dst: '', startDate: '', endDate: '' }
    loadStats()
    loadPackets(empty, 1)

    let socket
    import('socket.io-client').then(({ io }) => {
      const token = localStorage.getItem('token')
      socket = io('http://localhost:5000', { auth: { token } })

      socket.on('packet-received', (newPacket) => {
        // ✅ real-time insert เฉพาะตอนไม่ได้ filter
        if (!isFilteredRef.current) {
          setPackets(prev => [newPacket, ...prev].slice(0, 20))
        }
        setStats(prev => ({
          ...prev,
          total:     prev.total + 1,
          encrypted: newPacket.isEncrypted ? prev.encrypted + 1 : prev.encrypted,
          plain:     !newPacket.isEncrypted ? prev.plain + 1 : prev.plain,
        }))
        pushPoint(newPacket.isEncrypted)
      })
      socket.on('security-alert', (data) => showAlert(`${data.message} | จาก ${data.src}`))
    }).catch(err => console.warn('socket.io-client load failed:', err))

    const interval = setInterval(loadStats, 15000)
    return () => { clearInterval(interval); socket?.disconnect(); clearTimeout(alertTimerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const encPct = stats.total ? Math.round((stats.encrypted / stats.total) * 100) : 0

  return (
    <div>
      <Navbar live />

      {alert && (
        <div className={styles.alertBanner}>
          <span>⚠</span><span>{alert}</span>
          <span className={styles.alertClose} onClick={() => setAlert(null)}>✕</span>
        </div>
      )}

      <div className={styles.main}>
        {/* ── Stats ── */}
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

        {/* ── Chart ── */}
        <div className={styles.sectionTitle}>Packet Activity (Real-time)</div>
        <div className={styles.chartWrap}><canvas ref={canvasRef} /></div>

        {/* ── Table wrap ── */}
        <div className={styles.tableWrap}>

          {/* Header */}
          <div className={styles.tableHeader}>
            <div className={styles.tableTitle}>
              Recent Packets
              {isFiltered && <span className={styles.filterBadge}>FILTERED</span>}
            </div>
            <div className={styles.tableActions}>
              <span className={styles.badgeCount}>{pagination.total.toLocaleString()} total</span>

              <button
                className={`${styles.exportBtn} ${filterOpen || isFiltered ? styles.filterBtnActive : ''}`}
                onClick={() => setFilterOpen(o => !o)}
              >
                🔍 Filter{isFiltered ? ' ●' : ''}
              </button>
              <button className={styles.exportBtn}                              onClick={() => handleExport('csv')}  disabled={!!exporting}>{exporting === 'csv'  ? '⏳' : '⬇'} CSV</button>
              <button className={styles.exportBtn}                              onClick={() => handleExport('json')} disabled={!!exporting}>{exporting === 'json' ? '⏳' : '⬇'} JSON</button>
              <button className={`${styles.exportBtn} ${styles.exportPdf}`}    onClick={() => handleExport('pdf')}  disabled={!!exporting}>{exporting === 'pdf'  ? '⏳' : '📄'} PDF</button>
              <button className={styles.exportBtn} onClick={() => navigate('/geo')}>🌍 Geo</button>
            </div>
          </div>

          {/* ── Filter Panel ── */}
          {filterOpen && (
            <div className={styles.filterPanel}>
              <div className={styles.filterGrid}>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Protocol</label>
                  <select className={styles.filterSelect} value={filters.protocol}
                    onChange={e => setFilters(f => ({ ...f, protocol: e.target.value }))}>
                    {PROTOCOL_OPTIONS.map(p => <option key={p} value={p}>{p || 'All'}</option>)}
                  </select>
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Encrypted</label>
                  <select className={styles.filterSelect} value={filters.encrypted}
                    onChange={e => setFilters(f => ({ ...f, encrypted: e.target.value }))}>
                    <option value="">All</option>
                    <option value="true">YES</option>
                    <option value="false">NO</option>
                  </select>
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Source IP</label>
                  <input className={styles.filterInput} placeholder="e.g. 192.168"
                    value={filters.src} onChange={e => setFilters(f => ({ ...f, src: e.target.value }))} />
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Dest IP</label>
                  <input className={styles.filterInput} placeholder="e.g. 10.0.0"
                    value={filters.dst} onChange={e => setFilters(f => ({ ...f, dst: e.target.value }))} />
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Start Date</label>
                  <input type="datetime-local" className={styles.filterInput}
                    value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                </div>

                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>End Date</label>
                  <input type="datetime-local" className={styles.filterInput}
                    value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                </div>

              </div>
              <div className={styles.filterActions}>
                <button className={styles.filterApplyBtn} onClick={handleApplyFilter}>Apply Filter</button>
                <button className={styles.filterResetBtn} onClick={handleResetFilter}>Reset</button>
              </div>
            </div>
          )}

          {/* ── Table ── */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th><th>Source IP</th><th>Dest IP</th>
                <th>Protocol</th><th>Length</th><th>Enc</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((p, i) => (
                <tr key={i}>
                  <td>{formatTimestamp(p.timestamp)}</td>
                  <td>{p.sourceIp}</td>
                  <td>{p.destIp}</td>
                  <td>
                    <span className={protocolColor(p.protocol)}>
    {p.protocol.split(':').pop()}
</span>
                  </td>
                  <td>{p.length}</td>
                  <td className={p.isEncrypted ? styles.encYes : styles.encNo}>
                    {p.isEncrypted ? 'YES' : 'NO'}
                  </td>
                </tr>
              ))}
              {packets.length === 0 && (
                <tr><td colSpan={6} className={styles.emptyRow}>ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>
              )}
            </tbody>
          </table>

          {/* ── Pagination ── */}
          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={pagination.page <= 1}
                onClick={() => loadPackets(filters, pagination.page - 1)}>‹ Prev</button>
              <span className={styles.pageInfo}>Page {pagination.page} / {pagination.totalPages}</span>
              <button className={styles.pageBtn} disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadPackets(filters, pagination.page + 1)}>Next ›</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}