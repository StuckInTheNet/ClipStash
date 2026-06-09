export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-20 h-20 rounded-2xl bg-surface-raised border border-border-subtle flex items-center justify-center mb-5">
        <svg className="w-10 h-10 text-text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-base font-medium text-text-primary mb-2">No clips yet</h3>
      <p className="text-[14px] text-text-secondary text-center leading-relaxed max-w-[260px]">
        Start copying text, code, links, or colors and they will appear here automatically.
      </p>
      <div className="mt-6 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface-raised border border-border-subtle">
        <kbd className="text-[12px] text-accent bg-accent-dim px-2 py-1 rounded-md font-mono font-medium">⌘⇧V</kbd>
        <span className="text-[13px] text-text-secondary">to open ClipStash anytime</span>
      </div>
    </div>
  );
}
