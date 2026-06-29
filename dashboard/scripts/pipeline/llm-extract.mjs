/* ════════════════════════════════════════════════════════════════════
 *  LLM extractor (Pipeline E) — pull a single SCALAR fact out of a stored
 *  snapshot's markdown via the Anthropic Messages API. Runs on the snapshot
 *  we already captured (NO re-fetch, NO firecrawl credits). The model only
 *  LOCATES the value + copies a verbatim `quote` (and verbatim text fields);
 *  it must not paraphrase. The verbatim integrity gate (extractors.mjs)
 *  re-checks every quote is an EXACT substring of the snapshot, so a
 *  hallucinated/reworded value is caught exactly like rules-v1.
 *
 *  Model: PIPELINE_LLM_MODEL or claude-haiku-4-5 (cheap; bump to sonnet for
 *  messy pages). Structured output via a forced tool call.
 *  Ref: docs/data_fetching_and_verification_plan.md §5, §1A.
 * ════════════════════════════════════════════════════════════════════ */

export const DEFAULT_LLM_MODEL = 'claude-haiku-4-5'

/* Per-fact tool schemas. Every fact carries a verbatim `quote` (the exact
 * sentence/figure on the page) PLUS typed values the curator confirms.
 * cycle_year is the admissions cycle the figure refers to (e.g. "2024-2025"). */
const SCHEMAS = {
  essay: {
    description: 'The required application essay / writing supplement prompts for first-year applicants, grouped into sections.',
    schema: {
      type: 'object',
      properties: {
        cycle_year: { type: ['string', 'null'], description: 'Application cycle the prompts are for, e.g. "2025-2026". null if unstated.' },
        sections: {
          type: 'array',
          description: 'Each distinct group of prompts (e.g. "Personal Insight Questions", "Why Penn", a school-specific supplement).',
          items: {
            type: 'object',
            properties: {
              section_name: { type: ['string', 'null'], description: 'EXACT verbatim section/heading text. Copy character-for-character.' },
              instructions_text: { type: ['string', 'null'], description: 'EXACT verbatim instruction text for the section (e.g. "Respond to 4 of the 8 questions"), or null.' },
              conditions: { type: ['string', 'null'], description: 'EXACT verbatim platform/applicant condition if present (e.g. "Common Application only"), else null.' },
              choose_count: { type: ['integer', 'null'], description: 'How many prompts the applicant must answer (e.g. 4), or null if all required.' },
              choose_of: { type: ['integer', 'null'], description: 'Out of how many options (e.g. 8), or null.' },
              word_limit: { type: ['integer', 'null'], description: 'Section-wide word limit if stated, else null.' },
              char_limit: { type: ['integer', 'null'], description: 'Section-wide character limit if stated, else null.' },
              prompts: {
                type: 'array',
                description: 'The individual essay prompts in this section.',
                items: {
                  type: 'object',
                  properties: {
                    prompt_text: { type: 'string', description: 'EXACT verbatim prompt text. Copy character-for-character, including punctuation. Do NOT paraphrase, summarize, or fix.' },
                    word_limit: { type: ['integer', 'null'], description: 'Word limit for this prompt if stated, else null.' },
                    char_limit: { type: ['integer', 'null'], description: 'Character limit for this prompt if stated, else null.' },
                  },
                  required: ['prompt_text'],
                },
              },
            },
            required: ['section_name', 'prompts'],
          },
        },
      },
      required: ['sections', 'cycle_year'],
    },
  },
  sat: {
    description: 'The middle-50% (25th–75th percentile) total SAT score range of admitted/enrolled students.',
    schema: {
      type: 'object',
      properties: {
        sat_p25: { type: ['integer', 'null'], description: '25th-percentile total SAT (400–1600), or null if not stated.' },
        sat_p75: { type: ['integer', 'null'], description: '75th-percentile total SAT (400–1600), or null if not stated.' },
        quote: { type: ['string', 'null'], description: 'EXACT verbatim sentence/line from the page that states the SAT range. Copy character-for-character. null if the page does not state it.' },
        cycle_year: { type: ['string', 'null'], description: 'Admissions cycle the figure refers to, e.g. "2024-2025" or "Class of 2028". null if unstated.' },
      },
      required: ['sat_p25', 'sat_p75', 'quote', 'cycle_year'],
    },
  },
  test_policy: {
    description: "The university's standardized-testing policy (test-required / test-optional / test-blind / test-flexible) for first-year applicants.",
    properties_note: 'policy = a short normalized label; statement = the verbatim sentence stating the policy.',
    schema: {
      type: 'object',
      properties: {
        policy: { type: ['string', 'null'], description: 'Short label: "Test-required", "Test-optional", "Test-blind", or "Test-flexible".' },
        statement: { type: ['string', 'null'], description: 'EXACT verbatim sentence from the page stating the testing policy. Copy character-for-character.' },
        cycle_year: { type: ['string', 'null'], description: 'Cycle the policy applies to, if stated. null otherwise.' },
      },
      required: ['policy', 'statement', 'cycle_year'],
    },
  },
  admit_rate: {
    description: 'The overall undergraduate admission / acceptance rate (percent of applicants admitted).',
    schema: {
      type: 'object',
      properties: {
        admit_rate: { type: ['number', 'null'], description: 'Acceptance rate as a percent number (e.g. 4.6 for 4.6%). null if not stated.' },
        quote: { type: ['string', 'null'], description: 'EXACT verbatim sentence/line stating the admit rate. Copy character-for-character.' },
        cycle_year: { type: ['string', 'null'], description: 'Cycle the figure refers to, if stated.' },
      },
      required: ['admit_rate', 'quote', 'cycle_year'],
    },
  },
  cost: {
    description: 'Published cost of attendance for one year: tuition and total estimated cost.',
    schema: {
      type: 'object',
      properties: {
        currency: { type: ['string', 'null'], description: 'ISO currency code of the figures, e.g. "USD", "GBP", "SGD".' },
        tuition: { type: ['number', 'null'], description: 'Annual tuition (number only, no symbols/commas). null if not stated.' },
        total: { type: ['number', 'null'], description: 'Total estimated annual cost of attendance (tuition + fees + living). null if not stated.' },
        quote: { type: ['string', 'null'], description: 'EXACT verbatim line(s) from the page stating these figures. Copy character-for-character.' },
        cycle_year: { type: ['string', 'null'], description: 'Academic year the figures apply to, e.g. "2025-2026".' },
      },
      required: ['currency', 'tuition', 'total', 'quote', 'cycle_year'],
    },
  },
  scholarship: {
    description: 'The financial-aid / scholarship policy for (international) undergraduates — e.g. need-blind, need-aware, meets-full-need, merit availability.',
    schema: {
      type: 'object',
      properties: {
        aid_policy: { type: ['string', 'null'], description: 'EXACT verbatim sentence from the page summarizing the aid/scholarship policy. Copy character-for-character.' },
        quote: { type: ['string', 'null'], description: 'A second EXACT verbatim supporting line, or null.' },
        cycle_year: { type: ['string', 'null'], description: 'Cycle the policy applies to, if stated.' },
      },
      required: ['aid_policy', 'quote', 'cycle_year'],
    },
  },
}

