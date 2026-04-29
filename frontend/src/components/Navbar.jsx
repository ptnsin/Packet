import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './Navbar.module.css'

export default function Navbar({ live = false }) {
  const { role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span>PACKET</span>WATCH
        </div>
        {live && (
          <>
            <div className={styles.liveDot} />
            <div className={styles.liveLabel}>LIVE</div>
          </>
        )}
      </div>
      <div className={styles.right}>
        <Link
          to="/dashboard"
          className={`${styles.link} ${location.pathname === '/dashboard' ? styles.active : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/history"
          className={`${styles.link} ${location.pathname === '/history' ? styles.active : ''}`}
        >
          History
        </Link>
        {role === 'admin' && (
          <Link
            to="/users"
            className={`${styles.link} ${location.pathname === '/users' ? styles.active : ''}`}
          >
            User Management
          </Link>
        )}
        <span className={styles.roleBadge}>{(role || 'user').toUpperCase()}</span>
        <button className={styles.btnLogout} onClick={handleLogout}>
          ออกจากระบบ
        </button>
      </div>
    </nav>
  )
}
