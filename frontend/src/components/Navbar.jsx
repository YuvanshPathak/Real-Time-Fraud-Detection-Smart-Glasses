const Navbar = () => {
  return (
    <header className="glass-panel rounded-3xl px-6 py-4 border border-cyan-500/30 bg-slate-900/80 backdrop-blur-md shadow-2xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-400">
            Wearable Cyber-Physical System
          </p>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
            Real-Time AI Fraud & Anti-Spoofing Smart Glasses
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            Architecture: Edge (ESP32-S3) – Gateway – Cloud AI
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
