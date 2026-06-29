/* Browser port of the verbatim integrity gate (mirrors
 * scripts/pipeline/extractors.mjs). Asserts each verbatim TEXT field is an
 * EXACT substring of the snapshot — normalizing ONLY \r\n→\n, never
 * whitespace, so a 1-char rewording is caught. Runs live as the curator edits. */

const strict = (s) => String(s).replace(/\r\n/g, '\n')

export function verbatimCheck(factType, json, markdown) {
  const hay = strict(markdown || '')
  const issues = []
  let checked = 0
  const add = (path, value) => {
    if (value == null || value === '') return
    checked++
    if (!hay.includes(strict(value))) issues.push({ path, value: String(value).slice(0, 140) })
  }
  if (factType === 'essay') {
    ;(json.sections || []).forEach((s, i) => {
      add(`sections[${i}].section_name`, s.section_name)
      add(`sections[${i}].instructions_text`, s.instructions_text)
      add(`sections[${i}].conditions`, s.conditions)
      ;(s.prompts || []).forEach((p, j) => add(`sections[${i}].prompts[${j}].prompt_text`, p.prompt_text))
    })
  } else if (factType === 'deadline') {
    ;(json.rounds || []).forEach((r, i) => {
      add(`rounds[${i}].label`, r.label)
      add(`rounds[${i}].deadline_text`, r.deadline_text)
      add(`rounds[${i}].date_phrase`, r.date_phrase)
    })
  } else {
    // scalar facts (Pipeline E): the verbatim evidence field(s) per fact type
    const scalar = {
      sat: ['quote'], test_policy: ['statement'], admit_rate: ['quote'],
      cost: ['quote'], scholarship: ['aid_policy', 'quote'],
    }[factType] || []
    for (const k of scalar) add(k, json?.[k])
  }
  return { ok: issues.length === 0, checked, issues, failedPaths: new Set(issues.map((i) => i.path)) }
}
