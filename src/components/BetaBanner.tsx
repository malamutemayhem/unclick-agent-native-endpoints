import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useSession } from "@/lib/auth";

const STORAGE_KEY = "unclick_beta_banner_dismissed";
const BANNER_H = 36;
const BANNER_H_PX = `${BANNER_H}px`;

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function BetaBanner() {
  const enabled = import.meta.env.VITE_BETA_BANNER_ENABLED !== "false";
  const { session } = useSession();
  const [visible, setVisible] = useState(enabled && !isDismissed());

  useEffect(() => {
    document.documentElement.style.setProperty("--bbn-h", visible ? BANNER_H_PX : "0px");
    return () => {
      document.documentElement.style.setProperty("--bbn-h", "0px");
    };
  }, [visible]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const ctaHref = session ? "/admin/you" : "/signup";
  const ctaLabel = session ? "go to your dashboard" : "try it free";

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 border-b border-[#61C1C4]/20 bg-[#0D1A1A] px-4"
      style={{ height: BANNER_H_PX }}
    >
      <span className="text-[11px] leading-none text-[#888]" aria-hidden>
        &#9888;
      </span>
      <p className="text-[12px] leading-none text-[#999]">
        <span className="font-medium text-[#ccc]">UnClick is in beta</span>
        {" - "}
        <Link to={ctaHref} className="text-[#61C1C4] transition-colors hover:text-[#7dd4d7]">
          {ctaLabel}
        </Link>
        {" - "}
        <a
          href="mailto:bugs@unclick.world?subject=UnClick%20Beta%20Bug%20Report"
          className="text-[#61C1C4] transition-colors hover:text-[#7dd4d7]"
        >
          report a bug
        </a>
      </p>

      <button
        onClick={dismiss}
        aria-label="Dismiss beta banner"
        className="absolute right-3 rounded p-1 text-[#555] transition-colors hover:text-[#999]"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
