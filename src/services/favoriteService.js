import { apiClient } from '../config/api'
import { normalizeProduct } from './gunService'

// ---------------------------------------------------------------------------
// FavoriteService — favorit per-perangkat, disimpan di tabel `public.favorites`
// pada Supabase milik sendiri (join ke `products` lewat foreign key).
//
// NOTE: When server/RLS is offline or restricted, useFavorites hook falls back
// to localStorage automatically so favorites always work.
// ---------------------------------------------------------------------------

class FavoriteService {
  /**
   * Retrieve all favourited products for the given user.
   */
  async getFavorites(userIdentifier) {
    const data = await apiClient.get(
      `/rest/v1/favorites?user_id=eq.${userIdentifier}&select=product_id,created_at,products(*)`,
    )
    const list = Array.isArray(data)
      ? data.map((fav) => {
          const prod = fav.products ? normalizeProduct(fav.products) : null
          return {
            ...(prod || {}),
            id: fav.product_id,
            recipe_id: fav.product_id,
            product_id: fav.product_id,
            created_at: fav.created_at,
          }
        })
      : []

    return { success: true, data: list }
  }

  /**
   * Toggle a product's favourite state (add ↔ remove).
   * @param {Object} data  { recipe_id, user_identifier }
   */
  async toggleFavorite(data) {
    const targetId = Number(data.recipe_id || data.gun_id)
    const userId = data.user_identifier

    // Check if already favorited
    const existing = await apiClient.get(
      `/rest/v1/favorites?product_id=eq.${targetId}&user_id=eq.${userId}&select=*`,
    )

    if (Array.isArray(existing) && existing.length > 0) {
      // Remove from favorites
      await apiClient.delete(
        `/rest/v1/favorites?product_id=eq.${targetId}&user_id=eq.${userId}`,
      )
      return { success: true, data: { is_favorited: false } }
    } else {
      // Add to favorites
      await apiClient.post(
        '/rest/v1/favorites',
        { product_id: targetId, user_id: userId },
        { headers: { Prefer: 'return=minimal' } },
      )
      return { success: true, data: { is_favorited: true } }
    }
  }
}

export default new FavoriteService()
