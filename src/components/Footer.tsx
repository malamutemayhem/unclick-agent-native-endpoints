const Footer = () => (
  <footer className="border-t border-border px-6 py-8">
    <div className="container mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
      <span className="text-xs text-muted-custom">&copy; 2026 UnClick. Melbourne, Australia.</span>
      <div className="flex gap-6">
        {["Docs", "Status", "GitHub", "Terms"].map((link) => (
          <a key={link} href="#" className="text-xs text-muted-custom transition-colors hover:text-body">
            {link}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

export default Footer;
