import { useEffect } from "react";

const BASE = "https://unclick.world";

/**
 * Dynamically sets the canonical link tag for the current page.
 * Pass the path including leading slash, e.g. "/arena" or `/arena/${id}`.
 */
export function useCanonical(path: string) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${BASE}${path}`;
    return () => {
      // Reset to homepage default on unmount
      if (link) link.href = `${BASE}/`;
    };
  }, [path]);
}
