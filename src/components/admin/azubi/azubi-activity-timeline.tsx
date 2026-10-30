interface ActivityEvent {
  id: bigint;
  description: string;
  createdAt: Date;
  actor: { name: string } | null;
}

export function AzubiActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[13px] text-neutral-600">No activity recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {events.map((e) => (
        <li key={String(e.id)} className="text-[13px] border-l-2 border-divider pl-3 py-0.5">
          <span className="text-text">{e.description}</span>
          <div className="text-[11.5px] text-neutral-500">
            {e.createdAt.toLocaleString()} · {e.actor?.name ?? "System"}
          </div>
        </li>
      ))}
    </ul>
  );
}
