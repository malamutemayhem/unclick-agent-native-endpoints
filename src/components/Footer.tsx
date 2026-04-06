const footerLinks = [
  { label: "Get Started Free", href: "/docs" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/unclick-world", external: true },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Status", href: "https://status.unclick.world", external: true },
  { label: "Contact", href: "mailto:chris@unclick.world" },
];

const Footer = () => (
  <footer className="border-t border-border px-6 py-10">
    <div className="container mx-auto max-w-5xl">
      <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div>
          <span className="font-mono text-sm font-semibold text-heading">UnClick</span>
          <p className="mt-1 text-xs text-muted-custom">Agent-native APIs. Built in Melbourne, Australia.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-xs text-muted-custom transition-colors hover:text-body"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="mt-6 border-t border-border/40 pt-6 text-center">
        <span className="text-xs text-muted-custom">&copy; 2026 UnClick Pty Ltd. All rights reserved.</span>
      </div>
    </div>
  </footer>
);

export default Footer;
