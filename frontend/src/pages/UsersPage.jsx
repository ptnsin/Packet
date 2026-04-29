import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Navbar from '../components/Navbar.jsx'
import Toast, { useToast } from '../components/Toast.jsx'
import styles from './UsersPage.module.css'

const API_BASE = '/api'

export default function UsersPage() {
  const { authHeaders, logout, token } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [users, setUsers] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'user' })

  // Get current user id from JWT payload
  let currentUserId = null
  try {
    currentUserId = JSON.parse(atob(token.split('.')[1])).id
  } catch {}

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() })
      if (res.status === 401 || res.status === 403) { logout(); navigate('/login'); return }
      const data = await res.json()
      setUsers(data)
    } catch {
      showToast('โหลดข้อมูลผู้ใช้ไม่สำเร็จ', 'error')
    }
  }, [authHeaders, logout, navigate, showToast])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleDelete(id, username) {
    if (!confirm(`ยืนยันลบผู้ใช้ "${username}"?`)) return
    try {
      const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || 'ลบไม่สำเร็จ', 'error'); return }
      showToast(data.message || 'ลบผู้ใช้สำเร็จ', 'success')
      loadUsers()
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.username || !form.password) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return }
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || 'สร้างไม่สำเร็จ', 'error'); return }
      showToast(`สร้างผู้ใช้ "${form.username}" สำเร็จ`, 'success')
      setForm({ username: '', password: '', role: 'user' })
      loadUsers()
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <Navbar />
      <div className={styles.main}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}>User Management</div>
          <div className={styles.pageSub}>จัดการผู้ใช้งานในระบบ (Admin เท่านั้น)</div>
        </div>

        <div className={styles.layout}>
          {/* User Table */}
          <div className={styles.tableWrap}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>รายชื่อผู้ใช้ทั้งหมด</div>
              <span className={styles.badgeCount}>{users.length} users</span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} className={styles.emptyRow}>ยังไม่มีผู้ใช้งาน</td></tr>
                ) : users.map(u => {
                  const isSelf = u.id === currentUserId
                  const created = new Date(u.createdAt).toLocaleDateString('th-TH', {
                    year: '2-digit', month: 'short', day: 'numeric',
                  })
                  return (
                    <tr key={u.id}>
                      <td className={styles.tdId}>{u.id}</td>
                      <td>
                        <span className={styles.username}>{u.username}</span>
                        {isSelf && <span className={styles.selfTag}>(คุณ)</span>}
                      </td>
                      <td>
                        <span className={`${styles.roleBadge} ${styles[u.role]}`}>{u.role}</span>
                      </td>
                      <td className={styles.tdDate}>{created}</td>
                      <td>
                        <button
                          className={styles.btnDelete}
                          onClick={() => handleDelete(u.id, u.username)}
                          disabled={isSelf}
                          title={isSelf ? 'ไม่สามารถลบตัวเองได้' : ''}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Create User Form */}
          <div className={styles.formCard}>
            <div className={styles.formTitle}>สร้าง User ใหม่</div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="กรอก username"
                  autoComplete="off"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="กรอก password"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button className={styles.btnCreate} type="submit" disabled={creating}>
                {creating ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
