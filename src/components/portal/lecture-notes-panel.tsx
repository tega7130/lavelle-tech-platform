"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { isMarkupEmpty } from "@/lib/rich-text";
import { deleteNoteAction } from "@/app/actions/player";

const AUTOSAVE_DEBOUNCE_MS = 1500;

function noteLocalStorageKey(enrolmentId: string, lectureId: string) {
  return `lavelle:note-offline:${enrolmentId}:${lectureId}`;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * A private, per-lecture scratchpad under the video/content area — not a
 * step, never gates progression. Mirrors DraftingStep's debounced-
 * autosave + offline-localStorage-fallback shape (lecture-player.tsx),
 * plus an explicit "Save note" button so the candidate gets a clear,
 * on-demand confirmation rather than relying solely on the debounce.
 */
export function LectureNotesPanel({
  enrolmentId,
  lectureId,
  initialBody,
}: {
  enrolmentId: string;
  lectureId: string;
  initialBody: string;
}) {
  const [body, setBody] = React.useState(initialBody);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = React.useRef(body);
  bodyRef.current = body;

  const storageKey = noteLocalStorageKey(enrolmentId, lectureId);

  const save = React.useCallback(
    async (text: string) => {
      setSaveState("saving");
      try {
        await fetch("/api/progress/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrolmentId, lectureId, body: text }),
        });
        localStorage.removeItem(storageKey);
        setSaveState("saved");
      } catch {
        localStorage.setItem(storageKey, JSON.stringify({ body: text, savedAt: new Date().toISOString() }));
        setSaveState("error");
      }
    },
    [enrolmentId, lectureId, storageKey]
  );

  function onChange(markup: string) {
    setBody(markup);
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(markup), AUTOSAVE_DEBOUNCE_MS);
  }

  async function saveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await save(bodyRef.current);
  }

  React.useEffect(() => {
    function onOnline() {
      const pending = localStorage.getItem(storageKey);
      if (pending) save(JSON.parse(pending).body);
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [save, storageKey]);

  async function confirmedDelete() {
    setDeleting(true);
    try {
      await deleteNoteAction(enrolmentId, lectureId);
      setBody("");
      setSaveState("idle");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const hasContent = !isMarkupEmpty(body);

  return (
    <div className="mt-[var(--space-5)] pt-[var(--space-4)] border-t border-divider">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="m-0 text-[14px]">Your notes</h3>
        <span className="text-[11.5px] text-neutral-500">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Could not save — kept on this device"}
        </span>
      </div>
      <RichTextEditor
        key={lectureId}
        value={initialBody}
        onChange={onChange}
        placeholder="Jot down anything worth remembering from this lecture…"
        minHeightPx={110}
      />
      <div className="flex items-center justify-between mt-2.5">
        <Button variant="secondary" onClick={saveNow} disabled={saveState === "saving"}>
          Save note
        </Button>
        {hasContent && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-[12.5px] font-medium text-[#b42318] hover:underline"
          >
            Delete note
          </button>
        )}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this note?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmedDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete note"}
            </Button>
          </>
        }
      >
        <p>This can&rsquo;t be undone — your note for this lecture will be permanently removed.</p>
      </Dialog>
    </div>
  );
}
