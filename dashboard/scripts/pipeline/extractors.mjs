/* ════════════════════════════════════════════════════════════════════
 *  Extraction (Pipeline B) — segment a snapshot into a VERBATIM draft.
 *  rules-v1: deterministic, runs on the stored snapshot markdown, and copies
 *  text as EXACT substrings (the model identifies boundaries + metadata only;
 *  it never rewords). Swap in an LLM later behind the same {extract, schema}.
 *  Centerpiece = verbatimCheck(): the integrity gate (§3, §4.3).
 *  Ref: docs/data_fetching_and_verification_plan.md §5.
 * ════════════════════════════════════════════════════════════════════ */

import { extractLLM, LLM_FACT_TYPES, DEFAULT_LLM_MODEL } from './llm-extract.mjs'

export const EXTRACTION_MODEL = 'rules-v1'

/** Which extractor model produced a given fact type's draft (recorded on the draft). */
export function extractionModelFor(factType) {
  return LLM_FACT_TYPES.includes(factType)
    ? (process.env.PIPELINE_LLM_MODEL || DEFAULT_LLM_MODEL)
    : EXTRACTION_MODEL
}

const intIn = (re, s) => { const m = String(s || '').match(re); return m ? parseInt(m[1], 10) : null }

/* ---- ESSAYS (§5) ----------------------------------------------------- */
const PLATFORM_CLAUSES = [
  'Common Application and Coalition Application only',
  'Common Application only',
  'Coalition Application only',
  'QuestBridge Application',
]

function extractEssays(md) {
  const cycle = (md.match(/\b(20\d{2}-20\d{2})\b/) || [])[1] || null
  const sections = []
  // each `## heading` → body up to the next `#`/`##` heading (exact slices, no joins)
  const re = /^##\s+(.+?)\s*$/gm
  const heads = []
  let m
  while ((m = re.exec(md))) heads.push({ name: m[1], start: m.index, bodyStart: m.index + m[0].length })
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]
    const nextStart = i + 1 < heads.length ? heads[i + 1].start : md.length
    let body = md.slice(h.bodyStart, nextStart)
    // also stop the body at an h1 if one appears
    const h1 = body.search(/^#\s+/m)
    if (h1 > 0) body = body.slice(0, h1)

    const bulletRe = /^[-*]\s+(.+?)\s*$/gm
    const bullets = []
    let b
    while ((b = bulletRe.exec(body))) bullets.push(b[1])
    // keep only phrase-like prompts (drop nav/heading/link/image bullets).
    // structural filter — NOT a length gate (short prompts like "What inspires you?" are real)
    const prompts = bullets.filter(
      (t) => /\s/.test(t) && !/^!\[/.test(t) && !/^#{1,3}[\s[]/.test(t) && !/^\[[^\]]*\]\([^)]*\)\s*$/.test(t),
    )
    if (!prompts.length) continue // not an essay section

    const firstBullet = body.search(/^[-*]\s+/m)
    const instructions = (firstBullet > 0 ? body.slice(0, firstBullet) : '').trim() || null

    const charLimit = intIn(/(\d+)\s*characters?/i, instructions)
    const sectionWord = intIn(/(\d+)\s*words?\s*or\s*fewer/i, instructions)
    let chooseCount = null, chooseOf = null
    if (/one of the following/i.test(instructions || '')) { chooseCount = 1; chooseOf = prompts.length }
    else { const cm = (instructions || '').match(/respond to\s+(\d+)\s+of\s+(\d+)/i); if (cm) { chooseCount = +cm[1]; chooseOf = +cm[2] } }
    // condition = an exact platform clause present in the instructions (verbatim substring)
    const conditions = PLATFORM_CLAUSES.find((c) => (instructions || '').includes(c)) || null

    sections.push({
      section_name: h.name,
      instructions_text: instructions,
      conditions,
      choose_count: chooseCount,
      choose_of: chooseOf,
      word_limit: sectionWord,
      char_limit: charLimit,
      prompts: prompts.map((p) => ({
        prompt_text: p,
        word_limit: intIn(/\((\d+)\s*words?\s*or\s*fewer\)/i, p) ?? sectionWord,
        char_limit: charLimit,
      })),
    })
  }
  return { fact_type: 'essay', cycle_year: cycle, sections }
}

/* ---- DEADLINES ------------------------------------------------------- */
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 }

