"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { deleteProgramme, duplicateProgrammeAndRedirect, setProgrammeStatus } from "@/app/actions/programme";
import type { ProgrammeStatus } from "@/generated/prisma/client";

interface ProgrammeRowActionsProps {
  id: string;
  status: ProgrammeStatus;
  /** Same permission setProgrammeStatus itself requires (MANAGE_PROGRAMMES) — computed server-side from the signed-in staff's actual grants, not guessed from role name. */
  canManageProgrammes: boolean;
  isSuperAdmin: boolean;
}

export function ProgrammeRowActions({ id, status, canManageProgrammes, isSuperAdmin }: ProgrammeRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors programme-content-editor.tsx's Publish to catalogue / Revert
  // to draft pair — same underlying setProgrammeStatus action and publish
  // checks, just reachable from the list row instead of the content step.
  function handlePublish() {
    setError(null);
    startTransition(async () => {
      try {
        await setProgrammeStatus(id, "ACTIVE");
      } catch (e) {
        const failures = (e as { failures?: string[] })?.failures;
        setError(failures ? failures.join(" ") : e instanceof Error ? e.message : "Failed to publish programme");
      }
    });
  }

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      try {
        await setProgrammeStatus(id, "DRAFT");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revert programme to draft");
      }
    });
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteProgramme(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete programme");
        setDeleteConfirm(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <form action={duplicateProgrammeAndRedirect.bind(null, id)}>
          <button type="submit" className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}>
            Duplicate
          </button>
        </form>

        <Link href={`/admin/programmes/${id}/edit`} className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}>
          Edit
        </Link>

        {canManageProgrammes && status === "ACTIVE" && (
          <button
            onClick={handleUnpublish}
            disabled={isPending}
            className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}
          >
            Unpublish
          </button>
        )}

        {canManageProgrammes && status === "DRAFT" && (
          <button onClick={handlePublish} disabled={isPending} className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}>
            Publish
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={buttonClassName(deleteConfirm ? "danger" : "secondary", "px-[11px] py-[5px] text-xs")}
          >
            {deleteConfirm ? "Confirm delete?" : "Delete"}
          </button>
        )}
      </div>
      {error && <div className="max-w-[320px] text-right text-[11.5px] text-[#912019]">{error}</div>}
    </div>
  );
}
