import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AIAssistant from "./components/AIAssistant";
import HomePage from "./pages/HomePage";
import DoctorsPage from "./pages/DoctorsPage";
import DoctorDetailPage from "./pages/DoctorDetailPage";
import AuthPage from "./pages/AuthPage";
import ContactPage from "./pages/ContactPage";
import PortalPage from "./pages/PortalPage";
import AdminControlsPage from "./pages/AdminControlsPage";
import NotFoundPage from "./pages/NotFoundPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const location = useLocation();

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface-alt dark:bg-slate-950">
      <ScrollToTop />
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "lg:ml-[72px] lg:[--sidebar-w:72px]" : "lg:ml-[260px] lg:[--sidebar-w:260px]"} ml-0`}>
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-6 py-6">
          <div className="page-transition" key={location.pathname}>
            <ErrorBoundary>
              <Routes location={location}>
                <Route path="/" element={<HomePage />} />
                <Route path="/doctors" element={<DoctorsPage />} />
                <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
                <Route path="/signin" element={<AuthPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/portal" element={<PortalPage />} />
                <Route path="/portal/admin-controls" element={<AdminControlsPage />} />
                <Route path="/workspace/:role" element={<Navigate replace to="/portal" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
        <Footer />
      </div>

      <AIAssistant />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
