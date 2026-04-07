import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const installHref = isHome ? "#install" : "/#install";

  const navLinks = [
    { label: "Tools", href: isHome ? "#tools" : "/#tools", anchor: true },
    { label: "Arena", href: "/arena" },
    { label: "Docs", href: "/docs" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="font-mono text-lg font-semibold text-heading tracking-tight">
          UnClick
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.anchor ? (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-body transition-colors hover:text-heading"
              >
                {link.label}
              </a>
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
          <a
            href={installHref}
            className="hidden rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:block"
          >
            Get Started Free
          </a>

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
                link.anchor ? (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-body transition-colors hover:text-heading"
                  >
                    {link.label}
                  </a>
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
              <a
                href={installHref}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Get Started Free
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
