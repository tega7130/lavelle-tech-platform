import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, renderOgImage } from "@/lib/og-image";
import { getListingDetail } from "@/lib/website-reads";

export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getListingDetail(code);

  return renderOgImage({
    eyebrow: detail?.tierLabel ?? "Lavelle Institute",
    title: detail?.title ?? "Programme not found",
    subtitle: detail?.pitch,
  });
}
