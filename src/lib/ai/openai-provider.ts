import OpenAI from 'openai';
import { AIProvider, DDIAnalysisInput, QAInput } from './provider';
import { DDIAnalysis, DDIAnalysisSchema, QAResponse, QAResponseSchema } from './schemas';
import { buildSystemPrompt, buildAnalysisPrompt, buildQAPrompt } from './prompts';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async analyzeDrugInteraction(input: DDIAnalysisInput): Promise<DDIAnalysis> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildAnalysisPrompt(input as unknown as Record<string, unknown>);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    return DDIAnalysisSchema.parse(parsed);
  }

  async answerQuestion(input: QAInput): Promise<QAResponse> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildQAPrompt(
      input.question,
      input.evidenceBundle as unknown as Record<string, unknown>,
      input.previousAnalysis as unknown as Record<string, unknown>
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    return QAResponseSchema.parse(parsed);
  }
}
