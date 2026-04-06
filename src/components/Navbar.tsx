const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
    <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
      <span className="font-mono text-lg font-semibold text-heading tracking-tight">UnClick</span>
      <div className="hidden items-center gap-8 md:flex">
        <a href="#tools" className="text-sm text-body transition-colors hover:text-heading">Tools</a>
        <a href="#pricing" className="text-sm text-body transition-colors hover:text-heading">Pricing</a>
        <a href="#" className="text-sm text-body transition-colors hover:text-heading">Docs</a>
      </div>
      <a
        href="#"
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Get API Key
      </a>
    </div>
  </nav>
);

export default Navbar;
