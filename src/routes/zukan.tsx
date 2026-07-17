import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, MoreHorizontal, Trash2 } from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { BottomNav } from "@/components/BottomNav";
import { FriendshipMeter } from "@/components/FriendshipMeter";
import {
  useDex,
  useNewDex,
  clearNew,
  meetMonomon,
  petMonomon,
  removeFromDex,
  toggleFavorite,
} from "@/lib/dex";
import { getReunionDialogue, getFriendship } from "@/lib/friendship";
import { formatDiscoveredDate, type Monomon } from "@/lib/monomon";
import { tap, haptic } from "@/lib/sound";
import { trackZukanOpen } from "@/lib/analytics";
import { useComposedPhoto } from "@/hooks/useComposedPhoto";

export const Route = createFileRoute("/zukan")({
  head: () => ({
    meta: [
      { title: "思い出｜モノモン" },
      {
        name: "description",
        content: "出会ったモノたちの静かな日記",
      },
    ],
  }),
  component: Memories,
});

/**
 * 思い出（旧・図鑑）。
 *
 * v3.0：ギャラリーではなく「記憶の日記」。
 * 1件=1つの見開き。大きな写真・日付・モノの名前・小さなモノモン・一行の詩。
 * 統計・レア度・収集率・レベルは持たない。
 */
