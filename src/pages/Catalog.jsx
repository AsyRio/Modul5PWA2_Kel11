import { lazy, Suspense, useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen } from 'lucide-react'
import { useGuns, useGunCategories, useGunById, useDeleteGun, gunKeys } from '../hooks/useGuns'
import { useDebounce } from '../hooks/useDebounce'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import AdvancedFilter from '../components/common/AdvancedFilter'
import Pagination from '../components/common/Pagination'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import { getSharedGunId } from '../utils/shareLink'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

// Halaman detail di-lazy-load: chunk-nya baru diunduh saat produk pertama dibuka.
const GunDetail = lazy(() => import('../components/gun/GunDetail'))

// Jumlah kartu per halaman (dikirim ke server sebagai `limit`).
const PAGE_SIZE = 6

/**
 * Catalog page — daftar produk.
 *
 * Sumber data:
 *   1. Supabase milik sendiri lewat useGuns() — PAGINASI, SEARCH, FILTER dan
 *      SORT dikerjakan di server; hasil tiap halaman di-cache (React Query).
 *   2. Array statis GUNS_LOCAL bila server tidak bisa dijangkau (offline).
 *
 * Sharelink: bila URL berisi ?gun=<id>, produk itu diambil dan langsung
 * dibuka di halaman detail (lihat utils/shareLink.js).
 */
export default function Catalog({ onNavigate }) {
  // ---- filters / sort / page ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [useLocal, setUseLocal] = useState(false)

  // Tunda search 350ms agar tidak ada request per ketukan tombol.
  const debouncedSearch = useDebounce(search)

  // Setiap filter berubah → kembali ke halaman 1 (halaman lama bisa tidak ada).
  const changeSearch = (v) => { setSearch(v); setPage(1) }
  const changeCategory = (v) => { setActiveCategory(v); setPage(1) }
  const changeSort = ({ key, order }) => { setSortKey(key); setSortOrder(order); setPage(1) }

  // ---- API data (satu halaman) ----
  const params = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
  }
  const { guns: apiGuns, pagination, loading, fetching, error, refetch } = useGuns(params)
  const apiCategories = useGunCategories()

  // Bila server gagal dan belum ada data sama sekali → pakai katalog lokal.
  const showLocal = useLocal || (Boolean(error) && apiGuns.length === 0)

  // Katalog lokal: filter/sort/paginasi dilakukan di klien dengan helper yang sama.
  const localAll = useMemo(() => {
    if (!showLocal) return []
    const enriched = GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    const filtered = enriched.filter(
      (g) => matchesSearch(g, debouncedSearch) && matchesCategory(g, activeCategory),
    )
    return sortItems(filtered, sortKey, sortOrder)
  }, [showLocal, debouncedSearch, activeCategory, sortKey, sortOrder])

  const total = showLocal ? localAll.length : pagination?.total ?? 0
  const totalPages = showLocal
    ? Math.max(1, Math.ceil(localAll.length / PAGE_SIZE))
    : pagination?.totalPages ?? 1

  const visibleGuns = showLocal
    ? localAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : apiGuns

  const categories = showLocal ? extractCategories(GUNS_LOCAL) : apiCategories

  // Setelah menghapus item terakhir di halaman terakhir, mundur satu halaman.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Prefetch halaman berikutnya ke cache selagi pengguna membaca halaman ini,
  // sehingga klik "Next" terasa instan (tidak ada loading).
  const queryClient = useQueryClient()
  useEffect(() => {
    if (showLocal || !pagination || page >= pagination.totalPages) return
    const nextParams = { ...params, page: page + 1 }
    queryClient.prefetchQuery({
      queryKey: gunKeys.list(nextParams),
      queryFn: () => gunService.getGuns(nextParams),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination, showLocal, debouncedSearch, activeCategory, sortKey, sortOrder])

  // ---- detail view ----
  const [selectedGun, setSelectedGun] = useState(null)

  // Sharelink: ID dibaca SEKALI saat Catalog dimuat. Produknya diambil
  // (di-cache juga) dan ditampilkan sebagai detail sampai pengguna menekan Back.
  const [sharedId] = useState(() => getSharedGunId())
  const [sharedDismissed, setSharedDismissed] = useState(false)
  const { gun: sharedGun, loading: sharedLoading, error: sharedError } = useGunById(
    sharedDismissed ? null : sharedId,
  )

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const { mutateAsync: deleteGun, isPending: deleting } = useDeleteGun()

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleteError('')
      await deleteGun(deleteTarget.id) // sukses → cache ['guns'] di-invalidate
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    }
  }

  // ---- Detail: dibuka dari kartu, atau dari Sharelink ----
  const detailGun = selectedGun || (sharedDismissed ? null : sharedGun)
  if (detailGun) {
    return (
      <Suspense fallback={<div className="state-box"><Loader size={28} className="spin" /><p>Loading…</p></div>}>
      <GunDetail
        gun={detailGun}
        onBack={() => { setSelectedGun(null); setSharedDismissed(true) }}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => {
          setSelectedGun(null)
          setSharedDismissed(true)
          setDeleteTarget(g)
        }}
      />
      </Suspense>
    )
  }

  if (sharedId && !sharedDismissed && sharedLoading) {
    return (
      <div className="state-box">
        <Loader size={28} className="spin" />
        <p>Opening shared item…</p>
      </div>
    )
  }

  // ---- Main catalog view ----
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {total === 0
                ? '0 pieces'
                : `${from}–${to} of ${total} piece${total !== 1 ? 's' : ''}`}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Link Sharelink yang tidak ditemukan */}
        {sharedId && !sharedDismissed && sharedError && (
          <div className="toast toast--error" role="alert">
            Shared item not found. It may have been removed.
          </div>
        )}

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={changeSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={changeCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={changeSort}
        />

        {/* States */}
        {loading && !showLocal && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && apiGuns.length === 0 && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={() => refetch()}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && visibleGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid — redup sedikit saat halaman baru sedang diambil */}
        {visibleGuns.length > 0 && (
          <ul className={`stock${fetching && !showLocal ? ' stock--fetching' : ''}`}>
            {visibleGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={(p) => {
            setPage(p)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); setPage(1); refetch() }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      {deleteError && (
        <div className="toast toast--error">{deleteError}</div>
      )}
    </>
  )
}
