import { listMarkingQueue } from "@/lib/marking-reads";
import { MarkingQueue } from "@/components/admin/marking-queue";

export default async function Page() {
  const [awaiting, returned] = await Promise.all([
    listMarkingQueue({ tab: "awaiting" }),
    listMarkingQueue({ tab: "returned" }),
  ]);

  return <MarkingQueue awaiting={awaiting.items} returned={returned.items} counts={awaiting.counts} />;
}
