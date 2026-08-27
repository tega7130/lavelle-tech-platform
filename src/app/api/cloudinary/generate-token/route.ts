import { getCurrentCandidate } from "@/lib/candidate-session";
import crypto from "crypto";

/**
 * Generates a secure upload token for Cloudinary direct upload.
 * Validates candidate permissions before issuing token.
 */
export async function POST(request: Request) {
  const candidate = await getCurrentCandidate();

  if (!candidate) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate candidate has completed profile
  if (!candidate.profile?.completedAt) {
    return Response.json(
      { error: "Please complete your profile before uploading" },
      { status: 403 }
    );
  }

  try {
    // Generate secure upload token
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha256").update(toSign).digest("hex");

    return Response.json({
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "lavelle_videos",
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      success: true,
    });
  } catch (error) {
    console.error("Failed to generate upload token:", error);
    return Response.json(
      { error: "Failed to generate upload token" },
      { status: 500 }
    );
  }
}
