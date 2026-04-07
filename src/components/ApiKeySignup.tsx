import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "unclick_api_key";

interface ApiKeySignupProps {
  onKeyReady: (key: string) => void;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateApiKey() {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `uc_${uuid}`;
}

const ApiKeySignup = ({ onKeyReady }: ApiKeySignupProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      onKeyReady(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if email already has a key
      const { data: existing } = await supabase
        .from("api_keys")
        .select("api_key")
        .eq("email", trimmed.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (existing?.api_key) {
        const key = existing.api_key as string;
        localStorage.setItem(STORAGE_KEY, key);
        setApiKey(key);
        onKeyReady(key);
        return;
      }

      // Generate a new key and insert
      const newKey = generateApiKey();

      const { error: insertError } = await supabase
        .from("api_keys")
        .insert({ email: trimmed.toLowerCase(), api_key: newKey });

      if (insertError) throw insertError;

      localStorage.setItem(STORAGE_KEY, newKey);
      setApiKey(newKey);
      onKeyReady(newKey);
    } catch {
      setError("Something went wrong. Try again or email hello@unclick.world");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setEmail("");
    onKeyReady("");
  };

  if (apiKey) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="key-ready"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-primary/30 bg-primary/5 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-primary">You're in! Your API key is ready.</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-card/60 border border-border/40 px-3 py-2 font-mono text-xs text-heading truncate select-all">
              {apiKey}
            </code>
            <motion.button
              onClick={handleCopyKey}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 rounded-md border border-border/60 bg-card/80 px-3 py-2 font-mono text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:text-heading"
            >
              {keyCopied ? "Copied!" : "Copy key"}
            </motion.button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This key is already inserted into your config below.{" "}
            <button onClick={handleReset} className="underline underline-offset-2 hover:text-body transition-colors">
              Use a different account
            </button>
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="signup-form"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-border/60 bg-card/30 p-5"
      >
        <p className="text-sm font-medium text-heading mb-1">Get your free API key</p>
        <p className="text-xs text-muted-foreground mb-4">
          No credit card. No waitlist. Covers all 33 tools immediately.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="flex-1 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm text-heading placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors"
          />
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Working..." : "Get your API key"}
          </motion.button>
        </form>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default ApiKeySignup;
