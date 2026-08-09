import Webcam from "react-webcam";

const LiveFeedCard = ({ webcamRef, lastCapture }) => {
  return (
    <section className="glass-panel relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 border border-cyan-500/20 bg-slate-900/60 backdrop-blur-md shadow-xl">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-400">
              ESP32-S3 Sense Edge Stream
            </p>
            <h2 className="text-xl font-display font-semibold text-white">
              Smart Glasses HUD Vision Feed
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.3)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            ESP32 STREAMING (TINYLML ON-DEVICE)
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            className="aspect-video w-full object-cover opacity-90"
            videoConstraints={{ facingMode: "user" }}
          />

          {/* Futuristic Smart Glasses HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none border border-cyan-500/20 rounded-2xl flex items-center justify-center">
            {/* Target Reticle / Face Box */}
            <div className="w-48 h-48 border-2 border-dashed border-cyan-400/60 rounded-xl relative flex items-center justify-center animate-pulse">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-300" />
              <span className="text-[10px] font-mono text-cyan-300 bg-black/60 px-2 py-0.5 rounded border border-cyan-500/40 uppercase tracking-widest">
                Target Lock
              </span>
            </div>

            {/* Corner HUD Telemetry */}
            <div className="absolute top-3 left-3 text-[10px] font-mono text-cyan-400/80 bg-slate-950/80 px-2.5 py-1 rounded border border-cyan-500/30">
              OV2640 VGA | 30 FPS | TinyML Active
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-cyan-400/80 bg-slate-950/80 px-2.5 py-1 rounded border border-cyan-500/30">
              BLE Relay: CONNECTED
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2 border-t border-slate-800 pt-3">
        <span>Hardware: ESP32-S3 Sense (240MHz Dual Core)</span>
        <span>
          {lastCapture
            ? `Last Captured Frame: ${lastCapture.toLocaleTimeString()}`
            : "Live Stream Ready"}
        </span>
      </div>
    </section>
  );
};

export default LiveFeedCard;
