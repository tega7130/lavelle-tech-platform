"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { updateProfile } from "@/app/actions/candidate-auth";
import { finaliseCandidatePhotoUpload } from "@/app/actions/uploads";
import { emptyActionState } from "@/lib/action-state";
import { tierLabel, professionalStatusLabel, experienceBandLabel } from "@/lib/format";
import type { CandidateProfile, IdCard } from "@/generated/prisma/client";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function uploadPhoto(file: File) {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "image", mimeType: file.type, bytes: file.size, purpose: "candidate_photo" }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseCandidatePhotoUpload({ storageKey, mimeType: file.type, originalFilename: file.name });
}

const HANDBOOK_SECTIONS = [
  {
    title: "Standards of conduct",
    body: "Candidates are expected to engage honestly and respectfully in every module, drafting exercise and examination. Submitting another person's work as your own, or assisting someone else to do so, is treated as a serious integrity breach and may result in suspension.",
  },
  {
    title: "Assessment and marking",
    body: "Drafting exercises and written exam answers are marked by faculty against a published standard. Marks and feedback are released to your Assessment page only once a marker has signed off — nothing is visible early. Blind-marked programmes never reveal your identity to the marker.",
  },
  {
    title: "Deadlines and extensions",
    body: "Module and drafting deadlines are shown on your Deadlines page and are generated the moment you enrol. If personal circumstances affect your ability to meet one, contact support before it passes — extensions granted after a suspension or hardship review are recorded on your record.",
  },
  {
    title: "Examinations",
    body: "Certifying examinations are proctored and time-limited by the server, not your device — losing connection or reloading never grants extra time. Conduct flagged during a sitting is reviewed by a human invigilator before any action is taken; nothing is auto-failed.",
  },
  {
    title: "Support",
    body: "Use Contact us for anything affecting your candidacy — technical issues, deadline concerns, or questions about a mark. Every request is tracked to resolution and you can follow its thread from Your Requests.",
  },
];

