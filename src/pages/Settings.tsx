import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type SettingsSection = "profile" | "api-keys" | "notifications" | "admin";

const NAV_ITEMS: { id: SettingsSection; label: string; description: string }[] = [
  { id: "profile", label: "Profile", description: "Manage your account details" },
  { id: "api-keys", label: "API Keys", description: "Create and revoke API keys" },
  { id: "notifications", label: "Notifications", description: "Configure alerts and emails" },
  { id: "admin", label: "Admin", description: "Platform administration" },
];

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-8">
      <h2 className="text-base font-semibold text-heading">{title}</h2>
      <p className="mt-1 text-sm text-body">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-border/50 bg-muted/5 p-6 text-center">
        <span className="font-mono text-xs text-muted-foreground">Coming soon</span>
      </div>
    </div>
  );
}

function ProfileSection() {
  return (
    <PlaceholderSection
      title="Profile"
      description="Your name, avatar, and public profile information."
    />
  );
}

function ApiKeysSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-card/20 p-8">
        <h2 className="text-base font-semibold text-heading">API Keys</h2>
        <p className="mt-1 text-sm text-body">
          Use API keys to authenticate requests to the UnClick API.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-border/50 bg-muted/5 p-6 text-center">
          <span className="font-mono text-xs text-muted-foreground">
            Key management coming soon — see{" "}
            <a href="/docs" className="text-primary hover:underline">
              /docs
            </a>{" "}
            to get started
          </span>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <PlaceholderSection
      title="Notifications"
      description="Email alerts, Arena activity, and digest preferences."
    />
  );
}

function AdminSection() {
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.03] p-8">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-heading">Admin</h2>
        <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
          Restricted
        </span>
      </div>
      <p className="mt-1 text-sm text-body">
        Platform-level controls. Visible to admin accounts only.
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-amber-400/20 bg-muted/5 p-6 text-center">
        <span className="font-mono text-xs text-muted-foreground">Admin panel coming soon</span>
      </div>
    </div>
  );
}

const SECTION_CONTENT: Record<SettingsSection, React.ReactNode> = {
  profile: <ProfileSection />,
  "api-keys": <ApiKeysSection />,
  notifications: <NotificationsSection />,
  admin: <AdminSection />,
};

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("profile");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pb-32 pt-28">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-body">Manage your account and platform preferences.</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-48 shrink-0">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    active === item.id
                      ? "bg-primary/10 text-heading font-medium"
                      : "text-body hover:bg-card/40 hover:text-heading"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">{SECTION_CONTENT[active]}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
