
import { GoogleGenAI, Modality } from "@google/genai";
import { PracticeMode } from "../types";

/**
 * Helper to handle retries for API calls (Exponential Backoff)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (retries > 0 && isQuotaError) {
      console.warn(`Quota exceeded. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const geminiService = {
  /**
   * Generates a unique simple question for an English beginner.
   */
  async generateQuestion(mode: PracticeMode, previousQuestions: string[] = []): Promise<string> {
    if (mode === 'conversation') return '';

    const historyContext = previousQuestions.length > 0 
      ? `\n\nAvoid these previous questions: ${previousQuestions.join(', ')}` 
      : '';

    const systemPrompt = mode === 'hinglish' 
      ? `You are an English teacher. Generate a VERY SHORT (max 6 words) question in a mix of ENGLISH and HINDI.
         Focus on a single thought. Example: "Aaj aapka mood kaisa hai?" or "What are you doing abhi?"
         Only return the question text.${historyContext}`
      : `Generate a single, unique, VERY SHORT (max 8 words) question for an English beginner. 
         Focus on daily life, hobbies, or personal thoughts. Only return the question text in English.${historyContext}`;

    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: systemPrompt,
        config: {
          temperature: 0.8,
          topP: 0.9,
        }
      });
      const text = response.text?.trim();
      if (!text) throw new Error("Empty response");
      return text;
    }).catch(err => {
      console.error("Gemini Question Error:", err);
      const fallbacks = {
        standard: ["Tell me about your best friend?", "How was your morning today?", "What is your favorite hobby?"],
        hinglish: ["Aapka favorite khana kya hai?", "Aaj subah kaisa raha?", "Weekend pe kya karte ho?"]
      };
      const list = fallbacks[mode === 'hinglish' ? 'hinglish' : 'standard'];
      return list[Math.floor(Math.random() * list.length)];
    });
  },

  /**
   * Generates a conversation script between two characters.
   */
  async *generateConversationStream(who: string, whom: string, topic: string): AsyncGenerator<string> {
    const prompt = `Write a conversation script between two people: "${who}" and "${whom}".
      The topic is: "${topic}".
      Format it exactly like this:
      ${who}: [Dialogue]
      ${whom}: [Dialogue]
      Make the conversation at least 10 lines long. Keep it natural and helpful for English practice.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const result = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.8 }
      });

      for await (const chunk of result) {
        if (chunk.text) yield chunk.text;
      }
    } catch (err) {
      console.error("Gemini Conversation Stream Error:", err);
      yield `${who}: Hello! I'm glad we could talk about ${topic}.\n${whom}: Me too! It is a very interesting subject. Let's discuss it further.`;
    }
  },

  /**
   * Generates a detailed model answer in a STREAMING fashion.
   */
  async *generateSuggestedAnswerStream(mode: PracticeMode, question: string): AsyncGenerator<string> {
    const prompt = mode === 'hinglish'
      ? `Question: "${question}"
         Provide a VERY LONG and VERY DETAILED answer in "Hinglish" (Mixed English and Hindi). 
         Pattern: English Feeling + Hindi Reason.
         Write at least 10 sentences. Explain everything in depth. Only return the answer text.`
      : `Question: "${question}"
         Provide a VERY LONG, EXTREMELY DETAILED answer for an English beginner. 
         Use at least 12 descriptive sentences. Write in the first person. 
         Use high-quality but simple vocabulary. Only return the answer text.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const result = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { temperature: 0.7 }
      });

      for await (const chunk of result) {
        if (chunk.text) yield chunk.text;
      }
    } catch (err: any) {
      console.error("Gemini Answer Stream Error:", err);
      if (err?.message?.includes('429')) {
        throw new Error("QUOTA_EXCEEDED");
      }
      yield "I am having some trouble generating a detailed answer right now. Please try again in a few moments.";
    }
  },

  /**
   * Uses Gemini TTS to generate audio for the text.
   */
  async speakAnswer(text: string): Promise<Uint8Array | null> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this script naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }).catch(() => null);
  }
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playPcmAudio(data: Uint8Array, audioCtx: AudioContext) {
  const buffer = await decodeAudioData(data, audioCtx, 24000, 1);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  return new Promise((resolve) => {
    source.onended = resolve;
  });
}
