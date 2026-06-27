import { MonomonArt } from "./MonomonArt";
import { CATEGORY_STYLES, MATERIAL_STYLES } from "@/lib/monomon-data";
import { formatDiscoveredDate, type Monomon } from "@/lib/monomon";
import { cn } from "@/lib/utils";

interface MonomonCardProps {
  monomon: Monomon;
  className?: string;
  /** 登場アニメーション */
  animate?: boolean;
}

/** 保存したくなる、上質なモノモンカード（写真から精霊が飛び出す構図）。 */
export function MonomonCard({ monomon, className, animate }: MonomonCardProps) {
  const style = CATEGORY_STYLES[monomon.category];
  const mat = MATERIAL_STYLES[monomon.material];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-white/60 bg-card shadow-float",
        animate && "animate-pop-in",
        className,
      )}
    >
      {/* イラストエリア */}
      <div className="relative h-64">
        {/* 元写真をうっすら背景に */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={monomon.photo}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[3px]"
          />
          <div
            className="absolute inset-0 opacity-[0.86]"
            style={{
              backgroundImage: `linear-gradient(165deg, ${mat.bg[0]}, ${mat.bg[1]})`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(120% 90% at 50% 18%, ${mat.tint}22, transparent 60%)`,
            }}
          />
          {/* 上質な光沢 */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/55 to-transparent" />
        </div>

        {/* チップ */}
        <span className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
          {mat.emoji} {mat.label}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
          {style.emoji} {monomon.category}
        </span>

        {/* 飛び出すモノモン */}
        <div className="absolute bottom-0 left-1/2 h-60 w-60 -translate-x-1/2 translate-y-7">
          <span
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ backgroundColor: `${style.cheek}55` }}
          />
          <div className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_22px_rgba(90,60,40,0.28)]">
            <MonomonArt monomon={monomon} />
          </div>
        </div>
      </div>

      {/* 情報エリア */}
      <div className="px-6 pb-6 pt-9">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-3xl font-extrabold text-foreground">{monomon.name}</h2>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: style.cheek }}
          >
            {monomon.personality}
          </span>
        </div>

        <p className="mt-3 rounded-2xl bg-muted/70 px-4 py-3 text-[0.95rem] font-medium leading-relaxed text-foreground">
          「{monomon.description}」
        </p>

        <p className="mt-3 text-right text-xs font-medium text-muted-foreground">
          発見日　{formatDiscoveredDate(monomon.discoveredAt)}
        </p>
      </div>
    </div>
  );
}
