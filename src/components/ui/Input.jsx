import { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { label, error, touched, className = "", ...props },
  ref,
) {
  const showError = error && touched;
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-4 py-2.5 text-sm rounded-lg border transition-all duration-150
          bg-surface dark:bg-surface-raised text-ink placeholder:text-ink-muted
          focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
          ${showError ? "border-red-400 dark:border-red-600 ring-2 ring-red-500/20" : "border-custom"}
          ${className}
        `}
        {...props}
      />
      {showError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, touched, children, className = "", ...props },
  ref,
) {
  const showError = error && touched;
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full px-4 py-2.5 text-sm rounded-lg border transition-all duration-150
          bg-surface dark:bg-surface-raised text-ink
          focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
          ${showError ? "border-red-400 dark:border-red-600 ring-2 ring-red-500/20" : "border-custom"}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {showError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, touched, className = "", ...props },
  ref,
) {
  const showError = error && touched;
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`
          w-full px-4 py-2.5 text-sm rounded-lg border transition-all duration-150 resize-y
          bg-surface dark:bg-surface-raised text-ink placeholder:text-ink-muted
          focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
          ${showError ? "border-red-400 dark:border-red-600 ring-2 ring-red-500/20" : "border-custom"}
          ${className}
        `}
        {...props}
      />
      {showError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});
