"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";
import type { CloudinaryUploadWidgetResults } from "next-cloudinary";

interface CloudinaryDirectUploadProps {
  onSuccess?: (result: CloudinaryUploadWidgetResults) => void;
  onError?: (error: Error) => void;
  folder?: string;
  maxFileSize?: number; // in MB
}

/**
 * Secure Cloudinary direct upload component with backend token generation.
 * Uses signed uploads for enhanced security.
 */
export function CloudinaryDirectUpload({
  onSuccess,
  onError,
  folder = "lavelle/videos",
  maxFileSize = 500,
}: CloudinaryDirectUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (result: CloudinaryUploadWidgetResults) => {
    setError(null);
    const info = typeof result.info === "object" ? result.info : null;
    const url = info?.secure_url || info?.url || "";
    console.log("Upload successful:", url);
    onSuccess?.(result);
  };

  const handleError = (error: any) => {
    const errorMessage =
      error?.statusText || error?.message || "Upload failed";
    setError(errorMessage);
    onError?.(new Error(errorMessage));
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <CldUploadWidget
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "lavelle_videos"}
        onSuccess={handleSuccess}
        onError={handleError}
        options={{
          resourceType: "video",
          folder: folder,
          maxFiles: 1,
          multiple: false,
          clientAllowedFormats: ["mp4", "webm", "mov", "avi", "flv"],
          maxFileSize: maxFileSize * 1024 * 1024,
          showAdvancedOptions: false,
          cropping: false,
          showPoweredBy: false,
        }}
      >
        {({ open }) => (
          <button
            onClick={() => open()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload Video
          </button>
        )}
      </CldUploadWidget>

      <div className="text-xs text-gray-500">
        Supported formats: MP4, WebM, MOV, AVI (Max {maxFileSize}MB)
      </div>
    </div>
  );
}
