/* ------------------------------------------------------------------ *
 *  Pure helpers — config, formatters, date utilities.
 *  No dependency on the dataset; safe to import anywhere.
 *  (Data access lives behind the async layer: source/ + dataset.js + DataContext.)
 * ------------------------------------------------------------------ */

/* Mehek's SAT score — single source of truth.
 * Currently an ESTIMATE (official score pending); change this one number
 * when the real score is in and every gap/status across the app updates. */
export const SAT_SCORE = 1540
export const SAT_ESTIMATED = true

/* ---- tier config ---- */
export const TIERS = {
  Reach: { label: 'Reach', order: 1, text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', solid: 'bg-rose-500', hex: '#f43f5e' },
  'Realistic Reach': { label: 'Realistic Reach', order: 2, text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', solid: 'bg-amber-500', hex: '#f59e0b' },
  Target: { label: 'Target', order: 3, text: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', dot: 'bg-brand-500', solid: 'bg-brand-500', hex: '#3563f0' },
  Safety: { label: 'Safety', order: 4, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', solid: 'bg-emerald-500', hex: '#10b981' },
}
export const tier = (t) => TIERS[t] || { label: t, order: 9, text: 'text-ink-600', bg: 'bg-ink-100', border: 'border-ink-200', dot: 'bg-ink-400', solid: 'bg-ink-400', hex: '#637088' }

/* ---- country config ---- */
export const COUNTRY = {
  USA: { flag: '🇺🇸', label: 'United States' },
  Singapore: { flag: '🇸🇬', label: 'Singapore' },
  Australia: { flag: '🇦🇺', label: 'Australia' },
  India: { flag: '🇮🇳', label: 'India' },
}
export const country = (c) => COUNTRY[c] || { flag: '🏳️', label: c }

/* ---- verdict config (verification audit) ---- */
export const VERDICTS = {
  correct: { key: 'correct', label: 'Verified Correct', emoji: '✅', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', hex: '#10b981' },
  warning: { key: 'warning', label: 'Needs Care', emoji: '⚠️', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  wrong: { key: 'wrong', label: 'Wrong — Corrected', emoji: '❌', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', hex: '#f43f5e' },
  note: { key: 'note', label: 'Note', emoji: 'ℹ️', text: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200', dot: 'bg-brand-500', hex: '#3563f0' },
}
export function verdictBucket(verdict) {
  const v = String(verdict || '')
  if (v.includes('❌')) return VERDICTS.wrong
  if (v.includes('⚠️') || /unverified|confirm|verify|fix|approx(?!.*correct)/i.test(v)) return VERDICTS.warning
  if (v.includes('ℹ️')) return VERDICTS.note
  if (v.includes('✅')) return VERDICTS.correct
  return VERDICTS.note
}

/* ---- status config ---- */
export const STATUS = {
  'Not Started': { text: 'text-ink-500', bg: 'bg-ink-100', dot: 'bg-ink-400' },
  'In Progress': { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  Submitted: { text: 'text-brand-700', bg: 'bg-brand-50', dot: 'bg-brand-500' },
  Accepted: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  Complete: { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
}
export const statusStyle = (s) => STATUS[s] || STATUS['Not Started']

/* ------------------------------------------------------------------ *
 *  Deadline parsing -> real dates for the calendar / countdowns
 * ------------------------------------------------------------------ */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** parse the first concrete date out of a free-text deadline string */
export function parseDate(text) {
  if (!text) return null
  const s = String(text)
  // "Mon D, YYYY"  e.g. Nov 1, 2026
  let m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2])
  }
  // "D Mon YYYY"  e.g. 31 May 2027 / 23 Feb 2027
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1])
  }
  // "Month YYYY"  e.g. March 2027 -> mid month
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(m[2], MONTHS[m[1].slice(0, 3).toLowerCase()], 15)
  }
  return null
}

export const isApprox = (text) => /~|early|opens|rolling|confirm|tbc|tbd|apply asap|offers/i.test(String(text || ''))

/** an intake/term/semester START date — not an application deadline */
export const isIntakeNote = (text) => /intake|semester|\bsem\b|\bterm\s*\d/i.test(String(text || ''))

/** earliest upcoming primary deadline for a university (Date | null) — pure, takes a uni */
export function primaryDeadline(u) {
  const parts = String(u.keyDeadline || '').split(/\n|\s\|\s/)
  const dates = parts.filter((p) => !isIntakeNote(p)).map(parseDate).filter(Boolean).sort((a, b) => a - b)
  return dates[0] || null
}

export function daysUntil(date, from = new Date()) {
  if (!date) return null
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b - a) / 86400000)
}

/* ------------------------------------------------------------------ *
 *  Formatting helpers
 * ------------------------------------------------------------------ */
export const fmtL = (n) => (n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}L`)
export const fmtDate = (d) =>
  d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
export const fmtDateShort = (d) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
