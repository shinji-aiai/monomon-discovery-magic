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
  /**
   * Phase 1D：写真から生成した没入画像のObject URL。
   * 与えられたときは手続き的SVGの代わりに実画像をパネルに表示する。
   * 与えられないときは既存の v1.0 表示のまま。
   */
  immersionImageUrl?: string | null;
  /**
   * Phase 1D：没入画像を準備中（生成→圧縮→保存の途中）。
   * URLがまだ無いあいだの、そっとした「あらわれつつある」表現に使う。
   */
  immersionPending?: boolean;
}

export function MonomonCard({
  monomon,
  className,
  animate,
  onPet,
  immersionImageUrl,
  immersionPending,
}: MonomonCardProps) {
  const fam = FAMILY_STYLES[monomon.family];
  const species = getSpecies(monomon.speciesId);
  const accent = monomon.palette.c3;

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
        {immersionImageUrl ? (
          <>
            {/* 没入画像：ぼかしたコピーを背景にして、前面は object-contain で全形を保つ */}
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={immersionImageUrl}
                alt=""
                aria-hidden
                className="h-full w-full scale-110 object-cover blur-[10px] brightness-95"
              />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/30 to-transparent" />
            </div>
            {onPet ? (
              <button
                type="button"
                onClick={onPet}
                aria-label="なでる"
                className="absolute inset-0 flex cursor-pointer items-center justify-center transition-transform active:scale-95"
              >
                <img
                  src={immersionImageUrl}
                  alt={`${monomon.objectLabel ?? species.name}に宿る${monomon.name}`}
                  className="h-full w-full animate-pop-in object-contain drop-shadow-[0_16px_22px_rgba(90,60,40,0.28)]"
                />
              </button>
            ) : (
              <img
                src={immersionImageUrl}
                alt={`${monomon.objectLabel ?? species.name}に宿る${monomon.name}`}
                className="absolute inset-0 h-full w-full animate-pop-in object-contain drop-shadow-[0_16px_22px_rgba(90,60,40,0.28)]"
              />
            )}
          </>
        ) : (
          <>
            {/* 元写真をうっすら背景に */}
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={monomon.photo}
                alt=""
                className={cn(
                  "h-full w-full scale-110 object-cover blur-[3px]",
                  immersionPending && "animate-breathe",
                )}
              />
              <div
                className="absolute inset-0 opacity-[0.86]"
                style={{
                  backgroundImage: `linear-gradient(165deg, ${fam.bg[0]}, ${fam.bg[1]})`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(120% 90% at 50% 18%, ${fam.tint}22, transparent 60%)`,
                }}
              />
              {/* 上質な光沢 */}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/55 to-transparent" />
            </div>

            {/* モノモン（全身が必ず収まるよう中央に contain 配置） */}
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div className="relative h-full w-full">
                <span
                  className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
                  style={{ backgroundColor: `${accent}55` }}
                />
                <div className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_22px_rgba(90,60,40,0.28)]">
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
          </>
        )}

        {/* チップ：AIが認識した「モノ」（画像の有無に関わらず表示） */}
        <span className="absolute left-4 top-4 max-w-[60%] truncate rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
          {species.emoji} {monomon.objectLabel ?? species.name}
          {monomon.uncertain && "の仲間かも？"}
        </span>
        <span className="absolute right-4 top-4 whitespace-nowrap rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
          {fam.emoji} {fam.label}族
        </span>

        {immersionPending && !immersionImageUrl && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold text-foreground/70 shadow-soft backdrop-blur-sm">
            写真の中に姿をあらわしているよ…
          </span>
        )}
      </div>



      {/* 情報エリア（名前 → 性格 → 一言の順で見せる） */}
      <div className="px-6 pb-6 pt-9 text-center">
        {/* 名前：最優先・常に1行・中央。長い名前は自動で少し縮小 */}
        <AutoFitName maxFontSize={30} minFontSize={16} className="font-extrabold text-foreground">
          {monomon.name}
        </AutoFitName>

        {/* 性格（精神）：名前の下に配置 */}
        <div className="mt-3 flex justify-center">
          <span
            className="rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {monomon.personality}
          </span>
        </div>

        {/* 一言：最後に */}
        <p className="mt-3 rounded-2xl bg-muted/70 px-4 py-3 text-left text-[0.95rem] font-medium leading-relaxed text-foreground">
          「{monomon.description}」
        </p>

        {monomon.uncertain && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            ※ AIは少し自信がないみたい　{monomon.objectLabel ?? "この子"}の仲間かもしれない
          </p>
        )}

        <p className="mt-3 text-right text-xs font-medium text-muted-foreground">
          発見日　{formatDiscoveredDate(monomon.discoveredAt)}
        </p>
      </div>
    </div>
  );
}
