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

/** Downloads the document. The storage layer's `attachment` disposition (set server-side for mode "download") makes the browser save rather than render it. */
function useDownloadDocument(documentTemplateId: string) {
  const { showToast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [showFeedback, setShowFeedback] = React.useState(false);

  function download() {
    if (pending) return;
    startTransition(async () => {
      try {
        const url = await getDocumentFileAccessAction(documentTemplateId, "download");
        window.open(url, "_blank", "noopener,noreferrer");
        shouldShowBetaCompletionFeedbackAction(BETA_FEATURE.DOCUMENT_LIBRARY).then((show) => {
          if (show) setShowFeedback(true);
        });
      } catch {
        showToast({ tone: "danger", message: "Download failed. Please try again." });
      }
    });
  }

  return { download, pending, showFeedback };
}

export function DownloadButton({ documentTemplateId, variant = "primary", className }: DocumentFileButtonProps) {
  const { download, pending, showFeedback } = useDownloadDocument(documentTemplateId);
  return (
    <>
      <Button type="button" variant={variant} onClick={download} disabled={pending} className={className}>
        {pending ? "Preparing…" : "Download"}
      </Button>
      {showFeedback && <CompletionFeedbackModal feature={BETA_FEATURE.DOCUMENT_LIBRARY} heading="How was your first download?" />}
    </>
  );
}