export const LLM_FACT_TYPES = Object.keys(SCHEMAS)

const SYSTEM = `You extract a single factual data point from the markdown of an official university web page.
Rules:
- Use ONLY the supplied page text. Never use outside knowledge.
- Any field described as "verbatim" (quote/statement/aid_policy) MUST be copied character-for-character from the page — same words, spacing, capitalization and punctuation. Do not summarize, fix, or stitch together separated text.
- If the page does not clearly state the fact, return null for every field rather than guessing.
- Return your answer ONLY by calling the provided tool.`

/**
 * Extract one scalar fact from snapshot markdown. Returns the structured
 * object { fact_type, ...fields } shaped per SCHEMAS[factType]. Throws on a
 * missing API key or a hard API error (the caller records it).
 */
export async function extractLLM(factType, markdown) {
  const spec = SCHEMAS[factType]
  if (!spec) throw new Error(`no LLM schema for fact_type "${factType}"`)
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY in .env (required for Pipeline E scalar extraction)')
  const model = process.env.PIPELINE_LLM_MODEL || DEFAULT_LLM_MODEL

  // keep payloads bounded — these facts live near the top of focused pages
  const text = String(markdown || '').slice(0, 60000)
  const tool = {
    name: 'record_fact',
    description: spec.description,
    input_schema: spec.schema,
  }

  let res, json
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'record_fact' },
        messages: [{ role: 'user', content: `Fact to extract: ${factType}\n\nPAGE MARKDOWN:\n${text}` }],
      }),
    })
    json = await res.json().catch(() => null)
  } catch (e) {
    throw new Error(`anthropic request failed: ${e.message}`)
  }
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}: ${json?.error?.message || 'error'}`)

  const block = (json?.content || []).find((b) => b.type === 'tool_use' && b.name === 'record_fact')
  if (!block) throw new Error('model returned no structured fact')
  return { fact_type: factType, ...block.input }
}
