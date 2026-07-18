import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, BookHeart, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tap } from "@/lib/sound";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "ホーム", icon: Home, exact: true },
  { to: "/scan", label: "見つける", icon: Camera, exact: false },
  { to: "/zukan", label: "図鑑", icon: BookHeart, exact: false },
  { to: "/settings", label: "設定", icon: SettingsIcon, exact: false },
] as const;

/**
 * スクロール方向でナビの表示を切り替えるフック。
 * 下へ動かすとそっと隠れ、少し上へ動かすと戻ってくる。
 * しきい値を設けて小さな揺れでガタつかないようにしている。
 */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY.current;

      // 画面上部では常に表示する
      if (y < 24) {
        setHidden(false);
        lastY.current = y;
        return;
      }

      // 小さな揺れは無視する（自然な挙動）
      if (Math.abs(delta) < 8) return;

      setHidden(delta > 0);
      lastY.current = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

/** 全画面共通の下部ナビゲーション。現在地がひと目で分かります。 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hidden = useHideOnScroll();

  return (
    <nav
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 transition-transform duration-300 ease-out will-change-transform",
        hidden ? "translate-y-[140%]" : "translate-y-0",
      )}
    >
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
