import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingForEditor } from "@/lib/website-admin";
import { WebsiteListingEditor } from "@/components/admin/website-listing-editor";

const TAB_KEYS = new Set(["content", "pricing", "inherited"]);

// Slice 12: the editor is now its own route (was a side-by-side panel on
// the list page, selected via ?programme=). Reuses getListingForEditor
// exactly as Slice 09/11 called it — no schema, action, or permission
// change was needed for this split.
export default async function AdminWebsiteListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ programmeId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { programmeId } = await params;
  const { tab } = await searchParams;

  const listing = await getListingForEditor(programmeId).catch(() => null);
  if (!listing) notFound();

  const initialTab = tab && TAB_KEYS.has(tab) ? (tab as "content" | "pricing" | "inherited") : "content";

  return (
    <div className="max-w-[1400px]">
      <Link href="/admin/website" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; All listings
      </Link>
      <WebsiteListingEditor listing={listing} initialTab={initialTab} />
    </div>
  );
}