function extractDeadlines(md) {
  const rounds = []
  // "- Label (Deadline: DateText)"
  const re = /^[-*]\s+(.+?)\s*\(\s*Deadline:\s*(.+?)\s*\)\s*$/gm
  let m
  while ((m = re.exec(md))) {
    const label = m[1]
    const datePhrase = m[2]
    const deadlineText = m[0].replace(/^[-*]\s+/, '').trimEnd() // full "Label (Deadline: Date)" verbatim
    // best-effort month/day parse; year is cycle-dependent → left to the curator
    const dm = datePhrase.match(/([A-Za-z]+)\s+(\d{1,2})/)
    let parsedMonthDay = null
    if (dm && MONTHS[dm[1].toLowerCase()] !== undefined) parsedMonthDay = `${String(MONTHS[dm[1].toLowerCase()] + 1).padStart(2, '0')}-${String(+dm[2]).padStart(2, '0')}`
    rounds.push({ label, deadline_text: deadlineText, date_phrase: datePhrase, parsed_month_day: parsedMonthDay, parsed_date: null })
  }
  return { fact_type: 'deadline', rounds }
}

// essay now routes to the LLM extractor (rules-v1 extractEssays was Yale-specific
// and doesn't generalize to other schools' very different page structures).
const EXTRACTORS = { deadline: extractDeadlines }

/**
 * Extract a draft from snapshot markdown. essay/deadline use the deterministic
 * rules-v1 segmenters; the scalar facts (sat/test_policy/admit_rate/cost/
 * scholarship) route to the LLM extractor. Async because of the LLM call.
 */
export async function extract(factType, markdown) {
  const fn = EXTRACTORS[factType]
  if (fn) return fn(String(markdown || ''))
  if (LLM_FACT_TYPES.includes(factType)) return extractLLM(factType, markdown)
  throw new Error(`no extractor for fact_type "${factType}"`)
}

/* ---- VERBATIM INTEGRITY GATE (the trust anchor, §3/§4.3) ------------- *
 * Which JSON paths are verbatim TEXT (vs numeric/enum metadata). The gate
 * asserts each is an EXACT substring of the snapshot — normalizing ONLY
 * \r\n→\n (NOT whitespace), so even a 1-char change ("only:respond" vs
 * "only: respond") is caught, exactly as the spike proved.                */
function collectVerbatim(factType, json) {
  const out = []
  if (factType === 'essay') {
    ;(json.sections || []).forEach((s, i) => {
      out.push({ path: `sections[${i}].section_name`, value: s.section_name })
      out.push({ path: `sections[${i}].instructions_text`, value: s.instructions_text })
      out.push({ path: `sections[${i}].conditions`, value: s.conditions })
      ;(s.prompts || []).forEach((p, j) => out.push({ path: `sections[${i}].prompts[${j}].prompt_text`, value: p.prompt_text }))
    })
  } else if (factType === 'deadline') {
    ;(json.rounds || []).forEach((r, i) => {
      out.push({ path: `rounds[${i}].label`, value: r.label })
      out.push({ path: `rounds[${i}].deadline_text`, value: r.deadline_text })
      out.push({ path: `rounds[${i}].date_phrase`, value: r.date_phrase })
    })
  } else {
    // scalar facts (Pipeline E): the verbatim evidence string(s) per fact type
    for (const { path, value } of scalarVerbatim(factType, json)) out.push({ path, value })
  }
  return out
}

/** Verbatim evidence fields for each scalar fact type (must be exact substrings). */
export function scalarVerbatim(factType, json) {
  const pick = (keys) => keys.filter((k) => json?.[k]).map((k) => ({ path: k, value: json[k] }))
  switch (factType) {
    case 'sat': return pick(['quote'])
    case 'test_policy': return pick(['statement'])
    case 'admit_rate': return pick(['quote'])
    case 'cost': return pick(['quote'])
    case 'scholarship': return pick(['aid_policy', 'quote'])
    default: return []
  }
}

const strict = (s) => String(s).replace(/\r\n/g, '\n')

export function verbatimCheck(factType, json, markdown) {
  const hay = strict(markdown)
  const issues = []
  let checked = 0
  for (const { path, value } of collectVerbatim(factType, json)) {
    if (value == null || value === '') continue
    checked++
    if (!hay.includes(strict(value))) issues.push({ path, value: String(value).slice(0, 140) })
  }
  return { ok: issues.length === 0, checked, issues }
}
