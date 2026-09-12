"use client";

import * as React from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getDocumentFileAccessAction } from "@/app/actions/document-purchase";

interface DocumentFileButtonProps {
  documentTemplateId: string;
  variant?: ButtonVariant;
  className?: string;
}

/** Opens the signed file URL in a new tab — never an embedded in-page preview (spec rule 24). The storage layer's `attachment` disposition (set server-side for mode "download") is what makes the browser save rather than render it. */
function useOpenDocument(documentTemplateId: string, mode: "download" | "view") {
  const { showToast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function open() {
    if (pending) return;
    startTransition(async () => {
      try {
        const url = await getDocumentFileAccessAction(documentTemplateId, mode);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        showToast({ tone: "danger", message: mode === "download" ? "Download failed. Please try again." : "Could not open this document. Please try again." });
      }
    });
  }

  return { open, pending };
}

export function DownloadButton({ documentTemplateId, variant = "primary", className }: DocumentFileButtonProps) {
  const { open, pending } = useOpenDocument(documentTemplateId, "download");
  return (
    <Button type="button" variant={variant} onClick={open} disabled={pending} className={className}>
      {pending ? "Preparing…" : "Download"}
    </Button>
  );
}

export function ViewOnlineButton({ documentTemplateId, variant = "secondary", className }: DocumentFileButtonProps) {
  const { open, pending } = useOpenDocument(documentTemplateId, "view");
  return (
    <Button type="button" variant={variant} onClick={open} disabled={pending} className={className}>
      {pending ? "Opening…" : "View Online"}
    </Button>
  );
}
