"use client";

import * as React from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getDocumentFileAccessAction } from "@/app/actions/document-purchase";
import { shouldShowBetaCompletionFeedbackAction } from "@/app/actions/beta-access";
import { CompletionFeedbackModal } from "@/components/beta/completion-feedback-modal";
import { BETA_FEATURE } from "@/lib/beta-types";

interface DocumentFileButtonProps {
  documentTemplateId: string;
  variant?: ButtonVariant;
  className?: string;
}

/** Opens the signed file URL in a new tab — never an embedded in-page preview (spec rule 24). The storage layer's `attachment` disposition (set server-side for mode "download") is what makes the browser save rather than render it. */
function useOpenDocument(documentTemplateId: string, mode: "download" | "view") {
  const { showToast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [showFeedback, setShowFeedback] = React.useState(false);

  function open() {
    if (pending) return;
    startTransition(async () => {
      try {
        const url = await getDocumentFileAccessAction(documentTemplateId, mode);
        window.open(url, "_blank", "noopener,noreferrer");
        if (mode === "download") {
          shouldShowBetaCompletionFeedbackAction(BETA_FEATURE.DOCUMENT_LIBRARY).then((show) => {
            if (show) setShowFeedback(true);
          });
        }
      } catch {
        showToast({ tone: "danger", message: mode === "download" ? "Download failed. Please try again." : "Could not open this document. Please try again." });
      }
    });
  }

  return { open, pending, showFeedback };
}

export function DownloadButton({ documentTemplateId, variant = "primary", className }: DocumentFileButtonProps) {
  const { open, pending, showFeedback } = useOpenDocument(documentTemplateId, "download");
  return (
    <>
      <Button type="button" variant={variant} onClick={open} disabled={pending} className={className}>
        {pending ? "Preparing…" : "Download"}
      </Button>
      {showFeedback && <CompletionFeedbackModal feature={BETA_FEATURE.DOCUMENT_LIBRARY} heading="How was your first download?" />}
    </>
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
