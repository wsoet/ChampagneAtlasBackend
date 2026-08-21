# Managed content localization (NL/EN)

The admin remains Dutch. Managed producers, regions, places and manually managed events store Dutch source prose and a persisted English variant in `localizedContent.en`. Imported Explore events and experiences preserve provider-supplied localized variants whenever available and therefore do not replace source English with machine output.

## Workflow

- Dutch is the managed source language. Official house, cuvée, place, AOC and French region names are not localized.
- Entering an English field marks it `MANUAL` and `CURRENT`.
- Leaving English empty generates it once through the configured translation provider and persists the result. The translation cache prevents repeated provider calls.
- A later Dutch edit never replaces a manual English correction. Its status becomes `STALE`; an administrator can correct the English preview or explicitly request retranslation.
- The admin lock is stored per English field as `locked:true`. A locked/manual variant is never silently overwritten. Explicit retranslation is the only operation that may replace it.
- Provider failure does not block saving Dutch content. Metadata records `ERROR` so it can be retried.
- Admin forms show both variants. Places additionally show the current lifecycle status next to the English preview; houses, regions and events provide an explicit retranslation control.

Metadata is stored beside dynamic JSON content as `localizationMeta.en.fields.<field>` and includes status, method, provider/model, source hash/version, review flag and timestamps. Source names, URLs and attribution remain part of each entity. Migration `019_managed_localization_metadata` adds equivalent lifecycle fields to the durable translation cache and is additive/idempotent.

## API contract

Public catalog endpoints accept `?locale=nl|en` or `Accept-Language`. Responses include `contentLanguage`, `deliveredContentLanguage`, `sourceLanguage`, `localizedContent`, `localizationMeta`, `originalContent` and `attribution`. Resolution order is requested variant, source variant, English fallback, original source.

Provider content follows the same envelope. Viator and DATAtourisme persist both provider language variants when supplied. Google Places keeps official proper names and provider facts untouched. Muselet product names are not machine-translated and explicitly report `sourceLanguage: und`, `deliveredContentLanguage: und` and provider attribution. Public responses vary on `Accept-Language`; in-process provider caches include the normalized locale in their key.

Offline/sync consumers therefore receive both variants and metadata in the same entity response; displayed prose is also projected onto the existing top-level fields for backwards compatibility.

## Configuration

- `OPENAI_API_KEY` (server-side only)
- `CONTENT_TRANSLATION_MODEL` (optional, defaults to `gpt-5-mini`)

No key is sent to admin or client applications. Before deployment run `npm run migrate:localization:dry-run`, then `npm run migrate:localization` only after explicit approval.

Backfill is resumable and idempotent: `npm run backfill:localization:dry-run`, followed only after review by `npm run backfill:localization`. `LOCALIZATION_BACKFILL_CONCURRENCY` is capped at 16 (default 12), `LOCALIZATION_BACKFILL_DELAY_MS` adds provider-friendly pacing per successful record (default 250 ms, capped at 10 seconds), and `CONTENT_TRANSLATION_TIMEOUT_MS` is capped at 120 seconds. Successful records persist individually and are skipped on rerun. Provider failures are recorded as `ERROR` and can safely be retried.
