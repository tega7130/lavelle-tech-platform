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

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatValue(code: Pick<DiscountCodeRow, "type" | "value">) {
  return code.type === "PERCENT" ? `${code.value}% off` : `${formatNaira(code.value)} off`;
}

function NewDiscountCodeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [type, setType] = React.useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await createDiscountCodeAction({
        code,
        type,
        value,
        expiresAt: expiresAt || undefined,
        maxRedemptions: maxRedemptions || undefined,
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

export function DiscountCodesTable({ codes, now }: { codes: DiscountCodeRow[]; now: number }) {
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
                return (
                  <Tr key={c.id}>
                    <Td className="pl-[var(--space-4)] text-[13px] font-medium tracking-wide">{c.code}</Td>
                    <Td className="text-[13px]">{formatValue(c)}</Td>
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

      {creating && <NewDiscountCodeDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
