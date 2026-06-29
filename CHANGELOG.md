# Changelog

All notable changes to the College Application Tracker.

## [Unreleased]

### Pipeline E — Verified university scalar facts (SAT, test policy, admit rate, cost, aid)
- Extended the verification engine end-to-end to the university-scoped scalar facts. The fetch →
  snapshot → **verbatim gate** → review → publish flow is now generic across `essay`, `deadline`,
  `sat`, `test_policy`, `admit_rate`, `cost`, `scholarship`.
- **LLM extractor** (`scripts/pipeline/llm-extract.mjs`): Anthropic Messages API (default
  `claude-haiku-4-5`, `PIPELINE_LLM_MODEL` override) runs on the **stored snapshot** — no re-fetch, no
  firecrawl credits. The model only locates the value + copies a verbatim `quote`; the integrity gate
  re-checks every quote is an exact substring, so a reworded value is rejected exactly like rules-v1.
- **Map-assisted source discovery** (`scripts/pipeline/discover-sources.mjs` + `lib.map()`): one cheap
  firecrawl `map` per domain → keyword-ranked candidate URL per fact type → staged as
  `discovery_status='proposed'`. A new **Proposed sources** panel on the curator board lets the curator
  confirm/fix the URL before any scrape; `fetch-source.mjs` only fetches `confirmed` sources. Avoids
  burning a scrape + extraction on a wrong URL.
- **Publish into existing catalog columns** with per-field provenance: `universities.sat_p25/p75`,
  `test_policy`, `admit_rate`, `cost_reference`, `aid_policy` + `field_provenance` jsonb
  (`{source_url, verified_at, verified_by, snapshot_id, cycle_year, quote}` per column).
- **Consumer**: the Supabase recompose now falls back to the verified catalog fact when the per-app
  field is null (`Tests → test_policy`, `Aid Policy → aid_policy`, `STEM OPT → programs.is_stem /
  stem_notes`), joins the `programs` table, and surfaces `admitRate`. So a newly-onboarded student
  inherits real verified data; the university detail page shows a **"✓ verified · source"** badge on
  each pipeline-sourced field.
- Migration `0008_pipeline_e.sql`: `field_provenance` (universities + programs),
  `verification_sources.discovery_status` + `candidate_urls`.

### Phase 0 — Foundations & data-layer seam
- Refactored data access into an **async, swappable layer** so the source (local JSON today,
  Supabase next) can change without touching any UI:
  - `src/data/helpers.js` — pure config, formatters, date utilities (no data dependency).
  - `src/data/dataset.js` — `buildDataset(raw)`: all normalization/derivation as a pure function.
  - `src/data/source/localSource.js` — **the swap point** (`loadRawData()`): returns bundled
    `master.json` now; replace its body with a Supabase query in Phase 1.
  - `src/data/DataContext.jsx` — `DataProvider` loads the source once and serves the dataset via
    `useData()`; the single async boundary, with loading/error states.
  - `src/data/store.js` — now a thin compat barrel re-exporting pure helpers.
- All pages/components read **data** from `useData()` and **helpers** from the store barrel.
- No behavior change: build clean; data path verified to produce identical output
  (21 universities, 80 audit checks, SAT recomputed, all accessors).
