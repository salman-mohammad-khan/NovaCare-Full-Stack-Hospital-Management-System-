export default function Card({
  children,
  className = "",
  hover = false,
  padding = true,
  ...props
}) {
  return (
    <div
      className={`
        bg-surface rounded-xl border border-custom
        ${padding ? "p-5" : ""}
        ${hover ? "transition-all duration-200 hover:shadow-panel hover:-translate-y-0.5 cursor-pointer" : "shadow-card"}
        dark:bg-surface-raised dark:border-slate-700/60
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCard({ children, className = "", ...props }) {
  return (
    <div
      className={`
        bg-surface-glass rounded-xl border border-white/20
        shadow-panel
        dark:bg-slate-900/80 dark:border-slate-700/30
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
