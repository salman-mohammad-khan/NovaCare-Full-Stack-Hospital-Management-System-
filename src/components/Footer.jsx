import { useState } from "react";
import { Link } from "react-router-dom";
import { brand } from "../data/siteData";
import { useAppContext } from "../context/useAppContext";

export default function Footer() {
  const { currentUser, resetDemoData } = useAppContext();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    await resetDemoData();
    setIsResetting(false);
  };

  return (
    <footer className="border-t border-custom dark:border-slate-700/60 bg-surface dark:bg-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-ink mb-2">{brand.name}</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              A care coordination platform for hospitals and clinics that need clear
              workflows, patient visibility, and dependable digital operations.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-ink mb-3">Explore</h3>
            <div className="flex flex-col gap-2 text-sm">
              <Link to="/doctors" className="text-ink-soft hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Find specialists</Link>
              <Link to="/portal" className="text-ink-soft hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Open portal</Link>
              <Link to="/contact" className="text-ink-soft hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Contact us</Link>
              <Link to="/signin" className="text-ink-soft hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Demo login</Link>
              {currentUser?.role === "admin" ? (
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="text-left text-ink-muted hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  {isResetting ? "Resetting..." : "Reset demo data"}
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-ink mb-3">Contact</h3>
            <div className="flex flex-col gap-2 text-sm text-ink-soft">
              <a href={`tel:${brand.emergencyLine}`} className="hover:text-primary-600 transition-colors">{brand.emergencyLine}</a>
              <a href={`mailto:${brand.email}`} className="hover:text-primary-600 transition-colors">{brand.email}</a>
              <span>{brand.address}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-custom dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-muted">
          <span>&copy; {new Date().getFullYear()} NovaCare Healthcare Solutions. Demo project.</span>
          <span>Built with React + Express + MongoDB + a local LLM (Ollama)</span>
        </div>
      </div>
    </footer>
  );
}
