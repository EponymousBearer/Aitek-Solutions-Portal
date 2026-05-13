export interface AiCompletionParams {
  systemPrompt: string
  userMessage: string
  model?: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
}

export interface AiCompletionResult {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
  stopReason: string
}

export interface AiProvider {
  /**
   * Single-shot completion. Returns the full response.
   */
  complete(params: AiCompletionParams): Promise<AiCompletionResult>

  /**
   * Streaming completion. Yields text chunks as they arrive.
   */
  completeStream(params: AiCompletionParams): AsyncGenerator<string>
}
