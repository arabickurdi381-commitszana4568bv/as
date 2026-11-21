import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { GenerateContentParameters } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '18mb' }));

// Lazy-initialized Gemini client with required User-Agent so server boots safely in any environment
let _aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

// In-memory cache for generated Badini TTS audio (prevents redundant quota burn)
const audioCache = new Map<string, { audioBase64: string; mimeType: string; voice: string }>();

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Badini Voice Studio', time: new Date().toISOString() });
});

// Helper to concatenate multiple WAV buffers (24kHz mono 16-bit PCM) into a single valid WAV file
function concatWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  let totalPcmLength = 0;
  const pcmChunks: Buffer[] = [];

  for (const buf of buffers) {
    if (buf.length > 44) {
      const pcm = buf.subarray(44);
      pcmChunks.push(pcm);
      totalPcmLength += pcm.length;
    }
  }

  if (pcmChunks.length === 0) return buffers[0];

  const header = Buffer.from(buffers[0].subarray(0, 44));
  header.writeUInt32LE(36 + totalPcmLength, 4);
  header.writeUInt32LE(totalPcmLength, 40);

  return Buffer.concat([header, ...pcmChunks]);
}

function estimateWavDurationSec(base64Audio: string): number {
  const bytes = Buffer.from(base64Audio, 'base64').length;
  const pcmBytes = Math.max(0, bytes - 44);
  // 24000 Hz * 1 channel * 2 bytes/sample = 48000 bytes/sec
  return Number((pcmBytes / 48000).toFixed(2));
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.code;
  return (
    err?.name === 'AbortError' ||
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('aborted')
  );
}

function formatReadableGeminiError(err: any, fallbackMsg: string): { status: number; message: string } {
  const raw = String(err?.message || '');
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message:
        'سێرڤەرێ ژیرییا دەستکرد ل دەما نها دا قەرەباڵغە (503). تکایە پشتی چەند چرکەیەکان جارەکا دی هەول بدە (High demand, please retry shortly).',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return {
      status: 429,
      message: 'سنوورێ داخوازیێن نها پڕ بوو (429). تکایە کێمەکێ چاڤەڕێ بە و پاشان هەول بدە.',
    };
  }
  return { status: 500, message: raw || fallbackMsg };
}

