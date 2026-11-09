// ---------------------------------------------------------------------------
// shareLink.js — logika fitur SHARELINK untuk setiap item katalog.
//
// Ide dasar: tiap produk punya ID unik di database (`products.id`). Sharelink
// adalah URL aplikasi + parameter query `?gun=<id>`, contoh:
//
//     https://bore-barrel.vercel.app/?gun=12
//
// Alur lengkap:
//   1. Pengguna menekan tombol Share pada kartu katalog / halaman detail
//      (components/common/ShareButton.jsx) → `shareGun(gun)` dipanggil.
//   2. `buildShareUrl(id)` membuat URL di atas.
//   3. Jika perangkat mendukung Web Share API (HP/PWA), muncul share sheet
//      bawaan OS (WhatsApp, Telegram, dll). Jika tidak (desktop), URL disalin
//      ke clipboard.
//   4. Penerima membuka link → `Catalog.jsx` membaca `?gun=` lewat
//      `getSharedGunId()`, mengambil produk tsb dari Supabase
//      (`useGunById`) dan langsung menampilkan halaman detailnya.
//   5. Saat halaman detail terbuka, `setShareParam(id)` menyamakan address bar
//      dengan produk yang sedang dilihat (tanpa reload), dan menghapusnya lagi
//      ketika pengguna kembali ke katalog.
//
// Link bisa dibuka di browser mana pun karena data diambil dari database
// bersama (project Supabase sendiri), bukan dari state lokal pengirim.
// ---------------------------------------------------------------------------

export const SHARE_PARAM = 'gun'

/**
 * Produk hanya bisa dibagikan bila punya ID dari database. Item katalog lokal
 * (fallback offline, id "local-0", dst.) hanya ada di perangkat ini, jadi
 * tidak dibagikan.
 */
export const isShareable = (gun) =>
  Boolean(gun?.id) && !String(gun.id).startsWith('local-')

/**
 * Bangun URL yang dibagikan: <origin><base-path>?gun=<id>
 * `import.meta.env.BASE_URL` menjaga URL tetap benar bila app di-deploy di
 * sub-path.
 */
export const buildShareUrl = (id) => {
  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
  url.searchParams.set(SHARE_PARAM, String(id))
  return url.toString()
}

/**
 * Baca ID produk dari URL saat ini (null bila bukan Sharelink).
 */
export const getSharedGunId = () => {
  try {
    return new URLSearchParams(window.location.search).get(SHARE_PARAM)
  } catch {
    return null
  }
}

/**
 * Sinkronkan address bar dengan produk yang sedang dibuka.
 * `replaceState` dipakai (bukan pushState) agar tombol Back browser tidak
 * menumpuk riwayat; `null` menghapus parameter.
 */
export const setShareParam = (id) => {
  try {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set(SHARE_PARAM, String(id))
    else url.searchParams.delete(SHARE_PARAM)
    window.history.replaceState(window.history.state, '', url)
  } catch {
    /* lingkungan tanpa History API — abaikan */
  }
}

// Salin teks ke clipboard; punya cadangan untuk browser lama / konteks non-HTTPS.
const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('Copy failed')
}

/**
 * Bagikan satu produk.
 * @returns {Promise<'shared'|'copied'|'cancelled'|'failed'>}
 */
export async function shareGun(gun) {
  const url = buildShareUrl(gun.id)

  if (navigator.share) {
    try {
      await navigator.share({
        title: gun.name,
        text: `${gun.name} — Bore & Barrel`,
        url,
      })
      return 'shared'
    } catch (err) {
      // Pengguna menutup share sheet → bukan error, jangan lanjut menyalin.
      if (err?.name === 'AbortError') return 'cancelled'
      // Selain itu (mis. share ditolak) → coba salin ke clipboard.
    }
  }

  try {
    await copyToClipboard(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
