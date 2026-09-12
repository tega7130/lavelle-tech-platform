"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { toggleFavoriteAction } from "@/app/actions/document-favorites";
import { cn } from "@/lib/cn";

export function FavoriteButton({
  documentTemplateId,
  initialFavorited,
  className,
}: {
  documentTemplateId: string;
  initialFavorited: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [favorited, setFavorited] = React.useState(initialFavorited);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    if (pending) return;
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      try {
        const result = await toggleFavoriteAction(documentTemplateId);
        setFavorited(result.favorited);
        showToast({ tone: "success", message: result.favorited ? "Added to Favorites" : "Removed from Favorites" });
        router.refresh();
      } catch {
        setFavorited(!next);
        showToast({ tone: "danger", message: "Something went wrong. Please try again." });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-full border border-divider bg-bg text-neutral-500 transition-colors hover:text-[#b42318] disabled:cursor-not-allowed disabled:opacity-60",
        favorited && "border-[#f3c4bf] bg-danger-bg text-[#b42318]",
        className
      )}
    >
      <HeartIcon filled={favorited} width={16} height={16} />
    </button>
  );
}
