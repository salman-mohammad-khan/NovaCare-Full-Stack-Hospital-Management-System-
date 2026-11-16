import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { DoctorCard, SectionHeading } from "../components/Shared";
import { useAppContext } from "../context/useAppContext";

export default function DoctorsPage() {
  const { doctors } = useAppContext();
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All specialties");
  const [availableOnly, setAvailableOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const specialties = useMemo(
    () => ["All specialties", ...new Set(doctors.map((d) => d.specialty))],
    [doctors],
  );

  const availableCount = useMemo(
    () => doctors.filter((d) => d.isAvailable !== false).length,
    [doctors],
  );

  const filteredDoctors = useMemo(
    () =>
      doctors.filter((doctor) => {
        const matchesQuery =
          !normalizedQuery ||
          doctor.name.toLowerCase().includes(normalizedQuery) ||
          doctor.specialty.toLowerCase().includes(normalizedQuery) ||
          doctor.location.toLowerCase().includes(normalizedQuery) ||
          doctor.focusAreas.some((area) => area.toLowerCase().includes(normalizedQuery));
        const matchesSpecialty =
          specialtyFilter === "All specialties" || doctor.specialty === specialtyFilter;
        const matchesAvailability = !availableOnly || doctor.isAvailable !== false;
        return matchesQuery && matchesSpecialty && matchesAvailability;
      }),
    [doctors, normalizedQuery, specialtyFilter, availableOnly],
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Find the right specialist"
        subtitle="Search by specialty, city, or symptom focus area and move straight into the care request flow."
      />

      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-surface dark:bg-surface-raised rounded-xl border border-custom dark:border-slate-700/60">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-muted mb-1">Search</label>
          <input
            type="search"
            className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            placeholder="Search migraine, rehab, cardiology, New Delhi..."
            value={query}
            onChange={(e) => startTransition(() => setQuery(e.target.value))}
          />
        </div>
        <div className="sm:w-56">
          <label className="block text-xs font-medium text-ink-muted mb-1">Specialty</label>
          <select
            className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
          >
            {specialties.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={availableOnly}
            onClick={() => setAvailableOnly((prev) => !prev)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
              availableOnly ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                availableOnly ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span className="text-sm font-medium text-ink">
            Show available doctors only
          </span>
        </label>
        <span className="text-xs text-ink-muted">
          {availableCount} of {doctors.length} specialists currently available
        </span>
      </div>

      <p className="text-sm text-ink-muted">{filteredDoctors.length} specialist{filteredDoctors.length !== 1 ? "s" : ""} found</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((doctor) => (
          <DoctorCard doctor={doctor} key={doctor.id} />
        ))}
      </div>
    </div>
  );
}
