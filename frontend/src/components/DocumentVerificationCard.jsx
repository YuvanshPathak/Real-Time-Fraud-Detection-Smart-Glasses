import { useState } from "react";
import MetricRow from "./MetricRow.jsx";
import StatusPill from "./StatusPill.jsx";
import { uploadDocument, uploadFaceToIdSync } from "../services/api.js";

const DocumentVerificationCard = ({ liveFaceFile, onComplete, onScore }) => {
  const [docFile, setDocFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docResult, setDocResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setDocFile(e.target.files[0]);
      setError("");
      setDocResult(null);
      setSyncResult(null);
    }
  };

  const analyzeDocument = async () => {
    if (!docFile) {
      setError("Please select or capture an ID document image.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // 1. Run Error Level Analysis (ELA) on Document
      const data = await uploadDocument(docFile);
      setDocResult(data);

      let syncScore = 1.0;
      // 2. If live face file exists, run Face-to-ID Cross Match
      if (liveFaceFile) {
        try {
          const syncData = await uploadFaceToIdSync(liveFaceFile, docFile);
          setSyncResult(syncData);
          syncScore = syncData.face_id_match_score;
        } catch {
          syncScore = 0.5;
        }
      }

      onScore?.({
        docAuthenticityScore: data.doc_authenticity_score,
        faceIdMatchScore: syncScore,
      });
      onComplete?.(true);
    } catch (err) {
      setError("Document verification scan failed.");
      onComplete?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 border border-indigo-500/20 bg-slate-900/60 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-indigo-400">
            Document Verification
          </p>
          <h3 className="text-lg font-display font-semibold text-white">
            ID Forgery & Face-to-ID Sync
          </h3>
        </div>
        {docResult && (
          <StatusPill
            label={docResult.is_tampered ? "Tampered / Forged" : "Authentic Document"}
            className={docResult.is_tampered ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100 transition hover:bg-indigo-500/10">
          {docFile ? docFile.name.slice(0, 18) + "..." : "Select ID Document"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <button
          onClick={analyzeDocument}
          disabled={loading || !docFile}
          className="rounded-full bg-indigo-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Running ELA Check..." : "Verify ID Card"}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <MetricRow
          label="Document Authenticity (ELA)"
          value={
            docResult
              ? `${(docResult.doc_authenticity_score * 100).toFixed(1)}%`
              : loading
              ? "Calculating ELA Variance..."
              : docFile
              ? "ID Image Selected"
              : "Awaiting ID Card"
          }
          emphasize
          loading={loading}
        />
        <MetricRow
          label="Face-to-ID Sync Match"
          value={
            syncResult
              ? `${(syncResult.face_id_match_score * 100).toFixed(1)}% (${syncResult.verified_identity ? "MATCHED" : "UNMATCHED"})`
              : liveFaceFile && docResult
              ? "Synchronized"
              : "--"
          }
          loading={loading}
        />
        {docResult?.details && (
          <div className="rounded-xl bg-slate-950/60 p-3 text-xs font-mono text-slate-400 grid grid-cols-2 gap-2 border border-slate-800">
            <div>ELA Std Dev: <span className="text-indigo-300">{docResult.details.ela_std}</span></div>
            <div>ID Portrait Found: <span className="text-indigo-300">{docResult.has_id_portrait ? "YES" : "NO"}</span></div>
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

export default DocumentVerificationCard;
