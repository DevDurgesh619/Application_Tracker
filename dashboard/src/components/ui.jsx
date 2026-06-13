import { tier, country, statusStyle } from '../data/store'

export function TierBadge({ tier: t, size = 'sm' }) {
  const c = tier(t)
  const pad = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2.5 py-1 text-[11px]'
  return (
    <span className={`chip ${pad} ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = statusStyle(status)
  return (
    <span className={`chip ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status || 'Not Started'}
    </span>
  )
}

export function Flag({ country: c, withLabel = false, className = '' }) {
  const info = country(c)
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="text-base leading-none">{info.flag}</span>
      {withLabel && <span>{info.label}</span>}
    </span>
  )
}

export function StatCard({ icon: Icon, label, value, sub, accent = 'brand', to }) {
  const accents = {
    brand: 'text-brand-600 bg-brand-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    ink: 'text-ink-600 bg-ink-100',
  }
  return (
    <div className="card p-5 transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <div className="label">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink-900">{value}</div>
          {sub && <div className="mt-1 text-sm text-ink-500">{sub}</div>}
        </div>
        {Icon && (
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${accents[accent]}`}>
            <Icon size={20} strokeWidth={2.2} />
          </div>
        )}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="label mb-1">{label}</div>
      <div className="text-sm font-medium text-ink-800">{children ?? '—'}</div>
    </div>
  )
}

export function SectionCard({ icon: Icon, title, accent = 'brand', action, children, className = '' }) {
  const accents = {
    brand: 'text-brand-600 bg-brand-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    violet: 'text-violet-600 bg-violet-50',
    ink: 'text-ink-600 bg-ink-100',
  }
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={`grid h-7 w-7 place-items-center rounded-lg ${accents[accent]}`}>
              <Icon size={15} strokeWidth={2.4} />
            </div>
          )}
          <h2 className="text-sm font-bold tracking-tight text-ink-900">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Pill({ children, className = '' }) {
  return <span className={`chip bg-ink-100 text-ink-600 ${className}`}>{children}</span>
}

export function Empty({ children }) {
  return <div className="py-8 text-center text-sm text-ink-400">{children}</div>
}

/** colored progress bar 0..100 */
export function Bar({ value, className = 'bg-brand-500' }) {
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={`h-full rounded-full ${className} transition-all`} style={{ width: `${v}%` }} />
    </div>
  )
}
