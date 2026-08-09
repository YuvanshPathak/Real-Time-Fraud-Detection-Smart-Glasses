import { useEffect, useRef, useState } from "react";
import MetricRow from "./MetricRow.jsx";
import StatusPill from "./StatusPill.jsx";
import { uploadVoice } from "../services/api.js";

const statusStyles = {
  GENUINE_HUMAN_VOICE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  AI_SYNTHETIC_VOICE_CLONE: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  REPLAY_ATTACK: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

const RECORD_SECONDS = 5;

const encodeWav = (samples, sampleRate) => {
  const numChannels = 1;
  const numFrames = samples.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + numFrames * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numFrames * blockAlign, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numFrames * blockAlign, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
};

const VoiceVerificationCard = ({ onComplete, onScore }) => {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(RECORD_SECONDS);
  const [audioFile, setAudioFile] = useState(null);

  useEffect(() => {
    if (!recording) return;

    if (timeLeft <= 0) {
      mediaRecorderRef.current?.stop();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [recording, timeLeft]);

  const startRecording = async () => {
    setError("");
    setResult(null);
    setAudioFile(null);
    onComplete?.(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        try {
          if (!chunksRef.current.length) {
            setError("No audio captured from microphone.");
            return;
          }

          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const channelCount = audioBuffer.numberOfChannels;
          const length = audioBuffer.length;
          const mixed = new Float32Array(length);

          for (let channel = 0; channel < channelCount; channel += 1) {
            const data = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i += 1) {
              mixed[i] += data[i] / channelCount;
            }
          }

          const wavBuffer = encodeWav(mixed, audioBuffer.sampleRate);
          const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
          const file = new File([wavBlob], `voice-${Date.now()}.wav`, {
            type: "audio/wav",
          });
          setAudioFile(file);
        } catch (err) {
          setError("Could not process audio stream.");
        } finally {
          setRecording(false);
          setTimeLeft(RECORD_SECONDS);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setTimeLeft(RECORD_SECONDS);
      mediaRecorder.start(250);
    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const analyzeVoice = async () => {
    if (!audioFile) {
      setError("Record an audio stream first.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await uploadVoice(audioFile);
      setResult(data);
      if (typeof data.voice_liveness_score === "number") {
        onScore?.(data.voice_liveness_score);
      }
      onComplete?.(true);
    } catch (err) {
      setError("Voice anti-spoofing scan failed.");
      onComplete?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 border border-purple-500/20 bg-slate-900/60 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-purple-400">
            Acoustic Anti-Spoofing
          </p>
          <h3 className="text-lg font-display font-semibold text-white">
            AI Voice Clone & Replay Detection
          </h3>
        </div>
        {result && (
          <StatusPill
            label={result.spoof_type?.replace(/_/g, " ")}
            className={statusStyles[result.spoof_type] || "bg-purple-500/20 text-purple-200"}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={startRecording}
          disabled={recording}
          className="rounded-full border border-purple-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-100 transition hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {recording ? `Listening ${timeLeft}s` : "Record Mic Sample"}
        </button>
        <button
          onClick={analyzeVoice}
          disabled={loading || recording || !audioFile}
          className="rounded-full bg-purple-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-100 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Analyzing Spectrum..." : "Analyze Audio Liveness"}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <MetricRow
          label="Audio Liveness Score"
          value={
            result
              ? `${(result.voice_liveness_score * 100).toFixed(1)}%`
              : loading
              ? "Calculating HF Ratio..."
              : audioFile
              ? "Audio Captured"
              : "Awaiting Input"
          }
          emphasize
          loading={loading}
        />
        <MetricRow
          label="Voice Classification"
          value={
            result
              ? result.spoof_detected
                ? `SPOOF DETECTED (${result.spoof_type})`
                : "GENUINE HUMAN VOICE"
              : loading
              ? "Scanning F0 Jitter"
              : "--"
          }
          loading={loading}
        />
        {result?.details && (
          <div className="rounded-xl bg-slate-950/60 p-3 text-xs font-mono text-slate-400 grid grid-cols-2 gap-2 border border-slate-800">
            <div>HF Ratio: <span className="text-purple-300">{result.details.high_frequency_ratio}</span></div>
            <div>Centroid Std: <span className="text-purple-300">{result.details.spectral_centroid_std}</span></div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
};

export default VoiceVerificationCard;
