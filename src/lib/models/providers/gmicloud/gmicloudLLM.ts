import OpenAILLM from '../openai/openaiLLM';
import { GenerateObjectInput, StreamTextOutput } from '../../types';
import { repairJson } from '@toolsycc/json-repair';
import { parse } from 'partial-json';
import z from 'zod';

/**
 * GMICloud LLM — extends OpenAILLM but overrides generateObject and streamObject
 * because GPT 5.2 via GMICloud does not support the OpenAI Structured Outputs
 * (zodResponseFormat / .parse()) or the Responses API. It returns JSON wrapped
 * in markdown code fences (```json ... ```), so we use the regular Chat
 * Completions API and manually extract + repair the JSON.
 */
class GMICloudLLM extends OpenAILLM {
    async generateObject<T>(input: GenerateObjectInput): Promise<T> {
        // Build a JSON schema description to instruct the model
        const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema), null, 2);

        // Prepend a system message asking for raw JSON
        const messagesWithJsonInstruction = [
            {
                role: 'system' as const,
                content: `You must respond with valid JSON only, no markdown fences, no explanation. The JSON must conform to this schema:\n${jsonSchema}`,
            },
            ...input.messages,
        ];

        // Use the parent's generateText (which uses client.chat.completions.create)
        const result = await this.generateText({
            messages: messagesWithJsonInstruction,
            options: {
                temperature: input.options?.temperature ?? 0,
                maxTokens: input.options?.maxTokens,
                topP: input.options?.topP,
                stopSequences: input.options?.stopSequences,
                frequencyPenalty: input.options?.frequencyPenalty,
                presencePenalty: input.options?.presencePenalty,
            },
        });

        try {
            const repaired = repairJson(result.content, {
                extractJson: true,
            }) as string;
            return input.schema.parse(JSON.parse(repaired)) as T;
        } catch (err) {
            throw new Error(
                `Error parsing response from GMICloud: ${err}\nRaw content: ${result.content?.slice(0, 500)}`,
            );
        }
    }

    async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
        // Build a JSON schema description to instruct the model
        const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema), null, 2);

        // Prepend a system message asking for raw JSON
        const messagesWithJsonInstruction = [
            {
                role: 'system' as const,
                content: `You must respond with valid JSON only, no markdown fences, no explanation. The JSON must conform to this schema:\n${jsonSchema}`,
            },
            ...input.messages,
        ];

        // Use the parent's streamText (which uses client.chat.completions.create with stream: true)
        let receivedContent = '';
        const stream = this.streamText({
            messages: messagesWithJsonInstruction,
            options: {
                temperature: input.options?.temperature ?? 0,
                maxTokens: input.options?.maxTokens,
                topP: input.options?.topP,
                stopSequences: input.options?.stopSequences,
                frequencyPenalty: input.options?.frequencyPenalty,
                presencePenalty: input.options?.presencePenalty,
            },
        });

        for await (const chunk of stream) {
            receivedContent += chunk.contentChunk || '';

            // Strip any markdown fence prefix while streaming
            let cleanContent = receivedContent
                .replace(/^```(?:json)?\s*\n?/, '')
                .replace(/\n?```\s*$/, '');

            try {
                yield parse(cleanContent) as T;
            } catch {
                yield {} as T;
            }

            if (chunk.done) {
                // Final parse with full repair
                try {
                    const repaired = repairJson(receivedContent, {
                        extractJson: true,
                    }) as string;
                    yield input.schema.parse(JSON.parse(repaired)) as T;
                } catch (err) {
                    throw new Error(
                        `Error parsing final response from GMICloud: ${err}`,
                    );
                }
            }
        }
    }
}

export default GMICloudLLM;
