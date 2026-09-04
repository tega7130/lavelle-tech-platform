import { notFound } from "next/navigation";
import Link from "next/link";
import { getProgrammeDetail } from "@/lib/catalogue-reads";
import { formatNaira, tierLabel, youtubeEmbedUrl } from "@/lib/format";
import { getSignedAssetUrl } from "@/lib/storage";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { EnrolButton } from "@/components/portal/enrol-button";

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const programme = await getProgrammeDetail(code);
  if (!programme) notFound();

  const embedUrl = programme.coverVideoUrl ? youtubeEmbedUrl(programme.coverVideoUrl) : null;
  const directVideoUrl = programme.coverVideoAsset
    ? getSignedAssetUrl(programme.coverVideoAsset.storageKey, "video")
    : !embedUrl
      ? programme.coverVideoUrl
      : null;

  return (
    <div className="max-w-[820px]">
      <Link href="/portal/catalogue" className="text-[13px] text-accent">
        ← Back to catalogue
      </Link>
      <div className="flex gap-2 mt-[var(--space-4)] mb-1.5">
        <Tag variant="accent">{tierLabel(programme.tier)}</Tag>
        <Tag variant="neutral">{programme.category.name}</Tag>
      </div>
      <h1 className="font-heading text-[28px] m-0">{programme.title}</h1>
      <p className="text-[14px] text-neutral-600 max-w-[640px] mt-2">{programme.summary}</p>

      {(embedUrl || directVideoUrl) && (
        <div className="mt-[var(--space-4)] max-w-[640px] aspect-video overflow-hidden rounded-md border border-divider bg-[#0b1322]">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${programme.title} — cover video`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={directVideoUrl!} controls className="h-full w-full" />
          )}
        </div>
      )}

      <div className="grid grid-cols-[2fr_1fr] max-[760px]:grid-cols-1 gap-[var(--space-6)] mt-[var(--space-6)]">
        <div>
          <h3>
            Syllabus &middot; {programme.modules.length} modules &middot;{" "}
            {programme.modules.reduce((n, m) => n + m.lectures.length, 0)} lectures
          </h3>
          <div className="flex flex-col gap-2 mt-[var(--space-3)]">
            {programme.modules.map((m) => (
              <Card key={m.id} elev="sm" className="p-0 gap-0 overflow-hidden">
                <div className="px-[var(--space-4)] py-[var(--space-3)] bg-neutral-100">
                  <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-500">Week {m.weekNumber}</div>
                  <div className="font-heading font-semibold text-sm mt-0.5">{m.title}</div>
                </div>
                <div className="flex flex-col border-t border-dashed border-neutral-300">
                  {m.lectures.map((l, i) => (
                    <div
                      key={l.id}
                      className="flex items-start gap-3 px-[var(--space-4)] py-2.5 border-b border-dashed border-neutral-300 last:border-b-0"
                    >
                      <span className="flex-none w-6 text-[11px] text-neutral-500 tabular-nums">{i + 1}</span>
                      <span className="text-[13px]">{l.title}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card elev="md" className="h-fit">
          <CardKicker>Programme fee</CardKicker>
          <div className="font-heading text-[26px]">{formatNaira(programme.feeMinor)}</div>
          <div className="text-[12px] text-neutral-500 mb-2">Nigerian rails &amp; international cards accepted</div>
          {programme.viewerEnrolled ? (
            <Link href={`/portal/programme?programme=${code}`} className={buttonClassName("secondary", "w-full justify-center")}>
              Enrolled — go to programme
            </Link>
          ) : (
            <EnrolButton programmeId={programme.id} label="Enrol now" />
          )}
        </Card>
      </div>
    </div>
  );
}
