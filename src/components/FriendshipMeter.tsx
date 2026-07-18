import { Heart } from "lucide-react";
import {
  getFriendship,
  getFriendshipLevel,
  MAX_FRIENDSHIP,
} from "@/lib/friendship";
import type { Monomon } from "@/lib/monomon";

interface FriendshipMeterProps {
  monomon: Pick<Monomon, "friendship">;
  className?: string;
  /** セリフ（なかよし度に応じた一言）を表示するか */
  showQuote?: boolean;
}

/**
 * なかよし度メーター（❤️ なかよし度・表情・セリフ・ゲージ）。
 *
 * 表示のみを担当し、ルール（段階・境界・セリフ）は friendship.ts に集約しています。
 * 将来「お願い」「プレゼント」「進化」などの導線は、この段階情報を使って
 * 近くに足していけます。
 */
export function FriendshipMeter({
  monomon,
  className,
  showQuote = true,
}: FriendshipMeterProps) {
  const value = getFriendship(monomon);
  const level = getFriendshipLevel(value);

  return (
    <div className={`rounded-2xl bg-muted/70 px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          なかよし度
          <span className="text-lg leading-none" aria-hidden>
            {level.face}
          </span>
        </span>
        <span className="text-sm font-extrabold text-foreground">
          {value}
          <span className="ml-0.5 text-muted-foreground">/ {MAX_FRIENDSHIP}</span>
        </span>
      </div>

      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MAX_FRIENDSHIP}
        aria-valuenow={value}
        aria-label="なかよし度"
      >
        <div
          className="h-full rounded-full gradient-primary transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>

      {showQuote && (
        <p className="mt-2.5 text-center text-sm font-bold text-foreground">
          「{level.quote}」
        </p>
      )}
    </div>
  );
}
