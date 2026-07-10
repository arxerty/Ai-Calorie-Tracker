import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { z } from 'zod';

// 1. Zod Contract for Food Ingestion Output (in Russian)
export const FoodAnalysisSchema = z.object({
  dish_name: z.string().describe('Название блюда на русском языке'),
  weight_g: z.number().describe('Приблизительный вес в граммах'),
  calories: z.number().describe('Калорийность в ккал'),
  protein_g: z.number().describe('Белки в граммах'),
  fat_g: z.number().describe('Жиры в граммах'),
  carbs_g: z.number().describe('Углеводы в граммах'),
  confidence: z.number().min(0).max(1).describe('Уверенность анализа от 0.0 до 1.0'),
  ingredients: z.array(z.string()).describe('Список ингредиентов на русском'),
  ai_notes: z.string().describe('Пояснения ИИ, советы по питанию или описание состава на русском'),
});

export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

export interface AnalysisInput {
  text?: string;
  imageBuffer?: Buffer;
  imageMimeType?: string; // e.g. "image/jpeg", "image/png"
  voiceBuffer?: Buffer;
  voiceMimeType?: string; // e.g. "audio/ogg", "audio/mp3", "audio/wav"
}

// System Prompt forcing the strict structure and Russian output
const SYSTEM_PROMPT = `
Вы — профессиональный ИИ-диетолог и эксперт по подсчету калорий.
Проанализируйте предоставленные входные данные (изображение еды, текстовое описание или голосовое сообщение) и верните структурированный отчет на русском языке.

Правила:
1. Всегда отвечайте строго в формате JSON.
2. Не пишите никакого дополнительного текста до или после JSON.
3. Оценка веса и КБЖУ (калории, белки, жиры, углеводы) должна быть максимально реалистичной.
4. Язык вывода — русский.
5. Если предоставлено только изображение, определите блюдо по картинке.
6. Если предоставлено текстовое описание, используйте его для уточнения веса и ингредиентов.
7. Обязательно заполните поле "ai_notes" полезными советами по этому блюду.
`;

/**
 * Strategy-Pattern AI Service supporting Gemini and OpenAI
 */
