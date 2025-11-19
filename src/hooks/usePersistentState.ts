import { useState, useEffect } from 'react'

// Hook genérico para persistir estado en localStorage.
// No rehidrata objetos Date automáticamente (se guardan como string ISO).
// Uso: const [value, setValue] = usePersistentState('team-members', []);
export function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        return JSON.parse(raw)
      }
    } catch (e) {
      // Silencio errores de parseo
    }
    return defaultValue
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      // Silencio errores de escritura (cuota llena, etc.)
    }
  }, [key, value])

  return [value, setValue]
}
