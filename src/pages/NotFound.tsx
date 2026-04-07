import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    document.title = "404 — Page Not Found | UnClick";
    // Mark page as noindex so 404s don't get indexed
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prev = meta?.content ?? "index, follow";
    if (meta) meta.content = "noindex, nofollow";
    return () => {
      document.title = "UnClick — The App Store for AI Agents";
      if (meta) meta.content = prev;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pb-32 pt-40 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-heading sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-4 text-body text-lg leading-relaxed">
          This page doesn't exist — or maybe it moved.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Go home
          </Link>
          <Link
            to="/arena"
            className="rounded-lg border border-border/60 px-5 py-2.5 text-sm font-medium text-heading hover:border-primary/30 transition-colors"
          >
            Browse Arena
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
