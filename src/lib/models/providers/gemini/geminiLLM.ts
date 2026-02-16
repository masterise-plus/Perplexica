import { GoogleGenAI, Type } from '@google/genai';

import z from 'zod';
import { parse } from 'partial-json';
import { repairJson } from '@toolsycc/json-repair';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  ToolCall,
} from '../../types';
import { Message } from '@/lib/types';

type GeminiLLMConfig = {
  apiKey: string;
  model: string;
  options?: GenerateOptions;
};

class GeminiLLM extends BaseLLM<GeminiLLMConfig> {
  private ai: GoogleGenAI;

  constructor(config: GeminiLLMConfig) {
    super(config);
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  /**
   * Convert app Message[] to Gemini Content[] format.
   * System messages are extracted separately for config.systemInstruction.
   */
  private convertMessages(messages: Message[]): {
    contents: any[];
    systemInstruction?: string;
  } {
    let systemInstruction: string | undefined;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        // Check if rawModelParts are available (Gemini-specific, preserves
        // thought/thoughtSignature fields required by thinking models)
        const rawParts = msg.tool_calls?.[0]?.rawModelParts;
        if (rawParts && rawParts.length > 0) {
          contents.push({ role: 'model', parts: rawParts });
        } else {
          const parts: any[] = [];
          if (msg.content) {
            parts.push({ text: msg.content });
          }
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              parts.push({
                functionCall: {
                  name: tc.name,
                  args: tc.arguments,
                },
              });
            }
          }
          if (parts.length > 0) {
            contents.push({ role: 'model', parts });
          }
        }
      } else if (msg.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: { result: msg.content },
              },
            },
          ],
        });
      }
    }

    return { contents, systemInstruction };
  }

  /**
   * Convert app Tool[] to Gemini functionDeclarations format.
   */
  private convertTools(tools?: GenerateTextInput['tools']): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    const functionDeclarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.schema),
    }));

    return [{ functionDeclarations }];
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const { contents, systemInstruction } = this.convertMessages(
      input.messages,
    );
    const tools = this.convertTools(input.tools);

    const response = await this.ai.models.generateContent({
      model: this.config.model,
      contents,
      config: {
        ...(systemInstruction && { systemInstruction }),
        ...(tools && { tools }),
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
        topP: input.options?.topP ?? this.config.options?.topP,
        maxOutputTokens:
          input.options?.maxTokens ?? this.config.options?.maxTokens,
        stopSequences:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
        frequencyPenalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presencePenalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
      },
    });

    const toolCalls: ToolCall[] = [];
    const responseParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of responseParts) {
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${part.functionCall.name}_${Date.now()}`,
          name: part.functionCall.name!,
          arguments: part.functionCall.args as Record<string, any>,
        });
      }
    }
    // Store raw parts on first tool call so convertMessages can replay them
    // exactly (preserving thought/thoughtSignature for thinking models)
    if (toolCalls.length > 0 && responseParts.length > 0) {
      toolCalls[0].rawModelParts = responseParts;
    }

    return {
      content: response.text || '',
      toolCalls,
      additionalInfo: {
        finishReason:
          response.candidates?.[0]?.finishReason || 'stop',
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const { contents, systemInstruction } = this.convertMessages(
      input.messages,
    );
    const tools = this.convertTools(input.tools);

    const stream = await this.ai.models.generateContentStream({
      model: this.config.model,
      contents,
      config: {
        ...(systemInstruction && { systemInstruction }),
        ...(tools && { tools }),
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
        topP: input.options?.topP ?? this.config.options?.topP,
        maxOutputTokens:
          input.options?.maxTokens ?? this.config.options?.maxTokens,
        stopSequences:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
        frequencyPenalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presencePenalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
      },
    });

    let accumulatedToolCalls: ToolCall[] = [];
    let allRawParts: any[] = [];

    for await (const chunk of stream) {
      // Extract text content from the chunk
      const textContent = chunk.text || '';

      // Collect ALL raw parts from every chunk (preserves thought/thoughtSignature)
      const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
      allRawParts.push(...chunkParts);

      // Extract function calls from this chunk
      const chunkToolCalls: ToolCall[] = [];
      for (const part of chunkParts) {
        if (part.functionCall) {
          const tc: ToolCall = {
            id: `call_${part.functionCall.name}_${Date.now()}`,
            name: part.functionCall.name!,
            arguments: part.functionCall.args as Record<string, any>,
          };
          chunkToolCalls.push(tc);
          accumulatedToolCalls.push(tc);
        }
      }
      // Store accumulated raw parts on first tool call so convertMessages can
      // replay them exactly (preserving thought/thoughtSignature for thinking models)
      if (accumulatedToolCalls.length > 0) {
        accumulatedToolCalls[0].rawModelParts = [...allRawParts];
      }

      const finishReason =
        chunk.candidates?.[0]?.finishReason || null;

      yield {
        contentChunk: textContent,
        toolCallChunk: chunkToolCalls,
        done: finishReason !== null,
        additionalInfo: {
          finishReason,
        },
      };
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const { contents, systemInstruction } = this.convertMessages(
      input.messages,
    );

    const response = await this.ai.models.generateContent({
      model: this.config.model,
      contents,
      config: {
        ...(systemInstruction && { systemInstruction }),
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(input.schema) as any,
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
        topP: input.options?.topP ?? this.config.options?.topP,
        maxOutputTokens:
          input.options?.maxTokens ?? this.config.options?.maxTokens,
        stopSequences:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
        frequencyPenalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presencePenalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
      },
    });

    try {
      const rawText = response.text || '{}';
      console.log('[GeminiLLM] generateObject raw response:', rawText.substring(0, 500));
      const parsed = JSON.parse(
        repairJson(rawText, {
          extractJson: true,
        }) as string,
      );
      return input.schema.parse(parsed) as T;
    } catch (err) {
      console.error('[GeminiLLM] generateObject parse error. Raw:', response.text?.substring(0, 500));
      throw new Error(`Error parsing structured response from Gemini: ${err}`);
    }
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    const { contents, systemInstruction } = this.convertMessages(
      input.messages,
    );

    const stream = await this.ai.models.generateContentStream({
      model: this.config.model,
      contents,
      config: {
        ...(systemInstruction && { systemInstruction }),
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(input.schema) as any,
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
        topP: input.options?.topP ?? this.config.options?.topP,
        maxOutputTokens:
          input.options?.maxTokens ?? this.config.options?.maxTokens,
        stopSequences:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
        frequencyPenalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presencePenalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
      },
    });

    let accumulated = '';

    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      accumulated += text;

      try {
        yield parse(accumulated) as T;
      } catch (err) {
        console.log('Error parsing partial object from Gemini:', err);
        yield {} as T;
      }
    }

    // Final parse with the complete accumulated text
    if (accumulated) {
      try {
        yield input.schema.parse(
          JSON.parse(
            repairJson(accumulated, { extractJson: true }) as string,
          ),
        ) as T;
      } catch (err) {
        throw new Error(
          `Error parsing final structured response from Gemini: ${err}`,
        );
      }
    }
  }
}

export default GeminiLLM;
