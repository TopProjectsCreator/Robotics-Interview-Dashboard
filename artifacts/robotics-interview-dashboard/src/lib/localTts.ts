// On-device English text-to-speech for the big screen.
// Runs Kokoro-82M (82M params, English-only voices) 100% locally in the
// browser via kokoro-js + Transformers.js: WebGPU when available, WASM CPU
// otherwise. No API key, no speech service — the model downloads once from
// the Hugging Face Hub and is then cached in IndexedDB by the browser.
//
// Why this model: it is the best-regarded sub-1B TTS, and the v1.0 weights
// ship American + British English voices only, so nothing is wasted on
// languages the tryout will never announce in.

import type { KokoroTTS } from "kokoro-js";

export const LOCAL_TTS_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// af_heart is the highest-graded English voice in the Kokoro voice table.
export const LOCAL_TTS_VOICE = "af_heart" as const;
export const KOKORO_TEST_PHRASE = "This is a test of text to speech.";

let tts: KokoroTTS | null = null;
let webgpuActive: boolean | null = null;
let loadPromise: Promise<{ webgpu: boolean }> | null = null;
let activeAudio: HTMLAudioElement | null = null;

/** True once the model loaded, plus which engine it runs on. */
export function localTtsEngine(): "webgpu" | "wasm" | null {
  if (!tts || webgpuActive === null) return null;
  return webgpuActive ? "webgpu" : "wasm";
}

function pickEngine(): { device: "webgpu" | "wasm"; dtype: "fp32" | "q8" } {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  // Upstream recommendation: fp32 under WebGPU for best quality; the
  // quantized q8 weights (~90MB vs ~330MB) for the slower WASM CPU path.
  return hasWebGpu ? { device: "webgpu", dtype: "fp32" } : { device: "wasm", dtype: "q8" };
}

/**
 * Load (or reuse) the local voice. Reports aggregate download progress as a
 * 0..1 fraction. Importing kokoro-js is dynamic, so the ~2MB runtime stays
 * out of the main bundle until TTS is actually used.
 */
export function ensureLocalTts(onProgress?: (fraction: number) => void): Promise<{ webgpu: boolean }> {
  if (tts) return Promise.resolve({ webgpu: webgpuActive ?? false });
  if (!loadPromise) {
    loadPromise = (async () => {
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
      const primary = pickEngine();
      try {
        tts = await KokoroTTS.from_pretrained(LOCAL_TTS_MODEL_ID, {
          dtype: primary.dtype,
          device: primary.device,
          progress_callback,
        });
        webgpuActive = primary.device === "webgpu";
      } catch (error) {
        // WebGPU can be present but unusable (flags, drivers, SwiftShader).
        // Fall back to the CPU path rather than failing the announcement.
        if (primary.device === "webgpu") {
          files.clear();
          tts = await KokoroTTS.from_pretrained(LOCAL_TTS_MODEL_ID, {
            dtype: "q8",
            device: "wasm",
            progress_callback,
          });
          webgpuActive = false;
        } else {
          throw error;
        }
      }
      onProgress?.(1);
      return { webgpu: webgpuActive ?? false };
    })().catch((error: unknown) => {
      loadPromise = null;
      tts = null;
      webgpuActive = null;
      throw error;
    });
  }
  return loadPromise;
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

/** Speak text with the on-device voice. Resolves when playback ends. */
export async function speakLocalKokoro(text: string): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!clean) return;
  if (!tts) await ensureLocalTts();
  if (!tts) throw new Error("Local TTS failed to load");
  const waves: Float32Array[] = [];
  let sampleRate = 24000;
  for (const chunk of splitChunks(clean)) {
    const out = await tts.generate(chunk, { voice: LOCAL_TTS_VOICE, speed: 1 });
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
  const url = URL.createObjectURL(floatToWavBlob(merged, sampleRate));
  try {
    stopLocalTts();
    const el = new Audio(url);
    activeAudio = el;
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve();
      el.onerror = () => reject(new Error("Local audio playback failed"));
      el.play().catch(reject);
    });
  } finally {
    if (activeAudio?.src === url) activeAudio = null;
    URL.revokeObjectURL(url);
  }
}
