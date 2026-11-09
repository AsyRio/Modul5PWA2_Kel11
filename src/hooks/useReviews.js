import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import reviewService from '../services/reviewService'

// Cache review per produk: ['reviews', gunId]
const reviewKey = (gunId) => ['reviews', String(gunId)]

// ---------------------------------------------------------------------------
// useReviews — review untuk satu produk (di-cache per produk).
// ---------------------------------------------------------------------------
export function useReviews(gunId) {
  const query = useQuery({
    queryKey: reviewKey(gunId),
    queryFn: async () => {
      const response = await reviewService.getReviews(gunId)
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch reviews.')
      }
      return response.data || []
    },
    enabled: Boolean(gunId),
  })

  return {
    reviews: query.data ?? [],
    loading: Boolean(gunId) && query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  }
}

// ---------------------------------------------------------------------------
// useCreateReview — kirim review baru, lalu invalidate cache review produk
// tsb supaya daftar langsung menampilkan review yang baru.
// ---------------------------------------------------------------------------
export function useCreateReview() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ gunId, reviewData }) => reviewService.createReview(gunId, reviewData),
    onSuccess: (_res, { gunId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKey(gunId) }),
  })

  const createReview = async (gunId, reviewData) => {
    try {
      const response = await mutation.mutateAsync({ gunId, reviewData })
      return response.success ? response.data : null
    } catch {
      return null
    }
  }

  return {
    createReview,
    loading: mutation.isPending,
    error: mutation.error ? mutation.error.message : null,
    success: mutation.isSuccess,
  }
}
