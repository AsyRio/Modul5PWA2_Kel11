import { useState, useRef, useEffect } from 'react'
import { Share2, Check } from 'lucide-react'
import { isShareable, shareGun } from '../../utils/shareLink'

/**
 * Tombol Sharelink untuk satu item katalog.
 *
 * - `variant="icon"`  : bulat kecil, dipakai di kartu katalog.
 * - `variant="full"`  : tombol dengan teks, dipakai di halaman detail.
 *
 * Setelah ditekan, ikon berubah jadi centang + teks "Link copied" selama 2 detik
 * sebagai umpan balik. Tombol tidak ditampilkan untuk item lokal (tanpa ID
 * database) karena linknya tidak akan bisa dibuka orang lain.
 */
export default function ShareButton({ gun, variant = 'icon' }) {
  const [status, setStatus] = useState(null) // null | 'copied' | 'shared' | 'failed'
  const timer = useRef(null)

  // Bersihkan timer bila komponen di-unmount sebelum 2 detik berlalu.
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!isShareable(gun)) return null

  const handleClick = async (e) => {
    e.stopPropagation() // jangan memicu klik kartu (membuka detail)
    const result = await shareGun(gun)
    if (result === 'cancelled') return
    setStatus(result)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(null), 2000)
  }

  const done = status === 'copied' || status === 'shared'
  const label =
    status === 'copied' ? 'Link copied'
    : status === 'shared' ? 'Shared'
    : status === 'failed' ? 'Copy failed'
    : 'Share'

  if (variant === 'full') {
    return (
      <button
        type="button"
        className="btn btn--outline"
        onClick={handleClick}
        aria-label={`Share link for ${gun.name}`}
      >
        {done ? <Check size={16} /> : <Share2 size={16} />} {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`fav-btn share-btn${done ? ' share-btn--done' : ''}`}
      onClick={handleClick}
      aria-label={`Share link for ${gun.name}`}
      title={status ? label : 'Share link'}
    >
      {done ? (
        <Check size={16} stroke="var(--brass)" />
      ) : (
        <Share2 size={16} stroke="var(--steel)" />
      )}
    </button>
  )
}
