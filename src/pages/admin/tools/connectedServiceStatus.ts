export interface ConnectedServiceCredential {
  is_valid: boolean;
  last_tested_at: string | null;
}

export interface ConnectedService {
  credential: ConnectedServiceCredential | null;
}

export interface ConnectedServiceStatus {
  dot: string;
  pillClass: string;
  pill: string;
  note: string;
}

const STALE_CHECK_MS = 1000 * 60 * 60 * 24 * 30;

function parseTestedAt(value: string | null): Date | null {
  if (!value) return null;
  const testedAt = new Date(value);
  return Number.isNaN(testedAt.getTime()) ? null : testedAt;
}

export function formatLastTested(value: string | null): string {
  const testedAt = parseTestedAt(value);
  if (!testedAt) return value ? "test time unknown" : "not tested yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(testedAt);
}

export function getConnectedServiceStatus(connector: ConnectedService, now = Date.now()): ConnectedServiceStatus {
  const credential = connector.credential;
  if (!credential) {
    return {
      dot: "bg-white/20",
      pillClass: "border border-white/[0.08] bg-white/[0.04] text-white/75",
      pill: "Setup required",
      note: "No saved connection yet.",
    };
  }

  if (!credential.is_valid) {
    return {
      dot: "bg-amber-400",
      pillClass: "bg-amber-400/10 text-amber-200",
      pill: "Needs reconnection",
      note: `Reconnect or retest this service in Connections. Last checked: ${formatLastTested(credential.last_tested_at)}.`,
    };
  }

  const testedAt = parseTestedAt(credential.last_tested_at);
  if (!testedAt) {
    return {
      dot: "bg-sky-400",
      pillClass: "bg-sky-400/10 text-sky-200",
      pill: "Setup incomplete",
      note: "Saved, but not validated with a connection test yet.",
    };
  }

  if (now - testedAt.getTime() > STALE_CHECK_MS) {
    return {
      dot: "bg-yellow-400",
      pillClass: "bg-yellow-400/10 text-yellow-200",
      pill: "Check stale",
      note: `Credential exists, but test evidence is stale. Last checked: ${formatLastTested(credential.last_tested_at)}.`,
    };
  }

  return {
    dot: "bg-green-500",
    pillClass: "bg-green-500/10 text-green-200",
    pill: "Check recent",
    note: `Metadata-only check passed recently. Last checked: ${formatLastTested(credential.last_tested_at)}.`,
  };
}
