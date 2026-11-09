import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'

// ---------------------------------------------------------------------------
// localStorage fallback — used when the backend is unavailable so that
// favourites are still fully functional offline.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'bore_barrel_favorites'

const readLocalFavs = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalFavs = (ids) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
  } catch {
    /* quota exceeded — silently fail */
  }
}

// ---------------------------------------------------------------------------
// useFavorites — daftar favorit user ini.
//
// Di-cache dengan key ['favorites', userId]. Karena setiap FavoriteButton dan
// Header memanggil hook ini, tanpa cache akan terjadi puluhan request yang
// sama; dengan query cache semuanya berbagi SATU request (deduplikasi).
// Bila server gagal, queryFn memakai localStorage sebagai cadangan.
// ---------------------------------------------------------------------------

const favKey = (userId) => ['favorites', userId]

export function useFavorites() {
  const userIdentifier = getUserIdentifier()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: favKey(userIdentifier),
    queryFn: async () => {
      try {
        const response = await favoriteService.getFavorites(userIdentifier)
        if (!response.success) throw new Error(response.message)
        return { items: response.data || [], isLocal: false }
      } catch {
        return { items: readLocalFavs(), isLocal: true }
      }
    },
  })

  return {
    favorites: query.data?.items ?? [],
    loading: query.isPending,
    error: null,
    isLocal: query.data?.isLocal ?? false,
    refetch: () => queryClient.invalidateQueries({ queryKey: favKey(userIdentifier) }),
  }
}

// ---------------------------------------------------------------------------
// useToggleFavorite — tambah/hapus favorit; sukses → cache favorit di-refresh.
// ---------------------------------------------------------------------------

export function useToggleFavorite() {
  const userIdentifier = getUserIdentifier()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (gunId) => {
      try {
        const response = await favoriteService.toggleFavorite({
          recipe_id: gunId,
          user_identifier: userIdentifier,
        })
        if (response.success) return response.data
        throw new Error(response.message)
      } catch {
        // Cadangan: toggle di localStorage
        const current = readLocalFavs()
        const idx = current.findIndex((id) => String(id) === String(gunId))
        let isFavorited

        if (idx === -1) {
          current.push(gunId)
          isFavorited = true
        } else {
          current.splice(idx, 1)
          isFavorited = false
        }
        writeLocalFavs(current)
        return { is_favorited: isFavorited }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: favKey(userIdentifier) }),
  })

  return {
    toggleFavorite: (gunId) => mutation.mutateAsync(gunId),
    loading: mutation.isPending,
    error: mutation.error ? mutation.error.message : null,
  }
}

// ---------------------------------------------------------------------------
// useIsFavorited — convenience wrapper for a single product.
// ---------------------------------------------------------------------------

export function useIsFavorited(gunId) {
  const { favorites, loading: fetchLoading } = useFavorites()
  const { toggleFavorite, loading: toggleLoading } = useToggleFavorite()

  // Check both server-format (objects with .id) and local-format (plain ids)
  const isFavorited = favorites.some((fav) => {
    const favId = typeof fav === 'object' && fav !== null ? (fav.id ?? fav.product_id ?? fav.recipe_id) : fav
    return String(favId) === String(gunId)
  })

  return {
    isFavorited,
    loading: fetchLoading || toggleLoading,
    toggleFavorite: () => toggleFavorite(gunId),
  }
}

export { getUserIdentifier }
