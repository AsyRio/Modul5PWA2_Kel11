import { apiClient } from '../config/api'

// ---------------------------------------------------------------------------
// Normalizer — menyeragamkan bentuk data produk dari tabel Supabase
// `public.products` milik sendiri.
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — CRUD ke tabel `products` di project Supabase milik sendiri
// lewat REST API otomatis (PostgREST): /rest/v1/products.
// ---------------------------------------------------------------------------

// Batasi karakter yang punya arti khusus di filter PostgREST `or=(...)`.
const sanitizeSearch = (q) => String(q).replace(/[,()*\\]/g, ' ').trim()

// Header `Content-Range` berbentuk "0-5/23" (atau "*/0"): angka setelah "/"
// adalah TOTAL baris yang cocok dengan filter, bukan hanya baris halaman ini.
const parseTotal = (contentRange, fallback) => {
  const total = Number(String(contentRange || '').split('/')[1])
  return Number.isFinite(total) ? total : fallback
}

const toSpecsArray = (data, fallback) =>
  Array.isArray(data.ingredients)
    ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
    : Array.isArray(data.specs)
    ? data.specs
    : fallback

class GunService {
  /**
   * Ambil SATU HALAMAN produk (paginasi sisi-server) + filter/sort.
   *
   * params: { page = 1, limit = 6, search, category, sort_by, order }
   *
   * Paginasi memakai `limit` (jumlah baris) dan `offset` (baris yang dilewati)
   * = (page - 1) * limit. Header `Prefer: count=exact` membuat Supabase
   * mengirim total baris di `Content-Range`, dari sini totalPages dihitung.
   */
  async getGuns(params = {}) {
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.max(1, Number(params.limit) || 6)

    const query = {
      select: '*',
      limit,
      offset: (page - 1) * limit,
      // `id` sebagai pengurut kedua agar urutan stabil antar halaman.
      order: params.sort_by
        ? `${params.sort_by}.${params.order === 'desc' ? 'desc' : 'asc'},id.asc`
        : 'created_at.desc,id.asc',
    }

    const search = params.search ? sanitizeSearch(params.search) : ''
    if (search) {
      query.or = `(name.ilike.*${search}*,description.ilike.*${search}*)`
    }
    if (params.category && params.category !== 'All') {
      query.type = `eq.${params.category}`
    }

    const { data, headers } = await apiClient.get('/rest/v1/products', {
      params: query,
      headers: { Prefer: 'count=exact' },
      returnHeaders: true,
    })

    const list = Array.isArray(data) ? data.map(normalizeProduct) : []
    const total = parseTotal(headers?.['content-range'], list.length)

    return {
      success: true,
      data: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  }

  /**
   * Daftar kategori (kolom `type`) unik untuk filter pill.
   */
  async getCategories() {
    const data = await apiClient.get('/rest/v1/products', {
      params: { select: 'type' },
    })
    const set = new Set((Array.isArray(data) ? data : []).map((r) => r.type).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }

  /**
   * Ambil satu produk berdasarkan ID (dipakai halaman detail & Sharelink).
   */
  async getGunById(id) {
    const data = await apiClient.get('/rest/v1/products', {
      params: { id: `eq.${id}`, select: '*' },
    })
    if (Array.isArray(data) && data.length > 0) {
      return { success: true, data: normalizeProduct(data[0]) }
    }
    throw new Error('Hardware item not found.')
  }

  async createGun(data) {
    const payload = {
      name: data.name,
      type: data.type || 'Pistol',
      caliber: data.caliber || '9mm',
      price: Number(data.price ?? data.cook_time ?? 0),
      description: data.description || '',
      specs: toSpecsArray(data, []),
      image_url: data.image_url || null,
    }

    const res = await apiClient.post('/rest/v1/products', payload, {
      headers: { Prefer: 'return=representation' },
    })
    const created = Array.isArray(res) ? res[0] : res
    return { success: true, data: normalizeProduct(created) }
  }

  async updateGun(id, data) {
    const specsArray = toSpecsArray(data, undefined)
    const payload = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) payload.name = data.name
    if (data.type !== undefined) payload.type = data.type
    if (data.caliber !== undefined) payload.caliber = data.caliber
    if (data.price !== undefined || data.cook_time !== undefined) {
      payload.price = Number(data.price ?? data.cook_time ?? 0)
    }
    if (data.description !== undefined) payload.description = data.description
    if (specsArray !== undefined) payload.specs = specsArray
    if (data.image_url !== undefined) payload.image_url = data.image_url

    const res = await apiClient.patch('/rest/v1/products', payload, {
      params: { id: `eq.${id}` },
      headers: { Prefer: 'return=representation' },
    })
    const updated = Array.isArray(res) ? res[0] : res
    return { success: true, data: normalizeProduct(updated) }
  }

  async patchGun(id, data) {
    return this.updateGun(id, data)
  }

  async deleteGun(id) {
    await apiClient.delete('/rest/v1/products', { params: { id: `eq.${id}` } })
    return { success: true }
  }
}

export default new GunService()