export function ProfilePage({
  candidate,
  profile,
  idCard,
  photoUrl,
}: {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    applicantNumber: string;
    candidateNumber: string | null;
    isEnrolled: boolean;
  };
  profile: CandidateProfile | null;
  idCard: IdCard | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [handbookChecked, setHandbookChecked] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);
  const handbookDone = !!profile?.handbookAcknowledgedAt;

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Choose an image file (JPG, PNG or WebP).");
    if (file.size > MAX_PHOTO_BYTES) return setUploadError("That image is larger than 8MB.");

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      await uploadPhoto(file);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  async function acknowledgeHandbook() {
    setAcknowledging(true);
    const fd = new FormData();
    fd.set("handbookAcknowledged", "true");
    await updateProfile(emptyActionState, fd);
    setAcknowledging(false);
    router.refresh();
  }

  const displayPhoto = previewUrl ?? photoUrl;
  const professionalDone = !!profile?.completedAt;

  return (
    <div className="max-w-[880px] flex flex-col gap-[var(--space-6)]">
      <div>
        <h1 className="mb-1">Profile &amp; ID</h1>
        <p className="text-neutral-600 text-[13.5px]">
          Your photo, professional details and Candidate ID card in one place.
        </p>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-[var(--space-6)] max-[760px]:grid-cols-1">
        <Card elev="md" className="p-0 overflow-hidden h-fit">
          <div
            className="p-[var(--space-5)] text-white relative overflow-hidden text-center"
            style={{ background: "linear-gradient(158deg, #0c356f, #08234a)" }}
          >
            <div className="text-[8.5px] tracking-[0.14em] uppercase text-white/55">Lavelle Institute</div>
            <div className="mx-auto mt-3 w-[92px] h-[92px] rounded-full border-2 border-white/25 bg-white/10 overflow-hidden flex items-center justify-center">
              {displayPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-heading font-bold text-2xl text-white/70">
                  {candidate.firstName[0]}
                  {candidate.lastName[0]}
                </span>
              )}
            </div>
            <div className="font-heading font-semibold text-[15px] mt-3">
              {candidate.firstName} {candidate.lastName}
            </div>
            <div className="text-[8.5px] tracking-[0.1em] uppercase text-white/50 mt-2.5">
              {candidate.candidateNumber ? "Candidate no." : "Applicant no."}
            </div>
            <div className="text-xs mt-0.5 tabular-nums">{candidate.candidateNumber ?? candidate.applicantNumber}</div>
            {idCard && (
              <div className="flex justify-between mt-[var(--space-4)] pt-[var(--space-3)] border-t border-dashed border-white/22 text-[10.5px] text-white/50">
                <span>{tierLabel(idCard.tier)}</span>
                <span>Valid to {new Date(idCard.validUntil).toLocaleDateString("en-GB")}</span>
              </div>
            )}
          </div>
          <div className="p-[var(--space-4)] flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChosen} />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full justify-center"
            >
              {uploading ? "Uploading…" : displayPhoto ? "Change photo" : "Upload photo"}
            </Button>
            {uploadError && <div className="text-[11.5px] text-[#c0392b]">{uploadError}</div>}
            <div className="text-[11px] text-neutral-500">JPG, PNG or WebP, up to 8MB.</div>
          </div>
        </Card>

        <div className="flex flex-col gap-[var(--space-5)]">
          <Card elev="sm">
            <div className="flex items-baseline justify-between gap-3">
              <CardKicker>Professional details</CardKicker>
              {!candidate.isEnrolled && (
                <Link href="/portal/dashboard?complete=professional" className="text-xs font-medium text-accent">
                  {professionalDone ? "Edit" : "Add details"}
                </Link>
              )}
            </div>
            {professionalDone && profile ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3 max-[500px]:grid-cols-1">
                {profile.professionalStatus && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Professional status</dt>
                    <dd className="text-[13px] mt-0.5">{professionalStatusLabel(profile.professionalStatus)}</dd>
                  </div>
                )}
                {profile.yearOfCall && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Year of call</dt>
                    <dd className="text-[13px] mt-0.5 tabular-nums">{profile.yearOfCall}</dd>
                  </div>
                )}
                {profile.scnNumber && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">SCN number</dt>
                    <dd className="text-[13px] mt-0.5">{profile.scnNumber}</dd>
                  </div>
                )}
                {profile.institution && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Institution</dt>
                    <dd className="text-[13px] mt-0.5">{profile.institution}</dd>
                  </div>
                )}
                {profile.graduationYear && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Graduation year</dt>
                    <dd className="text-[13px] mt-0.5 tabular-nums">{profile.graduationYear}</dd>
                  </div>
                )}
                {profile.organisation && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Organisation</dt>
                    <dd className="text-[13px] mt-0.5">{profile.organisation}</dd>
                  </div>
                )}
                {profile.roleTitle && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Role</dt>
                    <dd className="text-[13px] mt-0.5">{profile.roleTitle}</dd>
                  </div>
                )}
                {profile.experienceBand && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Experience</dt>
                    <dd className="text-[13px] mt-0.5">{experienceBandLabel(profile.experienceBand)}</dd>
                  </div>
                )}
                {profile.placeOfPractice && (
                  <div>
                    <dt className="text-[11px] text-neutral-500">Place of practice</dt>
                    <dd className="text-[13px] mt-0.5">{profile.placeOfPractice}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-[12.5px] text-neutral-600 mt-2">
                Not provided yet.{" "}
                {!candidate.isEnrolled && (
                  <Link href="/portal/dashboard?complete=professional" className="text-accent font-medium">
                    Tell us about your background
                  </Link>
                )}
              </p>
            )}
          </Card>

          <Card elev="sm">
            <CardKicker>Candidate handbook</CardKicker>
            <div className="mt-3 max-h-[260px] overflow-y-auto rounded-md border border-divider p-4 flex flex-col gap-3.5">
              {HANDBOOK_SECTIONS.map((s) => (
                <div key={s.title}>
                  <div className="font-heading font-semibold text-[12.5px]">{s.title}</div>
                  <p className="text-[12.5px] leading-[1.6] text-neutral-600 mt-1">{s.body}</p>
                </div>
              ))}
            </div>
            {handbookDone ? (
              <div className="mt-3 text-[12.5px] text-neutral-600">
                Acknowledged {new Date(profile!.handbookAcknowledgedAt!).toLocaleDateString("en-GB")}.
              </div>
            ) : (
              <div className="mt-3.5 flex flex-col gap-3">
                <label className="flex items-start gap-2.5 text-[12.5px] text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={handbookChecked}
                    onChange={(e) => setHandbookChecked(e.target.checked)}
                    className="mt-0.5 h-[15px] w-[15px] accent-accent flex-none"
                  />
                  I have read and agree to follow the candidate handbook.
                </label>
                <Button
                  onClick={acknowledgeHandbook}
                  disabled={!handbookChecked || acknowledging}
                  className="self-start h-9 text-[13px]"
                >
                  {acknowledging ? "Saving…" : "Acknowledge"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div>
        <Link href="/portal/dashboard" className={buttonClassName("secondary")}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
