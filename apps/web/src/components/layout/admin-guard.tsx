'use client'

import { RequireInternalRole } from '@/components/layout/require-internal-role'

// /admin is for AiTek Admins only. Project Managers and Developers are bounced
// to their own areas (/pm, /dev) by RequireInternalRole.
export function AdminGuard({ children }: { children: React.ReactNode }) {
  return <RequireInternalRole area="ADMIN">{children}</RequireInternalRole>
}
