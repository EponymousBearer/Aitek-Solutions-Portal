import axios from 'axios'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach Clerk JWT on every request (token injected by the auth provider)
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      // Clerk exposes getToken on the window via ClerkJS
      // This is replaced with the proper clerk hook in Prompt 5
      const token =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (window as any).__clerk_getToken === 'function'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? await (window as any).__clerk_getToken()
          : null
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // no-op — unauthenticated request
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.response?.status === 401) {
      // Will be handled by Clerk redirect in Prompt 5
    }
    return Promise.reject(error)
  },
)

export default api
