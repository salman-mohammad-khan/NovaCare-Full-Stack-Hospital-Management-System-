import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-primary-200 dark:text-primary-900 mb-4">404</div>
        <h2 className="text-xl font-semibold text-ink mb-2">Page not available</h2>
        <p className="text-sm text-ink-soft mb-6">
          Return to the NovaCare overview or open the portal from the main navigation.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
