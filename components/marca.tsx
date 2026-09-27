export function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-ink" aria-hidden>
        <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          fill="currentColor"
          d="M16 8.4 11.2 10.5v4c0 2.8 1.9 5.3 4.8 6.2 2.9-.9 4.8-3.4 4.8-6.2v-4L16 8.4Zm-.7 8.6-2.2-2.2 1-1 1.2 1.2 2.6-2.6 1 1-3.6 3.6Z"
        />
      </svg>
      <span className="leading-tight">
        <span className="text-[1.05rem] font-medium tracking-tight text-ink">La Protectora</span>
      </span>
    </span>
  )
}
