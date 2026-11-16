import { useState } from "react";
import { brand } from "../data/siteData";
import { useAppContext } from "../context/useAppContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContext";

const INITIAL_FORM = { name: "", email: "", phone: "", category: "General question", subject: "", message: "" };

export default function ContactPage() {
  const { currentUser, submitContactMessage } = useAppContext();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    name: currentUser?.name ?? "",
    email: currentUser?.email ?? "",
    phone: currentUser?.phone ?? "",
  }));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await submitContactMessage(form);
    if (!result.ok) { setError(result.error); setIsSubmitting(false); return; }
    toast.success("Your message has been sent to the care support desk.");
    setForm((current) => ({
      ...INITIAL_FORM,
      name: currentUser?.name ?? current.name,
      email: currentUser?.email ?? current.email,
      phone: currentUser?.phone ?? current.phone,
    }));
    setIsSubmitting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
      <Card>
        <p className="text-xs font-semibold tracking-wider text-primary-600 dark:text-primary-400 uppercase mb-1">Patient support</p>
        <h2 className="text-xl font-bold text-ink mb-1">Contact the NovaCare care desk</h2>
        <p className="text-sm text-ink-soft mb-6">Send a service question, concern, or support request and the admin team will see it inside the portal.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["name", "email", "phone"].map((field) => (
              <div key={field} className={field === "phone" ? "" : ""}>
                <label className="block text-xs font-medium text-ink-muted mb-1 capitalize">{field === "phone" ? "Mobile number" : field === "name" ? "Full name" : "Email"}</label>
                <input
                  type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                  value={form[field]}
                  onChange={updateField(field)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  placeholder={`Enter your ${field === "phone" ? "contact number" : field}`}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Category</label>
              <select value={form.category} onChange={updateField("category")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                {["General question", "Appointment help", "Billing query", "Technical issue", "Feedback"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Subject</label>
            <input type="text" value={form.subject} onChange={updateField("subject")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Short summary of your request" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Message</label>
            <textarea rows={5} value={form.message} onChange={updateField("message")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-y" placeholder="Share your question, doubt, or feedback in detail." />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={isSubmitting} size="lg">
            {isSubmitting ? "Sending..." : "Send to support desk"}
          </Button>
        </form>
      </Card>

      <Card>
        <p className="text-xs font-semibold tracking-wider text-primary-600 dark:text-primary-400 uppercase mb-1">Reach us</p>
        <h3 className="text-lg font-semibold text-ink mb-1">Support details</h3>
        <p className="text-sm text-ink-soft mb-5">Patients can use the contact form for help related to services, scheduling, and platform questions.</p>
        <div className="space-y-3">
          {[
            { title: "Care support line", value: brand.emergencyLine, icon: "\u260E" },
            { title: "Email support", value: brand.email, icon: "\u2709" },
            { title: "Address", value: brand.address, icon: "\u2302" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-surface-alt dark:bg-slate-800 border border-custom dark:border-slate-700/60">
              <span className="text-lg shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-sm text-ink-soft">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
