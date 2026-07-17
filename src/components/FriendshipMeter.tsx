import { getFriendship, getFriendshipLevel } from "@/lib/friendship";
import type { Monomon } from "@/lib/monomon";

interface FriendshipMeterProps {
  monomon: Pick<Monomon, "friendship">;
  className?: string;
}

/**
 * なかよし度の静かな表示。
 *
 * v3.0：数値も進捗バーも見せない。ゲーム機構ではなく、
 * その子の今の「気配」だけをそっと伝える一葉のカード。
 * 段階の判定ロジック（friendship.ts）は保持し、
 * ここでは表情と一言だけを詩のように並べる。
 */
export function FriendshipMeter({ monomon, className }: FriendshipMeterProps) {
  const level = getFriendshipLevel(getFriendship(monomon));

  return (
    <div className={`text-center ${className ?? ""}`}>
      <div className="text-2xl leading-none" aria-hidden>
        {level.face}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-foreground/60">
        「{level.quote}」
      </p>
    </div>
  );
}
