import axios from 'axios'

// ---------------------------------------------------------------------------
// Konfigurasi API — memakai project Supabase MILIK SENDIRI.
//
// Nilai diambil dari file .env (lihat .env.example):
//   VITE_SUPABASE_URL           → https://<project-ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY → anon / publishable key project tsb.
//
// Supabase otomatis membuat REST API (PostgREST) untuk setiap tabel, sehingga
// endpoint seperti `${BASE_URL}/rest/v1/products` adalah API milik project
// individu, bukan API bersama (shared) dari modul.
// ---------------------------------------------------------------------------
const BASE_URL =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_API_BASE_URL || ''
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''

// Aplikasi hanya berbicara ke Supabase; flag ini dipertahankan agar mudah dicek.
const IS_CONFIGURED = Boolean(BASE_URL && SUPABASE_KEY)

if (!IS_CONFIGURED) {
  console.warn(
    '[api] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY belum diisi. ' +
      'Salin .env.example menjadi .env lalu isi dengan project Supabase Anda.',
  )
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Setiap request membawa apikey + Bearer token Supabase.
apiClient.interceptors.request.use((config) => {
  if (SUPABASE_KEY) {
    config.headers['apikey'] = SUPABASE_KEY
    if (!config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${SUPABASE_KEY}`
    }
  }
  return config
})

// Response: kembalikan `data` saja. Untuk paginasi kita butuh header
// `Content-Range` (total baris), jadi request boleh meminta `returnHeaders`
// agar mendapat { data, headers }.
apiClient.interceptors.response.use(
  (response) =>
    response.config.returnHeaders
      ? { data: response.data, headers: response.headers }
      : response.data,
  (error) => {
    let message = 'An unexpected error occurred'
    let status = null

    if (error.response) {
      status = error.response.status
      message =
        error.response.data?.message ||
        error.response.data?.msg ||
        error.response.data?.error ||
        error.response.data?.error_description ||
        `Server error (${status})`
    } else if (error.request) {
      message = 'Unable to reach the server. Check your connection and try again.'
    } else {
      message = error.message || message
    }

    return Promise.reject({
      message,
      status,
      code: error.response?.data?.code,
      raw: error.response?.data,
    })
  },
)

export { apiClient, BASE_URL, SUPABASE_KEY, IS_CONFIGURED }
