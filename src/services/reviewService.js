import { apiClient } from '../config/api'

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Disimpan di tabel `public.reviews` pada Supabase milik sendiri.
// ---------------------------------------------------------------------------

class ReviewService {
  /**
   * Fetch all reviews for a given product.
   */
  async getReviews(gunId) {
    const data = await apiClient.get(
      `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
    )
    const list = Array.isArray(data)
      ? data.map((r) => ({
          id: r.id,
          product_id: r.product_id,
          user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
        }))
      : []

    return { success: true, data: list }
  }

  /**
   * Submit a new review.
   * @param {string|number} gunId
   * @param {Object} reviewData  { user_identifier, rating, comment }
   */
  async createReview(gunId, reviewData) {
    const payload = {
      product_id: Number(gunId),
      user_id: reviewData.user_id || reviewData.user_identifier,
      rating: Number(reviewData.rating),
      comment: reviewData.comment || '',
    }

    const res = await apiClient.post('/rest/v1/reviews', payload, {
      headers: { Prefer: 'return=representation' },
    })
    const created = Array.isArray(res) ? res[0] : res
    return { success: true, data: created }
  }

  /**
   * Edit an existing review.
   */
  async updateReview(reviewId, reviewData) {
    const res = await apiClient.patch(
      `/rest/v1/reviews?id=eq.${reviewId}`,
      {
        rating: Number(reviewData.rating),
        comment: reviewData.comment,
      },
      { headers: { Prefer: 'return=representation' } },
    )
    return { success: true, data: Array.isArray(res) ? res[0] : res }
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
    return { success: true }
  }
}

export default new ReviewService()
