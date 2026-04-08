import { Link, useLocation } from "react-router-dom";

const tabs = [
  { label: "All Problems", href: "/arena", exact: true },
  { label: "Leaderboard", href: "/arena/leaderboard" },
  { label: "Submit Problem", href: "/arena/submit" },
];

export default function ArenaNav() {
  const { pathname } = useLocation();

  return (
    <div className="flex items-center gap-1 border-b border-border/40 mt-8">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <div key={tab.label} className="relative">
            {tab.soon ? (
              <span className="flex cursor-default items-center gap-1.5 px-4 py-2.5 text-sm text-muted-custom">
                {tab.label}
                <span className="rounded bg-border/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-custom">
                  soon
                </span>
              </span>
            ) : (
              <Link
                to={tab.href}
                className={`flex items-center px-4 py-2.5 text-sm transition-colors hover:text-heading ${
                  active ? "text-heading" : "text-body"
                }`}
              >
                {tab.label}
              </Link>
            )}
            {active && !tab.soon && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-primary" />
            )}
          </div>
        );
      })}
    </div>
  );
}
