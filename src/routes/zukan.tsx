import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  X,
  ArrowLeft,
  Download,
  Share2,
  Loader2,
  Heart,
  Star,
  Lock,
  Search,
  Home,
  Trash2,
} from "lucide-react";
import { MonomonArt } from "@/components/MonomonArt";
import { StoredImmersionVisual } from "@/components/StoredImmersionVisual";
import { useImmersionImageUrl } from "@/hooks/use-immersion-image-url";
import { AutoFitName } from "@/components/AutoFitName";
import { MonomonCard } from "@/components/MonomonCard";
import { ShareModal } from "@/components/ShareModal";
import { BottomNav } from "@/components/BottomNav";
import { FriendshipMeter } from "@/components/FriendshipMeter";
import { SupportButton } from "@/components/SupportButton";
import {
  useDex,
  useNewDex,
  toggleFavorite,
  clearNew,
  meetMonomon,
  petMonomon,
  removeFromDex,
} from "@/lib/dex";
import { getReunionDialogue, getFriendship } from "@/lib/friendship";
import { FAMILY_STYLES, type Family } from "@/lib/monomon-data";
import { SPECIES, SPECIES_COUNT, getSpecies, type Species } from "@/lib/species";
import { getRarity, getRarityLabel } from "@/lib/rarity";
import { saveCardImage } from "@/lib/card-image";
import type { Monomon } from "@/lib/monomon";
import { tap, playSound, haptic } from "@/lib/sound";
import { trackZukanOpen } from "@/lib/analytics";

export const Route = createFileRoute("/zukan")({
  head: () => ({
    meta: [
      { title: "図鑑｜モノモン" },
      {
        name: "description",
        content: "見つけた種族と出会った個体たちの図鑑　集めてお気に入りを見つけよう",
      },
    ],
  }),
  component: Zukan,
});

type Mode = "species" | "album";

