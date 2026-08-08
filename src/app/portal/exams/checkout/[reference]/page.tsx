import { getExamPaymentStatus } from "@/lib/exam-candidate-reads";
import { Card } from "@/components/ui/card";
import { ExamCheckoutStatus } from "@/components/portal/exam-checkout-status";

export default async function ExamCheckoutReturnPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const payment = await getExamPaymentStatus(reference);

  return (
    <div className="max-w-[520px] mx-auto">
      <Card elev="md" className="p-[var(--space-6)]">
        <ExamCheckoutStatus reference={reference} initial={payment} />
      </Card>
    </div>
  );
}
