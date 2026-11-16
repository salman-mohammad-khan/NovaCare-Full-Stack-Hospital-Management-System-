const toneMap = {
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  coral: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  gold: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  navy: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  primary: "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300",
};

const statusMap = {
  Requested: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Confirmed: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  Completed: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  Cancelled: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function Badge({ children, tone = "primary", size = "sm", className = "" }) {
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  const colorClass = toneMap[tone] || toneMap.primary;

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${colorClass} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = "" }) {
  const normalized = (status || "").toLowerCase();
  const label = { requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" }[normalized] || status;
  const colorClass = statusMap[label] || statusMap.Requested;
  const dotColor = {
    Requested: "bg-amber-500",
    Confirmed: "bg-teal-500",
    Completed: "bg-indigo-500",
    Cancelled: "bg-red-500",
  }[label] || "bg-gray-500";

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full px-2.5 py-0.5 text-xs ${colorClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
