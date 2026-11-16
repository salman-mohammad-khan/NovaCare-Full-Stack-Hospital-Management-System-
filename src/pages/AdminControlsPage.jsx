import { Link, Navigate } from "react-router-dom";
import { ContactInbox, DoctorAvailabilityPanel, DoctorManagementPanel } from "../components/AdminControls";
import { EmptyState, SectionHeading, SummaryCard } from "../components/Shared";
import { useAppContext } from "../context/useAppContext";
import { formatFriendlyDateTime } from "../lib/appointments";

export default function AdminControlsPage() {
  const {
    contactMessages,
    currentUser,
    doctors,
    isHydrating,
    saveDoctorProfile,
    toggleDoctorAvailability,
    users,
  } = useAppContext();

  if (isHydrating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-ink-muted text-sm">Loading admin controls...</p>
      </div>
    );
  }

  if (!currentUser) return <Navigate replace to="/signin" />;

  if (currentUser.role !== "admin") {
    return (
      <EmptyState
        title="Admin access only"
        description="Sign in with an admin account to manage specialist profiles and patient messages."
        action={<Link to="/portal" className="inline-block px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Return to portal</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Admin controls"
        title="Control specialist setup and patient messages"
        subtitle={`Last synced ${formatFriendlyDateTime(new Date().toISOString())} in your admin workspace.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Doctors onboarded" value={doctors.length} helper="Active specialists" />
        <SummaryCard label="Inbox messages" value={contactMessages.length} helper="Waiting for review" />
        <SummaryCard label="Admin session" value={currentUser.name} helper="Signed in with admin access" />
        <SummaryCard label="Back to triage" value="Portal" helper="Review appointments" />
      </div>

      <div className="flex gap-2">
        <Link to="/portal" className="inline-block px-4 py-2 border border-custom rounded-lg text-sm font-medium text-ink-soft hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800 transition-colors">
          &larr; Back to portal
        </Link>
      </div>

      <DoctorAvailabilityPanel doctors={doctors} toggleDoctorAvailability={toggleDoctorAvailability} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DoctorManagementPanel doctors={doctors} saveDoctorProfile={saveDoctorProfile} users={users} />
        <ContactInbox contactMessages={contactMessages} />
      </div>
    </div>
  );
}
