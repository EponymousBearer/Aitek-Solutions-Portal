import axios from 'axios'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

type ClerkWindow = Window & {
  Clerk?: {
    session?: {
      getToken: (options?: { template?: string }) => Promise<string | null>
    }
  }
}

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined' && !config.headers['Authorization']) {
    try {
      const clerkWindow = window as ClerkWindow
      const token = clerkWindow.Clerk?.session?.getToken
        ? await clerkWindow.Clerk.session.getToken()
        : null
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // unauthenticated — let the request proceed without a token
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'status' in error.response &&
      error.response.status === 401
    ) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`
      }
    }
    return Promise.reject(error)
  },
)

export default api
