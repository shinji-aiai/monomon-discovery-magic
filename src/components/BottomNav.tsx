import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, BookHeart, Settings as SettingsIcon } from "lucide-react";
import { tap } from "@/lib/sound";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "ホーム", icon: Home, exact: true },
  { to: "/scan", label: "見つける", icon: Camera, exact: false },
  { to: "/zukan", label: "図鑑", icon: BookHeart, exact: false },
  { to: "/settings", label: "設定", icon: SettingsIcon, exact: false },
] as const;

/** 全画面共通の下部ナビゲーション。現在地がひと目で分かります。 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      <div className="pointer-events-auto mx-auto flex max-w-sm items-stretch justify-between gap-1 rounded-[26px] border border-white/60 bg-card/85 p-1.5 shadow-float backdrop-blur-xl">
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
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[0.66rem] font-bold transition-all active:scale-95",
                active
                  ? "gradient-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.6 : 2.2}
              />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
