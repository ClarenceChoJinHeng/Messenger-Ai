"use client";
import { useEffect, useRef, useState } from "react";
import { useObjectUrl } from "@/lib/use-object-url";

const BARS = 32;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The loudest point in each slice of the recording, scaled 0.12–1: the real "shape" of the voice
function peaksOf(audio: AudioBuffer): number[] {
  const data = audio.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / BARS));
  const peaks = Array.from({ length: BARS }, (_, i) => {
    let max = 0;
    for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j++) max = Math.max(max, Math.abs(data[j]));
    return max;
  });
  const loudest = Math.max(...peaks, 0.0001);
  return peaks.map((p) => Math.max(0.12, p / loudest));
}

// A WhatsApp-style voice message player: ▶/⏸, the voice's waveform filling up as it plays
// (click a bar to jump there), and the time.
//
// It decodes the recording into raw sound with the browser's Web Audio engine and plays that directly.
// That gives the exact length (browser recordings often don't store it), the real waveform, and
// doesn't depend on an <audio> element or temporary links.
export default function VoicePlayer({ blob }: { blob: Blob }) {
  const [sound, setSound] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>(() => Array(BARS).fill(0.3));
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  // What's playing right now (kept in a ref: changing it doesn't need a redraw)
  const live = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode; startedAt: number; offset: number; frame: number } | null>(null);
  const offsetRef = useRef(0); // where to continue from after a pause

  // Decode once
  useEffect(() => {
    let cancelled = false;
    async function decode() {
      try {
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        void ctx.close();
        if (cancelled) return;
        setSound(decoded);
        setPeaks(peaksOf(decoded));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.name : "unknown error");
      }
    }
    decode();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  function stopSound() {
    const l = live.current;
    if (!l) return;
    cancelAnimationFrame(l.frame);
    l.source.onended = null;
    try {
      l.source.stop();
    } catch {
      // already stopped
    }
    void l.ctx.close();
    live.current = null;
  }

  // Stop the sound if the player disappears (leaving the chat, removing the preview)
  useEffect(() => () => stopSound(), []);

  function play(from: number) {
    if (!sound) return;
    stopSound();
    const ctx = new AudioContext(); // made on click, so the browser allows sound
    const source = ctx.createBufferSource();
    source.buffer = sound;
    source.connect(ctx.destination);
    source.onended = () => {
      // reached the end: back to the start
      stopSound();
      offsetRef.current = 0;
      setPlaying(false);
      setTime(0);
    };
    source.start(0, from);
    const tick = () => {
      const l = live.current;
      if (!l) return;
      setTime(Math.min(sound.duration, l.offset + (l.ctx.currentTime - l.startedAt)));
      l.frame = requestAnimationFrame(tick);
    };
    live.current = { ctx, source, startedAt: ctx.currentTime, offset: from, frame: requestAnimationFrame(tick) };
    setPlaying(true);
  }

  function toggle() {
    if (playing) {
      const l = live.current;
      offsetRef.current = l ? l.offset + (l.ctx.currentTime - l.startedAt) : 0;
      stopSound();
      setPlaying(false);
    } else {
      play(offsetRef.current);
    }
  }

  function seek(i: number) {
    if (!sound) return;
    const to = (i / BARS) * sound.duration;
    offsetRef.current = to;
    setTime(to);
    if (playing) play(to);
  }

  // This browser can't decode it (e.g. older WebM recordings): use its own audio player instead
  if (error) return <FallbackAudio blob={blob} />;

  const duration = sound?.duration ?? 0;
  const progress = duration ? Math.min(1, time / duration) : 0;

  return (
    <div className="flex w-64 max-w-full items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        disabled={!sound}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:cursor-pointer disabled:opacity-50"
      >
        {playing ? "⏸" : "▶"}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" role="progressbar" aria-label="Played" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        {peaks.map((h, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            onClick={() => seek(i)}
            className={`w-[3px] flex-1 rounded-full hover:cursor-pointer ${(i + 0.5) / BARS <= progress ? "bg-blue-500" : "bg-current opacity-30"}`}
            style={{ height: `${h * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      {/* While playing or paused part-way: how far in. Otherwise: the total length. */}
      <span className="w-9 shrink-0 text-right font-mono text-xs opacity-70">{fmt(playing || time > 0 ? time : duration)}</span>
    </div>
  );
}

// The browser's built-in player, for recordings the decoder can't read
function FallbackAudio({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob);
  if (!url) return null;
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <audio src={url} controls preload="metadata" className="h-10 w-64 max-w-full" />
    </span>
  );
}
