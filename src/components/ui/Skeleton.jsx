export default function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-surface dark:bg-surface-raised rounded-xl border border-custom dark:border-slate-700/60 p-5 space-y-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-surface dark:bg-surface-raised rounded-xl border border-custom dark:border-slate-700/60 p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
