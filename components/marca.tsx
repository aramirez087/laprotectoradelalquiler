export function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-moss" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill="currentColor" />
        <path d="m8 15 8-7 8 7M10 14v10h12V14M14 24v-7h4v7" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="marca-nombre whitespace-nowrap leading-tight">
        <span className="block text-[1.05rem] font-semibold tracking-tight text-ink">La Protectora</span>
        <span className="block text-[0.65rem] tracking-[0.08em] text-ink-soft">DEL ALQUILER</span>
      </span>
    </span>
  )
}