export class AIService {
  private geminiClient?: GoogleGenerativeAI;
  private openaiClient?: OpenAI;

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
    if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
    }
  }

  /**
   * Analyzes food input using the preferred provider.
   */
  async analyzeFood(input: AnalysisInput, provider: 'gemini' | 'openai' = 'gemini'): Promise<FoodAnalysis> {
    const errorLogs: string[] = [];

    // Fallback logic if preferred provider is not configured
    let actualProvider = provider;
    if (actualProvider === 'gemini' && !this.geminiClient) {
      console.warn('⚠️ Gemini client not configured, falling back to OpenAI.');
      actualProvider = 'openai';
    }
    if (actualProvider === 'openai' && !this.openaiClient) {
      console.warn('⚠️ OpenAI client not configured, falling back to Gemini.');
      actualProvider = 'gemini';
    }

    // Try executing the analysis with retries and fallback parsing
    try {
      if (actualProvider === 'gemini') {
        return await this.analyzeWithGemini(input);
      } else {
        return await this.analyzeWithOpenAI(input);
      }
    } catch (error: any) {
      console.error(`🔴 Error running ${actualProvider} food analysis:`, error);
      errorLogs.push(error.message || String(error));
      
      // Attempt automated retry/recovery with alternate provider if available
      if (actualProvider === 'gemini' && this.openaiClient) {
        console.log('🔄 Attempting recovery with OpenAI...');
        try {
          return await this.analyzeWithOpenAI(input);
        } catch (openaiErr: any) {
          errorLogs.push(openaiErr.message || String(openaiErr));
        }
      } else if (actualProvider === 'openai' && this.geminiClient) {
        console.log('🔄 Attempting recovery with Gemini...');
        try {
          return await this.analyzeWithGemini(input);
        } catch (geminiErr: any) {
          errorLogs.push(geminiErr.message || String(geminiErr));
        }
      }

      // If all AI attempts fail, execute safe parser fallback / throw descriptive error
      return this.generateFallbackData(input, errorLogs.join('; '));
    }
  }

  /**
   * Gemini Multimodal Implementation
   */
  private async analyzeWithGemini(input: AnalysisInput): Promise<FoodAnalysis> {
    if (!this.geminiClient) throw new Error('Gemini API client not initialized');

    // Use gemini-2.5-flash as the fast multimodal model
    const model = this.geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const parts: any[] = [];

    // 1. Text input
    if (input.text) {
      parts.push({ text: `Текстовое описание: ${input.text}` });
    }

    // 2. Image input
    if (input.imageBuffer && input.imageMimeType) {
      parts.push({
        inlineData: {
          data: input.imageBuffer.toString('base64'),
          mimeType: input.imageMimeType,
        },
      });
    }

    // 3. Audio input
    if (input.voiceBuffer && input.voiceMimeType) {
      parts.push({
        inlineData: {
          data: input.voiceBuffer.toString('base64'),
          mimeType: input.voiceMimeType,
        },
      });
    }

    if (parts.length === 0) {
      throw new Error('No inputs provided for Gemini analysis');
    }

    // Force strict JSON mode using Gemini's responseSchema
    const geminiSchema: any = {
      type: "object",
      properties: {
        dish_name: { type: "string" },
        weight_g: { type: "number" },
        calories: { type: "number" },
        protein_g: { type: "number" },
        fat_g: { type: "number" },
        carbs_g: { type: "number" },
        confidence: { type: "number" },
        ingredients: { type: "array", items: { type: "string" } },
        ai_notes: { type: "string" },
      },
      required: [
        'dish_name',
        'weight_g',
        'calories',
        'protein_g',
        'fat_g',
        'carbs_g',
        'confidence',
        'ingredients',
        'ai_notes',
      ],
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0.1,
      },
    });

    const responseText = result.response.text();
    return this.parseAndValidateJSON(responseText);
  }

  /**
   * OpenAI Implementation
   */
  private async analyzeWithOpenAI(input: AnalysisInput): Promise<FoodAnalysis> {
    if (!this.openaiClient) throw new Error('OpenAI API client not initialized');

    let processedText = input.text || '';

    // 1. If voice audio is present, transcribe it first using Whisper
    if (input.voiceBuffer && input.voiceMimeType) {
      console.log('🎙️ Transcribing voice message via OpenAI Whisper...');
      // Convert buffer to file-like object for OpenAI SDK
      const file = await OpenAI.toFile(input.voiceBuffer, `voice.${this.getExtensionFromMime(input.voiceMimeType)}`, {
        type: input.voiceMimeType,
      });

      const transcription = await this.openaiClient.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'ru',
      });
      console.log(`🎙️ Transcript: "${transcription.text}"`);
      processedText += `\n[Голосовой ввод транскрибирован]: ${transcription.text}`;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

    // 2. Add text
    if (processedText) {
      userContent.push({ type: 'text', text: processedText });
    } else if (!input.imageBuffer) {
      throw new Error('No inputs provided for OpenAI analysis');
    }

    // 3. Add image (base64 data URL)
    if (input.imageBuffer && input.imageMimeType) {
      const base64Image = input.imageBuffer.toString('base64');
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${input.imageMimeType};base64,${base64Image}`,
        },
      });
    }

    messages.push({ role: 'user', content: userContent });

    // Request completions with GPT-4o-mini in strict JSON mode
    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    return this.parseAndValidateJSON(responseText);
  }

  /**
   * Helper: Parse, regex extract, and Zod validate JSON response
   */
  private parseAndValidateJSON(rawText: string): FoodAnalysis {
    let cleaned = rawText.trim();

    // Remove markdown codeblock wrapper if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    // Attempt direct parse
    try {
      const parsed = JSON.parse(cleaned);
      return FoodAnalysisSchema.parse(parsed);
    } catch (e: any) {
      console.warn('⚠️ Direct JSON parse failed, attempting regex fallback extraction...', e);
      
      // Fallback: Locate outermost {...} block using regex
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return FoodAnalysisSchema.parse(parsed);
        } catch (errRegex: any) {
          throw new Error(`JSON Schema verification failed: ${errRegex.message}`);
        }
      }
      
      throw new Error(`Invalid response structure. Expected JSON, got: ${cleaned.substring(0, 100)}...`);
    }
  }

  /**
   * Generate fallback mock data if AI services are completely offline/errored
   */
  private generateFallbackData(input: AnalysisInput, errorDetails: string): FoodAnalysis {
    console.warn('🚨 [AI-SERVICE] Generating fallback food log details due to API failure:', errorDetails);
    
    let guessedName = 'Неизвестное блюдо';
    if (input.text) {
      // Clean up user text for a guess
      guessedName = input.text.split(/[,\n]/)[0].trim().substring(0, 35);
    } else if (input.imageBuffer) {
      guessedName = 'Распознанное блюдо (Фото)';
    } else if (input.voiceBuffer) {
      guessedName = 'Распознанное блюдо (Голос)';
    }

    return {
      dish_name: guessedName,
      weight_g: 250,
      calories: 320,
      protein_g: 12,
      fat_g: 10,
      carbs_g: 45,
      confidence: 0.3,
      ingredients: ['Ингредиент 1', 'Ингредиент 2'],
      ai_notes: `⚠️ Анализ выполнен локально. Не удалось подключиться к ИИ-провайдеру: ${errorDetails.substring(0, 80)}. Проверьте ключи API.`,
    };
  }

  /**
   * Resolve file extension from Mime Type
   */
  private getExtensionFromMime(mimeType: string): string {
    switch (mimeType) {
      case 'audio/ogg': return 'ogg';
      case 'audio/webm': return 'webm';
      case 'audio/mp3':
      case 'audio/mpeg': return 'mp3';
      case 'audio/wav': return 'wav';
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      default: return 'bin';
    }
  }
}
