"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";

interface CloudinaryUploadProps {
  onUpload: (data: {
    storageKey: string;
    bytes: number;
    mimeType: string;
    durationSeconds?: number;
  }) => void;
  folder: string;
  resourceType?: "image" | "video" | "auto";
  showPoweredBy?: boolean;
  accept?: string;
}

export function CloudinaryUpload({
  onUpload,
  folder,
  resourceType = "auto",
  showPoweredBy = false,
  accept,
}: CloudinaryUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <CldUploadWidget
      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
      folder={folder}
      resourceType={resourceType}
      onSuccess={(result: any) => {
        setIsUploading(false);
        onUpload({
          storageKey: result.event?.info?.public_id || "",
          bytes: result.event?.info?.bytes || 0,
          mimeType: result.event?.info?.type || "application/octet-stream",
          durationSeconds: result.event?.info?.duration || undefined,
        });
      }}
      onOpen={() => setIsUploading(true)}
      onClose={() => setIsUploading(false)}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={() => open()}
          disabled={isUploading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload File"}
        </button>
      )}
    </CldUploadWidget>
  );
}