/** レア度の星表示（★1〜★5）。 */
function RarityStars({ speciesId, dim }: { speciesId: string; dim?: boolean }) {
  const r = getRarity(speciesId);
  return (
    <span className="inline-flex items-center gap-[1px]" aria-label={`レア度 ${r}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < r
              ? dim
                ? "fill-muted-foreground/40 text-muted-foreground/40"
                : "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function Zukan() {
  const dex = useDex();
  const newIds = useNewDex();
  const newSet = useMemo(() => new Set(newIds), [newIds]);
  const [selected, setSelected] = useState<Monomon | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [mode, setMode] = useState<Mode>("species");
  const [favOnly, setFavOnly] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // 図鑑画面を開いた回数を計測
  useEffect(() => {
    trackZukanOpen();
  }, []);

  // 種族ごとに、見つけた個体をまとめる
  const bySpecies = useMemo(() => {
    const map = new Map<string, Monomon[]>();
    for (const m of dex) {
      const arr = map.get(m.speciesId) ?? [];
      arr.push(m);
      map.set(m.speciesId, arr);
    }
    return map;
  }, [dex]);

  const kinds = bySpecies.size;

  // 種族（大分類）ごとの達成率
  const familyStats = useMemo(() => {
    const groups = new Map<Family, { total: number; found: number }>();
    for (const s of SPECIES) {
      const g = groups.get(s.family) ?? { total: 0, found: 0 };
      g.total += 1;
      if (bySpecies.has(s.id)) g.found += 1;
      groups.set(s.family, g);
    }
    return [...groups.entries()].map(([family, v]) => ({ family, ...v }));
  }, [bySpecies]);

  // 発見順の通し番号（No.001 = 最初の相棒）
  const numbered = useMemo(() => {
    const map = new Map<string, number>();
    [...dex]
      .sort(
        (a, b) =>
          new Date(a.discoveredAt).getTime() - new Date(b.discoveredAt).getTime(),
      )
      .forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [dex]);

  // 検索（種族名・絵文字でしぼり込み）
  const q = query.trim().toLowerCase();
  const filteredSpecies = useMemo(() => {
    if (!q) return SPECIES;
    return SPECIES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.emoji.includes(q),
    );
  }, [q]);

  let album = dex;
  if (speciesFilter) album = album.filter((m) => m.speciesId === speciesFilter);
  if (favOnly) album = album.filter((m) => m.favorite);
  if (q) {
    album = album.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        getSpecies(m.speciesId).name.toLowerCase().includes(q),
    );
  }

  const remaining = SPECIES_COUNT - kinds;

  return (
    <div className="relative min-h-[100svh] bg-night-room px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* 星屑・微細な粒子 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/70 animate-drift"
            style={{
              width: (i % 3) + 1.5,
              height: (i % 3) + 1.5,
              top: `${(i * 37) % 100}%`,
              left: `${(i * 53) % 100}%`,
              opacity: 0.35 + (i % 3) * 0.15,
              animationDelay: `${(i % 6) * 0.5}s`,
            }}
          />
        ))}
      </div>

      <header className="relative mb-5">
        <h1 className="text-2xl font-extrabold text-night">図鑑</h1>
        <p className="mt-1 text-sm font-medium text-night-muted">
          {dex.length} 匹のモノモンと出会えたよ
        </p>
      </header>

      {/* コレクション率（ガラスカード） */}
      <div className="relative mb-3 rounded-3xl glass-night px-5 py-4 shadow-purple-glow">
        <div className="flex items-end justify-between">
          <p className="text-sm font-extrabold text-night">コレクション</p>
          <p className="text-base font-extrabold text-night">
            <span className="text-white">{kinds}</span>
            <span className="mx-1 text-night-muted">/</span>
            {SPECIES_COUNT}
          </p>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(kinds / SPECIES_COUNT) * 100}%`,
              background:
                "linear-gradient(90deg, oklch(0.78 0.2 300), oklch(0.7 0.2 275))",
            }}
          />
        </div>
        <p className="mt-2 text-xs font-bold text-night-muted">
          {remaining > 0
            ? `あと ${remaining} 種族で コンプリート`
            : "🎉 ぜんぶ集めたよ おめでとう"}
        </p>
      </div>

      {/* 種族ごとの達成率 */}
      <FamilyProgress stats={familyStats} />

      {/* 検索バー */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputMode="search"
          placeholder="モノモンや種族をさがす"
          className="w-full rounded-2xl glass-night py-3 pl-11 pr-10 text-sm font-medium text-night outline-none placeholder:text-night-dim focus:ring-2 focus:ring-purple-300/40"
        />
        {query && (
          <button
            onClick={() => { tap(); setQuery(""); }}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-night-muted active:scale-90"
            aria-label="検索をクリア"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* モード切替 */}
      <div className="mb-5 flex gap-2">
        <ModeBtn
          active={mode === "species"}
          onClick={() => { setMode("species"); setSpeciesFilter(null); }}
        >
          図鑑
        </ModeBtn>
        <ModeBtn active={mode === "album"} onClick={() => setMode("album")}>
          発見アルバム
        </ModeBtn>
      </div>

      {mode === "species" ? (
        filteredSpecies.length === 0 ? (
          <NoResult />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredSpecies.map((sp) => {
              const found = bySpecies.get(sp.id);
              const isNew = found?.some((f) => newSet.has(f.id)) ?? false;
              return (
                <SpeciesCell
                  key={sp.id}
                  species={sp}
                  sample={found?.[0]}
                  count={found?.length ?? 0}
                  isNew={isNew}
                  onOpen={() => {
                    tap();
                    if (found) found.forEach((f) => clearNew(f.id));
                    setSelectedSpecies(sp);
                  }}
                />
              );
            })}
          </div>
        )
      ) : dex.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ChipBtn active={!favOnly} onClick={() => setFavOnly(false)}>すべて</ChipBtn>
            <ChipBtn active={favOnly} onClick={() => setFavOnly(true)}>
              <Star className="h-3.5 w-3.5" /> お気に入り
            </ChipBtn>
            {speciesFilter && (
              <button
                onClick={() => { tap(); setSpeciesFilter(null); }}
                className="ml-auto flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-night"
              >
                {getSpecies(speciesFilter).emoji} {getSpecies(speciesFilter).name}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {album.length === 0 ? (
            <div className="flex min-h-[36svh] flex-col items-center justify-center text-center">
              <Star className="h-10 w-10 text-white/40" />
              <p className="mt-3 text-sm font-bold text-night">ここには まだ いません</p>
              <p className="mt-1 text-xs text-night-muted">
                カードの♡で お気に入りに追加できる
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {album.map((m) => (
                <DexCell
                  key={m.id}
                  monomon={m}
                  no={numbered.get(m.id) ?? 0}
                  isNew={newSet.has(m.id)}
                  onOpen={() => { tap(); clearNew(m.id); setSelected(m); }}
                />
              ))}
              <Link
                to="/scan"
                onClick={tap}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/25 bg-white/5 text-night-muted active:scale-95"
              >
                <span className="text-2xl opacity-60">＋</span>
                <span className="text-[0.7rem] font-bold">まだ見ぬモノモン</span>
              </Link>
            </div>
          )}
        </>
      )}

      {selectedSpecies && (
        <SpeciesDetailSheet
          species={selectedSpecies}
          found={bySpecies.get(selectedSpecies.id) ?? []}
          onClose={() => setSelectedSpecies(null)}
          onOpenIndividual={(m) => { setSelectedSpecies(null); setSelected(m); }}
        />
      )}

      {selected && (
        <DetailSheet
          monomon={selected}
          no={numbered.get(selected.id) ?? 0}
          onClose={() => setSelected(null)}
        />
      )}

      <p className="mt-8 text-center text-sm font-medium text-night-muted">
        まだ見ぬモノモンが待っているよ
      </p>

      <BottomNav variant="night" />
    </div>
  );
}


function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        tap();
        onClick();
      }}
      className={`flex-1 rounded-2xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
        active
          ? "bg-white/15 text-white shadow-purple-glow ring-1 ring-white/25"
          : "glass-night text-night-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        tap();
        onClick();
      }}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
        active
          ? "bg-white/20 text-white ring-1 ring-white/30"
          : "glass-night text-night-muted"
      }`}
    >
      {children}
    </button>
  );
}


