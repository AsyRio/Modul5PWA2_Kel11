# Bore & Barrel

A dummy gunshop storefront built as a Progressive Web App. It runs offline
with an app shell, a web app manifest, and a service worker, and uses React +
Vite + Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env   # lalu isi dengan project Supabase MILIK SENDIRI (lihat di bawah)
npm run dev            # dev server with HMR
```

Other scripts:

```bash
npm run build    # production build to dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Structure

```
.
├── index.html              # HTML shell
├── vite.config.js          # Vite + vite-plugin-pwa (manifest + service worker)
├── public/                 # static assets served at /
│   ├── icon-192.png / icon-512.png / icon.svg
│   └── guns/               # product images
└── src/
    ├── main.jsx            # entry, mounts <App/>
    ├── App.jsx             # app shell: tab state, header/nav/content/footer
    ├── App.css             # app shell styles
    ├── index.css           # global styles
    ├── components/
    │   ├── Header.jsx      # brand + nav
    │   ├── GunCard.jsx     # single product card
    │   └── Footer.jsx
    ├── data/
    │   └── guns.js         # dummy product data
    └── pages/
        ├── Catalog.jsx     # product grid
        ├── About.jsx
        └── Contact.jsx
```

## Backend & database milik sendiri (bukan API/Supabase bersama modul)

Aplikasi hanya berbicara ke project Supabase pribadi. Langkah:

1. Buat project di <https://supabase.com> (gratis).
2. Buka **SQL Editor**, tempel isi [`supabase/schema.sql`](supabase/schema.sql), lalu **Run**.
   Ini membuat tabel `products`, `favorites`, `reviews`, aturan RLS, bucket
   storage `guns`, dan 12 data contoh (cukup untuk melihat paginasi).
3. Salin **Project URL** dan **anon/publishable key** dari *Project Settings → API*
   ke file `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
4. Saat deploy (mis. Vercel), isi dua variabel yang sama di *Environment Variables*.

Supabase otomatis menyediakan REST API (PostgREST) untuk tiap tabel, mis.
`GET {URL}/rest/v1/products?limit=6&offset=0`. Itulah API yang dipakai
`src/services/*.js` (lewat Axios di `src/config/api.js`). Seluruh cabang kode
untuk API universitas bersama sudah dihapus.

## Penjelasan fitur

### 1. Lazy loading
- **Code splitting halaman** — `src/App.jsx` memakai `React.lazy(() => import(...))`
  untuk Favorites, Profile, Create, Edit, Detail, About, dan Contact. Vite memecahnya
  menjadi file JS terpisah (terlihat di output `npm run build`, mis.
  `CreateGunPage-*.js`, `GunDetail-*.js`). File itu baru diunduh saat halamannya
  pertama dibuka; selama menunggu, `<Suspense>` menampilkan spinner. Hanya Catalog
  (halaman pertama) yang ada di bundle awal. `Catalog.jsx` juga me-lazy-load `GunDetail`.
- **Lazy load gambar** — `GunCard.jsx` memakai `loading="lazy"` pada `<img>`, sehingga
  gambar kartu yang belum terlihat di layar tidak diunduh dulu.

### 2. Query caching (TanStack Query)
- `src/lib/queryClient.js` mengatur cache global: `staleTime` 5 menit (data dianggap
  segar, tidak ada request ulang), `gcTime` 30 menit (data tak terpakai dibuang
  dari memori), `retry: 1`.
- `src/hooks/useGuns.js`, `useReviews.js`, `useFavorites.js` memakai `useQuery`.
  Setiap data punya *query key*, mis. `['guns','list',{page:2,...}]`. Membuka kembali
  halaman 2 yang sudah pernah dilihat langsung dari cache tanpa request.
- **Deduplikasi** — banyak `FavoriteButton` memakai query yang sama
  (`['favorites', userId]`), sehingga hanya ada satu request, bukan satu per kartu.
- **Invalidasi** — `useCreateGun/useUpdateGun/useDeleteGun` memanggil
  `invalidateQueries(['guns'])` setelah sukses, jadi daftar otomatis ter-refresh.
  Review baru meng-invalidate `['reviews', id]`.
- **Prefetch** — `Catalog.jsx` mengambil halaman berikutnya di latar belakang,
  sehingga klik *Next* terasa instan.
- `placeholderData: keepPreviousData` menjaga halaman lama tetap tampil saat halaman
  baru diambil (tidak berkedip kosong).

### 3. Paginasi (server-side)
- `gunService.getGuns({ page, limit })` mengirim `limit=6&offset=(page-1)*6` ke
  PostgREST dengan header `Prefer: count=exact`. Supabase membalas header
  `Content-Range: 0-5/12`; angka setelah `/` adalah **total** baris, dipakai untuk
  menghitung `totalPages = ceil(total / limit)`.
- Search (`ilike` pada nama & deskripsi), filter kategori, dan sort juga dikerjakan di
  server, jadi paginasi selalu konsisten dengan filter. Urutan ditambah `id` sebagai
  pengurut kedua agar tidak ada item ganda/terlewat antar halaman.
- Mengganti search/kategori/sort mereset ke halaman 1; search di-debounce 350 ms
  (`hooks/useDebounce.js`).
- UI: `components/common/Pagination.jsx` (Prev, nomor halaman dengan `…`, Next) dan
  teks "1–6 of 12 pieces". Katalog lokal (fallback offline) dipaginasi di klien
  dengan ukuran halaman yang sama.

### 4. Sharelink per item katalog
Kode: `src/utils/shareLink.js` (logika) dan `src/components/common/ShareButton.jsx` (UI).
- Tiap produk punya `id` unik di database. Sharelink = URL aplikasi + `?gun=<id>`,
  mis. `https://situs-anda.app/?gun=7`.
- **Mengirim** — tombol Share ada di setiap kartu katalog dan halaman detail.
  `shareGun()` memakai **Web Share API** (share sheet bawaan HP/PWA) bila tersedia,
  jika tidak URL disalin ke clipboard (dengan cadangan `execCommand` untuk browser
  lama). Ikon berubah menjadi centang + "Link copied" selama 2 detik.
- **Menerima** — `Catalog.jsx` membaca `?gun=` saat dimuat (`getSharedGunId()`),
  mengambil produk itu dari Supabase lewat `useGunById` (hasilnya ikut di-cache), lalu
  langsung membuka halaman detailnya. Jika ID tidak ada, muncul pesan "Shared item not found".
- **Sinkron URL** — selama detail terbuka, `GunDetail.jsx` memanggil
  `setShareParam(id)` (`history.replaceState`) agar address bar selalu berisi link yang
  bisa dibagikan, dan menghapusnya saat kembali ke katalog.
- Item katalog **lokal** (fallback offline, id `local-*`) tidak punya ID database, jadi
  tombol Share disembunyikan untuk item tersebut.
