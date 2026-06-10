'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'

interface Preferences {
  emailOnMessage: boolean
  emailOnMilestone: boolean
  emailOnKYC: boolean
  emailOnAgreement: boolean
  emailOnProject: boolean
}

type PrefKey = keyof Preferences

const PREF_QUERY_KEY = ['notification-preferences'] as const

// Only the categories that actually trigger an email (see EMAIL_PREF_BY_TYPE on
// the API). Chat messages are intentionally never emailed, so emailOnMessage is
// omitted here.
const ROWS: { key: PrefKey; label: string; description: string }[] = [
  {
    key: 'emailOnMilestone',
    label: 'Milestone updates',
    description: 'When a milestone is submitted, approved, or rejected.',
  },
  {
    key: 'emailOnProject',
    label: 'Project & document updates',
    description: 'New projects kicked off and documents shared with you.',
  },
  {
    key: 'emailOnKYC',
    label: 'Verification status',
    description: 'Changes to your account verification (KYC) review.',
  },
  {
    key: 'emailOnAgreement',
    label: 'Agreements',
    description: 'When an agreement is sent or acknowledged.',
  },
]

export default function SettingsPage() {
  const queryClient = useQueryClient()

  const { data: prefs, isLoading, error } = useQuery<Preferences>({
    queryKey: PREF_QUERY_KEY,
    queryFn: async () =>
      (await api.get<{ data: Preferences }>('/notifications/preferences')).data.data,
  })

  const update = useMutation({
    mutationFn: async (patch: Partial<Preferences>) =>
      (await api.patch<{ data: Preferences }>('/notifications/preferences', patch)).data.data,
    // Optimistic: flip the toggle instantly, roll back if the request fails.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: PREF_QUERY_KEY })
      const prev = queryClient.getQueryData<Preferences>(PREF_QUERY_KEY)
      if (prev) queryClient.setQueryData<Preferences>(PREF_QUERY_KEY, { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PREF_QUERY_KEY, ctx.prev)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: PREF_QUERY_KEY }),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how AiTek keeps you in the loop.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Email notifications
          </CardTitle>
          <CardDescription>
            Choose which updates we email you. You&apos;ll always see everything in the in-app
            notification center.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {error && !isLoading && (
            <div className="py-4 text-sm text-destructive">Couldn&apos;t load your preferences.</div>
          )}

          {prefs &&
            ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <Switch
                  checked={prefs[row.key]}
                  onCheckedChange={(checked) =>
                    update.mutate({ [row.key]: checked } as Partial<Preferences>)
                  }
                  aria-label={row.label}
                />
              </div>
            ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Chat messages are delivered in-app and in real time — we don&apos;t email those.
      </p>
    </div>
  )
}