/** 種族（大分類）ごとの達成率。コンプリートした族はやさしくお祝い。 */
function FamilyProgress({
  stats,
}: {
  stats: { family: Family; total: number; found: number }[];
}) {
  return (
    <div className="mb-5 rounded-2xl glass-night px-4 py-3.5">
      <p className="mb-2.5 text-sm font-extrabold text-night">種族ごとの達成</p>
      <ul className="space-y-2.5">
        {stats.map(({ family, total, found }) => {
          const fam = FAMILY_STYLES[family];
          const complete = found === total;
          return (
            <li key={family} className="flex items-center gap-3">
              <span className="min-w-[6.5rem] shrink-0 whitespace-nowrap text-sm font-bold text-night">
                {fam.emoji} {fam.label}族
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(found / total) * 100}%`,
                    backgroundColor: fam.tint,
                  }}
                />
              </div>
              {complete ? (
                <span className="shrink-0 text-xs font-extrabold text-purple-200">
                  🎉
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold text-night-muted">
                  {found} / {total}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}



/** 新しく登録された子に付く「NEW!」バッジ（大きく・可愛く） */
function NewBadge() {
  return (
    <span className="animate-new-badge pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-primary-foreground shadow-float ring-2 ring-card">
      NEW!
    </span>
  );
}

/** 種族図鑑のセル（見つけた種族＝代表個体、未発見＝？？？シルエット） */
function SpeciesCell({
  species,
  sample,
  count,
  isNew,
  onOpen,
}: {
  species: Species;
  sample?: Monomon;
  count: number;
  isNew?: boolean;
  onOpen: () => void;
}) {
  const found = !!sample;
  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl glass-night active:scale-95"
    >
      {isNew && <NewBadge />}
      <div className="relative aspect-square p-2">
        {/* 紫の台座光 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-full pedestal-glow animate-pedestal-breathe"
        />
        {found ? (
          <>
            <div className="relative h-full w-full drop-shadow-[0_10px_14px_rgba(80,40,110,0.5)]">
              <MonomonArt monomon={sample} />
              <span className="glass-sheen rounded-[35%]" />
            </div>
            {count > 1 && (
              <span className="absolute bottom-1 right-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[0.58rem] font-extrabold text-night backdrop-blur">
                ×{count}
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-full w-full opacity-30 [filter:brightness(0)_invert(1)]">
              <MonomonArt seed={species.id.length * 7919 + 13} speciesId={species.id} />
            </div>
            <Lock className="absolute h-4 w-4 text-white/40" />
          </div>
        )}
      </div>
      <div className="px-1.5 pb-2">
        <AutoFitName className="font-extrabold text-night" maxFontSize={12}>
          {found ? (
            <>{species.emoji} {species.name}</>
          ) : (
            <span className="text-night-dim">？？？</span>
          )}
        </AutoFitName>
        <div className="mt-0.5 flex justify-center">
          <RarityStars speciesId={species.id} dim={!found} />
        </div>
      </div>
    </button>
  );
}

function DexCell({
  monomon,
  no,
  isNew,
  onOpen,
}: {
  monomon: Monomon;
  no: number;
  isNew?: boolean;
  onOpen: () => void;
}) {
  const species = getSpecies(monomon.speciesId);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl glass-night active:scale-95"
    >
      {isNew && <NewBadge />}
      <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-white/15 px-1.5 py-0.5 text-[0.56rem] font-extrabold text-night-muted backdrop-blur">
        No.{String(no).padStart(3, "0")}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(monomon.id);
          haptic(12);
        }}
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 backdrop-blur active:scale-90"
        aria-label="お気に入り"
      >
        <Heart
          className={`h-3.5 w-3.5 ${monomon.favorite ? "fill-rose-300 text-rose-300" : "text-white/70"}`}
        />
      </button>
      <div className="relative aspect-square p-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-full pedestal-glow animate-pedestal-breathe"
        />
        <div className="relative h-full w-full drop-shadow-[0_10px_16px_rgba(60,30,100,0.55)]">
          {monomon.immersionImageId ? (
            <StoredImmersionVisual
              monomon={monomon}
              alt={monomon.name}
              fallback={<MonomonArt monomon={monomon} />}
            />
          ) : (
            <MonomonArt monomon={monomon} />
          )}
          <span className="glass-sheen rounded-[35%]" />
        </div>
      </div>
      <div className="px-1.5 pb-2">
        <AutoFitName className="font-extrabold text-night" maxFontSize={12}>
          {monomon.name}
        </AutoFitName>
        <div className="mt-0.5 flex justify-center">
          <RarityStars speciesId={monomon.speciesId} />
        </div>
        <p className="mt-0.5 text-center text-[9px] font-medium text-night-dim">
          {new Date(monomon.discoveredAt).toLocaleDateString("ja-JP")}
        </p>
      </div>
    </div>
  );
}


function NoResult() {
  return (
    <div className="flex min-h-[36svh] flex-col items-center justify-center text-center">
      <Search className="h-10 w-10 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-bold text-foreground">見つからなかった</p>
      <p className="mt-1 text-xs text-muted-foreground">
        ちがう言葉でさがしてみてね
      </p>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[45svh] flex-col items-center justify-center text-center">
      <div className="mb-6 text-6xl opacity-80">🔍</div>
      <p className="text-lg font-bold text-foreground">まだ だれも いません</p>
      <p className="mt-2 text-sm text-muted-foreground">
        モノを撮って最初の精霊を見つけよう
      </p>
      <Link
        to="/scan"
        onClick={tap}
        className="mt-8 flex items-center gap-2 rounded-full gradient-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-float active:scale-95"
      >
        <Camera className="h-5 w-5" />
        見つける
      </Link>
    </div>
  );
}

/** 種族の詳細画面（発見済み／未発見の両方に対応） */
function SpeciesDetailSheet({
  species,
  found,
  onClose,
  onOpenIndividual,
}: {
  species: Species;
  found: Monomon[];
  onClose: () => void;
  onOpenIndividual: (m: Monomon) => void;
}) {
  const isFound = found.length > 0;
  const primary = found[0];
  const fam = FAMILY_STYLES[species.family];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md animate-rise-in rounded-t-3xl bg-background p-5 pb-8 shadow-float sm:my-6 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                tap();
                onClose();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-extrabold text-muted-foreground">
              {fam.emoji} {fam.label}族
            </span>
          </div>
          {primary && (
            <button
              onClick={() => {
                toggleFavorite(primary.id);
                haptic(12);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted active:scale-90"
              aria-label={primary.favorite ? "お気に入りを解除" : "お気に入り"}
            >
              <Heart
                className={`h-5 w-5 ${primary.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </button>
          )}
        </div>


        {/* ヒーロー */}
        <div
          className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-3xl p-6"
          style={{
            backgroundImage: `linear-gradient(160deg, ${fam.bg[0]}, ${fam.bg[1]})`,
          }}
        >
          {isFound ? (
            <div className="h-full w-full drop-shadow-[0_10px_14px_rgba(90,60,40,0.22)]">
              <MonomonArt monomon={found[0]} />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-full w-full opacity-25 [filter:brightness(0)]">
                <MonomonArt seed={species.id.length * 7919 + 13} speciesId={species.id} />
              </div>
              <Lock className="absolute h-8 w-8 text-foreground/30" />
            </div>
          )}
        </div>

        {/* 見出し */}
        <div className="mt-4">
          <h2 className="text-2xl font-extrabold text-foreground">
            {isFound ? (
              <>
                {species.emoji} {species.name}
              </>
            ) : (
              "？？？"
            )}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <RarityStars speciesId={species.id} dim={!isFound} />
            <span className="text-xs font-bold text-muted-foreground">
              {getRarityLabel(species.id)}
            </span>
          </div>
        </div>

        {isFound ? (
          <>
            <p className="mt-3 rounded-2xl bg-muted/70 px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
              この種族のモノモンを {found.length} 匹 見つけたよ　タップするとそれぞれの子の詳しい情報が見られるよ
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {found.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    tap();
                    onOpenIndividual(m);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tap();
                      onOpenIndividual(m);
                    }
                  }}
                  className="relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/60 bg-card shadow-soft active:scale-95"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(m.id);
                      haptic(12);
                    }}
                    className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 backdrop-blur active:scale-90"
                    aria-label={m.favorite ? "お気に入りを解除" : "お気に入り"}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${m.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                  <div
                    className="aspect-square p-1.5"
                    style={{
                      backgroundImage: `linear-gradient(160deg, ${fam.bg[0]}, ${fam.bg[1]})`,
                    }}
                  >
                    <div className="h-full w-full drop-shadow-[0_4px_6px_rgba(90,60,40,0.18)]">
                      {m.immersionImageId ? (
                        <StoredImmersionVisual
                          monomon={m}
                          alt={m.name}
                          lazy
                          fallback={<MonomonArt monomon={m} />}
                        />
                      ) : (
                        <MonomonArt monomon={m} />
                      )}
                    </div>
                  </div>
                  <AutoFitName
                    className="px-1 py-1 font-extrabold text-foreground"
                    maxFontSize={11}
                    minFontSize={7}
                  >
                    {m.name}
                  </AutoFitName>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 rounded-2xl bg-muted/70 px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
              まだ見つかっていない種族だよ　身近なモノを撮影してこの子を探してみよう
            </p>
            <Link
              to="/scan"
              onClick={tap}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary py-3.5 text-base font-bold text-primary-foreground shadow-float active:scale-95"
            >
              <Camera className="h-5 w-5" />
              さがしに行く
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function DetailSheet({
  monomon,
  no,
  onClose,
}: {
  monomon: Monomon;
  no: number;
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // なかよし度アップの小さなお祝い（ハートがふわっと舞う）演出のトリガー
  const [burst, setBurst] = useState(0);
  const celebrate = (big = false) => {
    setBurst((n) => n + 1);
    haptic(big ? [12, 40, 12] : 10);
  };

  // 詳細を開いたら必ず先頭（キャラのイラスト）から見えるようにする
  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monomon.id]);

  // なかよし度などが変わってもすぐ反映されるよう、常に最新の状態を読む
  const dex = useDex();
  const live = dex.find((m) => m.id === monomon.id) ?? monomon;

  // 会いに来たら「今日はじめて」なら再会が成立（なかよし度 +5・再会回数 +1）
  useEffect(() => {
    const r = meetMonomon(monomon.id);
    if (!r) return;
    // 経過日数・なかよし度・再会回数に応じたセリフ
    const dialogue = getReunionDialogue({
      reunionCount: r.reunionCount,
      daysSinceLastMet: r.daysSinceLastMet,
      friendship: getFriendship(r.monomon),
    });
    if (r.friendshipGained > 0) celebrate(Boolean(r.unlockedThreshold));
    toast(`「${dialogue}」`);
    // なかよし度の節目を越えたら、新しいセリフの解放を伝える
    if (r.unlockedThreshold) {
      toast(`なかよし度 ${r.unlockedThreshold} をこえたよ　あたらしいセリフが増えた ✨`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monomon.id]);

  // モノモンをなでる → なかよし度 +1（小さなお祝い）
  const pet = () => {
    petMonomon(live.id);
    celebrate();
  };

  const save = async () => {
    tap();
    setSaving(true);
    try {
      const where = await saveCardImage(live);
      playSound("save");
      toast.success(
        where === "photos" ? "写真アプリに保存しました📸" : "画像を保存しました",
      );
    } catch (err) {
      console.error("[monomon] 画像保存に失敗:", err);
      toast.error("うまく保存できなかったよ　もう一度ためしてみてね");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background"
    >
      {/* 単一の縦スクロール：上から下まで自然に流れる（入れ子スクロール・固定ブロックなし） */}
      <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* ヘッダー（戻る・No.・レア度・お気に入り）— スクロールと一緒に流れる */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                tap();
                onClose();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-extrabold text-muted-foreground">
              No.{String(no).padStart(3, "0")}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1">
              <RarityStars speciesId={monomon.speciesId} />
            </span>
          </div>
          <button
            onClick={() => {
              toggleFavorite(live.id);
              haptic(12);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted active:scale-90"
            aria-label={live.favorite ? "お気に入りを解除" : "お気に入り"}
          >
            <Heart
              className={`h-5 w-5 ${live.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        </div>

        {/* 1. イラスト → 2. 名前 → 3. 説明（MonomonCard が縦に並べて表示） */}
        <div className="relative">
          {/* なかよし度アップの小さなお祝い：ハートがふわっと舞う */}
          {burst > 0 && (
            <div
              key={burst}
              className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center"
              aria-hidden
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <Heart
                  key={i}
                  className="absolute h-5 w-5 fill-primary text-primary animate-heart-float"
                  style={{
                    left: `${44 + (i - 2) * 7}%`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>
          )}
          <DetailMonomonCard monomon={live} onPet={pet} />
        </div>

        {/* 4. なかよし度（表情・セリフ・ゲージ） */}
        <FriendshipMeter monomon={live} className="mt-4" />
        <p className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
          モノモンをなでると なかよし度が上がるよ
        </p>

        {/* 5. 応援セクション */}
        <SupportButton variant="home" />

        {/* 6. 画像を保存 ／ 7. シェア */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            画像を保存
          </button>
          <button
            onClick={() => {
              tap();
              setSharing(true);
            }}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            シェア
          </button>
        </div>

        {/* 8. ホームへ戻る ／ 9. もう一度さがす */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link
            to="/"
            onClick={tap}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
          >
            <Home className="h-4 w-4" />
            ホームへ戻る
          </Link>
          <Link
            to="/scan"
            onClick={tap}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-card py-3.5 text-sm font-bold text-foreground shadow-soft active:scale-95"
          >
            <Camera className="h-4 w-4 text-primary" />
            もう一度さがす
          </Link>
        </div>

        {/* 削除（コレクション内だけの、低優先アクション。発見結果には出さない） */}
        <button
          onClick={() => {
            tap();
            if (
              typeof window !== "undefined" &&
              !window.confirm("このモノモンをコレクションから消してもいい？")
            ) {
              return;
            }
            removeFromDex(live.id);
            haptic(12);
            toast("コレクションから消したよ");
            onClose();
          }}
          className="mx-auto mt-8 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-muted-foreground/70 active:scale-95"
          aria-label="このモノモンを削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
          コレクションから消す
        </button>
      </div>


      {sharing && (
        <ShareModal monomon={live} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}

/**
 * Detail 用の MonomonCard ラッパー。ここでだけ IndexedDB を読み、
 * MonomonCard には URL を渡す。友達度・お気に入りの再レンダーで
 * 二重取得や URL 破棄が起きないよう、フックが ref-count で共有する。
 */
function DetailMonomonCard({
  monomon,
  onPet,
}: {
  monomon: Monomon;
  onPet: () => void;
}) {
  const { url } = useImmersionImageUrl(monomon.immersionImageId);
  return <MonomonCard monomon={monomon} onPet={onPet} immersionImageUrl={url} />;
}
