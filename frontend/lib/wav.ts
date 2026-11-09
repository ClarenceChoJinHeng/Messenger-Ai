// Turning raw microphone samples into a WAV file.
// WAV is the simplest sound format: every browser can play AND decode it, and it always knows its length
// (unlike the WebM files browsers record by default, which their own decoder often rejects).

export const VOICE_SAMPLE_RATE = 16_000; // phone-call quality: plenty for speech, ~2 MB per minute

// The microphone gives e.g. 48 000 samples a second; keep 16 000 by averaging each group
export function downsample(samples: Float32Array, fromRate: number, toRate = VOICE_SAMPLE_RATE): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

// Build the WAV file: a 44-byte header that describes the sound, then the samples as 16-bit numbers
export function encodeWav(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true); // file size after this point
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // size of the format section
  view.setUint16(20, 1, true); // 1 = plain PCM (uncompressed)
  view.setUint16(22, 1, true); // 1 channel (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);

  // -1…1 floats → whole numbers from -32768 to 32767
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
