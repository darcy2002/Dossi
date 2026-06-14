import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { GlowBackground } from "@/components/GlowBackground";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "dossi_sidebar_collapsed";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function toggleCollapse() {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      return !v;
    });
  }

  const onHistory = location.pathname.startsWith("/app/history");
  const tab = (label: string, to: string, active: boolean) => (
    <button
      onClick={() => navigate(to)}
      className={cn(
        "relative px-1 py-3 text-sm transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border transition-[width] duration-200 md:block",
          collapsed ? "w-[68px]" : "w-72"
        )}
      >
        <Sidebar collapsed={collapsed} onToggle={toggleCollapse} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <GlowBackground subtle={location.pathname.includes("/sessions/")} />

        <header className="relative z-10 flex items-center gap-3 px-4 py-3">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-lg font-semibold">Chat with Dossi</h1>
          <nav className="ml-auto mr-auto flex items-center gap-6">
            {tab("Chat", "/app", !onHistory)}
            {tab("History", "/app/history", onHistory)}
          </nav>
          <div className="w-9 md:w-0" />
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
