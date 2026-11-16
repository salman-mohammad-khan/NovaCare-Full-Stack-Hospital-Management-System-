import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { demoCredentials } from "../data/siteData";
import { useAppContext } from "../context/useAppContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { useToast } from "../context/ToastContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const { currentUser, login, registerPatient, logout } = useAppContext();
  const toast = useToast();

  const [mode, setMode] = useState("signin");

  const [loginForm, setLoginForm] = useState({ email: "patient@novacare.demo", password: "Patient@123" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [registerErrors, setRegisterErrors] = useState({});

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearMessages() { setError(""); setRegisterErrors({}); }
  function switchMode(newMode) { setMode(newMode); clearMessages(); }

  const handleLoginChange = (field) => (e) => setLoginForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePasswordLogin = async (e) => {
    e.preventDefault(); clearMessages(); setIsSubmitting(true);
    const result = await login(loginForm);
    setIsSubmitting(false);
    if (!result.ok) { setError(result.error); return; }
    setTimeout(() => navigate("/portal", { replace: true }), 400);
  };

  const handleRegisterChange = (field) => (e) => {
    setRegisterForm((f) => ({ ...f, [field]: e.target.value }));
    setRegisterErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateRegisterForm = () => {
    const errs = {};
    const name = registerForm.name.trim();
    const email = registerForm.email.trim();
    const phone = registerForm.phone.trim();
    const password = registerForm.password;

    if (!name) errs.name = "Full name: This field is required.";
    else if (/^\d/.test(name)) errs.name = "Full name cannot start with a number.";

    if (!email) errs.email = "Email: This field is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Please enter a valid email address with @ and a domain such as .com.";

    if (!phone) errs.phone = "Phone: This field is required.";
    else if (phone.replace(/\D/g, "").length < 10) errs.phone = "Please enter a valid mobile number with at least 10 digits.";

    if (!password) errs.password = "Password: This field is required.";
    else if (password.length < 6 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))
      errs.password = "Password must be at least 6 characters long and include at least one number and one special character.";

    setRegisterErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault(); clearMessages();
    if (!validateRegisterForm()) return;
    setIsSubmitting(true);
    const result = await registerPatient(registerForm);
    setIsSubmitting(false);
    if (!result.ok) { setError(result.error); return; }
    toast.success("Patient profile created. Redirecting to your portal...");
    setTimeout(() => navigate("/portal", { replace: true }), 400);
  };

  const activeStyles = "bg-primary-600 text-white rounded-lg";
  const inactiveStyles = "text-ink-soft hover:text-ink rounded-lg";

  if (currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-2xl mx-auto mb-4">
            &#128274;
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">You&apos;re already signed in</h2>
          <p className="text-sm text-ink-soft mb-1">
            Signed in as <strong className="text-ink">{currentUser.name}</strong> ({currentUser.role}).
          </p>
          <p className="text-sm text-ink-soft mb-6">
            Sign out first if you want to switch to another account.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to="/portal"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Go to my portal
            </Link>
            <button
              onClick={async () => {
                await logout();
                toast.success("Signed out. You can sign in again.");
              }}
              className="px-5 py-2.5 border border-custom rounded-lg text-sm font-medium text-ink-soft hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800 transition-colors"
            >
              Sign out &amp; switch account
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
      <Card>
        <h2 className="text-xl font-bold text-ink mb-1">Access the demo portal</h2>
        <p className="text-sm text-ink-soft mb-6">Use seeded accounts for admin/doctor testing, or create a fresh patient profile.</p>

        <div className="flex gap-1 p-1 bg-surface-alt dark:bg-slate-800 rounded-lg mb-6">
          {["signin", "register"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === m ? activeStyles : inactiveStyles}`}
            >
              {m === "signin" ? "Sign in" : "Register patient"}
            </button>
          ))}
        </div>

        {mode === "signin" && (
          <>
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Email</label>
                <input type="email" value={loginForm.email} onChange={handleLoginChange("email")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Password</label>
                <input type="password" value={loginForm.password} onChange={handleLoginChange("password")} className="w-full px-3 py-2 text-sm rounded-lg border border-custom dark:border-slate-600 bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" loading={isSubmitting} className="w-full">
                {isSubmitting ? "Signing in..." : "Enter portal"}
              </Button>
            </form>

          </>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {[
              { key: "name", label: "Full name", type: "text", placeholder: "e.g. Rahul Verma" },
              { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
              { key: "phone", label: "Mobile number", type: "tel", placeholder: "10-digit mobile number" },
              { key: "password", label: "Password", type: "password", placeholder: "6+ chars, 1 number, 1 special char" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-ink-muted mb-1">{field.label}</label>
                <input
                  type={field.type}
                  value={registerForm[field.key]}
                  onChange={handleRegisterChange(field.key)}
                  placeholder={field.placeholder}
                  className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface dark:bg-slate-900 text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
                    registerErrors[field.key]
                      ? "border-red-400 dark:border-red-600 ring-2 ring-red-500/20"
                      : "border-custom dark:border-slate-600"
                  }`}
                />
                {registerErrors[field.key] && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{registerErrors[field.key]}</p>
                )}
              </div>
            ))}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" loading={isSubmitting} className="w-full">
              {isSubmitting ? "Creating account..." : "Create patient account"}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-ink mb-1">Seeded demo credentials</h3>
        <p className="text-sm text-ink-soft mb-4">These accounts are available immediately for platform testing.</p>
        <div className="space-y-3">
          {demoCredentials.map((cred) => (
            <div key={cred.role} className="p-3 rounded-lg bg-surface-alt dark:bg-slate-800 border border-custom dark:border-slate-700/60">
              <p className="text-sm font-semibold text-ink capitalize">{cred.role}</p>
              <p className="text-xs text-ink-muted mt-0.5">{cred.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="inline-block text-xs bg-surface dark:bg-slate-700 px-2 py-0.5 rounded text-ink-soft font-mono">{cred.password}</code>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setLoginForm({ email: cred.email, password: cred.password });
                    setError("");
                  }}
                  className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
