# NiceSOFT Marketplace integration TODO

The current codebase now targets the NiceSOFT Marketplace (Registry) instead of the legacy Rocket.Chat marketplace. The NiceSOFT server must provide the following HTTP API so the Rocket.Chat server and UI keep working:

## Base URL & health
- Base URL is defined by the `NICESOFT_MARKETPLACE_URL` environment variable.
- `GET /health` should respond with `200 OK` when the registry is reachable. Any non-2xx response or network failure is treated as `ok: false` and only disables the online catalog; offline installation must still work.

## App catalog
- `GET /v1/apps?endUserID=<userId>` returns an array of apps. Each item must match the fields validated in `fetchMarketplaceApps.ts` (ids, latest release with metadata, permissions, pricing, subscription info, flags like `isEnterpriseOnly`, `bundledIn`, `requestedEndUser`, etc.).
- For unsupported engine versions, respond with status `426` and `{ "errorMsg": "unsupported version" }` to surface the "Marketplace_Unsupported_Version" error state.
- For invalid Apps-Engine versions, respond with status `400` and body `{ code: 200 }`.
- Internal registry errors should use status `500` with `code` values such as `266`, `256`, `166`, `221`, `257`, or `320`.

## Categories
- `GET /v1/categories` returns an array of categories with fields `{ id, title, description, hidden, createdDate, modifiedDate }`.

## Featured and bundled apps
- `GET /v1/featured-apps` returns `{ sections: Array<{ slug, i18nLabel, apps: App[] }> }`, where each app matches the catalog schema.
- `GET /v1/bundles/:bundleId/apps` returns the list of apps inside the bundle (same app shape as `/v1/apps`).

## App requests
- `GET /v1/app-request/stats` returns `{ data: { totalSeen: number; totalUnseen: number } }`.
- `POST /v1/app-request/markAsSeen` accepts `{ ids: string[] }` and returns `{ success: boolean }`.
- `GET /v1/app-request` returns a paginated list `{ data: any[]; meta: { limit, offset, sort, filter, total } }`.

## Authentication & headers
- Requests may include `Authorization: Bearer <workspace token>` when available and should be honored.
- All responses must be JSON with appropriate `content-type` headers.

If any endpoint above is unavailable or returns non-200, the Rocket.Chat UI will fall back to an empty catalog while keeping "Install from file" available. Keeping responses concise and consistent with these shapes will avoid user-facing errors.
