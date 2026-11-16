import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { DetailRow, DoctorIdentity, SectionHeading } from "../components/Shared";
import Badge, { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAppContext } from "../context/useAppContext";
import { formatCurrency } from "../lib/appointments";
import { useToast } from "../context/ToastContext";
import NotFoundPage from "./NotFoundPage";

export default function DoctorDetailPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const aiPrefill = location.state?.aiPrefill ?? null;
  const { bookAppointment, currentUser, doctors, isHydrating } = useAppContext();
  const toast = useToast();
  const doctor = doctors.find((item) => item.id === doctorId);

  const defaultSchedule = doctor?.schedule?.[0];
  const [form, setForm] = useState(() => ({
    selectedDate: defaultSchedule?.date ?? "",
    selectedSlot: defaultSchedule?.slots?.[0] ?? "",
    consultationMode: aiPrefill?.consultMode ?? "In-clinic",
    priority: aiPrefill?.priority ?? "Routine",
    phone: currentUser?.phone ?? "",
    reason: aiPrefill?.reason ?? "",
    symptoms: aiPrefill?.symptoms ?? "",
  }));
  const [showPrefillBanner, setShowPrefillBanner] = useState(!!aiPrefill);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!doctor) {
    return isHydrating ? <p className="py-16 text-center text-sm text-ink-soft">Loading specialist...</p> : <NotFoundPage />;
  }

  const activeSchedule =
    doctor.schedule.find((slot) => slot.date === form.selectedDate) ?? doctor.schedule[0];

  const updateField = (field) => (event) => {
    const value = event.target.value;
    if (field === "selectedDate") {
      const nextSchedule = doctor.schedule.find((slot) => slot.date === value) ?? doctor.schedule[0];
      setForm((current) => ({ ...current, selectedDate: value, selectedSlot: nextSchedule?.slots?.[0] ?? "" }));
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    // If the page was opened directly (reload or shared link) the form may still hold empty
    // date/slot values from before the doctor list loaded, so fall back to the shown schedule.
    const result = await bookAppointment({
      doctorId: doctor.id,
      ...form,
      selectedDate: form.selectedDate || activeSchedule?.date || "",
      selectedSlot: form.selectedSlot || activeSchedule?.slots?.[0] || "",
    });
    if (!result.ok) { setError(result.error); setIsSubmitting(false); return; }
    toast.success(`Request ${result.appointment.id} sent to the admin triage board.`);
    setTimeout(() => navigate("/portal"), 800);
    setIsSubmitting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
      {/* Profile Column */}
      <Card padding={false}>
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <DoctorIdentity doctor={doctor} size="large" />
            <div className="min-w-0">
              <Badge tone={doctor.tone}>{doctor.specialty}</Badge>
              <h1 className="text-xl font-bold text-ink mt-1">{doctor.name}</h1>
              <p className="text-sm text-ink-soft mt-2">{doctor.about}</p>
            </div>
          </div>

          <div className="space-y-0">
            <DetailRow label="Clinic" value={doctor.clinic} />
            <DetailRow label="Experience" value={doctor.experience} />
            <DetailRow label="Fee" value={formatCurrency(doctor.fee)} />
            <DetailRow label="Languages" value={doctor.languages.join(", ")} />
            <DetailRow label="Credentials" value={doctor.credentials} />
            <DetailRow label="Location" value={doctor.location} />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink mb-2">Care focus</h3>
            <div className="flex flex-wrap gap-1.5">
              {doctor.focusAreas.map((focus) => (
                <span key={focus} className="px-2.5 py-1 text-xs rounded-full bg-surface-alt dark:bg-slate-800 text-ink-soft border border-custom dark:border-slate-700/60">
                  {focus}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Available slots</h3>
            <div className="space-y-2">
              {doctor.schedule.map((slot) => (
                <div key={slot.date} className="flex items-center justify-between p-3 rounded-lg bg-surface-alt dark:bg-slate-800 border border-custom dark:border-slate-700/60">
                  <span className="text-sm font-medium text-ink">{slot.label}</span>
                  <div className="flex gap-1.5">
                    {slot.slots.slice(0, 3).map((time) => (
                      <span key={time} className="px-2 py-0.5 text-xs rounded bg-surface dark:bg-slate-700 text-ink-muted border border-custom dark:border-slate-600">{time}</span>
                    ))}
                    {slot.slots.length > 3 && <span className="px-2 py-0.5 text-xs rounded bg-surface dark:bg-slate-700 text-ink-muted">+{slot.slots.length - 3}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Booking Column */}
      <Card>
        <h2 className="text-lg font-semibold text-ink mb-1">Request care slot</h2>
        <p className="text-sm text-ink-soft mb-4">This version uses a triage request flow — admin reviews before the doctor workspace sees the visit.</p>

        {showPrefillBanner && (
          <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-sm text-primary-700 dark:text-primary-300">
            <span className="text-lg shrink-0">&#10033;</span>
            <span className="flex-1">Form pre-filled by Health Assistant based on your symptoms.</span>
            <button onClick={() => setShowPrefillBanner(false)} className="text-primary-400 hover:text-primary-600 shrink-0">&times;</button>
          </div>
        )}

        {doctor.isAvailable === false ? (
          <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <h3 className="font-semibold text-red-700 dark:text-red-300 mb-1">Temporarily unavailable</h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              This specialist is not accepting new appointments right now. Please check back later or choose another specialist.
            </p>
            <Link
              to="/doctors"
              className="inline-block mt-4 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Browse other specialists
            </Link>
          </div>
        ) : currentUser?.role !== "patient" ? (
          <div className="text-center p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Patient sign-in required</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">Only patient accounts can send care requests. Sign in or register first.</p>
            <Link to="/signin" className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
              Go to patient access
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Date</label>
                <select value={form.selectedDate} onChange={updateField("selectedDate")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                  {doctor.schedule.map((slot) => (
                    <option key={slot.date} value={slot.date}>{slot.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Slot</label>
                <select value={form.selectedSlot} onChange={updateField("selectedSlot")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                  {activeSchedule.slots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Mode</label>
                <select value={form.consultationMode} onChange={updateField("consultationMode")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                  <option>In-clinic</option>
                  <option>Tele-consult</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Priority</label>
                <select value={form.priority} onChange={updateField("priority")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                  <option>Routine</option>
                  <option>Priority</option>
                  <option>Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Contact number</label>
              <input type="tel" value={form.phone} onChange={updateField("phone")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Enter reachable mobile number" />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Visit reason</label>
              <input type="text" value={form.reason} onChange={updateField("reason")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Short title for the appointment request" />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Symptoms or background</label>
              <textarea rows={4} value={form.symptoms} onChange={updateField("symptoms")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" placeholder="Mention symptoms, history, or follow-up context." />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <Button type="submit" loading={isSubmitting} className="w-full">
              {isSubmitting ? "Sending request..." : "Send care request"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
