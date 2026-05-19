import type { AiCompletionParams, AiCompletionResult, AiProvider } from './ai-provider.interface'

/**
 * NVIDIA API (Kimi 2.6) implementation of AiProvider.
 * NVIDIA's API is OpenAI-compatible — uses the `openai` npm package with a custom baseURL.
 * The `openai` dependency lives in apps/api.
 * This stub defines the shape; the full implementation is in apps/api/src/modules/ai/.
 *
 * Base URL: https://integrate.api.nvidia.com/v1
 * Model:    moonshotai/kimi-2.6
 * Auth:     Bearer ${NVIDIA_API_KEY}
 */
export class KimiAiProvider implements AiProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: any) {}

  async complete(_params: AiCompletionParams): Promise<AiCompletionResult> {
    throw new Error('KimiAiProvider.complete not yet implemented')
  }

  async *completeStream(_params: AiCompletionParams): AsyncGenerator<string> {
    throw new Error('KimiAiProvider.completeStream not yet implemented')
  }
}
