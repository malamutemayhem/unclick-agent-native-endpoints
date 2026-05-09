import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CONNECTORS, type ConnectorConfig, type CredentialField } from "@/lib/connectors";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";

// --- Types ---------------------------------------------------------------------

type PageState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "callback"; code: string; state: string | null }
  | { kind: "success" }
  | { kind: "error"; message: string };

// --- OAuth helpers -------------------------------------------------------------

const VITE_ENV = import.meta.env as Record<string, string>;

/** Returns the OAuth2 authorization URL for a platform, or null if client_id not configured. */
function buildOAuthUrl(
  connector: ConnectorConfig,
  redirectOrigin: string,
  state: string
): string | null {
  if (connector.authType !== "oauth2") return null;

  // Platform-specific client IDs come from Vite public env vars
  const clientIdKey = `VITE_${connector.slug.toUpperCase()}_CLIENT_ID`;
  const clientId    = VITE_ENV[clientIdKey];
  if (!clientId) return null;

  let authUrl = connector.authUrl ?? "";

  // Shopify: auth URL includes {store} which user must supply
  if (connector.slug === "shopify") {
    const store = sessionStorage.getItem("shopify_store") ?? "";
    if (!store) return null;
    authUrl = authUrl.replace("{store}", store);
  }

  const redirectUri = `${redirectOrigin}/connect/${connector.slug}`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         (connector.scopes ?? []).join(" "),
    state,
  });

  return `${authUrl}?${params.toString()}`;
}

/** Returns the stored API key from localStorage, or empty string. */
function getApiKey(): string {
  try {
    return localStorage.getItem("unclick_api_key") ?? "";
  } catch {
    return "";
  }
}

// --- Sub-components ------------------------------------------------------------

