"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Label, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { formatNaira } from "@/lib/format";
import { createDiscountCodeAction, setDiscountCodeActiveAction } from "@/app/actions/document-library";
import type { listDiscountCodes } from "@/lib/document-library-reads";

type DiscountCodeRow = Awaited<ReturnType<typeof listDiscountCodes>>[number];
export interface DiscountDocumentOption {
  id: string;
  title: string;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatValue(code: Pick<DiscountCodeRow, "type" | "value">) {
  return code.type === "PERCENT" ? `${code.value}% off` : `${formatNaira(code.value)} off`;
}

/** "All documents" when documentScopes is empty (the default — see DiscountCodeDocument's schema comment), otherwise the scoped titles. */
function formatScope(code: Pick<DiscountCodeRow, "documentScopes">) {
  if (code.documentScopes.length === 0) return "All documents";
  return code.documentScopes.map((s) => s.documentTemplate.title);
}

function NewDiscountCodeDialog({ onClose, documents }: { onClose: () => void; documents: DiscountDocumentOption[] }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [type, setType] = React.useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [scope, setScope] = React.useState<"all" | "specific">("all");
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleDocument(id: string) {
    setSelectedDocumentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit() {
    setError(null);
    if (scope === "specific" && selectedDocumentIds.length === 0) {
      setError("Select at least one document, or switch to All documents.");
      return;
    }
    setBusy(true);
    try {
      await createDiscountCodeAction({
        code,
        type,
        value,
        expiresAt: expiresAt || undefined,
        maxRedemptions: maxRedemptions || undefined,
        documentTemplateIds: scope === "specific" ? selectedDocumentIds : undefined,
      });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create this discount code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="New discount code" className="w-[min(480px,100%)]">
      <div className="flex flex-col gap-3">
        <Field>
          <Label>Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WELCOME20"
            className="uppercase placeholder:normal-case"
          />
          <div className="text-neutral-500 text-[11.5px] mt-1">What candidates type at checkout. Not case-sensitive.</div>
        </Field>

        <Field>
          <Label>Discount type</Label>
          <Segmented
            name="discount-type"
            value={type}
            onChange={(v) => setType(v as "PERCENT" | "FIXED")}
            options={[
              { value: "PERCENT", label: "Percent off" },
              { value: "FIXED", label: "Fixed amount off" },
            ]}
          />
        </Field>

        <Field>
          <Label>{type === "PERCENT" ? "Discount (%)" : "Discount (₦)"}</Label>
          <Input
            type="number"
            min={0}
            step={type === "PERCENT" ? 1 : 0.01}
            max={type === "PERCENT" ? 100 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "PERCENT" ? "20" : "2000"}
          />
        </Field>

        <Field>
          <Label>Applies to</Label>
          <Segmented
            name="discount-scope"
            value={scope}
            onChange={(v) => setScope(v as "all" | "specific")}
            options={[
              { value: "all", label: "All documents" },
              { value: "specific", label: "Specific documents" },
            ]}
          />
          {scope === "specific" && (
            <div className="mt-2 max-h-[160px] overflow-y-auto rounded-md border border-neutral-300 p-2 flex flex-col gap-1.5">
              {documents.length === 0 ? (
                <div className="text-neutral-500 text-[12.5px] px-1 py-1">No documents to choose from yet.</div>
              ) : (
                documents.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-[12.5px] cursor-pointer px-1 py-0.5 rounded hover:bg-neutral-100">
                    <input type="checkbox" checked={selectedDocumentIds.includes(d.id)} onChange={() => toggleDocument(d.id)} />
                    {d.title}
                  </label>
                ))
              )}
            </div>
          )}
        </Field>

        <Field>
          <Label>Expires (optional)</Label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>

        <Field>
          <Label>Maximum redemptions (optional)</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
          />
        </Field>

        {error && <div className="text-[12.5px] text-[#912019]">{error}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !code.trim() || !value} onClick={submit}>
            {busy ? "Creating…" : "Create code"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ActiveToggle({ code }: { code: DiscountCodeRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      await setDiscountCodeActiveAction(code.id, !code.isActive);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle checked={code.isActive} disabled={isPending} onChange={toggle} aria-label={`${code.isActive ? "Deactivate" : "Activate"} ${code.code}`} />
      <Tag variant={code.isActive ? "success" : "neutral"}>{code.isActive ? "Active" : "Inactive"}</Tag>
    </div>
  );
}

export function DiscountCodesTable({ codes, documents, now }: { codes: DiscountCodeRow[]; documents: DiscountDocumentOption[]; now: number }) {
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="mt-[var(--space-6)]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[var(--space-4)]">
        <div>
          <div className="font-heading font-semibold text-[15px]">Discount Codes</div>
          <div className="text-neutral-600 text-[12.5px] leading-[1.6] mt-1 max-w-[70ch]">
            Codes candidates can apply at checkout to reduce a document&apos;s price.
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New Code
        </Button>
      </div>

      {codes.length === 0 ? (
        <div className="text-center py-10 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[14px]">No discount codes yet</div>
          <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">Create a code to share with candidates.</p>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Code</Th>
                <Th>Discount</Th>
                <Th>Applies to</Th>
                <Th>Expires</Th>
                <Th>Redemptions</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {codes.map((c) => {
                const expired = c.expiresAt != null && new Date(c.expiresAt).getTime() < now;
                const exhausted = c.maxRedemptions != null && c.redemptionCount >= c.maxRedemptions;
                const scope = formatScope(c);
                return (
                  <Tr key={c.id}>
                    <Td className="pl-[var(--space-4)] text-[13px] font-medium tracking-wide">{c.code}</Td>
                    <Td className="text-[13px]">{formatValue(c)}</Td>
                    <Td className="text-[13px] max-w-[220px]">
                      {scope === "All documents" ? (
                        scope
                      ) : (
                        <span title={scope.join(", ")}>{scope.length === 1 ? scope[0] : `${scope.length} documents`}</span>
                      )}
                    </Td>
                    <Td className="text-[13px]">
                      {c.expiresAt ? formatDate(c.expiresAt) : "Never"}
                      {expired && <span className="block text-[#912019] text-[11px] mt-0.5">Expired</span>}
                    </Td>
                    <Td className="text-[13px] tabular-nums">
                      {c.redemptionCount}
                      {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                      {exhausted && <span className="block text-[#912019] text-[11px] mt-0.5">Limit reached</span>}
                    </Td>
                    <Td className="text-[13px]">{formatDate(c.createdAt)}</Td>
                    <Td>
                      <ActiveToggle code={c} />
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}

      {creating && <NewDiscountCodeDialog onClose={() => setCreating(false)} documents={documents} />}
    </div>
  );
}
