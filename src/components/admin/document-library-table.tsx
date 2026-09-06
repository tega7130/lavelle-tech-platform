"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Label, Input, Textarea } from "@/components/ui/field";
import { formatNaira } from "@/lib/format";
import { DOCUMENT_CATEGORIES, documentCategoryLabel, ACCEPTED_DOCUMENT_MIME_TYPES } from "@/lib/document-library";
import {
  updateDocumentTemplateAction,
  setDocumentTemplateActiveAction,
  deleteDocumentTemplateAction,
  getDocumentFileUrlAction,
} from "@/app/actions/document-library";
import type { listDocumentTemplates } from "@/lib/document-library-reads";

type DocumentRow = Awaited<ReturnType<typeof listDocumentTemplates>>[number];

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EditDocumentDialog({ document, onClose }: { document: DocumentRow; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(document.title);
  const [category, setCategory] = React.useState(document.category);
  const [description, setDescription] = React.useState(document.description ?? "");
  const [priceNaira, setPriceNaira] = React.useState(String(document.priceMinor / 100));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileUrlLoading, setFileUrlLoading] = React.useState(false);

  async function viewFile() {
    setFileUrlLoading(true);
    try {
      const url = await getDocumentFileUrlAction(document.storageKey);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setFileUrlLoading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      await updateDocumentTemplateAction(document.id, { title, category, description: description || undefined, priceNaira });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Edit document" className="w-[min(560px,100%)]">
      <div className="flex flex-col gap-3">
        <Field>
          <Label>Document file</Label>
          <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2.5">
            <div className="min-w-0 text-[12.5px] text-neutral-700">
              <div className="truncate">{document.fileName}</div>
              <div className="text-neutral-500 text-[11px] mt-0.5">
                {ACCEPTED_DOCUMENT_MIME_TYPES[document.fileType] ?? document.fileType} · {formatBytes(document.fileBytes)}
              </div>
            </div>
            <Button variant="secondary" className="h-8 flex-none text-[12px]" disabled={fileUrlLoading} onClick={viewFile}>
              {fileUrlLoading ? "Opening…" : "View file"}
            </Button>
          </div>
          <div className="text-neutral-500 text-[11.5px] mt-1">To replace the file itself, delete this document and upload a new one.</div>
        </Field>

        <Field>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm text-text"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>

        <Field>
          <Label>Price (₦)</Label>
          <Input type="number" min={0} step="0.01" value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} />
          <div className="text-neutral-500 text-[11.5px] mt-1">Amount in Nigerian Naira (NGN).</div>
        </Field>

        {error && <div className="text-[12.5px] text-[#912019]">{error}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !title.trim()} onClick={submit}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AnalyticsDialog({ document, onClose }: { document: DocumentRow; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={document.title} className="w-[min(480px,100%)]">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-divider p-3">
          <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500">Purchases</div>
          <div className="font-heading font-semibold text-[20px] mt-1 tabular-nums">{document.purchaseCount}</div>
        </div>
        <div className="rounded-md border border-divider p-3">
          <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500">Revenue</div>
          <div className="font-heading font-semibold text-[20px] mt-1 tabular-nums">{formatNaira(document.revenueMinor)}</div>
        </div>
        <div className="rounded-md border border-divider p-3 col-span-2">
          <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500">Uploaded</div>
          <div className="text-[13px] mt-1">{formatDate(document.createdAt)}</div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

function DeleteDocumentDialog({ document, onClose }: { document: DocumentRow; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteDocumentTemplateAction(document.id);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this document.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete document"
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p>
        Are you sure you want to delete <strong>{document.title}</strong>? This action cannot be undone.
      </p>
      {error && <div className="mt-2 text-[12.5px] text-[#912019]">{error}</div>}
    </Dialog>
  );
}

function StatusToggle({ document }: { document: DocumentRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      await setDocumentTemplateActiveAction(document.id, !document.isActive);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle checked={document.isActive} disabled={isPending} onChange={toggle} aria-label={`${document.isActive ? "Deactivate" : "Activate"} ${document.title}`} />
      <Tag variant={document.isActive ? "success" : "neutral"}>{document.isActive ? "Active" : "Inactive"}</Tag>
    </div>
  );
}

export function DocumentLibraryTable({ documents }: { documents: DocumentRow[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [analyticsId, setAnalyticsId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const editing = documents.find((d) => d.id === editingId) ?? null;
  const viewingAnalytics = documents.find((d) => d.id === analyticsId) ?? null;
  const deleting = documents.find((d) => d.id === deletingId) ?? null;

  return (
    <>
      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Document</Th>
              <Th>Category</Th>
              <Th>Price</Th>
              <Th>Purchases</Th>
              <Th>Revenue</Th>
              <Th>Uploaded</Th>
              <Th>Status</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {documents.map((d) => (
              <Tr key={d.id}>
                <Td className="pl-[var(--space-4)]">
                  <div className="text-[13px]">{d.title}</div>
                  <div className="text-[11.5px] text-neutral-500 truncate max-w-[280px]">{d.fileName}</div>
                </Td>
                <Td className="text-[13px]">{documentCategoryLabel(d.category)}</Td>
                <Td className="text-[13px] tabular-nums">{formatNaira(d.priceMinor)}</Td>
                <Td className="text-[13px] tabular-nums">{d.purchaseCount}</Td>
                <Td className="text-[13px] tabular-nums">{formatNaira(d.revenueMinor)}</Td>
                <Td className="text-[13px]">{formatDate(d.createdAt)}</Td>
                <Td>
                  <StatusToggle document={d} />
                </Td>
                <Td className="text-right pr-[var(--space-4)]">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" className="h-8 text-[12px]" onClick={() => setEditingId(d.id)}>
                      Edit
                    </Button>
                    <Button variant="secondary" className="h-8 text-[12px]" onClick={() => setAnalyticsId(d.id)}>
                      Analytics
                    </Button>
                    <Button variant="danger" className="h-8 text-[12px]" onClick={() => setDeletingId(d.id)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {editing && <EditDocumentDialog document={editing} onClose={() => setEditingId(null)} />}
      {viewingAnalytics && <AnalyticsDialog document={viewingAnalytics} onClose={() => setAnalyticsId(null)} />}
      {deleting && <DeleteDocumentDialog document={deleting} onClose={() => setDeletingId(null)} />}
    </>
  );
}
