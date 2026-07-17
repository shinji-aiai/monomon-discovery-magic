import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, BookHeart } from "lucide-react";
import { tap } from "@/lib/sound";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/scan", label: "Camera", icon: Camera, exact: false },
  { to: "/zukan", label: "Memories", icon: BookHeart, exact: false },
] as const;

/**
 * Minimal, calm bottom navigation.
 * Three tabs only. No pills, no gradients — just quiet type and an active dot.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="pointer-events-auto mx-auto flex max-w-sm items-stretch justify-around gap-1 rounded-[28px] border border-black/[0.04] bg-white/80 px-3 py-2 shadow-[0_8px_28px_-14px_rgba(60,45,25,0.18)] backdrop-blur-xl">
        {ITEMS.map((it) => {
          const active = it.exact
            ? pathname === "/"
            : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={tap}
              aria-label={it.label}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[0.68rem] font-medium tracking-wide transition-colors duration-500",
                active ? "text-foreground" : "text-muted-foreground/70",
              )}
            >
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2 : 1.6}
              />
              <span>{it.label}</span>
              <span
                className={cn(
                  "absolute -bottom-0.5 h-1 w-1 rounded-full transition-opacity duration-500",
                  active ? "bg-foreground opacity-70" : "opacity-0",
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
