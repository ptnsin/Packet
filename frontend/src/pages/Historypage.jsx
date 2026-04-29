import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import styles from './HistoryPage.module.css'

const API_BASE = '/api'

function protocolColor(proto = '') {
    const p = proto.toLowerCase()
    if (p.includes('tls') || p.includes('ssl')) return styles.protoTls
    if (p.includes('http')) return styles.protoHttp
    if (p.includes('dns')) return styles.protoDns
    if (p.includes('udp')) return styles.protoUdp
    if (p.includes('tcp')) return styles.protoTcp
    return styles.proto
}

export default function HistoryPage() {
    const { authHeaders, logout } = useAuth()
    const navigate = useNavigate()

    const [packets, setPackets] = useState([])
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 })
    const [loading, setLoading] = useState(false)

    // Filter state
    const [filters, setFilters] = useState({
        protocol: '',
        encrypted: '',
        src: '',
        dst: '',
        startDate: '',
        endDate: '',
    })

    const loadHistory = useCallback(async (page = 1, f = filters) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page, limit: 50 })
            if (f.protocol) params.append('protocol', f.protocol)
            if (f.encrypted !== '') params.append('encrypted', f.encrypted)
            if (f.src) params.append('src', f.src)
            if (f.dst) params.append('dst', f.dst)
            if (f.startDate) params.append('startDate', f.startDate)
            if (f.endDate) params.append('endDate', f.endDate)

            const res = await fetch(`${API_BASE}/packets/history?${params}`, { headers: authHeaders() })
            if (res.status === 401 || res.status === 403) { logout(); navigate('/login'); return }
            const data = await res.json()
            setPackets(data.data || [])
            setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [authHeaders, logout, navigate, filters])

    useEffect(() => { loadHistory(1) }, [])

    function handleFilterChange(e) {
        setFilters(f => ({ ...f, [e.target.name]: e.target.value }))
    }

    function handleSearch(e) {
        e.preventDefault()
        loadHistory(1, filters)
    }

    function handleReset() {
        const empty = { protocol: '', encrypted: '', src: '', dst: '', startDate: '', endDate: '' }
        setFilters(empty)
        loadHistory(1, empty)
    }

    function handleExportCSV() {
        window.open(`${API_BASE}/packets/export?format=csv`, '_blank')
    }

    function handleExportJSON() {
        window.open(`${API_BASE}/packets/export?format=json`, '_blank')
    }

    function handleExportPDF() {
        window.open(`${API_BASE}/packets/report`, '_blank')
    }

    return (
        <div>
            <Navbar />
            <div className={styles.main}>
                <div className={styles.pageHeader}>
                    <div>
                        <div className={styles.pageTitle}>Packet History</div>
                        <div className={styles.pageSub}>ประวัติการจับ Packet ทั้งหมด</div>
                    </div>
                    <div className={styles.exportBtns}>
                        <button className={styles.btnExport} onClick={handleExportCSV}>⬇ CSV</button>
                        <button className={styles.btnExport} onClick={handleExportJSON}>⬇ JSON</button>
                        <button className={`${styles.btnExport} ${styles.btnPdf}`} onClick={handleExportPDF}>⬇ PDF</button>
                    </div>
                </div>

                {/* Filter Form */}
                <div className={styles.filterCard}>
                    <form onSubmit={handleSearch} className={styles.filterGrid}>
                        <div className={styles.filterField}>
                            <label>Protocol</label>
                            <input
                                name="protocol"
                                value={filters.protocol}
                                onChange={handleFilterChange}
                                placeholder="เช่น tls, http, dns"
                            />
                        </div>
                        <div className={styles.filterField}>
                            <label>Encrypted</label>
                            <select name="encrypted" value={filters.encrypted} onChange={handleFilterChange}>
                                <option value="">ทั้งหมด</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        </div>
                        <div className={styles.filterField}>
                            <label>Source IP</label>
                            <input
                                name="src"
                                value={filters.src}
                                onChange={handleFilterChange}
                                placeholder="เช่น 192.168"
                            />
                        </div>
                        <div className={styles.filterField}>
                            <label>Dest IP</label>
                            <input
                                name="dst"
                                value={filters.dst}
                                onChange={handleFilterChange}
                                placeholder="เช่น 10.0"
                            />
                        </div>
                        <div className={styles.filterField}>
                            <label>Start Date</label>
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className={styles.filterField}>
                            <label>End Date</label>
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className={styles.filterActions}>
                            <button type="submit" className={styles.btnSearch}>🔍 ค้นหา</button>
                            <button type="button" className={styles.btnReset} onClick={handleReset}>↺ รีเซ็ต</button>
                        </div>
                    </form>
                </div>

                {/* Table */}
                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div className={styles.tableTitle}>ผลลัพธ์</div>
                        <span className={styles.badgeCount}>{pagination.total.toLocaleString()} packets</span>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>กำลังโหลด...</div>
                    ) : (
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
                                {packets.length === 0 ? (
                                    <tr><td colSpan={6} className={styles.emptyRow}>ไม่พบข้อมูล</td></tr>
                                ) : packets.map((p, i) => (
                                    <tr key={i}>
                                        <td>{new Date(p.timestamp).toISOString().slice(0, 19).replace('T', ' ')}</td>
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
                            </tbody>
                        </table>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className={styles.pagination}>
                            <button
                                className={styles.pageBtn}
                                disabled={pagination.page <= 1}
                                onClick={() => loadHistory(pagination.page - 1)}
                            >← ก่อนหน้า</button>

                            <span className={styles.pageInfo}>
                                หน้า {pagination.page} / {pagination.totalPages}
                            </span>

                            <button
                                className={styles.pageBtn}
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => loadHistory(pagination.page + 1)}
                            >ถัดไป →</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}