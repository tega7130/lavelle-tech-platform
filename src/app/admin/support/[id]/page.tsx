import { notFound } from "next/navigation";
import { getSupportRequestThread } from "@/lib/support-reads";
import { SupportThread } from "@/components/admin/support-thread";

export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getSupportRequestThread(id);
  if (!request) notFound();
  return <SupportThread request={request} />;
}
