import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, SectionHeading, SummaryCard } from "../components/Shared";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAppContext } from "../context/useAppContext";
import {
  formatCurrency,
  formatFriendlyDate,
  formatFriendlyDateTime,
  isUpcomingAppointment,
  sortAppointmentsNewestFirst,
} from "../lib/appointments";

const STATUS_OPTIONS = ["All", "Requested", "Confirmed", "Completed", "Cancelled"];

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function filterAppointments(appointments, searchTerm, statusFilter) {
  const normalizedQuery = searchTerm.trim().toLowerCase();
  return appointments.filter((appointment) => {
    const matchesStatus = statusFilter === "All" || appointment.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      safeText(appointment.patientName).toLowerCase().includes(normalizedQuery) ||
      safeText(appointment.patientEmail).toLowerCase().includes(normalizedQuery) ||
      safeText(appointment.phone).toLowerCase().includes(normalizedQuery) ||
      safeText(appointment.reason).toLowerCase().includes(normalizedQuery) ||
      safeText(appointment.symptoms).toLowerCase().includes(normalizedQuery) ||
      safeText(appointment.doctorName).toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
}

function PortalToolbar({ label, placeholder, searchValue, statusValue, onSearchChange, onStatusChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-surface dark:bg-surface-raised rounded-xl border border-custom dark:border-slate-700/60">
      <div className="flex-1">
        <label className="block text-xs font-medium text-ink-muted mb-1">{label}</label>
        <input
          type="search"
          value={searchValue}
          onChange={onSearchChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>
      <div className="sm:w-40">
        <label className="block text-xs font-medium text-ink-muted mb-1">Status</label>
        <select
          value={statusValue}
          onChange={onStatusChange}
          className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AdminAppointmentCard({ appointment, doctor, onSave }) {
  const schedule = doctor?.schedule ?? [];
  const defaultDate = schedule.some((slot) => slot.date === appointment.appointmentDate)
    ? appointment.appointmentDate
    : schedule[0]?.date ?? appointment.appointmentDate;
  const [form, setForm] = useState({
    appointmentDate: defaultDate,
    appointmentSlot: schedule.some((slot) => slot.date === appointment.appointmentDate)
      ? appointment.appointmentSlot
      : schedule[0]?.slots?.[0] ?? appointment.appointmentSlot,
    consultationMode: appointment.consultationMode,
    adminSummary: appointment.adminSummary,
  });
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const activeSchedule = schedule.find((slot) => slot.date === form.appointmentDate) ?? schedule[0];
  const canEditDetails = ["Requested", "Confirmed"].includes(appointment.status);
  const canConfirm = appointment.status === "Requested";
  const canCancel = appointment.status === "Requested" || appointment.status === "Confirmed";

  const updateField = (field) => (event) => {
    const value = event.target.value;
    if (field === "appointmentDate") {
      const nextSchedule = schedule.find((slot) => slot.date === value) ?? schedule[0];
      setForm((current) => ({ ...current, appointmentDate: value, appointmentSlot: nextSchedule?.slots?.[0] ?? "" }));
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitChange = async (status, successMessage) => {
    setIsSaving(true);
    const result = await onSave({ appointmentId: appointment.id, status, ...form });
    setFeedback(result.ok ? successMessage : result.error);
    setIsSaving(false);
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <StatusBadge status={appointment.status} />
          <h3 className="text-base font-semibold text-ink mt-1.5">{appointment.patientName}</h3>
          <p className="text-sm text-ink-soft">{appointment.doctorName} &middot; {appointment.specialty}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">{appointment.priority}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{appointment.consultationMode}</span>
        </div>
      </div>

      {doctor?.isAvailable === false && (
        <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <span className="shrink-0">&#9888;</span>
          <span>This doctor is currently marked unavailable for new bookings. Existing appointments remain active — coordinate with the care desk if a change is needed.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div><strong className="text-xs text-ink-muted">Patient contact</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.patientEmail}</p><p className="text-ink-soft text-xs">{appointment.phone}</p></div>
        <div><strong className="text-xs text-ink-muted">Visit window</strong><p className="text-ink-soft text-xs mt-0.5">{formatFriendlyDate(appointment.appointmentDate)}</p><p className="text-ink-soft text-xs">{appointment.appointmentSlot}</p></div>
        <div><strong className="text-xs text-ink-muted">Reason</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.reason}</p></div>
        <div><strong className="text-xs text-ink-muted">Symptoms</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.symptoms}</p></div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Date</label>
          <select disabled={!canEditDetails} value={form.appointmentDate} onChange={updateField("appointmentDate")}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
            {schedule.map((slot) => (<option key={slot.date} value={slot.date}>{slot.label}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Slot</label>
          <select disabled={!canEditDetails} value={form.appointmentSlot} onChange={updateField("appointmentSlot")}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
            {activeSchedule?.slots?.map((slot) => (<option key={slot} value={slot}>{slot}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Mode</label>
          <select disabled={!canEditDetails} value={form.consultationMode} onChange={updateField("consultationMode")}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
            <option>In-clinic</option>
            <option>Tele-consult</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-ink-muted mb-1">Admin intake note</label>
        <textarea disabled={!canEditDetails} rows={3} value={form.adminSummary} onChange={updateField("adminSummary")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" />
      </div>

      {feedback && <p className="text-sm mb-3 text-accent-600 dark:text-accent-400">{feedback}</p>}

      <div className="flex flex-wrap gap-2">
        {canEditDetails && (
          <Button variant="secondary" size="sm" loading={isSaving} onClick={() => submitChange(appointment.status, "Changes saved.")}>
            Save changes
          </Button>
        )}
        {canConfirm && (
          <Button size="sm" loading={isSaving} onClick={() => submitChange("Confirmed", "Slot confirmed.")}>
            Confirm slot
          </Button>
        )}
        {canCancel && (
          <Button variant="secondary" size="sm" loading={isSaving} onClick={() => submitChange("Cancelled", "Cancelled.")}>
            Cancel request
          </Button>
        )}
        {!canConfirm && !canCancel && (
          <p className="text-xs text-ink-muted">
            {appointment.status === "Completed" ? "Completed visits can no longer be edited." : "Not editable from admin triage."}
          </p>
        )}
      </div>
    </Card>
  );
}

function DoctorAppointmentCard({ appointment, doctorFee, doctorAvailable = true, onUpdate }) {
  const [doctorSummary, setDoctorSummary] = useState(appointment.doctorSummary);
  const [prescriptionItems, setPrescriptionItems] = useState(appointment.prescription.join(", "));
  const [followUpDate, setFollowUpDate] = useState(appointment.followUpDate);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canConfirm = appointment.status === "Requested";
  const canComplete = appointment.status === "Confirmed";
  const fieldsDisabled = !canComplete;

  const handleDoctorAction = async (status) => {
    setIsSaving(true);
    const result = await onUpdate(
      status === "Confirmed"
        ? { appointmentId: appointment.id, status }
        : { appointmentId: appointment.id, doctorSummary, followUpDate, prescriptionItems, status },
    );
    setFeedback(result.ok ? (status === "Confirmed" ? "Appointment confirmed." : "Consultation saved to patient history.") : result.error);
    setIsSaving(false);
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <StatusBadge status={appointment.status} />
          <h3 className="text-base font-semibold text-ink mt-1.5">{appointment.patientName}</h3>
          <p className="text-sm text-ink-soft">{formatFriendlyDate(appointment.appointmentDate)} at {appointment.appointmentSlot}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">{appointment.priority}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{appointment.consultationMode}</span>
        </div>
      </div>

      {!doctorAvailable && (
        <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <span className="shrink-0">&#9888;</span>
          <span>Your availability is currently marked OFF by the admin. Existing appointments stay active, but no new bookings will arrive.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div><strong className="text-xs text-ink-muted">Patient contact</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.patientEmail}</p><p className="text-ink-soft text-xs">{appointment.phone}</p></div>
        <div><strong className="text-xs text-ink-muted">Fee</strong><p className="text-ink-soft text-xs mt-0.5">{formatCurrency(doctorFee)}</p></div>
        <div><strong className="text-xs text-ink-muted">Patient reason</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.reason}</p></div>
        <div><strong className="text-xs text-ink-muted">Intake note</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.adminSummary || "No admin note yet."}</p></div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-ink-muted mb-1">Consultation summary</label>
        <textarea disabled={fieldsDisabled} rows={3} value={doctorSummary} onChange={(e) => setDoctorSummary(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Prescription items</label>
          <input disabled={fieldsDisabled} type="text" value={prescriptionItems} onChange={(e) => setPrescriptionItems(e.target.value)} placeholder="Comma-separated medicines or advice"
            className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Follow-up date</label>
          <input disabled={fieldsDisabled} type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
        </div>
      </div>

      {feedback && <p className="text-sm mb-3 text-accent-600 dark:text-accent-400">{feedback}</p>}

      <div className="flex flex-wrap gap-2">
        {canConfirm && (<Button size="sm" loading={isSaving} onClick={() => handleDoctorAction("Confirmed")}>Confirm request</Button>)}
        {canComplete && (<Button size="sm" loading={isSaving} onClick={() => handleDoctorAction("Completed")}>Mark completed</Button>)}
        {!canConfirm && !canComplete && (
          <p className="text-xs text-ink-muted">{appointment.status === "Completed" ? "Already completed." : "Only admin can cancel."}</p>
        )}
      </div>
    </Card>
  );
}

function PatientHistoryCard({ appointment, doctorFee, doctorAvailable = true }) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <StatusBadge status={appointment.status} />
          <h3 className="text-base font-semibold text-ink mt-1.5">{appointment.doctorName}</h3>
          <p className="text-sm text-ink-soft">{appointment.specialty}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{appointment.consultationMode}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">{appointment.priority}</span>
        </div>
      </div>

      {!doctorAvailable && ["Requested", "Confirmed"].includes(appointment.status) && (
        <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <span className="shrink-0">&#9888;</span>
          <span>This doctor is currently not accepting new appointments. Your existing request stays active — the care desk may reach out if your visit needs rescheduling.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div><strong className="text-xs text-ink-muted">Visit window</strong><p className="text-ink-soft text-xs mt-0.5">{formatFriendlyDate(appointment.appointmentDate)} at {appointment.appointmentSlot}</p></div>
        <div><strong className="text-xs text-ink-muted">Fee</strong><p className="text-ink-soft text-xs mt-0.5">{formatCurrency(doctorFee)}</p></div>
        <div><strong className="text-xs text-ink-muted">Reason</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.reason}</p></div>
        <div><strong className="text-xs text-ink-muted">Doctor</strong><p className="text-ink-soft text-xs mt-0.5">{appointment.doctorName}</p><p className="text-ink-soft text-xs">{appointment.specialty}</p></div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <strong className="text-xs text-ink-muted">Triage note</strong>
          <p className="text-sm text-ink-soft mt-0.5">{appointment.adminSummary || "Pending admin review."}</p>
        </div>
        <div>
          <strong className="text-xs text-ink-muted">Doctor note</strong>
          <p className="text-sm text-ink-soft mt-0.5">{appointment.doctorSummary || "This visit has not been completed yet."}</p>
        </div>
      </div>

      {appointment.prescription.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {appointment.prescription.map((item) => (
            <span key={item} className="px-2.5 py-0.5 text-xs rounded-full bg-accent-50 text-accent-700 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 border border-accent-200">{item}</span>
          ))}
        </div>
      )}

      {appointment.followUpDate && (
        <p className="text-xs text-ink-muted">Follow-up: {formatFriendlyDate(appointment.followUpDate)}</p>
      )}
    </Card>
  );
}

function AdminPortal({ appointments, contactMessages, doctors, onSave }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const deferredSearch = useDeferredValue(searchTerm);
  const filteredAppointments = useMemo(
    () => filterAppointments(sortAppointmentsNewestFirst(appointments), deferredSearch, statusFilter),
    [appointments, deferredSearch, statusFilter],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Doctors onboarded" value={doctors.length} helper="Active specialists" />
        <SummaryCard label="Requested queue" value={appointments.filter((i) => i.status === "Requested").length} helper="Needs triage" />
        <SummaryCard label="Confirmed visits" value={appointments.filter((i) => i.status === "Confirmed").length} helper="Ready for doctor" />
        <SummaryCard label="Support inbox" value={contactMessages.length} helper="Patient messages" />
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-ink mb-1">Admin controls</h3>
        <p className="text-sm text-ink-soft mb-3">Manage specialist profiles and review patient messages.</p>
        <Link to="/portal/admin-controls" className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          Open admin controls
        </Link>
      </Card>

      <PortalToolbar
        label="Search patient requests"
        placeholder="Search by patient name, email, phone, reason, or doctor..."
        searchValue={searchTerm}
        statusValue={statusFilter}
        onSearchChange={(e) => startTransition(() => setSearchTerm(e.target.value))}
        onStatusChange={(e) => setStatusFilter(e.target.value)}
      />

      {filteredAppointments.length ? (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <AdminAppointmentCard
              key={appointment.id}
              appointment={appointment}
              doctor={doctors.find((d) => d.id === appointment.doctorId)}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching requests" description="Try a different search or status filter." />
      )}
    </div>
  );
}

function DoctorPortal({ appointments, doctors, onUpdate, currentUser }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const deferredSearch = useDeferredValue(searchTerm);
  const filteredAppointments = useMemo(
    () => filterAppointments(sortAppointmentsNewestFirst(appointments), deferredSearch, statusFilter),
    [appointments, deferredSearch, statusFilter],
  );
  const doctorProfile = doctors.find((d) => d.id === currentUser.linkedDoctorId);
  const doctorFee = doctorProfile?.fee ?? 0;
  const doctorAvailable = doctorProfile?.isAvailable !== false;
  const upcomingRevenue = appointments.filter((a) => a.status === "Confirmed" && isUpcomingAppointment(a)).reduce((t) => t + doctorFee, 0);
  const totalEarned = appointments.filter((a) => a.status === "Completed").reduce((t) => t + doctorFee, 0);

  if (!appointments.length) {
    return <EmptyState title="No assigned appointments" description="Confirmed appointments for this doctor will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Assigned queue" value={appointments.length} helper="Visible for this doctor" />
        <SummaryCard label="Upcoming visits" value={appointments.filter(isUpcomingAppointment).length} helper="Still ahead on calendar" />
        <SummaryCard label="Upcoming revenue" value={formatCurrency(upcomingRevenue)} helper="Expected from confirmed" />
        <SummaryCard label="Total earned" value={formatCurrency(totalEarned)} helper="Completed consultations" />
      </div>

      <PortalToolbar
        label="Search patient details"
        placeholder="Search by patient name, email, phone, reason, or symptoms..."
        searchValue={searchTerm}
        statusValue={statusFilter}
        onSearchChange={(e) => startTransition(() => setSearchTerm(e.target.value))}
        onStatusChange={(e) => setStatusFilter(e.target.value)}
      />

      {filteredAppointments.length ? (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <DoctorAppointmentCard key={appointment.id} appointment={appointment} doctorFee={doctorFee} doctorAvailable={doctorAvailable} onUpdate={onUpdate} />
          ))}
        </div>
      ) : (
        <EmptyState title="No matching patient cards" description="Try a different search or status filter." />
      )}
    </div>
  );
}

function PatientPortal({ appointments, currentUser, doctors }) {
  if (!appointments.length) {
    return (
      <EmptyState
        title="No appointments yet"
        description="Book your first specialist visit and the request will appear here."
        action={<Link to="/doctors" className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Browse specialists</Link>}
      />
    );
  }

  const sorted = sortAppointmentsNewestFirst(appointments);
  const nextAppointment = sorted.find(isUpcomingAppointment);
  const completedCount = appointments.filter((a) => a.status === "Completed").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Logged in as" value={currentUser.email} helper="Patient account" />
        <SummaryCard label="Upcoming visit" value={nextAppointment ? formatFriendlyDate(nextAppointment.appointmentDate) : "None"} helper={nextAppointment ? nextAppointment.doctorName : "Book a specialist"} />
        <SummaryCard label="Completed visits" value={completedCount} helper="With notes & prescriptions" />
      </div>

      <div className="space-y-4">
        {sorted.map((appointment) => {
          const doctor = doctors.find((d) => d.id === appointment.doctorId);
          const doctorFee = doctor?.fee ?? 0;
          const doctorAvailable = doctor?.isAvailable !== false;
          return <PatientHistoryCard key={appointment.id} appointment={appointment} doctorFee={doctorFee} doctorAvailable={doctorAvailable} />;
        })}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const { appointments, backendError, contactMessages, currentUser, doctors, isHydrating, updateAppointmentByDoctor, updateAppointmentByAdmin } = useAppContext();

  if (isHydrating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="flex gap-2 justify-center mb-4">
            {[0,1,2].map((i) => (
              <div key={i} className="skeleton w-16 h-16 rounded-lg" />
            ))}
          </div>
          <p className="text-ink-muted text-sm">Syncing portal workspace...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <EmptyState
        title="Sign in to open the portal"
        description="The portal changes based on role. Use seeded accounts or create a patient account first."
        action={<Link to="/signin" className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Go to sign in</Link>}
      />
    );
  }

  const portalAppointments =
    currentUser.role === "admin"
      ? appointments
      : currentUser.role === "doctor"
        ? appointments.filter((a) => a.doctorId === currentUser.linkedDoctorId)
        : appointments.filter((a) => a.patientId === currentUser.id);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`${currentUser.role} workspace`}
        title={`Welcome back, ${currentUser.name}`}
        subtitle={`Last synced ${formatFriendlyDateTime(new Date().toISOString())} in your care workspace.`}
      />

      {backendError && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
          Backend sync: {backendError}
        </div>
      )}

      {currentUser.role === "admin" && <AdminPortal appointments={portalAppointments} contactMessages={contactMessages} doctors={doctors} onSave={updateAppointmentByAdmin} />}
      {currentUser.role === "doctor" && <DoctorPortal appointments={portalAppointments} currentUser={currentUser} doctors={doctors} onUpdate={updateAppointmentByDoctor} />}
      {currentUser.role === "patient" && <PatientPortal appointments={portalAppointments} currentUser={currentUser} doctors={doctors} />}
    </div>
  );
}
