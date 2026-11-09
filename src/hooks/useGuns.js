import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// Query keys — satu tempat agar invalidasi cache konsisten.
//   ['guns']                       → SEMUA cache produk (dipakai untuk invalidate)
//   ['guns', 'list', params]       → satu halaman daftar (page/search/filter/sort)
//   ['guns', 'detail', id]         → satu produk (halaman detail & Sharelink)
//   ['guns', 'categories']         → daftar kategori untuk filter
// ---------------------------------------------------------------------------
export const gunKeys = {
  all: ['guns'],
  list: (params) => ['guns', 'list', params],
  detail: (id) => ['guns', 'detail', String(id)],
  categories: ['guns', 'categories'],
}

// ---------------------------------------------------------------------------
// useGuns — daftar produk per halaman (paginasi server-side) + cache.
//
// Returns { guns, loading, fetching, error, pagination, refetch }.
//  - loading  : true hanya saat load pertama (belum ada data apa pun).
//  - fetching : true setiap ada request berjalan, termasuk saat pindah halaman.
//
// `placeholderData: keepPreviousData` menjaga halaman sebelumnya tetap tampil
// sementara halaman berikutnya diambil, jadi grid tidak berkedip kosong.
// ---------------------------------------------------------------------------
export function useGuns(params = {}) {
  const query = useQuery({
    queryKey: gunKeys.list(params),
    queryFn: async () => {
      const response = await gunService.getGuns(params)
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch products.')
      }
      return response
    },
    placeholderData: keepPreviousData,
  })

  return {
    guns: query.data?.data ?? [],
    pagination: query.data?.pagination ?? null,
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error ? query.error.message || 'Failed to fetch products.' : null,
    refetch: query.refetch,
  }
}

// ---------------------------------------------------------------------------
// useGunCategories — kategori unik; hampir tidak berubah sehingga cache lama.
// ---------------------------------------------------------------------------
export function useGunCategories() {
  const query = useQuery({
    queryKey: gunKeys.categories,
    queryFn: () => gunService.getCategories(),
    staleTime: 30 * 60 * 1000,
  })
  return query.data ?? ['All']
}

// ---------------------------------------------------------------------------
// useGunById — satu produk berdasarkan ID. `enabled` mencegah request bila
// id kosong (mis. tidak ada parameter ?gun= di URL Sharelink).
// ---------------------------------------------------------------------------
export function useGunById(id) {
  const query = useQuery({
    queryKey: gunKeys.detail(id),
    queryFn: async () => {
      const response = await gunService.getGunById(id)
      if (!response.success) {
        throw new Error(response.message || 'Product not found.')
      }
      return response.data
    },
    enabled: Boolean(id),
  })

  return {
    gun: query.data ?? null,
    loading: Boolean(id) && query.isPending,
    error: query.error ? query.error.message || 'Failed to load product details.' : null,
    refetch: query.refetch,
  }
}

// ---------------------------------------------------------------------------
// Mutations — setelah berhasil, seluruh cache ['guns'] di-invalidate agar
// daftar/detail/kategori di-refetch dengan data terbaru.
// ---------------------------------------------------------------------------
function useGunMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gunKeys.all }),
  })
}

export const useCreateGun = () => useGunMutation((data) => gunService.createGun(data))
export const useUpdateGun = () =>
  useGunMutation(({ id, data }) => gunService.updateGun(id, data))
export const useDeleteGun = () => useGunMutation((id) => gunService.deleteGun(id))
