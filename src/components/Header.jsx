import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import useTheme from "../hooks/useTheme";

export default function Header({ onMenuClick }) {
  const { currentUser, logout } = useAppContext();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface-glass border-b border-custom dark:border-slate-700/60">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800 transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {currentUser ? (
            <>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-ink">{currentUser.name}</p>
                <p className="text-xs text-ink-muted capitalize">{currentUser.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-custom text-ink-soft hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href="/signin"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
