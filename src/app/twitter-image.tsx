import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, renderOgImage } from "@/lib/og-image";

export const alt = "Lavelle Institute — Professional Legal Specialization for Nigeria";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Professional Specialization",
    title: "Structured specialization for the Nigerian legal market",
    subtitle: "Foundation, Specialist and Advanced Practitioner programmes with publicly verifiable certification.",
  });
}
