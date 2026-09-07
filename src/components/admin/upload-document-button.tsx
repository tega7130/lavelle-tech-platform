"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { createDocumentTemplateAction } from "@/app/actions/document-library";
import { finaliseUpload } from "@/app/actions/uploads";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { ACCEPTED_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES, isAcceptedDocumentMimeType } from "@/lib/document-library";
import { DocumentCategoryPicker, type DocumentCategoryOption } from "@/components/admin/document-category-picker";

interface UploadedDocumentFile {
  storageKey: string;
  fileType: string;
  fileName: string;
  fileBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT_ATTR = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function UploadDocumentButton({
  label = "Upload Document",
  categories: initialCategories,
}: {
  label?: string;
  categories: DocumentCategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [categories, setCategories] = React.useState(initialCategories);
  const [categoryId, setCategoryId] = React.useState(initialCategories[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [priceNaira, setPriceNaira] = React.useState("");
  const [discountedPriceNaira, setDiscountedPriceNaira] = React.useState("");
  const [file, setFile] = React.useState<UploadedDocumentFile | null>(null);
  const [fileUploading, setFileUploading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function reset() {
    setTitle("");
    setCategoryId(initialCategories[0]?.id ?? "");
    setDescription("");
    setPriceNaira("");
    setDiscountedPriceNaira("");
    setFile(null);
    setFileError(null);
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleFileSelect(selected: File) {
    setFileError(null);
    if (!isAcceptedDocumentMimeType(selected.type)) {
      setFileError(`Unsupported file type. Accepted types: ${ACCEPTED_DOCUMENT_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (selected.size > MAX_DOCUMENT_BYTES) {
      setFileError(`File is too large (max ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB).`);
      return;
    }
    setFileUploading(true);
    try {
      const uploaded = await uploadToCloudinary(selected, "document_library");
      const asset = await finaliseUpload({
        storageKey: uploaded.storageKey,
        kind: "document",
        mimeType: selected.type,
        originalFilename: selected.name,
        bytes: uploaded.bytes,
        durationSeconds: null,
        purpose: "document_library",
      });
      setFile({ storageKey: asset.storageKey, fileType: asset.mimeType, fileName: asset.originalFilename, fileBytes: asset.bytes });
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setFileUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!file) {
      setError("Select a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (discountedPriceNaira && Number(discountedPriceNaira) >= Number(priceNaira)) {
      setError("Discounted price must be lower than the selling price for a sale to show.");
      return;
    }
    setBusy(true);
    try {
      await createDocumentTemplateAction({
        title,
        categoryId,
        description: description || undefined,
        priceNaira,
        discountedPriceNaira: discountedPriceNaira || undefined,
        storageKey: file.storageKey,
        fileType: file.fileType,
        fileName: file.fileName,
        fileBytes: file.fileBytes,
      });
      setNotice(`"${title}" uploaded successfully.`);
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice && (
        <div className="mb-3 flex items-start gap-2.5 rounded-md border border-[#bfe3cd] bg-[#e7f6ed] px-3.5 py-2.5 text-[12.5px] text-[#116632]">
          <span className="flex-none font-bold">✓</span>
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="flex-none cursor-pointer text-[#116632]">
            ×
          </button>
        </div>
      )}

      <Button variant="primary" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open && (
        <Dialog open onClose={close} title="Upload document" className="w-[min(560px,100%)]">
          <div className="flex flex-col gap-3">
            <Field>
              <Label>Document file</Label>
              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2.5">
                  <div className="min-w-0 text-[12.5px] text-neutral-700 truncate">
                    {file.fileName} · {formatBytes(file.fileBytes)}
                  </div>
                  <Button variant="secondary" className="h-8 flex-none text-[12px]" onClick={() => setFile(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept={ACCEPT_ATTR}
                    disabled={fileUploading}
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (selected) void handleFileSelect(selected);
                      e.target.value = "";
                    }}
                    className="text-[12.5px]"
                  />
                  <div className="text-neutral-500 text-[11.5px] mt-1">
                    PDF or DOCX, up to {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB.
                  </div>
                </>
              )}
              {fileUploading && <div className="text-neutral-500 text-[12px] mt-1">Uploading…</div>}
              <FieldError>{fileError}</FieldError>
            </Field>

            <Field>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Employment Contract Template" />
            </Field>

            <Field>
              <Label>Category</Label>
              <DocumentCategoryPicker
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                onCategoryCreated={(created) => setCategories((cats) => (cats.some((c) => c.id === created.id) ? cats : [...cats, created]))}
              />
            </Field>

            <Field>
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="A short description of this document"
              />
            </Field>

            <Field>
              <Label>Selling price (₦)</Label>
              <Input type="number" min={0} step="0.01" value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} placeholder="15000" />
              <div className="text-neutral-500 text-[11.5px] mt-1">Amount in Nigerian Naira (NGN).</div>
            </Field>

            <Field>
              <Label>Discounted price (optional)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discountedPriceNaira}
                onChange={(e) => setDiscountedPriceNaira(e.target.value)}
                placeholder="10000"
              />
              <div className="text-neutral-500 text-[11.5px] mt-1">
                A flat sale price — lower than Selling price above. When set, this is what&apos;s charged, and the selling price is shown struck through beside it.
              </div>
            </Field>

            {error && <div className="text-[12.5px] text-[#912019]">{error}</div>}

            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy || fileUploading || !file || !title.trim() || !categoryId || priceNaira === ""} onClick={submit}>
                {busy ? "Uploading…" : "Upload Document"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
