"use server";

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Webhook handler for Cloudinary upload notifications.
 * Receives post-upload events and updates database.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify webhook signature
    const signature = request.headers.get("x-cwd-signature");
    if (!signature) {
      console.warn("[cloudinary-webhook] Missing signature header");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const bodyString = JSON.stringify(body);
    const expectedSignature = crypto
      .createHash("sha256")
      .update(bodyString + process.env.CLOUDINARY_API_SECRET)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("[cloudinary-webhook] Invalid signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Process upload event
    const { public_id, secure_url, resource_type, bytes, event_type, context } = body;

    if (resource_type === "video" && event_type === "upload") {
      // Extract candidate ID from custom context
      const candidateId = context?.candidate_id;

      if (!candidateId) {
        console.warn("[cloudinary-webhook] Missing candidate_id in context");
        return Response.json({ ok: true }); // Still return success to prevent retries
      }

      // Verify candidate exists
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
      });

      if (!candidate) {
        console.warn(`[cloudinary-webhook] Candidate not found: ${candidateId}`);
        return Response.json({ ok: true });
      }

      // Create video upload record
      await prisma.videoUpload.create({
        data: {
          candidateId,
          cloudinaryId: public_id,
          url: secure_url,
          fileSize: bytes || 0,
          status: "COMPLETED",
        },
      });

      console.log(
        `[cloudinary-webhook] Video uploaded: ${public_id} for candidate ${candidateId}`
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[cloudinary-webhook] Error processing webhook:", error);
    return Response.json({ ok: true }); // Return success to prevent infinite retries
  }
}