function Memories() {
  const dex = useDex();
  const newIds = useNewDex();
  const newSet = useMemo(() => new Set(newIds), [newIds]);
  const [selected, setSelected] = useState<Monomon | null>(null);

  useEffect(() => {
    trackZukanOpen();
  }, []);

  return (
    <div
      className="min-h-[100svh] px-6 pb-32 pt-[max(1.75rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: "#FAF8F3" }}
    >
      <header className="mb-8 pt-2">
        <p className="text-[13px] font-medium tracking-[0.02em] text-foreground/55">
          {dex.length === 0 ? "まだ何もない日記" : "出会ったモノたち"}
        </p>
      </header>

      {dex.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-10">
          {dex.map((m) => (
            <li key={m.id}>
              <MemoryPage
                monomon={m}
                isNew={newSet.has(m.id)}
                onOpen={() => {
                  tap();
                  clearNew(m.id);
                  setSelected(m);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <MemorySheet monomon={selected} onClose={() => setSelected(null)} />
      )}

      <BottomNav />
    </div>
  );
}

/**
 * 一葉の見開き。
 * 大きな写真の下に、日付・モノの名前・小さなモノモン・一行の詩。
 */
function MemoryPage({
  monomon,
  isNew,
  onOpen,
}: {
  monomon: Monomon;
  isNew: boolean;
  onOpen: () => void;
}) {
  const noun = monomon.objectLabel?.trim() || monomon.name;
  const composed = useComposedPhoto(monomon.id, monomon.hasComposed);
  const displaySrc = composed ?? monomon.photo;
  return (
    <button
      onClick={onOpen}
      className="group block w-full text-left"
      aria-label={`${noun}の思い出を開く`}
    >
      {/* 写真：主役（合成があれば「宿った1枚」を表示） */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px]"
        style={{
          boxShadow: "0 20px 40px -22px rgba(60,45,25,0.30)",
        }}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-active:scale-[0.985]"
          />
        ) : (
          <div className="h-full w-full bg-white/60" />
        )}

        {/* 合成が無いときだけ、控えめなSVGモノモンを添える */}
        {!composed && (
          <div className="pointer-events-none absolute -bottom-2 right-3 h-20 w-20 drop-shadow-[0_10px_14px_rgba(60,45,25,0.28)]">
            <MonomonArt monomon={monomon} />
          </div>
        )}

        {/* NEW は静かなドット1つ */}
        {isNew && (
          <span
            aria-label="新しい思い出"
            className="absolute right-4 top-4 h-2 w-2 rounded-full bg-foreground/70"
          />
        )}
      </div>

      {/* キャプション：日付・モノの名前・一行の詩 */}
      <div className="mt-4 px-1">
        <p className="text-[11px] font-medium tracking-[0.08em] text-foreground/45">
          {formatDiscoveredDate(monomon.discoveredAt)}
        </p>
        <p className="mt-1 text-[15px] font-medium leading-relaxed text-foreground/80">
          {noun}
        </p>
        <p className="mt-2 whitespace-pre-line text-[13px] font-medium leading-[1.9] text-foreground/55">
          {monomon.description}
        </p>
      </div>
    </button>
  );
}

/**
 * 記憶の一葉を開いた画面。
 * 写真が支配的。モノモンは静かに脇に佇む。
 * 削除・お気に入りは低優先で「…」の中に。
 */
function MemorySheet({
  monomon,
  onClose,
}: {
  monomon: Monomon;
  onClose: () => void;
}) {
  const [live, setLive] = useState<Monomon>(monomon);
  const [reunionLine, setReunionLine] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // 今日はじめての来訪なら再会のセリフをそっと表示
  useEffect(() => {
    const r = meetMonomon(monomon.id);
    if (r) {
      setLive(r.monomon);
      setReunionLine(
        getReunionDialogue({
          reunionCount: r.reunionCount,
          daysSinceLastMet: r.daysSinceLastMet,
          friendship: getFriendship(r.monomon),
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noun = live.objectLabel?.trim() || live.name;
  const composed = useComposedPhoto(live.id, live.hasComposed);
  const displaySrc = composed ?? live.photo;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: "#FAF8F3" }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ backgroundColor: "rgba(250,248,243,0.85)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => {
            tap();
            onClose();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 active:scale-95"
          aria-label="閉じる"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative">
          <button
            onClick={() => {
              tap();
              setMenuOpen((v) => !v);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/60 active:scale-95"
            aria-label="その他"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-11 w-44 overflow-hidden rounded-2xl border border-black/[0.04] bg-white/95 shadow-[0_12px_30px_-14px_rgba(60,45,25,0.28)] backdrop-blur"
            >
              <button
                onClick={() => {
                  if (
                    !window.confirm("この思い出を そっと手放してもいい？")
                  ) {
                    return;
                  }
                  removeFromDex(live.id);
                  onClose();
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-foreground/70 active:bg-black/[0.03]"
              >
                <Trash2 className="h-4 w-4" />
                思い出を手放す
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-24">
        {/* 大きな写真（主役） */}
        <div
          className="relative mx-auto mt-2 aspect-[4/5] w-full max-w-md overflow-hidden rounded-[28px]"
          style={{
            boxShadow: "0 24px 48px -22px rgba(60,45,25,0.30)",
          }}
        >
          {displaySrc && (
            <img src={displaySrc} alt="" className="h-full w-full object-cover" />
          )}
          {/* お気に入りはハートだけ、静かに */}
          <button
            onClick={() => {
              haptic(10);
              toggleFavorite(live.id);
              setLive({ ...live, favorite: !live.favorite });
            }}
            aria-label="お気に入り"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 backdrop-blur-md active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                live.favorite
                  ? "fill-foreground text-foreground"
                  : "text-foreground/50"
              }`}
            />
          </button>
        </div>

        {/* 日付・モノの名前 */}
        <div className="mt-8 text-center">
          <p className="text-[11px] font-medium tracking-[0.14em] text-foreground/45">
            {formatDiscoveredDate(live.discoveredAt)}
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-[0.02em] text-foreground/85">
            {noun}
          </h1>
        </div>

        {/* 一行の詩 */}
        <p className="mx-auto mt-6 max-w-[20rem] whitespace-pre-line text-center text-[15px] font-medium leading-[2] text-foreground/70">
          {live.description}
        </p>

        {/* 小さなモノモンをそっと触れる */}
        <div className="mt-10 flex flex-col items-center">
          <button
            onClick={() => {
              haptic(8);
              petMonomon(live.id);
              setLive({
                ...live,
                friendship: Math.min(100, (live.friendship ?? 0) + 1),
              });
            }}
            className="h-28 w-28 transition-transform active:scale-95"
            aria-label="そっと触れる"
          >
            <MonomonArt monomon={live} />
          </button>

          {/* なかよし度は数値ではなく気配だけ */}
          <FriendshipMeter monomon={live} className="mt-4" />

          {reunionLine && (
            <p className="mt-4 text-[13px] font-medium text-foreground/55">
              「{reunionLine}」
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center text-center">
      <p className="text-[15px] font-medium leading-[2] text-foreground/60">
        {"まだ何も\n記されていません"}
      </p>
      <p className="mt-4 whitespace-pre-line text-[13px] font-medium leading-[1.9] text-foreground/45">
        {"身の回りのモノを\nそっと撮ってみましょう"}
      </p>
      <Link
        to="/scan"
        onClick={tap}
        className="mt-10 rounded-full bg-foreground px-8 py-4 text-[14px] font-bold tracking-[0.08em] text-background shadow-[0_10px_30px_-14px_rgba(60,45,25,0.35)] active:scale-[0.985]"
      >
        探してみる
      </Link>
    </div>
  );
}
