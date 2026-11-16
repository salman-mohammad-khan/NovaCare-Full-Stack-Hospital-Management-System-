import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/appointments";
import Badge from "./ui/Badge";
import Card from "./ui/Card";

export function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-xs font-semibold tracking-wider text-primary-600 dark:text-primary-400 uppercase mb-1">{eyebrow}</p>}
      {title && <h2 className="text-2xl lg:text-3xl font-bold text-ink mb-2">{title}</h2>}
      {subtitle && <p className="text-ink-soft text-sm max-w-2xl">{subtitle}</p>}
    </div>
  );
}

export function MetricCard({ label, value, tone = "default", trend }) {
  const borderClass = {
    teal: "border-l-accent-500",
    coral: "border-l-sky-500",
    gold: "border-l-amber-500",
    navy: "border-l-indigo-500",
    default: "border-l-primary-500",
  }[tone] || "border-l-primary-500";

  return (
    <article className={`bg-surface dark:bg-surface-raised rounded-xl border border-custom dark:border-slate-700/60 p-4 border-l-4 ${borderClass}`}>
      <span className="text-xs text-ink-muted font-medium">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <strong className="text-2xl font-bold text-ink">{value}</strong>
        {trend && (
          <span className={`text-xs font-medium ${trend > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </article>
  );
}

export function SummaryCard({ label, value, helper }) {
  return (
    <Card>
      <span className="text-xs text-ink-muted font-medium">{label}</span>
      <strong className="block text-xl font-bold text-ink mt-1">{value}</strong>
      {helper && <p className="text-xs text-ink-muted mt-1">{helper}</p>}
    </Card>
  );
}

export function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-custom dark:border-slate-700/60 last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <strong className="text-sm text-ink text-right max-w-[60%]">{value}</strong>
    </div>
  );
}

export function AvatarBadge({ label, tone = "teal", size = "medium" }) {
  const sizeClass = size === "large" ? "w-16 h-16 text-xl" : size === "small" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  const colorClass = {
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    coral: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    gold: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    navy: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  }[tone] || "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300";

  return (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {label}
    </div>
  );
}

export function DoctorIdentity({ doctor, size = "medium" }) {
  if (doctor.photo) {
    const sizeClass = size === "large" ? "w-16 h-16" : "w-10 h-10";
    return (
      <img
        className={`${sizeClass} rounded-full object-cover shrink-0`}
        src={doctor.photo}
        alt={`${doctor.name}`}
        loading="lazy"
      />
    );
  }
  return <AvatarBadge label={doctor.avatarLabel} tone={doctor.tone} size={size} />;
}

export function DoctorCard({ doctor }) {
  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <DoctorIdentity doctor={doctor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={doctor.tone}>{doctor.specialty}</Badge>
            {doctor.isAvailable === false && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
                <span className="w-1 h-1 rounded-full bg-red-500" />
                Unavailable
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-ink mt-1 truncate">{doctor.name}</h3>
          <p className="text-xs text-ink-muted">{doctor.clinic}</p>
        </div>
      </div>

      <p className="text-sm text-ink-soft mb-3 line-clamp-2 flex-1">{doctor.intro}</p>

      <div className="flex items-center gap-3 text-xs text-ink-muted mb-3">
        <span>{doctor.experience}</span>
        <span className="w-1 h-1 rounded-full bg-ink-muted" />
        <span className="truncate">{doctor.location}</span>
        <span className="w-1 h-1 rounded-full bg-ink-muted" />
        <span>{formatCurrency(doctor.fee)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {doctor.focusAreas.slice(0, 3).map((area) => (
          <span key={area} className="px-2 py-0.5 text-xs rounded-full bg-surface-alt dark:bg-slate-800 text-ink-soft border border-custom dark:border-slate-700/60">
            {area}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-custom dark:border-slate-700/60">
        <span className="text-xs text-ink-muted">Next: {doctor.nextAvailable}</span>
        <Link
          to={`/doctors/${doctor.id}`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
        >
          View profile &rarr;
        </Link>
      </div>
    </Card>
  );
}

export function EmptyState({ action, description, title }) {
  return (
    <Card className="text-center py-12">
      <div className="text-4xl mb-3">&#128203;</div>
      <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-soft mb-4">{description}</p>
      {action}
    </Card>
  );
}
