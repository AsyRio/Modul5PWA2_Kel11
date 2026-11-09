import { QueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Query caching (TanStack Query)
//
// Setiap hasil fetch disimpan di cache memori berdasarkan "query key",
// mis. ['guns', 'list', { page: 2, search: 'ak' }]. Aturan siklus hidup cache:
//
//  - staleTime  : selama 5 menit data dianggap SEGAR. Membuka kembali halaman
//                 atau kembali ke halaman paginasi yang pernah dilihat
//                 langsung memakai cache — TIDAK ada request jaringan.
//  - gcTime     : data yang sudah tidak dipakai komponen mana pun tetap
//                 disimpan 30 menit sebelum dibuang dari memori.
//  - setelah stale: data lama tetap ditampilkan seketika, lalu di-refetch di
//                 latar belakang (stale-while-revalidate).
//  - retry: 1   : gagal sekali → coba ulang sekali sebelum menampilkan error.
//
// Saat data berubah (tambah/ubah/hapus), cache terkait di-invalidate lewat
// queryClient.invalidateQueries(...) di hooks/useGuns.js, sehingga daftar
// otomatis di-refetch.
// ---------------------------------------------------------------------------
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
