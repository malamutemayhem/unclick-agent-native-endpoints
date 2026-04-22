import { useEffect, useCallback } from "react";

export function useAutoRefresh(
  callback: () => void,
  intervalMs = 30000,
  enabled = true,
) {
  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(stableCallback, intervalMs);
    return () => clearInterval(id);
  }, [stableCallback, intervalMs, enabled]);
}
