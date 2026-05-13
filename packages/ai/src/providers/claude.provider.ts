import type { AiCompletionParams, AiCompletionResult, AiProvider } from './ai-provider.interface'

/**
 * Anthropic Claude implementation of AiProvider.
 * The @anthropic-ai/sdk dependency lives in apps/api.
 * This stub defines the shape; the full implementation is in apps/api/src/modules/ai/.
 */
export class ClaudeAiProvider implements AiProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: any) {}

  async complete(_params: AiCompletionParams): Promise<AiCompletionResult> {
    throw new Error('ClaudeAiProvider.complete not yet implemented')
  }

  async *completeStream(_params: AiCompletionParams): AsyncGenerator<string> {
    throw new Error('ClaudeAiProvider.completeStream not yet implemented')
  }
}
