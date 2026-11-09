import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Susun daftar nomor halaman yang ditampilkan, dengan "…" untuk bagian yang
 * dipersingkat. Contoh (total 10, aktif 5): [1, '…', 4, 5, 6, '…', 10]
 */
function getPageItems(page, totalPages, siblings = 1) {
  const first = 1
  const last = totalPages
  const start = Math.max(first + 1, page - siblings)
  const end = Math.min(last - 1, page + siblings)

  const items = [first]
  if (start > first + 1) items.push('…')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < last - 1) items.push('…')
  if (last > first) items.push(last)
  return items
}

/**
 * Kontrol paginasi: Prev, nomor halaman, Next.
 *
 * @param {Object}   props
 * @param {number}   props.page         — halaman aktif (mulai dari 1)
 * @param {number}   props.totalPages   — total halaman
 * @param {Function} props.onPage       — (nomorHalaman) => void
 * @param {boolean}  [props.disabled]   — nonaktifkan saat request berjalan
 */
export default function Pagination({ page, totalPages, onPage, disabled = false }) {
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPage(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} /> Prev
      </button>

      <ul className="pagination__pages">
        {getPageItems(page, totalPages).map((item, i) =>
          item === '…' ? (
            <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">…</li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={`pagination__btn pagination__num${item === page ? ' pagination__btn--active' : ''}`}
                onClick={() => onPage(item)}
                disabled={disabled}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPage(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label="Next page"
      >
        Next <ChevronRight size={16} />
      </button>
    </nav>
  )
}
