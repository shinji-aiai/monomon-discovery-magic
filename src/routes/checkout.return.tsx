import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart, Home } from "lucide-react";
import { trackSupportComplete } from "@/lib/analytics";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const success = Boolean(sessionId);

  // 応援完了（決済成功）を計測
  useEffect(() => {
    if (success) trackSupportComplete();
  }, [success]);



  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
        <Heart className="h-10 w-10 fill-rose-400 text-rose-400" />
      </span>
      {success ? (
        <>
          <h1 className="mt-6 text-2xl font-extrabold text-foreground">
            応援ありがとう
          </h1>
          <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground">
            いただいた応援は新しいモノモンの開発に
            <br />
            大切に使わせてもらうよ
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-extrabold text-foreground">
            決済情報が見つからなかった
          </h1>
          <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground">
            お手数だけどもう一度おためしください
          </p>
        </>
      )}

      <Link
        to="/"
        className="mt-8 flex items-center justify-center gap-2 rounded-full gradient-primary px-8 py-4 text-lg font-extrabold text-primary-foreground shadow-float active:scale-95"
      >
        <Home className="h-5 w-5" />
        ホームへ戻る
      </Link>
    </div>
  );
}
