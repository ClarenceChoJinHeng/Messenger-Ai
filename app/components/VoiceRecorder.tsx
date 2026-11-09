"use client";
import { useEffect, useRef, useState } from "react";
import { downsample, encodeWav } from "@/lib/wav";

const MAX_SECONDS = 5 * 60; // voice notes up to 5 minutes
const BAR_COUNT = 36; // how many bars the live meter shows

// Everything that exists only while recording
interface Session {
  stream: MediaStream;
  ctx: AudioContext;
  processor: ScriptProcessorNode;
  chunks: Float32Array[]; // the raw sound, collected bit by bit
}

// The 🎤 button. Click to start recording: bars move with your voice. Then Done or Cancel.
// Records raw sound and saves it as a WAV file, which every browser can play.
export default function VoiceRecorder({ onRecorded, onError }: { onRecorded: (file: File) => void; onError: (message: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const session = useRef<Session | null>(null);

  // Timer, with an automatic stop at the limit
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) finish(true);
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps -- finish() only uses refs

  // Leaving the chat mid-recording: stop and throw it away
  useEffect(() => () => finish(false), []); // eslint-disable-line react-hooks/exhaustive-deps -- finish() only uses refs

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      onError("Can't use the microphone. Allow microphone access in your browser and try again.");
      return;
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    // A processor gets the sound in small pieces (~0.08 s each): we keep each piece, and use it for the meter
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    processor.onaudioprocess = (e) => {
      const piece = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(piece)); // copy: the browser reuses this memory
      let sum = 0;
      for (const s of piece) sum += s * s;
      const level = Math.min(1, Math.sqrt(sum / piece.length) * 6); // how loud this piece was
      setLevels((old) => [...old.slice(1), Math.max(0.08, level)]);
    };
    source.connect(processor);
    processor.connect(ctx.destination); // needed for it to run; it outputs silence, so no echo

    session.current = { stream, ctx, processor, chunks };
    setSeconds(0);
    setLevels(Array(BAR_COUNT).fill(0.08));
    setRecording(true);
  }

  // Stop recording; keep = true turns it into a WAV file, false throws it away
  function finish(keep: boolean) {
    const s = session.current;
    if (!s) return;
    session.current = null;
    s.processor.onaudioprocess = null;
    s.processor.disconnect();
    s.stream.getTracks().forEach((t) => t.stop()); // turn the microphone off
    const rate = s.ctx.sampleRate;
    void s.ctx.close();
    setRecording(false);
    if (!keep || !s.chunks.length) return;

    // Glue the pieces together, shrink to speech quality, and wrap it as a WAV file
    const total = s.chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let at = 0;
    for (const c of s.chunks) {
      all.set(c, at);
      at += c.length;
    }
    if (total / rate < 0.5) return onError("That was too short. Hold on a bit longer."); // under half a second
    onRecorded(new File([encodeWav(downsample(all, rate))], `voice-${Date.now()}.wav`, { type: "audio/wav" }));
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  if (!recording) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label="Record a voice message"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-xl hover:cursor-pointer hover:bg-surface-2"
      >
        🎤
      </button>
    );
  }
  return (
    <div className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-red-500 px-3" role="status" aria-label={`Recording, ${clock}`}>
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
      <span className="shrink-0 font-mono text-sm">{clock}</span>
      {/* Bars that move with your voice */}
      <span className="flex h-7 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden="true">
        {levels.map((l, i) => (
          <span key={i} className="w-[3px] flex-1 rounded-full bg-red-500 transition-[height] duration-75" style={{ height: `${l * 100}%` }} />
        ))}
      </span>
      <button type="button" onClick={() => finish(false)} className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-muted hover:cursor-pointer hover:bg-surface-2">
        Cancel
      </button>
      <button type="button" onClick={() => finish(true)} className="shrink-0 rounded-md bg-blue-500 px-3 py-1 text-sm font-semibold text-white hover:cursor-pointer">
        Done
      </button>
    </div>
  );
}
