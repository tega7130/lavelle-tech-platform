export function ScreenPlaceholder({ title }: { title: string }) {
  return (
    <div className="max-w-[560px] rounded-md border border-dashed border-neutral-300 p-[var(--space-6)] text-neutral-600 text-sm">
      <div className="font-heading font-semibold text-text mb-1">{title}</div>
      This screen ships in a later handoff. This route exists to prove the shell renders and
      navigates correctly.
    </div>
  );
}
