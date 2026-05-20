'use client'

import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'

import type { AuthUser } from '@aitek/types'
import { UserRole, CompanyMembershipRole } from '@aitek/types'

import { api } from '@/lib/api'

export function useCurrentUser() {
  const { isSignedIn, getToken } = useAuth()

  const { data, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const token = await getToken()
      const res = await api.get<{ data: AuthUser }>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    enabled: !!isSignedIn,
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
