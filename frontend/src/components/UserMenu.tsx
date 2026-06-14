import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function Avatar({ email }: { email?: string }) {
  const letter = (email?.[0] ?? "?").toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {letter}
    </span>
  );
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="absolute bottom-full mb-2 w-48 overflow-hidden rounded-lg border border-border glass shadow-xl">
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-muted",
          collapsed && "justify-center"
        )}
      >
        <Avatar email={user?.email} />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {user?.email?.split("@")[0]}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
