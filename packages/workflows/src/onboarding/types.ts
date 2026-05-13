import type { QuestionType } from '@aitek/types'

export interface ConditionalRule {
  questionId: string
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'is_empty'
    | 'is_not_empty'
    | 'greater_than'
    | 'less_than'
    | 'includes'
  value: string | number | string[]
}

export interface ConditionalLogic {
  logic: 'ALL' | 'ANY'
  rules: ConditionalRule[]
}

export interface FlowQuestion {
  id: string
  templateId: string
  parentQuestionId: string | null
  text: string
  helpText: string | null
  type: QuestionType
  isRequired: boolean
  sortOrder: number
  section: string | null
  conditionalLogic: ConditionalLogic | null
  options: string[] | null
  budgetMin: number | null
  budgetMax: number | null
  budgetStep: number | null
  timelineOptions: string[] | null
  aiContextHint: string | null
}

export interface FlowAnswer {
  questionId: string
  textValue: string | null
  numberValue: number | null
  jsonValue: unknown
  fileKeys: string[]
}

export interface FlowEngineState {
  questions: FlowQuestion[]
  answers: Map<string, FlowAnswer>
  currentQuestionId: string | null
}

export interface ProgressInfo {
  currentIndex: number
  totalVisible: number
  percentage: number
  currentSection: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}
