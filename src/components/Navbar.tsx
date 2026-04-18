import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Brain, Calendar, Users, Trophy, HelpCircle } from "lucide-react";
import { useSession } from "@/lib/auth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const installHref = isHome ? "#install" : "/#install";
  const session = useSession();
  const isLoggedIn = Boolean(session);

  const navLinks = [
    { label: "Tools", href: "/tools", icon: Wrench },
    { label: "Memory", href: "/memory", icon: Brain },
    { label: "Organiser", href: "/organiser", icon: Calendar },
    { label: "Crews", href: "/crews", icon: Users },
    { label: "Arena", href: "/arena", icon: Trophy },
    { label: "Pricing", href: "/pricing" },
    { label: "Docs", href: "/docs" },
    { label: "New to AI?", href: "/new-to-ai", icon: HelpCircle },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/" className="shrink-0">
          <img src="/logo-wordmark.svg" alt="UnClick" style={{ height: "3.3rem" }} className="w-auto pt-2 pb-[3px]" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) =>
            link.icon ? (
              <Link
                key={link.label}
                to={link.href}
                className={`flex items-center gap-1.5 text-sm transition-colors hover:text-heading ${
                  pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                    ? "text-heading"
                    : "text-body"
                }`}
              >
                <link.icon className="h-3.5 w-3.5 shrink-0" />
                {link.label}
              </Link>
            ) : (
              <Link
                key={link.label}
                to={link.href}
                className={`text-sm transition-colors hover:text-heading ${
                  pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                    ? "text-heading"
                    : "text-body"
                }`}
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              to="/admin/you"
              className="hidden whitespace-nowrap text-sm text-body transition-colors hover:text-heading hover:underline sm:inline-block"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden whitespace-nowrap text-sm text-body transition-colors hover:text-heading hover:underline sm:inline-block"
              >
                Log in
              </Link>
              <a
                href={installHref}
                className="hidden whitespace-nowrap rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:block"
              >
                Get Started Free
              </a>
            </>
          )}

          {/* Hamburger button */}
          <button
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <motion.span
              className="block h-0.5 w-5 bg-heading origin-center"
              animate={open ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="block h-0.5 w-5 bg-heading"
              animate={open ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.1 }}
            />
            <motion.span
              className="block h-0.5 w-5 bg-heading origin-center"
              animate={open ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.2 }}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {navLinks.map((link) =>
                link.icon ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm text-body transition-colors hover:text-heading"
                  >
                    <link.icon className="h-3.5 w-3.5 shrink-0" />
                    {link.label}
                  </Link>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-body transition-colors hover:text-heading"
                  >
                    {link.label}
                  </Link>
                )
              )}
              {isLoggedIn ? (
                <Link
                  to="/admin/you"
                  onClick={() => setOpen(false)}
                  className="mt-2 py-2 text-sm text-body transition-colors hover:text-heading"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="mt-2 py-2 text-sm text-body transition-colors hover:text-heading"
                  >
                    Log in
                  </Link>
                  <a
                    href={installHref}
                    onClick={() => setOpen(false)}
                    className="mt-2 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
                  >
                    Get Started Free
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
