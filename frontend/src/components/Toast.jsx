import { useState, useCallback, useEffect, useRef } from 'react'
import styles from './Toast.module.css'

export function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((msg, type = 'success') => {
    clearTimeout(timerRef.current)
    setToast({ msg, type })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { toast, showToast }
}

export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`${styles.toast} ${styles[toast.type]}`}>
      {toast.msg}
    </div>
  )
}
