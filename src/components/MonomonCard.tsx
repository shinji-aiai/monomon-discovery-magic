import { MonomonArt } from "./MonomonArt";
import { AutoFitName } from "./AutoFitName";
import { FAMILY_STYLES } from "@/lib/monomon-data";
import { getSpecies } from "@/lib/species";
import { formatDiscoveredDate, type Monomon } from "@/lib/monomon";
import { auraVars } from "@/lib/aura";
import { cn } from "@/lib/utils";

interface MonomonCardProps {
  monomon: Monomon;
  className?: string;
  /** 登場アニメーション */
  animate?: boolean;
  /** モノモンをタップ（なでる）したときの処理。渡すとイラストが押せるようになる */
  onPet?: () => void;
  /** 中央イラストを公式静的アセットで表示（発見結果画面用） */
  preferOfficialArt?: boolean;
  /** 見た目バリアント：discovery=結果画面用（元写真ブラー背景・枠を隠して背景に溶け込ませる） */
  variant?: "default" | "discovery";
}

/** 保存したくなる、上質なモノモンカード（写真から精霊が飛び出す構図）。 */
export function MonomonCard({ monomon, className, animate, onPet, preferOfficialArt, variant = "default" }: MonomonCardProps) {
  const fam = FAMILY_STYLES[monomon.family];
  const species = getSpecies(monomon.speciesId);
  const accent = monomon.palette.c3;
  const isDiscovery = variant === "discovery";
  // 撮ったモノの色の雰囲気（本体は変えず、まわりの空気だけ寄せる）
  const aura = auraVars(monomon);

  return (
    <div
      style={aura}
      className={cn(
        "relative overflow-hidden rounded-[30px]",
        isDiscovery
          ? "border-0 bg-transparent shadow-none"
          : "border border-white/60 bg-card shadow-float",
        animate && "animate-pop-in",
        className,
      )}
    >
      {/* カード全体にうっすら、撮ったモノの色の空気 */}
      <span aria-hidden className="monomon-object-ambient" />
      {/* イラストエリア */}
      <div className="relative h-64">
        {/* 元写真をうっすら背景に（結果画面では背景に溶け込ませたいので非表示） */}
        {!isDiscovery && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={monomon.photo}
              alt=""
              className="h-full w-full scale-110 object-cover blur-[3px]"
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
        )}

        {/* チップ：AIが認識した「モノ」（結果画面では隠して背景に溶け込ませる） */}
        {!isDiscovery && (
          <>
            <span className="absolute left-4 top-4 max-w-[60%] truncate rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
              {species.emoji} {monomon.objectLabel ?? species.name}
              {monomon.uncertain && "の仲間かも？"}
            </span>
            <span className="absolute right-4 top-4 whitespace-nowrap rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-foreground/70 backdrop-blur-sm">
              {species.emoji} {species.name}
            </span>
          </>
        )}

        {/* モノモン（全身が必ず収まるよう中央に contain 配置） */}
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <div className="relative h-full w-full">
            {isDiscovery && <span aria-hidden className="character-sun-rays" />}
            {isDiscovery && <span aria-hidden className="character-warm-glow" />}
            {isDiscovery && (
              <span aria-hidden className="discovery-sparkles">
                <i style={{ left: "18%", top: "22%", animationDelay: "0s" }} />
                <i style={{ left: "78%", top: "30%", animationDelay: "0.6s" }} />
                <i style={{ left: "30%", top: "70%", animationDelay: "1.2s" }} />
                <i style={{ left: "82%", top: "68%", animationDelay: "1.8s" }} />
                <i style={{ left: "10%", top: "50%", animationDelay: "2.4s" }} />
                <i style={{ left: "62%", top: "12%", animationDelay: "3.0s" }} />
              </span>
            )}
            {!isDiscovery && (
              <span
                className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
                style={{ backgroundColor: `${accent}55` }}
              />
            )}
            <div className="relative h-full w-full animate-float-soft drop-shadow-[0_16px_22px_rgba(90,60,40,0.28)]">
              {onPet ? (
                <button
                  type="button"
                  onClick={onPet}
                  aria-label="なでる"
                  className="h-full w-full cursor-pointer transition-transform active:scale-90"
                >
                  <MonomonArt monomon={monomon} preferOfficial={preferOfficialArt} />
                </button>
              ) : (
                <MonomonArt monomon={monomon} preferOfficial={preferOfficialArt} />
              )}
            </div>
          </div>
        </div>

      </div>



      {/* 情報エリア（名前 → 性格 → 一言の順で見せる） */}
      <div className={cn("text-center", isDiscovery ? "px-2 pb-2 pt-6" : "px-6 pb-6 pt-9")}>
        {/* 名前：最優先・常に1行・中央。長い名前は自動で少し縮小 */}
        <AutoFitName
          maxFontSize={isDiscovery ? 38 : 30}
          minFontSize={18}
          className={cn(
            "font-extrabold text-foreground",
            isDiscovery && "drop-shadow-[0_2px_10px_rgba(255,255,255,0.7)]",
          )}
        >
          {monomon.name}
        </AutoFitName>

        {/* 性格（精神）：名前の下に配置 */}
        <div className="mt-3 flex justify-center">
          <span
            className={cn(
              "rounded-full text-xs font-bold text-white",
              isDiscovery ? "px-5 py-1.5 text-sm shadow-[0_4px_12px_rgba(60,120,220,0.35)]" : "px-3 py-1",
            )}
            style={{
              backgroundColor: isDiscovery ? "#4A90E2" : accent,
            }}
          >
            {monomon.personality}
          </span>
        </div>

        {/* 一言：最後に */}
        <p
          className={cn(
            "mt-4 text-left text-[0.95rem] font-medium leading-relaxed text-foreground",
            isDiscovery
              ? "discovery-glass-capsule rounded-full px-5 py-3 text-center"
              : "rounded-2xl bg-muted/70 px-4 py-3",
          )}
        >
          「{monomon.description}」
        </p>

        {monomon.uncertain && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            ※ AIは少し自信がないみたい　{monomon.objectLabel ?? "この子"}の仲間かもしれない
          </p>
        )}

        <p
          className={cn(
            "mt-3 text-right text-xs font-medium",
            isDiscovery ? "text-foreground/70" : "text-muted-foreground",
          )}
        >
          発見日　{formatDiscoveredDate(monomon.discoveredAt)}
        </p>
      </div>
    </div>
  );
}
