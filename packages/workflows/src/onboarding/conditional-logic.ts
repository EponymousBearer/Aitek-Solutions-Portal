import type { ConditionalLogic, ConditionalRule, FlowAnswer } from './types'

function evaluateRule(rule: ConditionalRule, answer: FlowAnswer | undefined): boolean {
  if (!answer) {
    // No answer recorded for the referenced question
    if (rule.operator === 'is_empty') return true
    if (rule.operator === 'is_not_empty') return false
    return false
  }

  const raw =
    answer.textValue ??
    (answer.numberValue !== null ? String(answer.numberValue) : null) ??
    (answer.jsonValue !== null ? answer.jsonValue : null)

  switch (rule.operator) {
    case 'is_empty':
      return raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)

    case 'is_not_empty':
      return raw !== null && raw !== '' && !(Array.isArray(raw) && raw.length === 0)

    case 'equals':
      return String(raw) === String(rule.value)

    case 'not_equals':
      return String(raw) !== String(rule.value)

    case 'contains':
      return typeof raw === 'string' && raw.toLowerCase().includes(String(rule.value).toLowerCase())

    case 'not_contains':
      return (
        typeof raw !== 'string' || !raw.toLowerCase().includes(String(rule.value).toLowerCase())
      )

    case 'greater_than':
      return answer.numberValue !== null && answer.numberValue > Number(rule.value)

    case 'less_than':
      return answer.numberValue !== null && answer.numberValue < Number(rule.value)

    case 'includes':
      if (Array.isArray(raw)) {
        const targets = Array.isArray(rule.value) ? rule.value : [String(rule.value)]
        return targets.some((t) => raw.includes(t))
      }
      return false

    default:
      return false
  }
}

export function evaluateConditionalLogic(
  logic: ConditionalLogic,
  answers: Map<string, FlowAnswer>,
): boolean {
  const results = logic.rules.map((rule) => evaluateRule(rule, answers.get(rule.questionId)))

  if (logic.logic === 'ALL') {
    return results.every(Boolean)
  }
  return results.some(Boolean)
}
