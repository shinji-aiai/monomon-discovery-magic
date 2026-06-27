import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xs text-center">
        <div className="text-6xl">🫧</div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">みつかりません</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          このページは どこかへ お出かけ中のようです。
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-soft"
          >
            ホームへ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xs text-center">
        <div className="text-6xl">😴</div>
        <h1 className="mt-4 text-xl font-bold text-foreground">うまく開けませんでした</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          少し時間をおいて、もう一度おためしください。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-soft"
          >
            もう一度
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground"
          >
            ホームへ
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
      },
      { title: "モノモン｜モノに宿る、小さな精霊たち" },
      {
        name: "description",
        content:
          "身の回りのモノを撮ると、そのモノに宿る小さな精霊「モノモン」が見つかるアプリ。さあ、次は何を撮ってみよう？",
      },
      { name: "theme-color", content: "#fbf3e6" },
      { name: "author", content: "モノモン" },
      { property: "og:title", content: "モノモン｜モノに宿る、小さな精霊たち" },
      {
        property: "og:description",
        content: "写真を撮ると、モノに宿る小さな精霊が見つかります。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
