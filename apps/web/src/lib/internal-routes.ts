import { type AuthUser, AitekRole, UserRole } from '@aitek/types'

// The "home" area for a user, used by guards to bounce people to the right
// shell. AiTek Admin → /admin, Project Manager → /pm, Developer → /dev,
// everyone else (clients) → /portal.
export function homePathFor(user?: Pick<AuthUser, 'role' | 'aitekRole'> | null): string {
  if (!user) return '/portal'
  if (user.role === UserRole.AITEK_ADMIN) return '/admin'
  if (user.role === UserRole.AITEK_TEAM_MEMBER) {
    return user.aitekRole === AitekRole.PROJECT_MANAGER ? '/pm' : '/dev'
  }
  return '/portal'
}

export type InternalArea = 'ADMIN' | 'PM' | 'DEV'

export function userMatchesArea(
  user: Pick<AuthUser, 'role' | 'aitekRole'> | undefined | null,
  area: InternalArea,
): boolean {
  if (!user) return false
  switch (area) {
    case 'ADMIN':
      return user.role === UserRole.AITEK_ADMIN
    case 'PM':
      return user.role === UserRole.AITEK_TEAM_MEMBER && user.aitekRole === AitekRole.PROJECT_MANAGER
    case 'DEV':
      return user.role === UserRole.AITEK_TEAM_MEMBER && user.aitekRole === AitekRole.DEVELOPER
  }
}
