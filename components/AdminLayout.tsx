import Link from "next/link";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Objects" },
  { href: "/admin/contributions", label: "Contributions" },
  { href: "/admin/queries", label: "Queries" },
  { href: "/admin/voice-sessions", label: "Voice sessions" },
  { href: "/admin/prompts", label: "Prompts" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-rule bg-bg-elev">
        <div className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="font-display italic text-[16px] text-ink">
              Practice Commons{" "}
              <span className="not-italic text-muted text-[11px] tracking-[0.22em] uppercase ml-2">
                Admin
              </span>
            </div>
            <nav className="flex gap-5 text-[12px] tracking-[0.14em] uppercase font-body">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="plain text-muted hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[11px] tracking-[0.16em] uppercase font-body">
            <Link href="/" className="plain text-muted hover:text-ink">
              View public site
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="plain text-muted hover:text-ink bg-transparent border-0 p-0 cursor-pointer font-body uppercase tracking-[0.16em] text-[11px]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap max-w-[1140px] mx-auto px-[40px] max-[900px]:px-[24px] py-10">
        {children}
      </main>
    </div>
  );
}
