"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Label, Input, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatNaira } from "@/lib/format";
import { validateDiscountCodeAction, initiateDocumentPurchaseAction } from "@/app/actions/document-purchase";

interface DiscountState {
  applying: boolean;
  valid?: boolean;
  reason?: string;
  discountMinor?: number;
  finalAmountMinor?: number;
}

/**
 * One-click purchase, no cart (spec rule 12): Purchase Now opens this
 * confirmation modal; Confirm Purchase redirects straight to the Nomba
 * hosted checkout page. The discount preview here is just that — a
 * preview (validateDiscountCodeAction never charges anything) —
 * initiateDocumentPurchaseAction re-validates the same code again,
 * independently, server-side, at the moment the payment is actually
 * created.
 */
export function PurchaseButton({
  documentTemplateId,
  title,
  priceMinor,
  fileFormatLabel,
}: {
  documentTemplateId: string;
  title: string;
  priceMinor: number;
  fileFormatLabel: string;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [discountCode, setDiscountCode] = React.useState("");
  const [discount, setDiscount] = React.useState<DiscountState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setDiscountCode("");
    setDiscount(null);
    setError(null);
  }

  async function applyDiscount() {
    const code = discountCode.trim();
    if (!code) return;
    setDiscount({ applying: true });
    const result = await validateDiscountCodeAction(documentTemplateId, code);
    if (result.valid) {
      setDiscount({ applying: false, valid: true, discountMinor: result.discountMinor, finalAmountMinor: result.finalAmountMinor });
      showToast({ tone: "success", message: "Code applied" });
    } else {
      setDiscount({ applying: false, valid: false, reason: result.reason });
      showToast({ tone: "danger", message: "Invalid discount code" });
    }
  }

  function removeDiscount() {
    setDiscountCode("");
    setDiscount(null);
  }

  async function confirmPurchase() {
    setBusy(true);
    setError(null);
    try {
      const result = await initiateDocumentPurchaseAction(documentTemplateId, discount?.valid ? discountCode.trim() : undefined);
      if (result.error || !result.checkoutUrl) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const finalAmountMinor = discount?.valid ? discount.finalAmountMinor! : priceMinor;

  return (
    <>
      <Button type="button" variant="primary" block onClick={() => setOpen(true)}>
        Purchase Now
      </Button>

      {open && (
        <Dialog open onClose={close} title="Confirm purchase" className="w-[min(480px,100%)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-divider p-3.5">
              <div className="font-heading font-semibold text-[14px]">{title}</div>
              <div className="mt-1 text-[12px] text-neutral-500">{fileFormatLabel}</div>
              <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-neutral-300 pt-3 text-[13px]">
                <div className="flex justify-between text-neutral-600">
                  <span>Price</span>
                  <span className="tabular-nums">{formatNaira(priceMinor)}</span>
                </div>
                {discount?.valid && (
                  <div className="flex justify-between text-success-text">
                    <span>Discount</span>
                    <span className="tabular-nums">−{formatNaira(discount.discountMinor!)}</span>
                  </div>
                )}
                <div className="flex justify-between font-heading font-semibold text-[15px]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatNaira(finalAmountMinor)}</span>
                </div>
              </div>
            </div>

            <Field>
              <Label>Have a discount code?</Label>
              <div className="flex gap-2">
                <Input
                  dense
                  value={discountCode}
                  disabled={!!discount?.valid}
                  onChange={(e) => {
                    setDiscountCode(e.target.value);
                    setDiscount(null);
                  }}
                  placeholder="Enter code"
                  className="flex-1"
                />
                {discount?.valid ? (
                  <Button type="button" variant="secondary" className="h-[38px] text-[12.5px]" onClick={removeDiscount}>
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-[38px] text-[12.5px]"
                    disabled={discount?.applying || !discountCode.trim()}
                    onClick={applyDiscount}
                  >
                    {discount?.applying ? "Checking…" : "Apply"}
                  </Button>
                )}
              </div>
              {discount?.valid && (
                <div className="mt-1.5 text-[11.5px] text-success-text">Code applied — you save {formatNaira(discount.discountMinor!)}.</div>
              )}
              {discount && discount.valid === false && <FieldError>{discount.reason}</FieldError>}
            </Field>

            {error && <div className="text-[12.5px] text-danger-heading">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={confirmPurchase} disabled={busy}>
                {busy ? "Redirecting…" : "Confirm Purchase"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