async function callWithTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function generateTextWithFallback(
  buildParams: (model: string) => GenerateContentParameters
) {
  const attempts: { model: string; timeoutMs: number }[] = [
    { model: 'gemini-4-hydrogen', timeoutMs: 10000 },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 15000 },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 18000 },
  ];
  let lastError: any = null;

  for (let i = 0; i < attempts.length; i++) {
    const { model, timeoutMs } = attempts[i];
    try {
      const params = buildParams(model);
      const extraConfig =
        model === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {};

      return await callWithTimeout(timeoutMs, (abortSignal) =>
        getAi().models.generateContent({
          ...params,
          config: {
            ...(params.config || {}),
            ...extraConfig,
            abortSignal,
          },
        })
      );
    } catch (err: any) {
      lastError = err;
      if (isTransientError(err) && i < attempts.length - 1) {
        console.warn(`[${model}] unavailable/slow (${err?.message || 'timeout'}), failing over...`);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Gemini text generation failed.');
}

async function generateSingleTTSChunk(
  chunkText: string,
  chosenVoice: string,
  stylePrompt: string
): Promise<string> {
  const cacheKey = `${chunkText}::${chosenVoice}::${stylePrompt}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!.audioBase64;
  }

  const ttsAttempts: { model: string; timeoutMs: number }[] = [
    { model: 'gemini-3.8-flash-tts', timeoutMs: 16000 },
    { model: 'gemini-3.8-flash-lite-tts', timeoutMs: 16000 },
    { model: 'gemini-3.8-flash-lite-tts', timeoutMs: 18000 },
  ];
  let lastError: any = null;

  for (let i = 0; i < ttsAttempts.length; i++) {
    const { model, timeoutMs } = ttsAttempts[i];
    try {
      const response = await callWithTimeout(timeoutMs, (abortSignal) =>
        getAi().models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: chunkText,
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            abortSignal,
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
          },
        })
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioCache.set(cacheKey, {
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          voice: chosenVoice,
        });
        return base64Audio;
      }
    } catch (err: any) {
      lastError = err;
      if (isTransientError(err) && i < ttsAttempts.length - 1) {
        console.warn(`[${model}] transient TTS error, failing over:`, err?.message);
        await new Promise((resolve) => setTimeout(resolve, 600));
        continue;
      }
      if (i < ttsAttempts.length - 1) {
        console.warn(`[${model}] failed, trying fallback:`, err?.message);
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to generate speech audio from Gemini TTS providers.');
}

// 1. Badini Text-to-Speech Endpoint (Single & Long Paragraph Chunking)
app.post('/api/badini/tts', async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice = 'Puck',
      style = '',
      emotion = 'calm',
      dialectRegion = 'duhok',
      adaptationEnabled = true,
      lexiconRules = [],
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'تکایە دەقێکی بادینی بنووسە (Text is required).' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured in server environment.' });
      return;
    }

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = validVoices.includes(voice) ? voice : 'Puck';
    let processedText = text.trim();

    // Apply user custom Badini phonetic lexicon substitutions if provided (e.g. "word=>pronunciation")
    if (Array.isArray(lexiconRules) && lexiconRules.length > 0) {
      for (const rule of lexiconRules) {
        if (typeof rule === 'string' && rule.includes('=>')) {
          const [target, replacement] = rule.split('=>').map((s) => s.trim());
          if (target && replacement) {
            processedText = processedText.split(target).join(replacement);
          }
        }
      }
    }

    const dialectPromptMap: Record<string, string> = {
      duhok: 'Kurdish Badini (Duhok Kurdistan Region dialect)',
      zakho: 'Kurdish Badini (Zakho northern cadence)',
      amedi: 'Kurdish Badini (Amedi resonant mountain cadence)',
      akre: 'Kurdish Badini (Akre melodic dialect)',
    };

    const dialectLabel = dialectPromptMap[dialectRegion] || dialectPromptMap.duhok;
    const adaptationInstruction = adaptationEnabled
      ? `Speak strictly in authentic ${dialectLabel}, articulating Badini consonants (ڤ /v/, ژ /ʒ/, چ /tʃ/, پ /p/, گ /ɡ/) and vowels (ێ /eː/, ۆ /oː/) cleanly with natural human breathing and realistic pauses. Do NOT switch to Arabic or Sorani pronunciation.`
      : `Speak clearly in ${dialectLabel}.`;

    const fullStyle = [style, `Emotion: ${emotion}`, adaptationInstruction]
      .filter(Boolean)
      .join('. ');

    const cacheKey = `${processedText}::${chosenVoice}::${fullStyle}`;
    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey)!;
      res.json({
        success: true,
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        voice: chosenVoice,
        durationSec: estimateWavDurationSec(cached.audioBase64),
        cached: true,
      });
      return;
    }

    // Smart sentence chunking for long paragraphs (> 170 chars)
    let chunks: string[] = [];
    if (processedText.length > 170) {
      const sentences = processedText
        .split(/(?<=[.!؟\n])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let current = '';
      for (const s of sentences) {
        if ((current + ' ' + s).length <= 170) {
          current = current ? `${current} ${s}` : s;
        } else {
          if (current) chunks.push(current);
          current = s;
        }
      }
      if (current) chunks.push(current);
    }

    if (chunks.length <= 1) {
      const audioBase64 = await generateSingleTTSChunk(processedText, chosenVoice, fullStyle);
      res.json({
        success: true,
        audioBase64,
        mimeType: 'audio/wav',
        voice: chosenVoice,
        durationSec: estimateWavDurationSec(audioBase64),
        chunksCount: 1,
        cached: false,
      });
      return;
    }

    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const b64 = await generateSingleTTSChunk(chunk, chosenVoice, fullStyle);
      buffers.push(Buffer.from(b64, 'base64'));
    }

    const mergedWav = concatWavBuffers(buffers);
    const mergedBase64 = mergedWav.toString('base64');
    audioCache.set(cacheKey, {
      audioBase64: mergedBase64,
      mimeType: 'audio/wav',
      voice: chosenVoice,
    });

    res.json({
      success: true,
      audioBase64: mergedBase64,
      mimeType: 'audio/wav',
      voice: chosenVoice,
      durationSec: estimateWavDurationSec(mergedBase64),
      chunksCount: chunks.length,
      cached: false,
    });
  } catch (error: any) {
    console.error('Badini TTS error:', error);
    const formatted = formatReadableGeminiError(error, 'Error generating Badini speech.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 2. AI Badini Story Creator (Generates multi-character authentic Badini scripts via gemini-4-hydrogen)
app.post('/api/badini/story-generate', async (req: Request, res: Response) => {
  try {
    const {
      premise,
      categoryId = 'emotional',
      categoryTitle = 'Emotional Stories',
      dialectRegion = 'duhok',
      lengthMode = 'medium',
      charactersCount = 3,
    } = req.body;

    if (!premise || !String(premise).trim()) {
      res.status(400).json({ error: 'تکایە بیرۆکەیا چیرۆکێ بنڤیسە.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const targetLines = lengthMode === 'short' ? 5 : lengthMode === 'long' ? 12 : 8;

    const promptText = `You are a master Kurdish Badini novelist, playwright, and audio-drama director from Duhok, Kurdistan Region of Iraq.
Write a deeply natural, expressive multi-character audio story strictly in authentic Kurdish Badini dialect (spoken in Duhok, Zakho, Amedi, Akre — NEVER Zazakî and NEVER Sorani).
Use genuine Badini grammar and vocabulary (e.g. "دێ", "ئەز", "تۆ", "چاوا/چەوا", "گەلەک", "هەمی", "ڤێجا", "ل کیڤە", "دڤێت", "نزا", "بۆچی", "لێ", "پێکڤە").

Requirements:
- Category: ${categoryTitle} (${categoryId})
- Dialect flavor: ${dialectRegion}
- Premise: ${premise}
- Target scenes/lines: around ${targetLines} lines
- Cast up to ${charactersCount} distinct characters (always include a Narrator/ڤەگێڕ plus emotional characters appropriate to the story).
- Assign each line a realistic emotion from: happy, sad, crying, angry, romantic, fearful, excited, calm, serious, inspirational, whispering, dramatic.
- Assign natural pauseAfterSec (e.g. 0.6 to 2.2 seconds) between lines for dramatic cinematic pacing.
- Suggest an appropriate bgMusicPreset ('none' | 'oud_calm' | 'doc_strings' | 'romantic_piano' | 'tension_pulse') and sfxPreset ('none' | 'duhok_rain' | 'mountain_wind' | 'heartbeat' | 'fireplace').`;

    const response = await generateTextWithFallback((model) => ({
      model,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summaryKurdish: { type: Type.STRING },
            bgMusicPreset: { type: Type.STRING },
            sfxPreset: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  roleLabel: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  suggestedCategory: { type: Type.STRING },
                  defaultEmotion: { type: Type.STRING },
                },
                required: ['id', 'name', 'roleLabel', 'gender', 'suggestedCategory', 'defaultEmotion'],
              },
            },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterId: { type: Type.STRING },
                  characterName: { type: Type.STRING },
                  isNarration: { type: Type.BOOLEAN },
                  emotion: { type: Type.STRING },
                  pauseAfterSec: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                },
                required: ['characterId', 'characterName', 'isNarration', 'emotion', 'pauseAfterSec', 'text'],
              },
            },
          },
          required: ['title', 'summaryKurdish', 'bgMusicPreset', 'sfxPreset', 'characters', 'lines'],
        },
      },
    }));

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json({ success: true, story: parsed });
  } catch (error: any) {
    console.error('Story generation error:', error);
    const formatted = formatReadableGeminiError(error, 'چێکرنا چیرۆکێ سەرنەکەفت.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 3. Multi-Character Script Auto-Parser (Identifies dialogue speakers & emotions automatically)
app.post('/api/badini/parse-dialogue', async (req: Request, res: Response) => {
  try {
    const { scriptText, dialectRegion = 'duhok' } = req.body;
    if (!scriptText || !String(scriptText).trim()) {
      res.status(400).json({ error: 'تکایە دەقێ سیناریۆیێ بنڤیسە.' });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const promptText = `Analyze this multi-character script and convert it into structured characters and dialogue scenes.
Preserve any Badini Kurdish text faithfully, or if lines are written in English/mixed, translate/adapt them naturally into authentic ${dialectRegion} Kurdish Badini script while keeping character roles clear.
Identify each speaker (e.g., Narrator, Man, Woman, Elderly Man, etc.), infer whether each line is narration, detect the emotional tone (happy, sad, crying, angry, romantic, fearful, excited, calm, serious, inspirational, whispering, dramatic), and set realistic pauseAfterSec.

Script:
${scriptText}`;

    const response = await generateTextWithFallback((model) => ({
      model,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  roleLabel: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  suggestedCategory: { type: Type.STRING },
                  defaultEmotion: { type: Type.STRING },
                },
                required: ['id', 'name', 'roleLabel', 'gender', 'suggestedCategory', 'defaultEmotion'],
              },
            },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterId: { type: Type.STRING },
                  characterName: { type: Type.STRING },
                  isNarration: { type: Type.BOOLEAN },
                  emotion: { type: Type.STRING },
                  pauseAfterSec: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                },
                required: ['characterId', 'characterName', 'isNarration', 'emotion', 'pauseAfterSec', 'text'],
              },
            },
          },
          required: ['characters', 'lines'],
        },
      },
    }));

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json({ success: true, parsed });
  } catch (error: any) {
    console.error('Dialogue parser error:', error);
    const formatted = formatReadableGeminiError(error, 'شیکردنەڤەیا دیالۆگێ سەرنەکەفت.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 4. Custom Badini Voice Training & Audio Analysis (gemini-3.5-transcribe + gemini-4-hydrogen)
app.post('/api/badini/voice-train', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', voiceName = 'دەنگێ من', region = 'duhok' } = req.body;

    if (!audioBase64) {
      res.status(400).json({ error: 'تکایە فایلا دەنگی تۆمار بکە یان ئەپڵۆد بکە.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBase64,
      },
    };

    // Step A: Transcribe exact speech using gemini-3.5-transcribe
    let transcriptionText = '';
    try {
      const transcribeResp = await getAi().models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            { text: 'Transcribe this Kurdish Badini speech accurately in Kurdish Arabic script.' },
          ],
        },
      });
      transcriptionText = (transcribeResp.text || '').trim();
    } catch (transErr) {
      console.warn('gemini-3.5-transcribe fallback to gemini-4-hydrogen:', transErr);
    }

    // Step B: Analyze vocal acoustic characteristics with retry + fallback
    const analysisResp = await generateTextWithFallback((model) => ({
      model,
      contents: {
        parts: [
          audioPart,
          {
            text: `Analyze this Badini Kurdish voice recording for custom voice adaptation named "${voiceName}" in region "${region}".
Determine:
1. gender: "male" or "female"
2. ageGroup: concise age range (e.g. "22-28", "35-45", "50+")
3. region: one of "duhok", "zakho", "amedi", "akre"
4. baseVoice: closest neural voice anchor among "Puck", "Charon", "Kore", "Fenrir", "Zephyr"
5. pitchShift: recommended semitone shift between -6 and +6 (number)
6. timbrePrompt: detailed English acoustic description (resonance, warmth, cadence, breathing, Badini phonetic inflection)
7. sampleTranscription: verbatim Badini transcription (if empty use: "${transcriptionText.replace(/"/g, '')}")
8. summaryKurdish: brief Kurdish Badini summary of the detected vocal profile.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING },
            ageGroup: { type: Type.STRING },
            region: { type: Type.STRING },
            baseVoice: { type: Type.STRING },
            pitchShift: { type: Type.NUMBER },
            timbrePrompt: { type: Type.STRING },
            sampleTranscription: { type: Type.STRING },
            summaryKurdish: { type: Type.STRING },
          },
          required: [
            'gender',
            'ageGroup',
            'region',
            'baseVoice',
            'pitchShift',
            'timbrePrompt',
            'sampleTranscription',
            'summaryKurdish',
          ],
        },
      },
    }));

    const profile = JSON.parse((analysisResp.text || '{}').trim());
    if (!profile.sampleTranscription && transcriptionText) {
      profile.sampleTranscription = transcriptionText;
    }

    res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Voice training analysis error:', error);
    const formatted = formatReadableGeminiError(error, 'شیکردنەڤەیا دەنگی سەرنەکەفت.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 5. AI Presentation & Gamma Deck Generator
app.post('/api/badini/presentation-generate', async (req: Request, res: Response) => {
  try {
    const {
      topic,
      slidesCount = 7,
      language = 'Kurdish Badini',
      audience = 'Academic / Professional Seminar',
      tone = 'Modern & Persuasive',
    } = req.body;

    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'تکایە بابەتێ پرێزنتەیشنێ بنڤیسە.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const safeCount = Math.max(3, Math.min(15, Number(slidesCount) || 7));

    const promptText = `You are a world-class presentation designer and Gamma.app prompt architect.
Create a crisp, well-structured ${safeCount}-slide presentation in ${language} about: "${topic}".
Target audience/context: ${audience}.
Tone & Style: ${tone}.

Return structured JSON containing:
1. "title": compelling presentation title.
2. "subtitle": brief subtitle.
3. "gammaReadyPrompt": full presentation outline formatted specifically for Gamma.app ("Paste in text" mode) using "---" between slides so the user can paste it directly into gamma.app/create and get an instant deck.
4. "slides": array of exactly ${safeCount} slide objects, each with:
   - slideNumber (integer starting at 1)
   - title (concise slide heading)
   - bullets (array of 3-5 clear, punchy bullet points)
   - speakerNotes (natural spoken narration for that slide)
   - visualIdea (short visual/diagram suggestion for the slide)`;

    const response = await generateTextWithFallback((model) => ({
      model,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            gammaReadyPrompt: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  speakerNotes: { type: Type.STRING },
                  visualIdea: { type: Type.STRING },
                },
                required: ['slideNumber', 'title', 'bullets', 'speakerNotes', 'visualIdea'],
              },
            },
          },
          required: ['title', 'subtitle', 'gammaReadyPrompt', 'slides'],
        },
      },
    }));

    const deck = JSON.parse((response.text || '{}').trim());
    res.json({ success: true, deck });
  } catch (error: any) {
    console.error('Presentation generation error:', error);
    const formatted = formatReadableGeminiError(error, 'دروستکرنا پرێزنتەیشنێ سەرنەکەفت.');
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Badini Voice Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
