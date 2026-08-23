"use client";

import { useState } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { deleteProgramme, unpublishProgramme, duplicateProgrammeAndRedirect } from "@/app/actions/programme";
import type { StaffRole } from "@/generated/prisma/client";

interface ProgrammeRowActionsProps {
  id: string;
  code: string;
  title: string;
  status: string;
  isPublished?: boolean;
  staffRole: StaffRole | null;
}

export function ProgrammeRowActions({
  id,
  code,
  title,
  status,
  isPublished,
  staffRole,
}: ProgrammeRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [unpublishConfirm, setUnpublishConfirm] = useState(false);

  const isSuperAdmin = staffRole === "SUPER_ADMIN";
  const isAdmin = staffRole === "REGISTRAR" || staffRole === "ACADEMIC_ADMIN";
  const canDelete = isSuperAdmin && status === "DRAFT";
  const canUnpublish = isPublished && (isSuperAdmin || isAdmin);

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    startTransition(async () => {
      try {
        await deleteProgramme(id);
        // The server action will revalidate paths, causing a page refresh
      } catch (error) {
        alert(`Error: ${error instanceof Error ? error.message : "Failed to delete programme"}`);
        setDeleteConfirm(false);
      }
    });
  };

  const handleUnpublish = () => {
    if (!unpublishConfirm) {
      setUnpublishConfirm(true);
      return;
    }

    startTransition(async () => {
      try {
        await unpublishProgramme(id);
      } catch (error) {
        alert(`Error: ${error instanceof Error ? error.message : "Failed to unpublish programme"}`);
        setUnpublishConfirm(false);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={duplicateProgrammeAndRedirect.bind(null, id)}>
        <button type="submit" className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}>
          Duplicate
        </button>
      </form>

      <Link
        href={`/admin/programmes/${id}/edit`}
        className={buttonClassName("secondary", "px-[11px] py-[5px] text-xs")}
      >
        Edit
      </Link>

      {canUnpublish && (
        <button
          onClick={handleUnpublish}
          disabled={isPending}
          className={buttonClassName(
            unpublishConfirm ? "danger" : "secondary",
            "px-[11px] py-[5px] text-xs"
          )}
        >
          {unpublishConfirm ? "Confirm unpublish?" : "Unpublish"}
        </button>
      )}

      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={buttonClassName(
            deleteConfirm ? "danger" : "secondary",
            "px-[11px] py-[5px] text-xs"
          )}
        >
          {deleteConfirm ? "Confirm delete?" : "Delete"}
        </button>
      )}
    </div>
  );
}
