import { MonomonArt } from "./MonomonArt";
import { CATEGORY_STYLES } from "@/lib/monomon-data";
import { formatDiscoveredDate, type Monomon } from "@/lib/monomon";
import { cn } from "@/lib/utils";

interface MonomonCardProps {
  monomon: Monomon;
  className?: string;
  /** 登場アニメーション */
  animate?: boolean;
}

/** 保存したくなるモノモンカード。 */
export function MonomonCard({ monomon, className, animate }: MonomonCardProps) {
  const style = CATEGORY_STYLES[monomon.category];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-card shadow-float",
        animate && "animate-pop-in",
        className,
      )}
    >
      {/* イラストエリア */}
      <div
        className="relative flex items-center justify-center px-6 pt-8 pb-4"
        style={{
          backgroundImage: `linear-gradient(160deg, ${style.bg[0]}, ${style.bg[1]})`,
        }}
      >
        <span className="absolute right-4 top-4 rounded-full bg-card/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur">
          {style.emoji} {monomon.category}
        </span>
        <div className="h-52 w-52 animate-float-soft">
          <MonomonArt seed={monomon.seed} category={monomon.category} />
        </div>
      </div>

      {/* 情報エリア */}
      <div className="px-6 pb-6 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-3xl font-extrabold text-foreground">{monomon.name}</h2>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-card"
            style={{ backgroundColor: style.cheek }}
          >
            {monomon.personality}
          </span>
        </div>

        <p className="mt-3 rounded-2xl bg-muted/70 px-4 py-3 text-[0.95rem] font-medium leading-relaxed text-foreground">
          「{monomon.description}」
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border">
            <img
              src={monomon.photo}
              alt="元になった写真"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">元になった写真</p>
            <p className="font-medium text-foreground">
              発見日　{formatDiscoveredDate(monomon.discoveredAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
