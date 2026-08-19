import { useState } from "react";
import MetricRow from "./MetricRow.jsx";
import StatusPill from "./StatusPill.jsx";
import { fetchRiskScore } from "../services/api.js";

const statusStyles = {
  SAFE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  SUSPICIOUS: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  FRAUD: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

const formatModalityScore = (value) =>
  value === null || value === undefined ? "Not checked" : `${(value * 100).toFixed(0)}%`;

const playBoneConductionAlert = (toneType) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (toneType === "CRITICAL_ALARM" || toneType === "FRAUD") {
      // High pitch double alarm beep for fraud alert
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } else if (toneType === "WARNING_CHIME" || toneType === "SUSPICIOUS") {
      // Medium pitch warning chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else {
      // Soft confirmation beep for genuine human
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }
  } catch (err) {
    console.error("Audio feedback failed:", err);
  }
};

const RiskAnalysisCard = ({
  faceLivenessScore,
  voiceLivenessScore,
  docAuthenticityScore,
  faceIdMatchScore,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [fusedInputs, setFusedInputs] = useState(null);

  const canCalculate = faceLivenessScore !== null || voiceLivenessScore !== null;

  // True once any modality score changes after a fusion was already computed —
  // the displayed verdict no longer reflects everything that's now been checked.
  const isStale =
    result !== null &&
    fusedInputs !== null &&
    (fusedInputs.faceLivenessScore !== faceLivenessScore ||
      fusedInputs.voiceLivenessScore !== voiceLivenessScore ||
      fusedInputs.docAuthenticityScore !== docAuthenticityScore ||
      fusedInputs.faceIdMatchScore !== faceIdMatchScore);

  const handleAnalyze = async () => {
    if (!canCalculate) {
      setError("Run at least facial liveness or voice anti-spoofing scan first.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Only send scores for checks that actually ran — an omitted field tells
      // the backend "not evaluated," which is not the same as "genuine."
      const payload = {
        ...(faceLivenessScore !== null && { face_liveness_score: faceLivenessScore }),
        ...(voiceLivenessScore !== null && { voice_liveness_score: voiceLivenessScore }),
        ...(docAuthenticityScore !== null && { doc_authenticity_score: docAuthenticityScore }),
        ...(faceIdMatchScore !== null && { face_id_match_score: faceIdMatchScore }),
      };

      const data = await fetchRiskScore(payload);
      setResult(data);
      setFusedInputs({
        faceLivenessScore,
        voiceLivenessScore,
        docAuthenticityScore,
        faceIdMatchScore,
      });

      // Trigger discreet bone conduction feedback audio playback
      playBoneConductionAlert(data.audio_alert_tone || data.risk_level);
    } catch (err) {
      setError("Decision fusion engine failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 border border-cyan-500/30 bg-slate-900/80 backdrop-blur-md shadow-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-400">
            Multi-Modal Fusion Engine
          </p>
          <h3 className="text-lg font-display font-semibold text-white">
            Unified Fraud Risk Index
          </h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!canCalculate || loading}
          className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition disabled:cursor-not-allowed disabled:opacity-50 shadow-lg ${
            isStale
              ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-400/50 text-amber-100 hover:from-amber-500/50 hover:to-orange-500/50"
              : "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50 text-cyan-100 hover:from-cyan-500/50 hover:to-blue-500/50"
          }`}
        >
          {loading ? "Fusing Signals..." : isStale ? "Re-Fuse Decision" : "Fuse Decision"}
        </button>
        {result && (
          <StatusPill
            label={result.risk_level}
            className={statusStyles[result.risk_level] || "bg-slate-500/20 text-slate-300"}
          />
        )}
      </div>

      {isStale && (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          A scan result changed after this verdict was fused — the numbers below no longer reflect everything that's been checked. Re-Fuse to update.
        </p>
      )}

      <div className="mt-5 space-y-3">
        <MetricRow
          label="Fraud Risk Score"
          value={
            result
              ? `${(result.fraud_risk_score * 100).toFixed(1)}%`
              : loading
              ? "Computing Multi-Modal Risk..."
              : canCalculate
              ? "Ready for Fusion"
              : "Awaiting Scans"
          }
          emphasize
          loading={loading}
        />
        <MetricRow
          label="Actionable Recommendation"
          value={
            result
              ? result.recommendation
              : loading
              ? "Evaluating Threat Matrix"
              : "--"
          }
          loading={loading}
        />
        <MetricRow
          label="Bone Conduction Alert Signal"
          value={
            result
              ? `${result.audio_alert_tone} (DISCREET TONE TRANSMITTED)`
              : loading
              ? "Synthesizing Alert..."
              : "--"
          }
          loading={loading}
        />
      </div>

      {result?.modalities && (
        <div className="mt-4 rounded-xl bg-slate-950/70 p-3 text-xs font-mono text-slate-300 border border-slate-800 space-y-1">
          <div className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Modality Confidence Scores:</div>
          <div className="grid grid-cols-2 gap-2">
            <div>Voice Liveness: <span className="text-purple-300">{formatModalityScore(result.modalities.voice_liveness)}</span></div>
            <div>Face Liveness: <span className="text-cyan-300">{formatModalityScore(result.modalities.face_liveness)}</span></div>
            <div>Face-ID Sync: <span className="text-indigo-300">{formatModalityScore(result.modalities.face_id_match)}</span></div>
            <div>Doc Authenticity: <span className="text-emerald-300">{formatModalityScore(result.modalities.doc_authenticity)}</span></div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
};

export default RiskAnalysisCard;
