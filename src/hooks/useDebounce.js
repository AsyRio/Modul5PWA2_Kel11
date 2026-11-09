import { useState, useEffect } from 'react'

/**
 * Mengembalikan `value` yang tertunda `delay` ms. Dipakai pada kolom search
 * agar request ke server tidak dikirim di setiap ketukan tombol, melainkan
 * setelah pengguna berhenti mengetik.
 */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
