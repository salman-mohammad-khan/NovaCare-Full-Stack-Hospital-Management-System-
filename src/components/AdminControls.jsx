import { useState } from "react";
import { SectionHeading } from "./Shared";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import { formatFriendlyDateTime } from "../lib/appointments";

const DOCTOR_FORM_TEMPLATE = {
  doctorId: "", name: "", specialty: "", clinic: "", experience: "", fee: "", location: "",
  languages: "", focusAreas: "", credentials: "", intro: "", about: "", tone: "teal",
  email: "", phone: "", availabilityDate: "2026-03-30",
};

function createDoctorFormState(doctor, users) {
  if (!doctor) return DOCTOR_FORM_TEMPLATE;
  const linkedUser = users.find((user) => user.linkedDoctorId === doctor.id);
  return {
    doctorId: doctor.id, name: doctor.name, specialty: doctor.specialty, clinic: doctor.clinic,
    experience: doctor.experience, fee: String(doctor.fee), location: doctor.location,
    languages: Array.isArray(doctor.languages) ? doctor.languages.join(", ") : "",
    focusAreas: Array.isArray(doctor.focusAreas) ? doctor.focusAreas.join(", ") : "",
    credentials: doctor.credentials, intro: doctor.intro, about: doctor.about, tone: doctor.tone,
    email: linkedUser?.email ?? "", phone: linkedUser?.phone ?? "",
    availabilityDate: doctor.schedule?.[0]?.date ?? DOCTOR_FORM_TEMPLATE.availabilityDate,
  };
}

