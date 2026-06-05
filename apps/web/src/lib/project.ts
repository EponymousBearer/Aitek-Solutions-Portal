import { MilestoneStatus, ProjectStatus } from '@aitek/types'

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.PENDING]: 'Pending',
  [MilestoneStatus.IN_PROGRESS]: 'In progress',
  [MilestoneStatus.AWAITING_APPROVAL]: 'Awaiting approval',
  [MilestoneStatus.APPROVED]: 'Approved',
  [MilestoneStatus.REJECTED]: 'Changes requested',
  [MilestoneStatus.COMPLETED]: 'Completed',
}

export function milestoneStatusBadgeClass(status: MilestoneStatus): string {
  switch (status) {
    case MilestoneStatus.COMPLETED:
    case MilestoneStatus.APPROVED:
      return 'bg-green-100 text-green-700'
    case MilestoneStatus.AWAITING_APPROVAL:
      return 'bg-amber-100 text-amber-700'
    case MilestoneStatus.REJECTED:
      return 'bg-red-100 text-red-700'
    case MilestoneStatus.IN_PROGRESS:
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// The forward "ladder" of project phases used to derive a progress %.
// ON_HOLD / CANCELLED sit outside the ladder.
export const PROJECT_LADDER: ProjectStatus[] = [
  ProjectStatus.DISCOVERY,
  ProjectStatus.PLANNING,
  ProjectStatus.DESIGN,
  ProjectStatus.DEVELOPMENT,
  ProjectStatus.QA,
  ProjectStatus.DEPLOYMENT,
  ProjectStatus.COMPLETED,
]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.DISCOVERY]: 'Discovery',
  [ProjectStatus.PLANNING]: 'Planning',
  [ProjectStatus.DESIGN]: 'Design',
  [ProjectStatus.DEVELOPMENT]: 'Development',
  [ProjectStatus.QA]: 'QA',
  [ProjectStatus.DEPLOYMENT]: 'Deployment',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.ON_HOLD]: 'On hold',
  [ProjectStatus.CANCELLED]: 'Cancelled',
}

// All statuses, ladder first then the two off-ladder ones — for dropdowns.
export const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  ...PROJECT_LADDER,
  ProjectStatus.ON_HOLD,
  ProjectStatus.CANCELLED,
]

export interface ProjectStep {
  key: ProjectStatus
  label: string
  status: 'done' | 'current' | 'upcoming'
}

export interface ProjectProgress {
  percent: number
  steps: ProjectStep[]
  offLadder: boolean
}

export function projectProgress(status: ProjectStatus): ProjectProgress {
  const idx = PROJECT_LADDER.indexOf(status)
  const offLadder = idx === -1
  const percent = offLadder ? 0 : Math.round((idx / (PROJECT_LADDER.length - 1)) * 100)

  const steps: ProjectStep[] = PROJECT_LADDER.map((key, i) => ({
    key,
    label: PROJECT_STATUS_LABELS[key],
    status: offLadder ? 'upcoming' : i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }))

  return { percent, steps, offLadder }
}

export function projectStatusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.COMPLETED:
      return 'bg-green-100 text-green-700'
    case ProjectStatus.CANCELLED:
      return 'bg-red-100 text-red-700'
    case ProjectStatus.ON_HOLD:
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-primary/10 text-primary'
  }
}
