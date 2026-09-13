import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

const logoData = await readFile(join(process.cwd(), "src/app/icon.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export function renderOgImage({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#131a2e",
          padding: "72px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={56} height={56} style={{ borderRadius: 14 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>LAVELLE INSTITUTE</div>
            <div style={{ color: "#98a1b2", fontSize: 14, letterSpacing: 3, textTransform: "uppercase" }}>
              Professional Specialization
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          {eyebrow && (
            <div
              style={{
                display: "flex",
                color: "#ffc629",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div style={{ display: "flex", color: "#ffffff", fontSize: 56, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ display: "flex", color: "#c3c9d4", fontSize: 24, marginTop: 20, maxWidth: 920, lineHeight: 1.4 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, width: "100%", height: 10, background: "#1668e3" }} />
      </div>
    ),
    { ...OG_IMAGE_SIZE }
  );
}
