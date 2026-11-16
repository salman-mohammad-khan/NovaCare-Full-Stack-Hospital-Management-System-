import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import medVid from "../assets/med-vid.mp4";
import { formalFeatures, platformHighlights, roleCards } from "../data/siteData";
import { useAppContext } from "../context/useAppContext";
import { isUpcomingAppointment } from "../lib/appointments";
import { DoctorCard, MetricCard, SectionHeading } from "../components/Shared";
import Card from "../components/ui/Card";

export default function HomePage() {
  const { appointments, doctors, stats, users } = useAppContext();
  // The hero video is decorative: skip it on phones and for people who prefer reduced motion.
  const [showHeroVideo] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const featuredDoctors = useMemo(() => doctors.slice(0, 3), [doctors]);
  const patientCount = useMemo(() => stats?.patientCount ?? users.filter((u) => u.role === "patient").length, [stats, users]);
  const requestedCount = useMemo(() => stats?.requestedCount ?? appointments.filter((a) => a.status === "Requested").length, [stats, appointments]);
  const upcomingCount = useMemo(() => stats?.upcomingCount ?? appointments.filter(isUpcomingAppointment).length, [stats, appointments]);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section
        className="relative -mt-6 overflow-hidden ml-[calc(50%-50vw-var(--sidebar-w-half))] mr-[calc(50%-50vw+var(--sidebar-w-half))]"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-primary-900">
          {showHeroVideo ? (
            <video autoPlay className="w-full h-full object-cover opacity-50" loop muted playsInline preload="metadata">
              <source src={medVid} type="video/mp4" />
            </video>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/55 via-primary-800/45 to-slate-900/65" />
        </div>

        <div className="relative z-10 px-4 lg:pl-[calc(var(--sidebar-w)+3rem)] lg:pr-12 py-16 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wider text-primary-200 uppercase mb-3">
              Integrated patient care coordination
            </p>
            <h1 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              NovaCare brings appointments, triage, and doctor follow-up into one clear care operations workspace.
            </h1>
            <p className="text-base lg:text-lg text-slate-100 leading-relaxed mb-8 max-w-2xl">
              Patients raise care requests, admins coordinate the queue, and doctors close each visit with digital notes,
              prescriptions, and follow-up plans — all connected to a unified patient timeline.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/doctors" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow-lg">
                Browse specialists
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <Link to="/signin" className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors">
                Sign in to portal
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Specialists live" value={doctors.length} tone="teal" />
              <MetricCard label="Patients stored" value={patientCount} tone="gold" />
              <MetricCard label="Open requests" value={requestedCount} tone="coral" />
              <MetricCard label="Upcoming visits" value={upcomingCount} tone="navy" />
            </div>
          </div>

          <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-[380px]">
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Live triage flow</span>
              </div>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Patient request", desc: "Login and slot selection from doctor profile" },
                  { step: "2", title: "Admin review", desc: "Confirm, reschedule, or cancel with intake notes" },
                  { step: "3", title: "Doctor closure", desc: "Save notes, prescriptions, follow-up plans" },
                  { step: "R", title: "Patient timeline", desc: "Every visit preserved in medical history" },
                ].map((item) => (
                  <div key={item.step} className={`flex gap-3 p-3 rounded-lg ${item.step === "R" ? "bg-emerald-500/20 border border-emerald-400/30" : "bg-white/5"}`}>
                    <span className="w-7 h-7 rounded-full bg-primary-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0">{item.step}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Modules */}
      <section>
        <SectionHeading title="Platform modules" subtitle="Designed to support modern hospital coordination with clear patient, admin, and doctor workflows." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {platformHighlights.map((item) => (
            <Card key={item.title}>
              <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-ink mb-1">{item.title}</h3>
              <p className="text-xs text-ink-soft leading-relaxed">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Role-led care flow */}
      <section>
        <SectionHeading title="Role-led care flow" subtitle="Each workspace is tailored to the responsibilities of patients, administrators, and doctors." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleCards.map((card) => (
            <Card key={card.role}>
              <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 mb-3">
                {card.badge}
              </span>
              <h3 className="text-lg font-semibold text-ink mb-2">{card.role}</h3>
              <ul className="space-y-2 mb-4">
                {card.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2 text-sm text-ink-soft">
                    <svg className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {cap}
                  </li>
                ))}
              </ul>
              <Link to="/portal" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
                Open {card.role.toLowerCase()} portal &rarr;
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Professional features */}
      <section>
        <SectionHeading title="Professional care platform features" subtitle="NovaCare combines a polished healthcare presentation with practical care operations." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formalFeatures.map((item) => (
            <Card key={item.title}>
              <h3 className="text-sm font-semibold text-ink mb-1">{item.title}</h3>
              <p className="text-xs text-ink-soft leading-relaxed">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured Doctors */}
      <section>
        <SectionHeading title="Care desk lineup" subtitle="These specialists anchor the core booking and consultation flows in the demo." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredDoctors.map((doctor) => (
            <DoctorCard doctor={doctor} key={doctor.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
