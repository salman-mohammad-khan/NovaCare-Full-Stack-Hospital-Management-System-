import { NavLink } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import brandLogo from "../assets/reference/logo.jpg";

const iconPaths = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  doctors: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  portal: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  contact: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  signin: "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
  admin: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  appointments: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  inbox: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
};

function SidebarIcon({ name }) {
  const d = iconPaths[name];
  if (!d) return null;
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  );
}

const patientLinks = [
  { to: "/portal", icon: "portal", label: "Dashboard" },
  { to: "/doctors", icon: "doctors", label: "Find Doctors" },
  { to: "/contact", icon: "contact", label: "Contact" },
];

const doctorLinks = [
  { to: "/portal", icon: "portal", label: "Queue" },
  { to: "/portal", icon: "appointments", label: "My Patients" },
];

const adminLinks = [
  { to: "/portal", icon: "portal", label: "Triage Board" },
  { to: "/doctors", icon: "doctors", label: "Doctors" },
  { to: "/portal/admin-controls", icon: "admin", label: "Management" },
  { to: "/portal", icon: "inbox", label: "Inbox" },
];

const publicLinks = [
  { to: "/", icon: "home", label: "Overview" },
  { to: "/doctors", icon: "doctors", label: "Specialists" },
  { to: "/contact", icon: "contact", label: "Contact" },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { currentUser } = useAppContext();

  const roleLinks = !currentUser
    ? publicLinks
    : currentUser.role === "admin"
      ? adminLinks
      : currentUser.role === "doctor"
        ? doctorLinks
        : patientLinks;

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          bg-surface dark:bg-slate-900
          border-r border-custom dark:border-slate-700/60
          transition-all duration-300 ease-in-out
          ${collapsed ? "-translate-x-full lg:translate-x-0 lg:w-[72px]" : "translate-x-0 w-[260px]"}
          shadow-elevated lg:shadow-none
        `}
      >
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-custom dark:border-slate-700/60 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <img src={brandLogo} alt="NovaCare" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          {!collapsed && <span className="font-bold text-lg text-ink truncate">NovaCare</span>}
          <button
            onClick={onToggle}
            className={`ml-auto lg:hidden p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800 ${collapsed ? "lg:block lg:ml-0" : ""}`}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 px-3 space-y-1 ${collapsed ? "lg:px-2" : ""}`}>
          {roleLinks.map((link) => (
            <NavLink
              key={link.to + link.label}
              to={link.to}
              onClick={collapsed ? undefined : onToggle}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
                ${isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-ink-soft hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800"
                }
              `}
            >
              <SidebarIcon name={link.icon} />
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`px-4 py-3 border-t border-custom dark:border-slate-700/60 ${collapsed ? "lg:px-2 lg:text-center" : ""}`}>
          {currentUser ? (
            <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.name?.charAt(0)?.toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{currentUser.name}</p>
                  <p className="text-xs text-ink-muted capitalize">{currentUser.role}</p>
                </div>
              )}
            </div>
          ) : (
            <NavLink
              to="/signin"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
                ${isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-ink-soft hover:text-ink hover:bg-surface-alt dark:hover:bg-slate-800"
                }
              `}
            >
              <SidebarIcon name="signin" />
              {!collapsed && <span>Sign in</span>}
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}
