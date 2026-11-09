"use client";
import { useEffect, useRef, useState } from "react";

const MAX_VIDEO_SECONDS = 60;

// Pick a video format this browser can record. WebM (VP9/VP8) first: every browser can play it back.
function pickVideoType() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

// A full-screen camera: take a photo or record a video (up to 60 s). Gives back a File, just like
// picking one with the 📎 button, so it's sent (and encrypted) the same way.
export default function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [facing, setFacing] = useState<"user" | "environment">("user"); // front or back camera
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Turn the camera on (and off again when this closes or the camera is flipped)
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } }); // no microphone: video only
        }
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) setError("Can't use the camera. Allow camera access in your browser (the icon in the address bar) and try again.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  // Recording timer, with an automatic stop at the limit
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_VIDEO_SECONDS) recorderRef.current?.stop();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Escape closes (but not in the middle of a recording)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !recording && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [recording, onClose]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })), "image/jpeg", 0.9);
  }

  function startRecording() {
    if (!streamRef.current) return;
    const type = pickVideoType();
    const recorder = new MediaRecorder(streamRef.current, { ...(type && { mimeType: type }), videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      setRecording(false);
      const base = (recorder.mimeType || "video/webm").split(";")[0];
      const ext = base === "video/mp4" ? "mp4" : "webm";
      onCapture(new File(chunks, `video-${Date.now()}.${ext}`, { type: base }));
    };
    recorderRef.current = recorder;
    recorder.start(1000); // save a chunk every second
    setSeconds(0);
    setRecording(true);
  }

  const shutter = () => (mode === "photo" ? takePhoto() : recording ? recorderRef.current?.stop() : startRecording());
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="flex items-center justify-between p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onClose} disabled={recording} className="rounded-full px-3 py-1 text-2xl hover:cursor-pointer hover:bg-white/10 disabled:opacity-40" aria-label="Close camera">
          ✕
        </button>
        {recording && <span className="rounded-full bg-red-600 px-3 py-1 font-mono text-sm">● {clock} / 1:00</span>}
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          disabled={recording}
          className="rounded-full px-3 py-1 text-sm font-semibold hover:cursor-pointer hover:bg-white/10 disabled:opacity-40"
        >
          ⟲ Flip
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {error ? (
          <p className="max-w-sm p-6 text-center">{error}</p>
        ) : (
          // Mirror the front camera so it feels like a mirror (the saved photo is not mirrored)
          <video ref={videoRef} autoPlay playsInline muted className={`max-h-full max-w-full ${facing === "user" ? "-scale-x-100" : ""}`} />
        )}
      </div>

      <div className="flex flex-col items-center gap-4 p-6" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 rounded-full bg-white/10 p-1 text-sm font-semibold" role="radiogroup" aria-label="Camera mode">
          {(["photo", "video"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={recording}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1 capitalize hover:cursor-pointer ${mode === m ? "bg-white text-black" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={shutter}
          disabled={!!error}
          aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Start recording"}
          className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white hover:cursor-pointer disabled:opacity-40"
        >
          <span className={`block transition-all ${mode === "video" ? "bg-red-600" : "bg-white"} ${recording ? "h-7 w-7 rounded-md" : "h-14 w-14 rounded-full"}`} />
        </button>
      </div>
    </div>
  );
}
