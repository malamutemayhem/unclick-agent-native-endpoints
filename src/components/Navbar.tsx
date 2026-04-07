import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <a href="/" className="font-mono text-lg font-semibold text-heading tracking-tight">UnClick</a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#tools" className="text-sm text-body transition-colors hover:text-heading">Tools</a>
          <a href="#install" className="text-sm text-body transition-colors hover:text-heading">Install</a>
          <a href="/docs" className="text-sm text-body transition-colors hover:text-heading">Docs</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#install"
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
              <a href="#tools" onClick={() => setOpen(false)} className="py-2 text-sm text-body transition-colors hover:text-heading">Tools</a>
              <a href="#install" onClick={() => setOpen(false)} className="py-2 text-sm text-body transition-colors hover:text-heading">Install</a>
              <a href="/docs" onClick={() => setOpen(false)} className="py-2 text-sm text-body transition-colors hover:text-heading">Docs</a>
              <a
                href="#install"
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
