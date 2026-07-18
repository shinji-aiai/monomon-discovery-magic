
# Phase 0 — Isolated Photo-Immersion Feasibility Test Only

This plan **replaces** the previous full v1.1 plan. The full v1.1 implementation will **not** begin as part of this task. The only goal is to verify that `google/gemini-3.1-flash-image` can edit one attached mug photograph while preserving the original mug, table, lighting, camera angle, pattern, and background, with one small Monomon added naturally inside the mug.

---

## 1. Exact files to create or temporarily change

**Create (permanent — but no other code imports it yet):**
- `src/lib/monomon-image.functions.ts` — one `createServerFn` (`generateImmersionImage`) that POSTs a single, hard-coded-shaped request to the Lovable AI Gateway image endpoint and returns a plain DTO (see §3). No retries, no streaming, no caching, no logging of the image payload. All detailed error information stays server-side (server-side `console.error`), and the DTO returned to the client contains only `{ status, errorSummary }` on failure (see §3 and end of §4).

**Create (temporary — removed at end of Phase 0):**
- `src/routes/phase0-immersion-test.tsx` — an **unlisted** route at `/phase0-immersion-test`. No underscore prefix (underscores are TanStack's pathless-layout convention and would not produce the stated URL). Nothing in the app links to it. It contains: a file input to pick the controlled test image, a single "Run test" button (disabled after one click for the remainder of the session — see §5/§6), and areas that display the input image, the returned image, the measured duration, and the observed contract summary.

**Expected auto-generated change (do NOT edit by hand):**
- `src/routeTree.gen.ts` — the TanStack Router Vite plugin will regenerate this to register `/phase0-immersion-test`. This file is not authored.

**Do NOT touch:** `src/routes/scan.tsx`, `src/routes/index.tsx`, `src/routes/zukan.tsx`, `src/routes/settings.tsx`, `src/routes/about.tsx`, `src/routes/__root.tsx`, `src/components/DiscoveryReveal.tsx`, `src/components/MonomonCard.tsx`, `src/components/ShareModal.tsx`, `src/components/AutoUpdater.tsx`, `src/components/IntroOverlay.tsx`, `src/components/BottomNav.tsx`, `src/lib/monomon.ts`, `src/lib/monomon-ai.functions.ts`, `src/lib/monomon-art.ts`, `src/lib/dex.ts`, `src/lib/store.ts`, `src/lib/card-image.ts`, `src/lib/classification.ts`, `src/lib/friendship.ts`, `src/lib/discovery.ts`, `src/lib/image-utils.ts`, `src/lib/build-info.ts`, `src/router.tsx`, `src/start.ts`, `package.json`, `capacitor.config.ts`, anything under `ios/`.

---

## 2. How the development-only test is isolated

Isolation is guaranteed by **structural** properties only. No environment-variable gates are used — Lovable Preview may run a production-like build, and `import.meta.env.DEV` / `process.env.NODE_ENV !== "production"` gates could either blank the page or make the server function refuse to run.

Guarantees:
- **No navigation link.** Nothing in the app renders a `<Link to="/phase0-immersion-test">` or href to it. The route is reachable only by typing the URL.
- **Unlisted route file.** The route name is descriptive (`phase0-immersion-test`) so it is obviously temporary and easy to find and delete.
- **No connection to any normal application flow.** The route imports only React, `createFileRoute`, and `generateImmersionImage`. It does **not** import from `scan.tsx`, `zukan.tsx`, `index.tsx`, `monomon.ts`, `monomon-ai.functions.ts`, `dex.ts`, `MonomonCard`, `DiscoveryReveal`, or any other production module.
- **No production module imports the test module.** `generateImmersionImage` is not imported by any existing file. Verified by search before Phase 0 is called complete.
- **No Publish.** The site is not published during Phase 0.
- **No new dependencies.** No `bun add`, no `package.json` change, no `cap sync`.
- **Deletion after Phase 0.** The route file is deleted immediately after the report (see §8).
- **No new secrets, no new middleware, no new env vars.** Uses the existing `LOVABLE_API_KEY` secret.

---

## 3. Exact model and proposed Gateway request

**Endpoint:** `POST https://ai.gateway.lovable.dev/v1/images/generations`
**Auth header:** `Lovable-API-Key: ${process.env.LOVABLE_API_KEY}` (read inside the handler; no new secret).
**Content type:** `application/json`.
**Model:** `google/gemini-3.1-flash-image` (Nano Banana 2, chat-shape).
**Stream:** omitted — Phase 0 buffers a single JSON response, because there is no client rendering of previews to justify SSE.

**Request body (exact shape planned):**

```json
{
  "model": "google/gemini-3.1-flash-image",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Edit this photograph. Preserve the original mug, table surface, lighting, camera angle, focal length, colors, mug pattern, and background exactly. Do not restyle, recolor, or re-illuminate the scene. Add one small soft round pastel creature (a Monomon) about the size of a grape peeking naturally from inside the mug's opening. The creature must look physically present in the same lighting and cast a soft shadow consistent with the scene. Do not add text, logos, borders, watermarks, or other objects."
        },
        {
          "type": "image_url",
          "image_url": { "url": "<data:image/jpeg;base64,...>" }
        }
      ]
    }
  ],
  "modalities": ["image", "text"]
}
```

**Success DTO returned to the client:**

```ts
{
  ok: true,
  base64: string,           // as returned by the gateway (data[0].b64_json)
  detectedMime: string,     // determined from decoded magic bytes (see §4)
  responseContentType: string | null, // HTTP Content-Type of the gateway response
  hasBase64Field: boolean,  // whether data[0].b64_json was present
  payloadKeys: string[],    // top-level keys observed on data[0]
  durationMs: number,
  requestId?: string        // any x-lovable-aig-* header value if present
}
```

**Failure DTO returned to the client (browser UI never sees the raw upstream body):**

```ts
{
  ok: false,
  status: number,           // HTTP status from the gateway (0 for network throw)
  errorSummary: string      // safe short string, max 200 chars, redacted (see §4)
}
```

The server function logs the full detail (status, response headers, first 2 KB of response body) with `console.error` for retrieval via `stack_modern--server-function-logs`.

No retries, no fallback model, no request re-shaping.

---

## 4. How the accepted request and response contract will be recorded

The dev route shows a "Contract summary" panel populated from the actual response:

- HTTP status
- Response `Content-Type` header (`responseContentType`)
- Whether `data[0].b64_json` was present, and the top-level keys observed on `data[0]`
- Base64 length in bytes and the first 16 chars (for shape only)
- **MIME detection from decoded magic bytes** — not hardcoded. The server function decodes the first ~16 bytes of the base64 and matches against known signatures:
  - `89 50 4E 47 0D 0A 1A 0A` → `image/png`
  - `FF D8 FF` → `image/jpeg`
  - `52 49 46 46 …. 57 45 42 50` → `image/webp`
  - `47 49 46 38` → `image/gif`
  - otherwise `application/octet-stream` and the test is marked inconclusive
  The **detected** MIME is what the browser then uses for the `data:` URL (`data:${detectedMime};base64,${base64}`). The response `Content-Type` header is recorded separately for comparison; it is not used to render.
- Measured `durationMs` (see §7)
- Any Lovable AI Gateway request/run id header if present

**Error safety.** On failure the dev UI shows only `status` and `errorSummary`. `errorSummary` is generated server-side: take the upstream body, remove anything that looks like a token/key (regex-strip `sb_[a-z]+_...`, `Bearer ...`, long hex/base64 blobs), then truncate to 200 chars. The full upstream body is **never** sent to the browser; it is only logged server-side. Server logs can be retrieved with `stack_modern--server-function-logs`.

After the test I copy the contract summary into a comment block at the top of `src/lib/monomon-image.functions.ts` labelled "Verified contract on <date>" so future work references the observed contract, not assumptions.

---

## 5. Single controlled test procedure — exactly one paid request

1. In Preview, open `/phase0-immersion-test`.
2. Select one controlled test photo: **a coffee mug on a plain desk, daylight, one clear angle, no people, no personal data.**
3. Client resizes the image to ~1024 px longest edge, JPEG q≈0.85, and computes the data URL.
4. Click "Run test." The client calls `generateImmersionImage` with `{ photo: dataUrl }`.
5. The server function performs **exactly one** Gateway request (see §3) and returns the DTO. The client disables the "Run test" button after this single click for the rest of the session so no accidental second request is possible.
6. The dev UI displays: input image, returned image (rendered using `detectedMime`), the contract summary from §4, and the measured duration.

**One request only.** If the single request fails for any of these reasons:
- an invalid API contract (missing `data[0].b64_json`, wrong response shape),
- a non-2xx response,
- an empty or malformed response,
- a moderation failure,
- unacceptable scene replacement (fails §6 acceptance),
- inability to detect a valid image MIME from magic bytes,

**stop and report.** Do not send a second request without a new explicit approval from the user.

---

## 6. Acceptance criteria

Pass **all** of these to consider Phase 0 successful:

- HTTP 200 and `data[0].b64_json` present.
- Detected MIME from magic bytes is a real image type (`image/png`, `image/jpeg`, `image/webp`, or `image/gif`).
- The returned image renders without error in the browser using the detected MIME.
- Mug shape, color, pattern, handle orientation are preserved (visually indistinguishable at a glance).
- Table surface, background, lighting direction, and camera angle are preserved.
- Exactly one small Monomon-like creature appears inside the mug, cast with a shadow consistent with the scene.
- No added text, logos, borders, watermarks, extra objects, or restyling.
- End-to-end duration is recorded (any value; latency does not gate acceptance).
- No unhandled errors on the server console.

Fail conditions (any one is a fail — stop and report, do not retry):
- Scene is regenerated / restyled / recolored / relit.
- Mug is replaced or its pattern changes.
- Multiple creatures, floating creature, no creature, or creature placed outside the mug.
- Non-2xx response, moderation block, empty `data`, malformed payload, or undetectable image type.

On fail I do **not** propose falling back to SVG overlays or regenerated stand-in scenes without a new explicit approval.

---

## 7. How AI cost and latency will be measured

- **Latency:** `performance.now()` bracketing the `fetch` inside `generateImmersionImage.handler` returns `durationMs` in the DTO; the dev UI shows it.
- **Cost:** after the test I call `ai_gateway_logs--list_ai_gateway_requests` (this project, filtered to the last few minutes and `operation: images`) to find the run, then `ai_gateway_logs--get_ai_gateway_request` for that `log_id` to read the exact cost in Lovable credits and the reported duration. I record cost and duration in the Phase 0 report to the user; no client-side cost estimate is invented.

---

## 8. How all temporary test UI will be removed after the test

After the user reviews the Phase 0 result and confirms next steps:

- Delete `src/routes/phase0-immersion-test.tsx`. The plugin regenerates `src/routeTree.gen.ts` to unregister `/phase0-immersion-test`.
- Leave `src/lib/monomon-image.functions.ts` in place with the verified-contract comment block from §4, but with zero callers until a future approved plan wires it in. It stays inert.
- Confirm by search that no file references the deleted route or its component.

If the user rejects continuing, delete `src/lib/monomon-image.functions.ts` as well.

---

## 9. Confirmation: no normal application behavior changes

- Home, Scan, Memories/Dex, Detail, Share Card, IntroOverlay, AutoUpdater, Settings, About, Support/Stripe, Friendship, Reunion, Classification, SVG rendering, image utils, dex store, localStorage schema, IndexedDB (none), monomon data model, duplicate detection, retry rules, privacy text — **none are modified or observed during Phase 0.**
- No production route or bundle behavior changes.
- No new dependencies, no `package.json` edit, no `capacitor.config.ts` edit, no `ios/` edit, no `cap sync`, no Xcode work.
- No Publish. No preview device viewport changes. No badge changes.

---

## 10. Confirmation: the full v1.1 implementation will not begin

- The prior v1.1 plan (scan integration, IndexedDB store, hooks, dedupe, retry rules, privacy update, release procedure, model comparison across candidates) is set aside and is **not** part of this approval.
- After Phase 0 the next step is a short written report to the user (contract, sample outputs, cost, latency, verdict) and a request for a new decision.
- Only if the user then approves will a new plan (still to be written) propose the storage, UI, retry, privacy, and release work — as a fresh plan, not a resumption of the prior one.

---

Awaiting approval to proceed with Phase 0 only.
