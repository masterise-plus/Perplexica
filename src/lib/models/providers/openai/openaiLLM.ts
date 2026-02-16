import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodTextFormat, zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  ToolCall,
} from '../../types';
import { parse } from 'partial-json';
import z from 'zod';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources/index.mjs';
import { Message } from '@/lib/types';
import { repairJson } from '@toolsycc/json-repair';
import KeyRotator from '../../keyRotator';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class OpenAILLM extends BaseLLM<OpenAIConfig> {
  private keyRotator: KeyRotator;
  private baseURL: string;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.baseURL = this.config.baseURL || 'https://api.openai.com/v1';
    // Use singleton KeyRotator per baseURL so all LLM instances share rotation state
    this.keyRotator = KeyRotator.getInstance(this.baseURL, this.config.apiKey);
  }

  /**
   * Create a fresh OpenAI client using the next available (non-cooldown) key.
   * Returns both the client and the key used (for cooldown tracking on error).
   */
  private createClient(): { client: OpenAI; apiKey: string } {
    const apiKey = this.keyRotator.getNextKey();
    console.log(
      `[KeyRotator] Using API key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
    );

    const cooldown = this.keyRotator.getCooldownRemaining(apiKey);
    if (cooldown > 0) {
      console.log(
        `[KeyRotator] Key still has ${Math.round(cooldown / 1000)}s cooldown remaining`,
      );
    }

    return {
      client: new OpenAI({ apiKey, baseURL: this.baseURL }),
      apiKey,
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse the retry-after duration from a 429 error.
   * Returns duration in ms. Falls back to 30s if header is missing.
   */
  private getRetryAfterMs(err: any): number {
    const retryAfter = err?.headers?.get?.('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    return 30_000; // default 30s
  }

  /**
   * Handle a 429 error: mark the key on cooldown and decide whether to retry.
   * Returns true if should retry, false if all keys exhausted.
   */
  private async handle429(
    err: any,
    apiKey: string,
    attempt: number,
    maxAttempts: number,
    methodName: string,
  ): Promise<boolean> {
    const retryMs = this.getRetryAfterMs(err);
    this.keyRotator.markRateLimited(apiKey, retryMs);

    if (attempt < maxAttempts - 1) {
      // Check if next key is available without waiting
      const nextKey = this.keyRotator.getNextKey();
      const nextCooldown = this.keyRotator.getCooldownRemaining(nextKey);

      if (nextCooldown <= 0) {
        // Next key is ready — retry immediately
        console.warn(
          `[KeyRotator] 429 on ${methodName} attempt ${attempt + 1}/${maxAttempts}, switching to next available key...`,
        );
        // "un-advance" the rotator so createClient picks this key
        // Actually, getNextKey already advanced to nextKey, so we need
        // to put it back. Simplest: just wait briefly and let createClient
        // call getNextKey again which will find the non-cooldown key.
        return true;
      } else {
        // All keys on cooldown — wait for the shortest cooldown
        const waitMs = Math.min(nextCooldown, 15_000); // cap wait at 15s
        console.warn(
          `[KeyRotator] 429 on ${methodName} attempt ${attempt + 1}/${maxAttempts}, all keys on cooldown. Waiting ${Math.round(waitMs / 1000)}s...`,
        );
        await this.sleep(waitMs);
        return true;
      }
    }

    return false;
  }

  convertToOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.id,
          content: msg.content,
        } as ChatCompletionToolMessageParam;
      } else if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content,
          ...(msg.tool_calls &&
            msg.tool_calls.length > 0 && {
            tool_calls: msg.tool_calls?.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          }),
        } as ChatCompletionAssistantMessageParam;
      }

      return msg;
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    // Retry up to totalKeys + 1 (to allow one wait-and-retry cycle)
    const maxAttempts = this.keyRotator.totalKeys + 1;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { client, apiKey } = this.createClient();

      try {
        const response = await client.chat.completions.create({
          model: this.config.model,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          messages: this.convertToOpenAIMessages(input.messages),
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ??
            this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
        });

        if (response.choices && response.choices.length > 0) {
          return {
            content: response.choices[0].message.content!,
            toolCalls:
              response.choices[0].message.tool_calls
                ?.map((tc) => {
                  if (tc.type === 'function') {
                    return {
                      name: tc.function.name,
                      id: tc.id,
                      arguments: JSON.parse(tc.function.arguments),
                    };
                  }
                })
                .filter((tc) => tc !== undefined) || [],
            additionalInfo: {
              finishReason: response.choices[0].finish_reason,
            },
          };
        }

        throw new Error('No response from OpenAI');
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429) {
          const shouldRetry = await this.handle429(
            err,
            apiKey,
            attempt,
            maxAttempts,
            'generateText',
          );
          if (shouldRetry) continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const maxAttempts = this.keyRotator.totalKeys + 1;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { client, apiKey } = this.createClient();

      try {
        const stream = await client.chat.completions.create({
          model: this.config.model,
          messages: this.convertToOpenAIMessages(input.messages),
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ??
            this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          stream: true,
        });

        let recievedToolCalls: {
          name: string;
          id: string;
          arguments: string;
        }[] = [];

        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const toolCalls = chunk.choices[0].delta.tool_calls;
            yield {
              contentChunk: chunk.choices[0].delta.content || '',
              toolCallChunk:
                toolCalls?.map((tc) => {
                  if (!recievedToolCalls[tc.index]) {
                    const call = {
                      name: tc.function?.name!,
                      id: tc.id!,
                      arguments: tc.function?.arguments || '',
                    };
                    recievedToolCalls.push(call);
                    return {
                      ...call,
                      arguments: parse(call.arguments || '{}'),
                    };
                  } else {
                    const existingCall = recievedToolCalls[tc.index];
                    existingCall.arguments +=
                      tc.function?.arguments || '';
                    return {
                      ...existingCall,
                      arguments: parse(existingCall.arguments),
                    };
                  }
                }) || [],
              done: chunk.choices[0].finish_reason !== null,
              additionalInfo: {
                finishReason: chunk.choices[0].finish_reason,
              },
            };
          }
        }
        return; // Stream completed successfully
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429) {
          const shouldRetry = await this.handle429(
            err,
            apiKey,
            attempt,
            maxAttempts,
            'streamText',
          );
          if (shouldRetry) continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const maxAttempts = this.keyRotator.totalKeys + 1;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { client, apiKey } = this.createClient();

      try {
        const response = await client.chat.completions.parse({
          messages: this.convertToOpenAIMessages(input.messages),
          model: this.config.model,
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ??
            this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          response_format: zodResponseFormat(input.schema, 'object'),
        });

        if (response.choices && response.choices.length > 0) {
          try {
            return input.schema.parse(
              JSON.parse(
                repairJson(response.choices[0].message.content!, {
                  extractJson: true,
                }) as string,
              ),
            ) as T;
          } catch (err) {
            throw new Error(
              `Error parsing response from OpenAI: ${err}`,
            );
          }
        }

        throw new Error('No response from OpenAI');
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429) {
          const shouldRetry = await this.handle429(
            err,
            apiKey,
            attempt,
            maxAttempts,
            'generateObject',
          );
          if (shouldRetry) continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    const maxAttempts = this.keyRotator.totalKeys + 1;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { client, apiKey } = this.createClient();

      try {
        let recievedObj: string = '';

        const stream = client.responses.stream({
          model: this.config.model,
          input: input.messages,
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ??
            this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          text: {
            format: zodTextFormat(input.schema, 'object'),
          },
        });

        for await (const chunk of stream) {
          if (
            chunk.type === 'response.output_text.delta' &&
            chunk.delta
          ) {
            recievedObj += chunk.delta;

            try {
              yield parse(recievedObj) as T;
            } catch (err) {
              console.log(
                'Error parsing partial object from OpenAI:',
                err,
              );
              yield {} as T;
            }
          } else if (
            chunk.type === 'response.output_text.done' &&
            chunk.text
          ) {
            try {
              yield parse(chunk.text) as T;
            } catch (err) {
              throw new Error(
                `Error parsing response from OpenAI: ${err}`,
              );
            }
          }
        }
        return; // Stream completed successfully
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429) {
          const shouldRetry = await this.handle429(
            err,
            apiKey,
            attempt,
            maxAttempts,
            'streamObject',
          );
          if (shouldRetry) continue;
        }
        throw err;
      }
    }

    throw lastError;
  }
}

export default OpenAILLM;
