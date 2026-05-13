import { QuestionType } from '@aitek/types'

import { evaluateConditionalLogic } from './conditional-logic'
import type {
  FlowAnswer,
  FlowEngineState,
  FlowQuestion,
  ProgressInfo,
  ValidationResult,
} from './types'

export class FlowEngine {
  /**
   * Returns true if a question should be displayed given the current answers.
   */
  isQuestionVisible(question: FlowQuestion, answers: Map<string, FlowAnswer>): boolean {
    if (!question.conditionalLogic) return true
    return evaluateConditionalLogic(question.conditionalLogic, answers)
  }

  /**
   * Returns all questions that are currently visible in sorted order.
   */
  getVisibleQuestions(state: FlowEngineState): FlowQuestion[] {
    const sorted = [...state.questions].sort((a, b) => a.sortOrder - b.sortOrder)
    return sorted.filter((q) => this.isQuestionVisible(q, state.answers))
  }

  /**
   * Returns the next unanswered visible question, or null if the flow is complete.
   */
  getNextQuestion(state: FlowEngineState): FlowQuestion | null {
    const visible = this.getVisibleQuestions(state)

    if (!state.currentQuestionId) {
      // No current question — return first visible unanswered question
      return visible.find((q) => !state.answers.has(q.id)) ?? null
    }

    const currentIndex = visible.findIndex((q) => q.id === state.currentQuestionId)
    if (currentIndex === -1) {
      // currentQuestionId not in visible set (was hidden by conditional logic)
      return visible.find((q) => !state.answers.has(q.id)) ?? null
    }

    // Return next visible question after current
    for (let i = currentIndex + 1; i < visible.length; i++) {
      const q = visible[i]
      if (q && !state.answers.has(q.id)) return q
    }

    return null
  }

  /**
   * Returns progress information for display in the UI.
   */
  getProgress(state: FlowEngineState): ProgressInfo {
    const visible = this.getVisibleQuestions(state)
    const answered = visible.filter((q) => state.answers.has(q.id))
    const currentIndex = state.currentQuestionId
      ? visible.findIndex((q) => q.id === state.currentQuestionId) + 1
      : answered.length

    const total = visible.length
    const percentage = total === 0 ? 0 : Math.round((answered.length / total) * 100)

    const current = state.currentQuestionId
      ? visible.find((q) => q.id === state.currentQuestionId)
      : null

    return {
      currentIndex: Math.max(currentIndex, 0),
      totalVisible: total,
      percentage,
      currentSection: current?.section ?? null,
    }
  }

  /**
   * Returns true if all required visible questions have answers.
   */
  isComplete(state: FlowEngineState): boolean {
    const visible = this.getVisibleQuestions(state)
    return visible
      .filter((q) => q.isRequired)
      .every((q) => {
        const answer = state.answers.get(q.id)
        if (!answer) return false
        return this.hasValidValue(answer, q.type)
      })
  }

  /**
   * Validates a single answer against question constraints.
   */
  validateAnswer(
    question: FlowQuestion,
    answer: Partial<FlowAnswer>,
  ): ValidationResult {
    const errors: string[] = []

    if (question.isRequired) {
      const hasValue =
        (answer.textValue !== null && answer.textValue !== undefined && answer.textValue !== '') ||
        answer.numberValue !== null ||
        (Array.isArray(answer.fileKeys) && answer.fileKeys.length > 0) ||
        answer.jsonValue !== null

      if (!hasValue) {
        errors.push('This field is required')
      }
    }

    switch (question.type) {
      case QuestionType.URL_INPUT:
        if (answer.textValue) {
          try {
            new URL(answer.textValue)
          } catch {
            errors.push('Must be a valid URL (e.g. https://example.com)')
          }
        }
        break

      case QuestionType.TEAM_SIZE:
        if (answer.textValue) {
          const n = parseInt(answer.textValue, 10)
          if (isNaN(n) || n < 1) errors.push('Must be a positive number')
        }
        break

      case QuestionType.BUDGET_SLIDER:
        if (answer.numberValue !== null && answer.numberValue !== undefined) {
          if (question.budgetMin !== null && answer.numberValue < question.budgetMin) {
            errors.push(`Minimum value is ${question.budgetMin}`)
          }
          if (question.budgetMax !== null && answer.numberValue > question.budgetMax) {
            errors.push(`Maximum value is ${question.budgetMax}`)
          }
        }
        break

      case QuestionType.MULTIPLE_CHOICE:
        if (answer.jsonValue && question.options) {
          if (!question.options.includes(answer.jsonValue as string)) {
            errors.push('Invalid option selected')
          }
        }
        break

      case QuestionType.CHECKBOX:
        if (Array.isArray(answer.jsonValue) && question.options) {
          const invalid = (answer.jsonValue as string[]).filter(
            (v) => !question.options!.includes(v),
          )
          if (invalid.length > 0) {
            errors.push(`Invalid options selected: ${invalid.join(', ')}`)
          }
        }
        break
    }

    return { valid: errors.length === 0, errors }
  }

  private hasValidValue(answer: FlowAnswer, type: QuestionType): boolean {
    switch (type) {
      case QuestionType.FILE_UPLOAD:
      case QuestionType.VOICE_NOTE:
        return answer.fileKeys.length > 0
      case QuestionType.BUDGET_SLIDER:
      case QuestionType.RATING_SCALE:
        return answer.numberValue !== null
      case QuestionType.CHECKBOX:
        return Array.isArray(answer.jsonValue) && (answer.jsonValue as unknown[]).length > 0
      default:
        return (answer.textValue !== null && answer.textValue !== '') || answer.jsonValue !== null
    }
  }
}