function ScopeList({ scopes }: { scopes: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {scopes.map((s) => (
        <Badge
          key={s}
          variant="outline"
          className="text-xs font-mono border-white/20 text-[#E8E8E8]/70"
        >
          {s}
        </Badge>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field:    CredentialField;
  value:    string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const fieldId = `credential_${field.key}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldId} className="text-sm text-[#E8E8E8]">
          {field.label}
        </Label>
        {field.findGuideUrl && (
          <a
            href={field.findGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#E2B93B] hover:underline"
          >
            Where do I find this?
          </a>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-[#E8E8E8]/50">{field.description}</p>
      )}
      <div className="relative">
        <Input
          id={fieldId}
          type={field.secret && !revealed ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className="bg-white/5 border-white/10 text-[#E8E8E8] placeholder:text-[#E8E8E8]/30 pr-16"
        />
        {field.secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#E8E8E8]/40 hover:text-[#E8E8E8]/80"
          >
            {revealed ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Main page -----------------------------------------------------------------

export default function ConnectPage() {
  const { platform }      = useParams<{ platform: string }>();
  const [searchParams]    = useSearchParams();
  const code              = searchParams.get("code");
  const stateParam        = searchParams.get("state");

  const connector: ConnectorConfig | null =
    platform ? (CONNECTORS[platform] ?? null) : null;

  const [pageState, setPageState]     = useState<PageState>({ kind: "idle" });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [shopifyStore, setShopifyStore] = useState("");
  const [apiKey, setApiKey]           = useState(getApiKey);
  const callbackFired                 = useRef(false);

  // -- Handle OAuth callback ------------------------------------------------
  useEffect(() => {
    if (!code || !connector || callbackFired.current) return;
    callbackFired.current = true;

    if (!stateParam) {
      setPageState({ kind: "error", message: "Missing OAuth state. Please try again." });
      return;
    }

    const currentApiKey = apiKey || getApiKey();
    if (!currentApiKey) {
      setPageState({
        kind:    "error",
        message: "No UnClick API key found. Please add your API key below and try again.",
      });
      return;
    }

    setPageState({ kind: "callback", code, state: stateParam });

    const body: Record<string, string> = {
      platform: connector.slug,
      code,
      state: stateParam,
      api_key:  currentApiKey,
    };
    const storedStore = sessionStorage.getItem("shopify_store");
    if (connector.slug === "shopify" && storedStore) {
      body.store = storedStore;
    }

    fetch("/api/oauth-callback", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
      .then(async (res) => {
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (res.ok && data.success) {
          sessionStorage.removeItem("shopify_store");
          setPageState({ kind: "success" });
        } else {
          setPageState({ kind: "error", message: data.error ?? "Connection failed." });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Network error.";
        setPageState({ kind: "error", message });
      });
  }, [code, connector, stateParam, apiKey]);

  // -- Loading / unknown service --------------------------------------------
  if (!connector) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <p className="text-[#E8E8E8]/60 text-lg">
            {platform ? `This Passport service is not listed yet: ${platform}` : "No Passport service specified."}
          </p>
          <Link to="/admin/keychain" className="text-[#E2B93B] hover:underline text-sm">
            Back to Passport
          </Link>
        </div>
      </div>
    );
  }

  // -- Success state --------------------------------------------------------
  if (pageState.kind === "success") {
    const vaultCommands = connector.credentialFields.map(
      (f) => `vault_store key="${connector.slug}/${f.key}" value="..."`
    );
    return (
      <ConnectShell connector={connector}>
        <div className="space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#E8E8E8]">
              {connector.name} connected
            </h2>
            <p className="text-sm text-[#E8E8E8]/60 mt-1">
              Credentials stored securely. MCP tool calls will auto-use them.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left space-y-2">
            <p className="text-xs font-mono text-[#E8E8E8]/50 uppercase tracking-wide">
              Optional: also store in local vault for offline use
            </p>
            {vaultCommands.map((cmd) => (
              <code key={cmd} className="block text-xs font-mono text-[#E2B93B] bg-black/30 px-3 py-1.5 rounded">
                {cmd}
              </code>
            ))}
          </div>

          <Link to="/admin/keychain" className="inline-block text-sm text-[#E8E8E8]/60 hover:text-[#E8E8E8]">
            Back to Passport
          </Link>
        </div>
      </ConnectShell>
    );
  }

  // -- Error state ----------------------------------------------------------
  if (pageState.kind === "error") {
    return (
      <ConnectShell connector={connector}>
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#E8E8E8]">Connection failed</h2>
            <p className="text-sm text-red-400/80 mt-1">{pageState.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-[#E8E8E8]"
            onClick={() => setPageState({ kind: "idle" })}
          >
            Try again
          </Button>
        </div>
      </ConnectShell>
    );
  }

  // -- Callback processing --------------------------------------------------
  if (pageState.kind === "callback" || pageState.kind === "connecting") {
    return (
      <ConnectShell connector={connector}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#E2B93B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#E8E8E8]/60 text-sm">
            {pageState.kind === "callback"
              ? "Exchanging tokens..."
              : `Connecting to ${connector.name}...`}
          </p>
        </div>
      </ConnectShell>
    );
  }

  // -- Idle: show connect form ----------------------------------------------

  const isOAuth2          = connector.authType === "oauth2";
  const origin            = window.location.origin;
  const oauthClientKey     = isOAuth2 ? VITE_ENV[`VITE_${connector.slug.toUpperCase()}_CLIENT_ID`] : "";
  const oauthNotConfigured = isOAuth2 && !oauthClientKey && connector.slug !== "shopify";

  function handleFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentApiKey = apiKey.trim();
    if (!currentApiKey) {
      setPageState({ kind: "error", message: "UnClick API key is required." });
      return;
    }

    setPageState({ kind: "connecting" });
    try {
      const res = await fetch("/api/credentials", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platform:    connector.slug,
          credentials: fieldValues,
          api_key:     currentApiKey,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        localStorage.setItem("unclick_api_key", currentApiKey);
        setPageState({ kind: "success" });
      } else {
        setPageState({ kind: "error", message: data.error ?? "Failed to save credentials." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error.";
      setPageState({ kind: "error", message });
    }
  }

  async function handleOAuthConnect() {
    const normalizedStore =
      connector.slug === "shopify"
        ? shopifyStore.trim().replace(/\.myshopify\.com$/i, "")
        : "";

    if (connector.slug === "shopify" && !normalizedStore) return;

    try {
      const res = await fetch("/api/oauth-init", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platform: connector.slug,
          ...(normalizedStore ? { store: normalizedStore } : {}),
        }),
      });

      const data = (await res.json()) as { state?: string; error?: string };
      if (!res.ok || !data.state) {
        setPageState({ kind: "error", message: data.error ?? "Failed to initialize OAuth." });
        return;
      }

      if (normalizedStore) {
        sessionStorage.setItem("shopify_store", normalizedStore);
      }

      const url = buildOAuthUrl(connector, origin, data.state);
      if (!url) {
        setPageState({ kind: "error", message: `OAuth2 setup pending for ${connector.name}.` });
        return;
      }

      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error.";
      setPageState({ kind: "error", message });
    }
  }

  const allFieldsFilled = connector.credentialFields.every(
    (f) => (fieldValues[f.key] ?? "").trim() !== ""
  );

  return (
    <ConnectShell connector={connector}>
      <div className="space-y-6">
        {/* API key input (needed for all flows) */}
        <div className="space-y-1.5 border border-white/10 rounded-lg p-4 bg-white/[0.02]">
          <Label htmlFor="api_key" className="text-sm text-[#E8E8E8]">
            Your UnClick Passport key
          </Label>
          <p className="text-xs text-[#E8E8E8]/50">
            Needed once in this browser so Passport can store access securely.{" "}
            <Link to="/" className="text-[#E2B93B] hover:underline">Get one here.</Link>
          </p>
          <Input
            id="api_key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="uc_xxxxxxxx or agt_live_xxxxxxxx"
            className="bg-white/5 border-white/10 text-[#E8E8E8] placeholder:text-[#E8E8E8]/30"
          />
        </div>

        {/* OAuth2 flow */}
        {isOAuth2 && (
          <div className="space-y-4">
            {connector.scopes && connector.scopes.length > 0 && (
              <div>
                <p className="text-xs text-[#E8E8E8]/50 uppercase tracking-wide mb-2">
                  Permissions requested
                </p>
                <ScopeList scopes={connector.scopes} />
              </div>
            )}

            {connector.slug === "shopify" && (
              <div className="space-y-1.5">
                <Label htmlFor="shopify_store" className="text-sm text-[#E8E8E8]">
                  Shopify store name
                </Label>
                <Input
                  id="shopify_store"
                  value={shopifyStore}
                  onChange={(e) => setShopifyStore(e.target.value)}
                  placeholder="mystore"
                  className="bg-white/5 border-white/10 text-[#E8E8E8] placeholder:text-[#E8E8E8]/30"
                />
                <p className="text-xs text-[#E8E8E8]/40">Without .myshopify.com</p>
              </div>
            )}

            {oauthNotConfigured ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-primary/80">
                  Login setup is pending for {connector.name}. Use the manual fallback below,
                  or enter credentials directly in your MCP config.
                </p>
              </div>
            ) : (
              <Button
                className="w-full bg-[#E2B93B] hover:bg-[#E2B93B]/90 text-black font-semibold"
                onClick={() => void handleOAuthConnect()}
                disabled={!apiKey.trim() || (connector.slug === "shopify" && !shopifyStore.trim())}
              >
                Connect with {connector.name}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0A0A0A] px-2 text-[#E8E8E8]/40">
                  manual fallback
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Manual form (always shown for non-oauth2; shown as fallback for oauth2) */}
        {isOAuth2 ? (
          <details className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#E8E8E8]">
              Use a token instead
            </summary>
            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
              {connector.credentialFields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={fieldValues[field.key] ?? ""}
                  onChange={(v) => handleFieldChange(field.key, v)}
                  disabled={false}
                />
              ))}

              <Button
                type="submit"
                className="w-full bg-[#E2B93B] hover:bg-[#E2B93B]/90 text-black font-semibold"
                disabled={!apiKey.trim() || !allFieldsFilled}
              >
                Save token fallback
              </Button>
            </form>
          </details>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {connector.credentialFields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? ""}
                onChange={(v) => handleFieldChange(field.key, v)}
                disabled={false}
              />
            ))}

            <Button
              type="submit"
              className="w-full bg-[#E2B93B] hover:bg-[#E2B93B]/90 text-black font-semibold"
              disabled={!apiKey.trim() || !allFieldsFilled}
            >
              Save credentials
            </Button>
          </form>
        )}

        {connector.docsUrl && (
          <p className="text-center text-xs text-[#E8E8E8]/40">
            <a
              href={connector.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E8E8E8]/70"
            >
              {connector.name} API docs
            </a>
          </p>
        )}
      </div>
    </ConnectShell>
  );
}

// --- Shell layout --------------------------------------------------------------

function ConnectShell({
  connector,
  children,
}: {
  connector: ConnectorConfig;
  children:  React.ReactNode;
}) {
  const authLabel: Record<string, string> = {
    oauth2:    "OAuth2",
    api_key:   "API Key",
    bot_token: "Bot Token",
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-start justify-center pt-16 pb-24 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <header className="text-center space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#E8E8E8]/40 hover:text-[#E8E8E8]/70"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Passport
          </Link>

          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-[#E2B93B]">
              {connector.name.charAt(0)}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#E8E8E8]">
              Connect {connector.name}
            </h1>
            <p className="text-sm text-[#E8E8E8]/60 mt-1">{connector.description}</p>
          </div>

          <Badge
            variant="outline"
            className="border-white/20 text-[#E8E8E8]/50 text-xs"
          >
            {authLabel[connector.authType] ?? connector.authType}
          </Badge>
        </header>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
          {children}
        </div>

        <p className="text-center text-xs text-[#E8E8E8]/30">
          Credentials are encrypted with AES-256-GCM using your API key before storage.
        </p>
      </div>
    </main>
  );
}
