"use client";

import * as React from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NotesIcon } from "@/components/icons";
import type { getCandidateNotes } from "@/lib/notes-reads";
import { deleteNoteAction } from "@/app/actions/player";

type Groups = Awaited<ReturnType<typeof getCandidateNotes>>;

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function NotesList({ groups }: { groups: Groups }) {
  const [pendingDelete, setPendingDelete] = React.useState<{ enrolmentId: string; lectureId: string; lectureTitle: string } | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);
  // Deleted notes disappear immediately rather than waiting on the
  // Server Action's revalidatePath to round-trip back through this page.
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());

  const totalNotes = groups.reduce((n, g) => n + g.notes.length, 0) - removed.size;

  if (totalNotes <= 0) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-16">
        <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-3">
          <NotesIcon width={20} height={20} />
        </div>
        <div className="font-heading font-semibold text-[16px]">No notes yet</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[48ch] mx-auto">
          While you&rsquo;re watching a lecture, jot down anything worth remembering underneath the video — it&rsquo;ll
          show up here.
        </p>
      </div>
    );
  }

  async function confirmedDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteNoteAction(pendingDelete.enrolmentId, pendingDelete.lectureId);
      setRemoved((prev) => new Set(prev).add(`${pendingDelete.enrolmentId}:${pendingDelete.lectureId}`));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-[860px] flex flex-col gap-[var(--space-6)]">
      {groups.map((group) => {
        const visibleNotes = group.notes.filter((n) => !removed.has(`${group.enrolmentId}:${n.lectureId}`));
        if (visibleNotes.length === 0) return null;
        return (
          <div key={group.enrolmentId}>
            <h3 className="m-0 mb-2">{group.programmeTitle}</h3>
            <div className="border border-divider rounded-md overflow-hidden">
              {visibleNotes.map((note) => (
                <div
                  key={note.lectureId}
                  className="flex items-start gap-[var(--space-4)] p-[var(--space-4)] border-b border-dashed border-neutral-300 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{note.lectureTitle}</div>
                    <div className="text-neutral-500 text-[12px] mt-0.5">
                      Week {note.weekNumber} &middot; {note.moduleTitle} &middot; Updated {formatDate(note.updatedAt)}
                    </div>
                    {note.preview && <p className="text-[13px] text-neutral-700 mt-2 mb-0">{note.preview}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Link
                      href={`/learn/${group.enrolmentId}/${note.lectureId}`}
                      className={buttonClassName("secondary", "h-[31px] px-[11px] text-xs")}
                    >
                      Open lecture
                    </Link>
                    <button
                      onClick={() =>
                        setPendingDelete({ enrolmentId: group.enrolmentId, lectureId: note.lectureId, lectureTitle: note.lectureTitle })
                      }
                      className="text-[12px] font-medium text-[#b42318] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this note?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmedDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete note"}
            </Button>
          </>
        }
      >
        <p>
          This can&rsquo;t be undone — your note for <strong>{pendingDelete?.lectureTitle}</strong> will be permanently
          removed.
        </p>
      </Dialog>
    </div>
  );
}
