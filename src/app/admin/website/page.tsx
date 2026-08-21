import { listListings, getListingForEditor } from "@/lib/website-admin";
import { WebsiteListingEditor } from "@/components/admin/website-listing-editor";
import { WebsiteListingRail } from "@/components/admin/website-listing-rail";
import { buttonClassName } from "@/components/ui/button";

export default async function AdminWebsitePage({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const { programme: selectedId } = await searchParams;
  const listings = await listListings();

  if (listings.length === 0) {
    return (
      <div className="max-w-[1000px]">
        <h1 className="font-heading text-2xl mb-[var(--space-4)]">Website</h1>
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No programmes published yet</div>
          <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">
            Create a programme first — its listing can then be published from here.
          </p>
        </div>
      </div>
    );
  }

  const selected = selectedId ?? listings[0]!.programmeId;
  const listing = await getListingForEditor(selected);
  // Slice 11 Part C: archiving a programme never unpublishes its listing
  // (README C1) — this is the derived warning that tells a human when a
  // live listing needs a decision, computed fresh on every render.
  const archivedLive = listings.filter((l) => l.isPublished && l.isArchived);

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[var(--space-5)]">
        <div>
          <div className="text-[10px] tracking-[0.1em] uppercase font-semibold text-accent">Public site</div>
          <div className="font-heading font-semibold text-[17px] mt-[2px]">Programme listings</div>
          <div className="text-neutral-600 text-[12.5px] leading-[1.6] mt-1 max-w-[70ch]">
            Choose which programmes appear on the public site. A listing inherits the syllabus and assessment weighting from the programme record; everything else on this page is what a visitor reads before they register.
          </div>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className={buttonClassName("secondary", "h-[38px] text-[13px]")}>
          View public site
        </a>
      </div>

      {archivedLive.length > 0 && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mb-[var(--space-5)]">
          <span className="flex-none w-[26px] h-[26px] rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-[14px] font-bold">!</span>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-semibold text-[13.5px] text-[#7a4d06]">
              {archivedLive.length === 1 ? "A live listing has an archived programme" : `${archivedLive.length} live listings have an archived programme`}
            </div>
            <div className="text-[12.5px] leading-relaxed text-[#8a6013] mt-1">
              {archivedLive.map((l) => l.title).join(", ")} — enrolment is closed on the listing, but it remains visible on the public site until unpublished.
            </div>
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {archivedLive.map((l) => (
                <a
                  key={l.programmeId}
                  href={`/admin/website?programme=${l.programmeId}`}
                  className={buttonClassName("secondary", "h-[32px] px-3 text-[12px]")}
                >
                  Review {l.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[var(--space-5)] items-start">
        {/* programme list — sticky and independently scrollable so a long
            list (every programme ever created, not just published ones)
            doesn't dwarf the editor column next to it and leave a slab of
            dead space once the shorter column's content ends. */}
        <div className="border border-divider rounded-md p-[var(--space-3)] lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <div className="flex justify-between items-baseline gap-3 px-2 pb-3">
            <div className="text-[10px] tracking-[0.1em] uppercase font-semibold text-accent">Created programmes</div>
            <span className="text-neutral-500 text-[11.5px]">{listings.filter((l) => l.isPublished).length} live</span>
          </div>
          <WebsiteListingRail listings={listings} selected={selected} />
        </div>

        <WebsiteListingEditor listing={listing} />
      </div>
    </div>
  );
}