function ContactMessageCard({ message }) {
  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <Badge tone="primary">{message.category}</Badge>
          <h4 className="text-sm font-semibold text-ink mt-1.5">{message.subject}</h4>
          <p className="text-xs text-ink-soft">{message.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-ink-muted">
          <span className="capitalize">{message.submittedByRole}</span>
          <span>{formatFriendlyDateTime(message.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-ink-muted mb-2">
        <span>{message.email}</span>
        {message.phone && <span>{message.phone}</span>}
      </div>
      <p className="text-sm text-ink-soft">{message.message}</p>
    </Card>
  );
}

export function DoctorManagementPanel({ doctors, saveDoctorProfile, users }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState("new");
  const [form, setForm] = useState(DOCTOR_FORM_TEMPLATE);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleDoctorSelection = (event) => {
    const doctorId = event.target.value;
    setSelectedDoctorId(doctorId);
    setFeedback(""); setError("");
    if (doctorId === "new") { setForm(DOCTOR_FORM_TEMPLATE); return; }
    const doctor = doctors.find((item) => item.id === doctorId);
    setForm(createDoctorFormState(doctor, users));
  };

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(""); setError(""); setIsSaving(true);
    const result = await saveDoctorProfile(form);
    if (!result.ok) { setError(result.error); setIsSaving(false); return; }
    setFeedback(result.message);
    if (!form.doctorId) { setSelectedDoctorId("new"); setForm(DOCTOR_FORM_TEMPLATE); }
    setIsSaving(false);
  };

  return (
    <Card padding={false}>
      <div className="p-5">
        <SectionHeading eyebrow="Admin controls" title="Manage specialist profiles" subtitle="Add or update doctor profiles, fees, and portal-linked details." />
        <div className="mb-4">
          <label className="block text-xs font-medium text-ink-muted mb-1">Choose profile</label>
          <select value={selectedDoctorId} onChange={handleDoctorSelection} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
            <option value="new">Add new doctor</option>
            {doctors.map((doctor) => (<option key={doctor.id} value={doctor.id}>{doctor.name}</option>))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["name", "specialty", "clinic", "experience"].map((f) => (
              <div key={f}>
                <label className="block text-xs font-medium text-ink-muted mb-1 capitalize">{f}</label>
                <input value={form[f]} onChange={updateField(f)} placeholder={f === "experience" ? "e.g. 12 years" : ""}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            ))}
            {["fee", "location", "email", "phone"].map((f) => (
              <div key={f}>
                <label className="block text-xs font-medium text-ink-muted mb-1 capitalize">{f === "email" ? "Doctor email" : f === "phone" ? "Doctor phone" : f}</label>
                <input type={f === "fee" ? "number" : f === "email" ? "email" : "text"} min={f === "fee" ? 1 : undefined} value={form[f]} onChange={updateField(f)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Availability date</label>
              <input type="date" value={form.availabilityDate} onChange={updateField("availabilityDate")}
                className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Color tone</label>
              <select value={form.tone} onChange={updateField("tone")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                <option value="teal">Teal</option>
                <option value="coral">Coral</option>
                <option value="gold">Gold</option>
                <option value="navy">Navy</option>
              </select>
            </div>
            {["languages", "focusAreas", "credentials"].map((f) => (
              <div key={f} className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-muted mb-1 capitalize">{f === "focusAreas" ? "Focus areas" : f}</label>
                <input value={form[f]} onChange={updateField(f)} placeholder={f === "languages" ? "English, Hindi" : f === "focusAreas" ? "Migraine, Sleep review" : ""}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Short intro</label>
            <textarea rows={2} value={form.intro} onChange={updateField("intro")}
              className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">About</label>
            <textarea rows={3} value={form.about} onChange={updateField("about")}
              className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {feedback && <p className="text-sm text-accent-600 dark:text-accent-400">{feedback}</p>}

          <Button type="submit" loading={isSaving} className="w-full">
            {isSaving ? "Saving profile..." : "Save doctor profile"}
          </Button>
        </form>
        <p className="text-xs text-ink-muted mt-3">
          New doctor accounts use default password <code className="bg-surface-alt dark:bg-slate-800 px-1 rounded">Doctor@123</code>.
        </p>
      </div>
    </Card>
  );
}

export function ContactInbox({ contactMessages }) {
  if (!contactMessages.length) {
    return (
      <Card>
        <SectionHeading eyebrow="Support inbox" title="No patient messages yet" subtitle="Questions submitted from the contact page will appear here." />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      <div className="p-5 border-b border-custom dark:border-slate-700/60">
        <SectionHeading eyebrow="Support inbox" title="Patient questions and feedback" subtitle="Review patient concerns, service doubts, and support requests." />
      </div>
      <div className="p-5 max-h-[600px] overflow-y-auto space-y-0">
        {contactMessages.map((message) => (
          <ContactMessageCard key={message.id} message={message} />
        ))}
      </div>
    </Card>
  );
}

export function DoctorAvailabilityPanel({ doctors, toggleDoctorAvailability }) {
  const [feedback, setFeedback] = useState("");
  const [togglingId, setTogglingId] = useState("");

  const availableCount = doctors.filter((d) => d.isAvailable !== false).length;

  const handleToggle = async (doctor, isAvailable) => {
    setTogglingId(doctor.id);
    setFeedback("");
    const result = await toggleDoctorAvailability(doctor.id, isAvailable);
    if (!result.ok) {
      setFeedback(result.error);
    } else {
      setFeedback(result.message);
    }
    setTogglingId("");
  };

  return (
    <Card padding={false}>
      <div className="p-5 border-b border-custom dark:border-slate-700/60">
        <SectionHeading
          eyebrow="Availability control"
          title="Manage specialist availability"
          subtitle="Toggle which doctors are accepting new appointments. Unavailable doctors stay visible but cannot receive new bookings."
        />
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {availableCount} available
          </span>
          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
            {doctors.length - availableCount} unavailable
          </span>
        </div>
      </div>
      <div className="p-5 max-h-[600px] overflow-y-auto">
        {feedback && <p className="text-sm text-accent-600 dark:text-accent-400 mb-3">{feedback}</p>}
        <div className="space-y-3">
          {doctors.map((doctor) => {
            const isAvailable = doctor.isAvailable !== false;
            return (
              <div
                key={doctor.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isAvailable
                    ? "bg-surface-alt dark:bg-slate-800 border-custom dark:border-slate-700/60"
                    : "bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-800/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{doctor.name}</p>
                  <p className="text-xs text-ink-muted truncate">{doctor.specialty} &middot; {doctor.clinic}</p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    isAvailable
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  }`}
                >
                  {isAvailable ? "Available" : "Unavailable"}
                </span>
                <button
                  type="button"
                  disabled={togglingId === doctor.id}
                  onClick={() => handleToggle(doctor, !isAvailable)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    isAvailable
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {togglingId === doctor.id ? "Updating..." : isAvailable ? "Set unavailable" : "Set available"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
