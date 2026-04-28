const STATUS_MAP = {
  pending:         { color: "#94a3b8", label: "Queued — waiting for agent...",              showCaptcha: false },
  running:         { color: "#3b82f6", label: "🤖 Automation running...",                   showCaptcha: false },
  waiting_captcha: { color: "#f59e0b", label: "⚠ Solve the captcha in the browser window", showCaptcha: true  },
  completed:       { color: "#22c55e", label: "✅ Submitted to Odex successfully!",          showCaptcha: false },
  failed:          { color: "#ef4444", label: "❌ Failed — check agent logs",                showCaptcha: false },
};

export default function OdexStatusPanel({ status, onCaptchaDone }) {
  const cfg = STATUS_MAP[status];
  if (!cfg) return null;
  return (
    <div className="odex-status-panel" style={{ borderLeft: `4px solid ${cfg.color}` }}>
      <span className="status-dot" style={{ background: cfg.color }} />
      <span>{cfg.label}</span>
      {cfg.showCaptcha && (
        <button className="btn-captcha" onClick={onCaptchaDone}>
          ✅ I've Solved the Captcha — Continue
        </button>
      )}
    </div>
  );
}