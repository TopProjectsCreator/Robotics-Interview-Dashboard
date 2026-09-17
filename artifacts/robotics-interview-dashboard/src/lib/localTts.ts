// On-device text-to-speech engines for the big screen and interview bay.
// Everything here runs 100% locally in the browser — no API key, no speech
// service. Neural models download once from the Hugging Face Hub and are
// cached by the browser.
//
// Engines (all English):
//   kokoro — Kokoro-82M (82M params) via kokoro-js + Transformers.js.
//            Best quality. WebGPU (fp32, ~330MB) with WASM CPU fallback (q8).
//   kitten — KittenTTS Mini (80M params, pure WebGPU shaders, ~78MB).
//            Fastest. WebGPU only — falls back to the system voice.
//   system — the browser's built-in voice. Instant, offline, no download.
//
// NOTE: F5-TTS and ChatTTS are Python-only models with no browser/WebGPU
// builds, so they cannot run on-device here. This registry is where a new
// engine goes if one ever ships a web build.

import type { KokoroTTS } from "kokoro-js";

export type TtsEngineId = "kokoro" | "kitten" | "system";

export const TTS_ENGINES: { id: TtsEngineId; label: string; detail: string }[] = [
  { id: "kokoro", label: "Kokoro-82M", detail: "Best quality · English · downloads ~330MB once" },
  { id: "kitten", label: "KittenTTS Mini", detail: "Fast · English · downloads ~78MB once · needs WebGPU" },
  { id: "system", label: "System voice", detail: "Instant · built into the browser · no download" },
];

const ENGINE_KEY = "tts-engine-id";
const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// af_heart is the highest-graded English voice in the Kokoro voice table.
const KOKORO_VOICE = "af_heart" as const;
const KITTEN_VOICE = "Bella";
const KITTEN_MODEL = "mini" as const;

export const KOKORO_TEST_PHRASE = "This is a test of text to speech.";

export function getSelectedEngine(): TtsEngineId {
  try {
    const value = window.localStorage.getItem(ENGINE_KEY);
    if (value === "kokoro" || value === "kitten" || value === "system") return value;
  } catch {
    // Storage unavailable (private mode) — fall back to the default engine.
  }
  return "kokoro";
}

export function setSelectedEngine(id: TtsEngineId): void {
  try {
    window.localStorage.setItem(ENGINE_KEY, id);
  } catch {
    // Storage unavailable — the choice lasts for this page only.
  }
}

// ---------------------------------------------------------------------------
// Kokoro-82M (Transformers.js: WebGPU fp32, WASM q8 fallback)
// ---------------------------------------------------------------------------

let kokoro: KokoroTTS | null = null;
let kokoroWebGpu: boolean | null = null;
let kokoroLoad: Promise<{ webgpu: boolean }> | null = null;
let activeAudio: HTMLAudioElement | null = null;

/** Which backend the loaded Kokoro model runs on (null while unloaded). */
export function kokoroEngine(): "webgpu" | "wasm" | null {
  if (!kokoro || kokoroWebGpu === null) return null;
  return kokoroWebGpu ? "webgpu" : "wasm";
}

function pickKokoroEngine(): { device: "webgpu" | "wasm"; dtype: "fp32" | "q8" } {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  // Upstream recommendation: fp32 under WebGPU for best quality; the
  // quantized q8 weights (~90MB vs ~330MB) for the slower WASM CPU path.
  return hasWebGpu ? { device: "webgpu", dtype: "fp32" } : { device: "wasm", dtype: "q8" };
}

/**
 * Load (or reuse) Kokoro. Reports aggregate download progress as 0..1.
 * Importing kokoro-js is dynamic, so the ~2MB runtime stays out of the main
 * bundle until TTS is actually used.
 */
export function ensureKokoro(onProgress?: (fraction: number) => void): Promise<{ webgpu: boolean }> {
  if (kokoro) return Promise.resolve({ webgpu: kokoroWebGpu ?? false });
  if (!kokoroLoad) {
    kokoroLoad = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      const files = new Map<string, number>();
      const report = () => {
        if (!onProgress || files.size === 0) return;
        let sum = 0;
        files.forEach((value) => {
          sum += value;
        });
        onProgress(sum / files.size);
      };
      const progress_callback = (info: { status: string; file?: string; progress?: number }) => {
        if (info && typeof info.file === "string" && typeof info.progress === "number") {
          files.set(info.file, Math.min(1, Math.max(0, info.progress / 100)));
          report();
        }
      };
      const primary = pickKokoroEngine();
      try {
        kokoro = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: primary.dtype,
          device: primary.device,
          progress_callback,
        });
        kokoroWebGpu = primary.device === "webgpu";
      } catch (error) {
        // WebGPU can be present but unusable (flags, drivers, software GL).
        // Fall back to the CPU path rather than failing the announcement.
        if (primary.device === "webgpu") {
          files.clear();
          kokoro = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
            dtype: "q8",
            device: "wasm",
            progress_callback,
          });
          kokoroWebGpu = false;
        } else {
          throw error;
        }
      }
      onProgress?.(1);
      return { webgpu: kokoroWebGpu ?? false };
    })().catch((error: unknown) => {
      kokoroLoad = null;
      kokoro = null;
      kokoroWebGpu = null;
      throw error;
    });
  }
  return kokoroLoad;
}

