import { MonomonArt } from "./MonomonArt";
import { AutoFitName } from "./AutoFitName";
import { FAMILY_STYLES } from "@/lib/monomon-data";
import { getSpecies } from "@/lib/species";
import { formatDiscoveredDate, type Monomon } from "@/lib/monomon";
import { cn } from "@/lib/utils";

interface MonomonCardProps {
  monomon: Monomon;
  className?: string;
  /** 登場アニメーション */
  animate?: boolean;
  /** モノモンをタップ（なでる）したときの処理。渡すとイラストが押せるようになる */
  onPet?: () => void;
}

/** 保存したくなる、上質なモノモンカード（写真から精霊が飛び出す構図）。 */
export function MonomonCard({ monomon, className, animate, onPet }: MonomonCardProps) {
  const fam = FAMILY_STYLES[monomon.family];
  const species = getSpecies(monomon.speciesId);
  const accent = monomon.palette.c3;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-border/50 bg-card shadow-float",
        animate && "animate-pop-in",
        className,
      )}
    >
      {/* イラストエリア（静かで奥行きのある背景） */}
      <div className="relative h-64">
        <div className="absolute inset-0 overflow-hidden">
          {/* 元写真をとても淡く背景に */}
          <img
            src={monomon.photo}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[8px]"
          />
          <div
            className="absolute inset-0 opacity-[0.94]"
            style={{
              backgroundImage: `linear-gradient(168deg, ${fam.bg[0]}, ${fam.bg[1]})`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(130% 90% at 50% 22%, ${fam.tint}1f, transparent 62%)`,
            }}
          />
          {/* かすかな光のにじみ */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/40 to-transparent" />
        </div>

        {/* チップ：控えめに、紙のような質感 */}
        <span className="absolute left-4 top-4 max-w-[60%] truncate rounded-full bg-card/80 px-3 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground shadow-soft backdrop-blur">
          {species.emoji} {monomon.objectLabel ?? species.name}
          {monomon.uncertain && "の仲間かも"}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-card/80 px-3 py-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground shadow-soft backdrop-blur">
          {fam.emoji} {fam.label}
        </span>

        {/* モノモン（全身が必ず収まるよう中央に contain 配置） */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative h-full w-full">
            <span
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{ backgroundColor: `${accent}33` }}
            />
            <div className="relative h-full w-full animate-float-soft drop-shadow-[0_10px_18px_rgba(80,55,35,0.18)]">
              {onPet ? (
                <button
                  type="button"
                  onClick={onPet}
                  aria-label="なでる"
                  className="h-full w-full cursor-pointer transition-transform active:scale-90"
                >
                  <MonomonArt monomon={monomon} />
                </button>
              ) : (
                <MonomonArt monomon={monomon} />
              )}
            </div>
          </div>
        </div>
      </div>


      {/* 情報エリア（余白多め・上質な組版） */}
      <div className="px-7 pb-7 pt-8 text-center">
        {/* 名前 */}
        <AutoFitName maxFontSize={30} minFontSize={16} className="font-extrabold tracking-tight text-foreground">
          {monomon.name}
        </AutoFitName>

        {/* 性格 */}
        <div className="mt-3 flex justify-center">
          <span className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-[0.72rem] font-medium tracking-wide text-secondary-foreground">
            {monomon.personality}
          </span>
        </div>

        {/* 一言：絵本のような静かな余白で */}
        <p className="mt-5 rounded-2xl bg-muted/50 px-5 py-4 text-left text-[0.95rem] font-normal leading-[1.9] text-foreground/85">
          「{monomon.description}」
        </p>

        {monomon.uncertain && (
          <p className="mt-3 text-xs font-normal leading-relaxed text-muted-foreground">
            {monomon.objectLabel ?? "この子"}の仲間かもしれない
          </p>
        )}

        <p className="mt-5 text-right text-[0.7rem] font-medium tracking-wide text-muted-foreground/80">
          発見　{formatDiscoveredDate(monomon.discoveredAt)}
        </p>
      </div>
    </div>
  );
}

