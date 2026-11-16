import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const add = useCallback((message, { type = "info", duration = 3800 } = {}) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  const toast = useCallback(
    (message, opts) => add(message, { type: "info", ...opts }),
    [add],
  );
  toast.success = (message, opts) => add(message, { type: "success", ...opts });
  toast.error = (message, opts) => add(message, { type: "error", ...opts });
  toast.warning = (message, opts) => add(message, { type: "warning", ...opts });

  return (
    <ToastContext.Provider value={{ toasts, toast, remove }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[10000] flex flex-col-reverse gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`
              pointer-events-auto px-5 py-3 rounded-lg shadow-elevated text-sm font-medium
              flex items-center gap-3 min-w-[280px] max-w-[420px]
              animate-[slideUp_0.25s_ease-out]
              ${t.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800" : ""}
              ${t.type === "error" ? "bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800" : ""}
              ${t.type === "warning" ? "bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800" : ""}
              ${t.type === "info" ? "bg-surface border border-custom shadow-card dark:bg-surface-raised text-ink" : ""}
            `}
          >
            <span className="text-lg shrink-0">
              {t.type === "success" && "\u2713"}
              {t.type === "error" && "\u2717"}
              {t.type === "warning" && "\u26A0"}
              {t.type === "info" && "\u2139"}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-ink-muted hover:text-ink shrink-0 text-base leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