/** Split long announcements so no single generate() call eats a paragraph. */
function splitChunks(text: string, maxLen = 380): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["']?|\S(?:.*$)/g) ?? [clean];
  const chunks: string[] = [];
  for (const sentence of sentences.map((part) => part.trim()).filter(Boolean)) {
    if (sentence.length <= maxLen) {
      chunks.push(sentence);
    } else {
      for (let i = 0; i < sentence.length; i += maxLen) chunks.push(sentence.slice(i, i + maxLen));
    }
  }
  return chunks.length ? chunks : [clean];
}

function floatToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Stop whatever the local voice is currently saying. */
export function stopLocalTts(): void {
  try {
    activeAudio?.pause();
  } catch {
    // Audio element may already be gone; nothing to stop.
  }
  activeAudio = null;
}

function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    stopLocalTts();
    const el = new Audio(url);
    activeAudio = el;
    return new Promise<void>((resolve, reject) => {
      el.onended = () => resolve();
      el.onerror = () => reject(new Error("Local audio playback failed"));
      el.play().catch(reject);
    }).finally(() => {
      if (activeAudio?.src === url) activeAudio = null;
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Speak text with Kokoro. Resolves when playback ends. */
export async function speakKokoro(text: string): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!clean) return;
  if (!kokoro) await ensureKokoro();
  if (!kokoro) throw new Error("Local TTS failed to load");
  const waves: Float32Array[] = [];
  let sampleRate = 24000;
  for (const chunk of splitChunks(clean)) {
    const out = await kokoro.generate(chunk, { voice: KOKORO_VOICE, speed: 1 });
    sampleRate = out.sampling_rate || sampleRate;
    waves.push(out.audio);
  }
  const total = waves.reduce((sum, wave) => sum + wave.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const wave of waves) {
    merged.set(wave, offset);
    offset += wave.length;
  }
  await playBlob(floatToWavBlob(merged, sampleRate));
}

// ---------------------------------------------------------------------------
// KittenTTS Mini (pure WebGPU shaders, no ONNX Runtime)
// ---------------------------------------------------------------------------

/** Speak text with KittenTTS. Throws when WebGPU is unavailable. */
export async function speakKitten(text: string, onStage?: (stage: string) => void): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!clean) return;
  const { textToSpeech } = await import("kitten-tts-webgpu");
  const chunks = splitChunks(clean, 450);
  if (chunks.length <= 1) {
    onStage?.("Generating speech…");
    const blob = await textToSpeech(clean, {
      voice: KITTEN_VOICE,
      model: KITTEN_MODEL,
      onProgress: onStage,
    });
    await playBlob(blob);
    return;
  }
  // Long text: render each chunk, decode, stitch gaplessly, play once.
  onStage?.("Generating speech…");
  const context = new OfflineAudioContext(1, 1, 24000);
  const buffers = await Promise.all(
    chunks.map(async (chunk) => {
      const blob = await textToSpeech(chunk, { voice: KITTEN_VOICE, model: KITTEN_MODEL });
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      return decoded.getChannelData(0);
    }),
  );
  const rate = 24000;
  const total = buffers.reduce((sum, part) => sum + part.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const part of buffers) {
    merged.set(part, offset);
    offset += part.length;
  }
  await playBlob(floatToWavBlob(merged, rate));
}

// ---------------------------------------------------------------------------
// System voice + unified entry points
// ---------------------------------------------------------------------------

/** Speak text with the browser's built-in voice. Best-effort, no download. */
export function speakSystemVoice(text: string): void {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Browser speech is best-effort; the display works fine silent.
  }
}

/** Warm an engine without speaking (preloads the model into cache/memory). */
export function warmEngine(engine: TtsEngineId): Promise<void> {
  if (engine === "kokoro") {
    return ensureKokoro().then(() => undefined);
  }
  // Kitten loads on first speak; the system voice needs nothing.
  return Promise.resolve();
}

/**
 * Speak text with the chosen engine. Kitten without WebGPU throws so the
 * caller can fall through to the next voice in its cascade.
 */
export async function speakWithEngine(
  engine: TtsEngineId,
  text: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (engine === "kokoro") {
    await ensureKokoro(onProgress);
    await speakKokoro(text);
    return;
  }
  if (engine === "kitten") {
    await speakKitten(text, (stage) => {
      if (/download/i.test(stage)) onProgress?.(0.5);
      if (/generat/i.test(stage)) onProgress?.(1);
    });
    return;
  }
  speakSystemVoice(text);
}

/**
 * Delete locally cached voice files (corrupt downloads are the usual cause
 * of garbled speech) and unload Kokoro. Callers should reload the page after
 * so in-memory copies are dropped too.
 */
export async function clearLocalTtsCaches(): Promise<string[]> {
  const cleared: string[] = [];
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      for (const key of keys) {
        if (/transformers|huggingface|onnx|kokoro|kitten/i.test(key)) {
          await caches.delete(key);
          cleared.push(key);
        }
      }
    }
  } catch {
    // CacheStorage unavailable — nothing to clear.
  }
  try {
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && /transformers|huggingface|onnx|kokoro|kitten/i.test(db.name)) {
          await new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(db.name as string);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
          });
          cleared.push(db.name);
        }
      }
    }
  } catch {
    // IndexedDB unavailable — nothing to clear.
  }
  kokoro = null;
  kokoroLoad = null;
  kokoroWebGpu = null;
  return cleared;
}
