'use client'

import { type AuthUser, CompanyMembershipRole, UserRole } from '@aitek/types'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export function useCurrentUser() {
  const { isSignedIn, userId, getToken } = useAuth()

  const { data, isLoading, error } = useQuery<AuthUser>({
    // Scope the cache to the Clerk user id. Without it, the static key bleeds the
    // previous account's /auth/me across a sign-out → sign-in as someone else
    // (e.g. PM signs out, dev signs in but the guard still reads the PM role and
    // renders the PM dashboard).
    queryKey: ['current-user', userId],
    queryFn: async () => {
      const token = await getToken()
      const res = await api.get<{ data: AuthUser }>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    enabled: !!isSignedIn && !!userId,
    staleTime: 1000 * 60 * 5,
  })

  return {
    user: data,
    isLoading,
    error,
    isAdmin: data?.role === UserRole.AITEK_ADMIN,
    isAitekTeam:
      data?.role === UserRole.AITEK_ADMIN || data?.role === UserRole.AITEK_TEAM_MEMBER,
    isClientAdmin: data?.companyMembershipRole === CompanyMembershipRole.CLIENT_ADMIN,
    hasCompany: !!data?.companyId,
  }
}
