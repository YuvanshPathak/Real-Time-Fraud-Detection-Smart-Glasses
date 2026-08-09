import { useState } from "react";
import MetricRow from "./MetricRow.jsx";
import StatusPill from "./StatusPill.jsx";
import { uploadFace } from "../services/api.js";

const statusStyles = {
  REAL_HUMAN: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  AI_DEEPFAKE_DETECTED: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  SCREEN_REPLAY_ATTACK: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  INVALID_IMAGE: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

const FaceVerificationCard = ({ onCapture, onComplete, onScore }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleCapture = () => {
    const captured = onCapture?.();
    if (!captured) {
      setError("Unable to capture frame from smart glasses camera stream.");
      return;
    }

    setError("");
    setResult(null);
    setFile(captured);
    onComplete?.(false);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Capture a camera frame first.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await uploadFace(file);
      setResult(data);

      if (typeof data.face_liveness_score === "number") {
        onScore?.(data.face_liveness_score);
      }
      onComplete?.(true);
    } catch (err) {
      setError("Facial liveness & deepfake scan failed.");
      onComplete?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 border border-cyan-500/20 bg-slate-900/60 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-400">
            Visual Anti-Spoofing
          </p>
          <h3 className="text-lg font-display font-semibold text-white">
            Facial Deepfake & Liveness
          </h3>
        </div>
        {result && (
          <StatusPill
            label={result.liveness_status?.replace(/_/g, " ")}
            className={statusStyles[result.liveness_status] || "bg-cyan-500/20 text-cyan-200"}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handleCapture}
          className="rounded-full border border-cyan-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/10"
        >
          Capture Frame
        </button>
        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          className="rounded-full bg-cyan-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Scanning FFT..." : "Analyze Liveness"}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <MetricRow
          label="Facial Liveness Score"
          value={
            result
              ? `${(result.face_liveness_score * 100).toFixed(1)}%`
              : loading
              ? "Running Spatial-FFT..."
              : file
              ? "Frame Ready"
              : "Awaiting Capture"
          }
          emphasize
          loading={loading}
        />
        <MetricRow
          label="Deepfake Artifact Check"
          value={
            result
              ? result.is_deepfake
                ? "DEEPFAKE / GAN DETECTED"
                : "REAL HUMAN VERIFIED"
              : loading
              ? "Analyzing Texture"
              : "--"
          }
          loading={loading}
        />
        {result?.details && (
          <div className="rounded-xl bg-slate-950/60 p-3 text-xs font-mono text-slate-400 grid grid-cols-2 gap-2 border border-slate-800">
            <div>FFT Freq Ratio: <span className="text-cyan-300">{result.details.fft_frequency_ratio}</span></div>
            <div>Laplacian Var: <span className="text-cyan-300">{result.details.laplacian_variance}</span></div>
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

export default FaceVerificationCard;
