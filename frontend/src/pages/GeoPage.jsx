import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './GeoPage.module.css'

const API_BASE = '/api'

export default function GeoPage() {
  const { authHeaders, logout } = useAuth()
  const navigate = useNavigate()

  const [locations, setLocations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [selected, setSelected]   = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadGeo() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/geo/map`, { headers: authHeaders() })
      if (res.status === 401) { logout(); navigate('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLocations(data.locations || [])
      setLastUpdated(new Date())
    } catch (e) {
      setError('ไม่สามารถโหลดข้อมูล Geolocation ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGeo()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // group by country for sidebar stats
  const countryStats = locations.reduce((acc, loc) => {
    acc[loc.country] = (acc[loc.country] || 0) + 1
    return acc
  }, {})
  const topCountries = Object.entries(countryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.main}>
        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.pageTitle}>🌍 Geolocation Map</div>
            <div className={styles.pageSub}>
              แสดง Source IP ที่ไม่ซ้ำ 20 อันล่าสุด
              {lastUpdated && (
                <span className={styles.updatedAt}>
                  {' '}· updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={loadGeo} disabled={loading}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
              ← Dashboard
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className={styles.errorBanner}>
            ⚠ {error}
          </div>
        )}

        {/* ── Layout ── */}
        <div className={styles.layout}>
          {/* Map */}
          <div className={styles.mapWrap}>
            {loading && (
              <div className={styles.mapOverlay}>
                <div className={styles.spinner} />
                <span>กำลังโหลดข้อมูล...</span>
              </div>
            )}
            <MapContainer
              center={[20, 0]}
              zoom={2}
              className={styles.map}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CartoDB"
              />
              {locations.map((loc, i) => (
                <CircleMarker
                  key={i}
                  center={[loc.lat, loc.lon]}
                  radius={selected?.ip === loc.ip ? 10 : 7}
                  pathOptions={{
                    color:       selected?.ip === loc.ip ? '#00d2a8' : '#e3b341',
                    fillColor:   selected?.ip === loc.ip ? '#00d2a8' : '#e3b341',
                    fillOpacity: 0.75,
                    weight:      selected?.ip === loc.ip ? 2 : 1,
                  }}
                  eventHandlers={{ click: () => setSelected(loc) }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                    <div className={styles.tooltipBox}>
                      <div className={styles.tooltipIp}>{loc.ip}</div>
                      <div className={styles.tooltipCity}>{loc.city}, {loc.country}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>

            {/* Selected IP detail */}
            {selected ? (
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <span className={styles.detailTitle}>IP Detail</span>
                  <span className={styles.detailClose} onClick={() => setSelected(null)}>✕</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>IP</span>
                  <span className={styles.detailValue}>{selected.ip}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>City</span>
                  <span className={styles.detailValue}>{selected.city || '-'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Country</span>
                  <span className={styles.detailValue}>{selected.country || '-'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>ISP</span>
                  <span className={styles.detailValue}>{selected.isp || '-'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Coords</span>
                  <span className={styles.detailValue}>
                    {selected.lat?.toFixed(4)}, {selected.lon?.toFixed(4)}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.hintCard}>
                <div className={styles.hintIcon}>📍</div>
                <div className={styles.hintText}>คลิก marker บนแผนที่<br/>เพื่อดูรายละเอียด IP</div>
              </div>
            )}

            {/* Stats */}
            <div className={styles.statsCard}>
              <div className={styles.statsTitle}>Summary</div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Total IPs</span>
                <span className={styles.statVal}>{locations.length}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Countries</span>
                <span className={styles.statVal}>{Object.keys(countryStats).length}</span>
              </div>
            </div>

            {/* Top Countries */}
            {topCountries.length > 0 && (
              <div className={styles.statsCard}>
                <div className={styles.statsTitle}>Top Countries</div>
                {topCountries.map(([country, count]) => (
                  <div className={styles.countryRow} key={country}>
                    <span className={styles.countryName}>{country}</span>
                    <div className={styles.countryBarWrap}>
                      <div
                        className={styles.countryBar}
                        style={{ width: `${(count / locations.length) * 100}%` }}
                      />
                    </div>
                    <span className={styles.countryCount}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* IP List */}
            <div className={styles.ipListCard}>
              <div className={styles.statsTitle}>IP List</div>
              {locations.length === 0 && !loading && (
                <div className={styles.emptyText}>ยังไม่มีข้อมูล</div>
              )}
              {locations.map((loc, i) => (
                <div
                  key={i}
                  className={`${styles.ipRow} ${selected?.ip === loc.ip ? styles.ipRowActive : ''}`}
                  onClick={() => setSelected(loc)}
                >
                  <span className={styles.ipAddr}>{loc.ip}</span>
                  <span className={styles.ipCity}>{loc.city}, {loc.country}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}