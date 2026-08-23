"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Field, Label, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { BlogPostView } from "@/components/site/blog-post-view";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/slug";
import {
  createBlogPostAction,
  updateBlogPostAction,
  publishBlogPostAction,
  unpublishBlogPostAction,
  deleteBlogPostAction,
  getBlogHeroPreviewUrlAction,
} from "@/app/actions/blog-admin";
import { finaliseUpload } from "@/app/actions/uploads";
import type { getBlogPostForEditor } from "@/lib/blog-admin-reads";

type PostData = Awaited<ReturnType<typeof getBlogPostForEditor>> | null;

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

async function uploadHeroImage(file: File) {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "image", mimeType: file.type, bytes: file.size, purpose: "blog" }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseUpload({ storageKey, kind: "image", mimeType: file.type, originalFilename: file.name, purpose: "blog" });
}

export function BlogEditor({ post, defaultAuthorName }: { post: PostData; defaultAuthorName: string }) {
  const router = useRouter();
  const isNew = !post;

  const [title, setTitle] = React.useState(post?.title ?? "");
  const [slug, setSlug] = React.useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(!isNew);
  const [excerpt, setExcerpt] = React.useState(post?.excerpt ?? "");
  const [body, setBody] = React.useState(post?.body ?? "");
  const [tagsInput, setTagsInput] = React.useState(((post?.tags as string[] | null) ?? []).join(", "));
  const [authorName, setAuthorName] = React.useState(post?.authorName ?? defaultAuthorName);
  const [heroAsset, setHeroAsset] = React.useState(post?.heroAsset ?? null);
  const [heroPreviewUrl, setHeroPreviewUrl] = React.useState(post?.heroImageUrl ?? null);
  const [heroUploading, setHeroUploading] = React.useState(false);
  const [heroError, setHeroError] = React.useState<string | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const isPublished = post?.isPublished ?? false;

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleHeroUpload(file: File) {
    setHeroError(null);
    setHeroUploading(true);
    try {
      const asset = await uploadHeroImage(file);
      setHeroAsset({ id: asset.id, originalFilename: asset.originalFilename, storageKey: asset.storageKey });
      setHeroPreviewUrl(await getBlogHeroPreviewUrlAction(asset.storageKey));
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setHeroUploading(false);
    }
  }

  function currentInput() {
    return {
      title,
      excerpt,
      body,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      authorName,
      heroAssetId: heroAsset?.id ?? null,
    };
  }

  /** The actual create/update call, with no busy/error state of its own — save() and publish() both wrap this so publish() stays busy for the whole create-then-publish sequence instead of flickering re-enabled in between. */
  async function persist(): Promise<string> {
    if (isNew) {
      const created = await createBlogPostAction(currentInput());
      router.replace(`/admin/blog/${created.id}`);
      return created.id;
    }
    await updateBlogPostAction(post!.id, currentInput());
    return post!.id;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await persist();
      setNotice(isNew ? "Draft saved." : "Saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const id = await persist();
      await publishBlogPostAction(id);
      setNotice(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function submitUnpublish() {
    if (!reason.trim() || !post) return;
    setBusy(true);
    try {
      await unpublishBlogPostAction(post.id, reason);
      setUnpublishing(false);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    if (!post) return;
    setBusy(true);
    try {
      await deleteBlogPostAction(post.id);
      router.push("/admin/blog");
    } finally {
      setBusy(false);
    }
  }

  const statusNote = error
    ? { tone: "error" as const, text: error }
    : notice
      ? { tone: "success" as const, text: notice }
      : isPublished
        ? { tone: "success" as const, text: "Live on the public website and inside the candidate portal." }
        : { tone: "info" as const, text: "Not visible to visitors. Publishing adds it to both /blog and the candidate portal." };

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card elev="sm" className={isPublished ? "border-[#bfe3cd]" : undefined}>
        <div>
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="font-heading font-semibold text-[19px]">{isNew ? "New post" : title || "Untitled post"}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tag variant={isPublished ? "success" : "neutral"}>{isPublished ? "Live" : "Draft"}</Tag>
              <Button variant="secondary" className="h-9 text-[12.5px]" onClick={() => setPreviewOpen(true)}>
                Preview
              </Button>
              {isPublished && (
                <Button variant="secondary" className="h-9 text-[12.5px]" onClick={() => setUnpublishing(true)}>
                  Unpublish
                </Button>
              )}
              {!isNew && !isPublished && (
                <Button variant="danger" className="h-9 text-[12.5px]" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              )}
              <Button variant="primary" className="h-9 text-[12.5px]" disabled={busy || !title.trim()} onClick={publish}>
                {isPublished ? "Update" : "Publish"}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex items-start gap-[10px] px-4 py-3 rounded-md mt-4 text-[12px] leading-[1.55]",
              statusNote.tone === "error" && "bg-[#fef3f2] border border-[#f3c4bf] text-[#912019]",
              statusNote.tone === "success" && "bg-[#e7f6ed] border border-[#bfe3cd] text-[#116632]",
              statusNote.tone === "info" && "bg-accent-100 border border-accent-200 text-accent-800"
            )}
          >
            <span className="flex-none font-bold">{statusNote.tone === "error" ? "!" : statusNote.tone === "success" ? "✓" : "i"}</span>
            <div className="text-wrap-pretty">{statusNote.text}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-5">
          <Field>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Post title" />
          </Field>

          <Field>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="post-title"
            />
            <div className="text-neutral-500 text-[11.5px] mt-1">/blog/{slug || "…"}</div>
          </Field>

          <Field>
            <Label>Excerpt</Label>
            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One or two sentences shown in the list view" rows={2} />
          </Field>

          <Field>
            <Label>Body</Label>
            <RichTextEditor key={post?.id ?? "new"} value={body} onChange={setBody} placeholder="Write the post…" minHeightPx={280} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Author</Label>
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Byline" />
            </Field>
            <Field>
              <Label>Tags</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Comma-separated, e.g. News, Careers" />
            </Field>
          </div>

          <Field>
            <Label>Featured image</Label>
            {heroAsset ? (
              <div className="flex items-center gap-3">
                <div className="text-[12.5px] text-neutral-600 truncate">{heroAsset.originalFilename}</div>
                <Button
                  variant="secondary"
                  className="h-8 text-[12px]"
                  onClick={() => {
                    setHeroAsset(null);
                    setHeroPreviewUrl(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                disabled={heroUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleHeroUpload(file);
                }}
                className="text-[12.5px]"
              />
            )}
            {heroUploading && <div className="text-neutral-500 text-[12px] mt-1">Uploading…</div>}
            {heroError && <div className="text-[#912019] text-[12px] mt-1">{heroError}</div>}
          </Field>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-dashed border-neutral-300">
          <Button variant="secondary" disabled={busy || !title.trim()} onClick={save}>
            Save draft
          </Button>
        </div>
      </Card>

      {unpublishing && (
        <Dialog open onClose={() => setUnpublishing(false)} title="Unpublish this post?">
          <p>It's removed from the public website and candidate portal immediately. It stays here as a draft, editable and re-publishable.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for unpublishing" rows={2} className="mt-3" />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setUnpublishing(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !reason.trim()} onClick={submitUnpublish}>
              Unpublish
            </Button>
          </div>
        </Dialog>
      )}

      {deleting && (
        <Dialog open onClose={() => setDeleting(false)} title="Delete this post?">
          <p>This permanently deletes the draft. It was never published, so nothing on the public site or portal is affected.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={submitDelete}>
              Delete
            </Button>
          </div>
        </Dialog>
      )}

      {previewOpen && (
        <Dialog open onClose={() => setPreviewOpen(false)} title="Preview" className="w-[min(820px,95vw)] max-h-[90vh]">
          <div className="flex items-center gap-2 -mt-1">
            <Tag variant="warning">Preview</Tag>
            <span className="text-[12px] text-neutral-500">
              {isPublished ? "Shows your unsaved changes, not what's currently live." : "This is a draft — not visible to visitors."}
            </span>
          </div>
          <div className="mt-4">
            <BlogPostView
              title={title}
              tags={tagsInput.split(",").map((t) => t.trim()).filter(Boolean)}
              authorName={authorName}
              dateLabel={isPublished && post?.publishedAt ? formatDate(post.publishedAt) : formatDate(new Date())}
              heroImageUrl={heroPreviewUrl}
              body={body}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
