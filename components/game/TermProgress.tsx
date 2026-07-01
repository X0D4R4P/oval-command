export function TermProgress({ currentMonth }: { currentMonth: number }) {
  const percent = Math.min(100, Math.round((currentMonth / 48) * 100))

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-paper-faint)] whitespace-nowrap">
        Month {Math.min(currentMonth, 48)} / 48
      </span>
      <div className="h-[3px] flex-1 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-brass)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-[var(--color-paper-faint)]">{percent}%</span>
    </div>
  )
}
