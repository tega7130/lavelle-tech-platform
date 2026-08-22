"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card, CardKicker } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { LogoMark } from "@/components/ui/logo-mark";
import { updateProfile, updateCandidateContactDetails } from "@/app/actions/candidate-auth";
import { finaliseCandidatePhotoUpload } from "@/app/actions/uploads";
import { emptyActionState } from "@/lib/action-state";
import { professionalStatusLabel, experienceBandLabel } from "@/lib/format";
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

interface ContactValues {
  email: string;
  phone: string;
}

export function ProfilePage({
  candidate,
  profile,
  idCard,
  cohortStatus,
  photoUrl,
}: {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    applicantNumber: string;
    candidateNumber: string | null;
    isEnrolled: boolean;
  };
  profile: CandidateProfile | null;
  idCard: IdCard | null;
  cohortStatus: { intakeLabel: string; statusLine: string } | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [handbookChecked, setHandbookChecked] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);
  const handbookDone = !!profile?.handbookAcknowledgedAt;

  const [contactState, contactAction, contactPending] = useActionState(updateCandidateContactDetails, emptyActionState);
  const initialValues: ContactValues = React.useMemo(
    () => ({ email: candidate.email, phone: candidate.phone ?? "" }),
    [candidate.email, candidate.phone]
  );
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [prevStateErrors, setPrevStateErrors] = React.useState(contactState.errors);
  if (contactState.errors !== prevStateErrors) {
    setPrevStateErrors(contactState.errors);
    setErrors(contactState.errors ?? {});
  }
  // router.refresh() has side effects, unlike the plain setState calls
  // above — it can't run during render (React flags exactly this), so a
  // successful save is the one case that needs an effect instead.
  React.useEffect(() => {
    if (contactState.ok) router.refresh();
    // contactState (not contactState.ok) is the dependency — useActionState
    // returns a new object per dispatch, so this still fires on a second
    // consecutive successful save where .ok stays true both times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactState]);

  function field(key: keyof ContactValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setErrors((errs) => {
        if (!(key in errs)) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      });
    };
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  async function handlePhotoFile(file: File | undefined) {
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

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    void handlePhotoFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    void handlePhotoFile(e.dataTransfer.files?.[0]);
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
    <div className="max-w-[1120px] flex flex-col gap-[var(--space-6)]">
      <p className="text-neutral-600 text-[13.5px] m-0">
        Your photo, contact details and Candidate ID card in one place.
      </p>

      <div className="grid grid-cols-[1fr_360px] gap-[var(--space-6)] items-start max-[900px]:grid-cols-1">
        <div>
          <h3 className="mb-3">Candidate profile</h3>
          <Card elev="sm">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 text-center rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer transition-colors",
                dragOver ? "border-accent bg-accent-100" : "border-neutral-300 hover:border-neutral-400"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFileInputChange}
              />
              {displayPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayPhoto} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M21 16l-5-4-4 3-3-2-3 2" />
                  </svg>
                </div>
              )}
              <div className="font-heading font-semibold text-[14px] mt-1">
                {uploading ? "Uploading…" : "Drop photo"}
              </div>
              {!uploading && (
                <div className="text-[12.5px] text-neutral-500">
                  or <span className="text-accent font-medium underline">browse files</span>
                </div>
              )}
            </div>
            {uploadError && <div className="text-[11.5px] text-[#c0392b] mt-2 text-center">{uploadError}</div>}
            <div className="text-[11.5px] text-neutral-500 text-center mt-2 leading-[1.5]">
              Passport-style photo, plain background. Your ID card was issued once your enrolment fee was confirmed
              — adding a photo completes it.
            </div>

            <form action={contactAction} className="mt-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={candidate.firstName}
                    readOnly
                    disabled
                    className="bg-neutral-100 text-neutral-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={candidate.lastName}
                    readOnly
                    disabled
                    className="bg-neutral-100 text-neutral-500 cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="text-[11.5px] text-neutral-500 -mt-2">
                Your legal name is fixed to your record. Contact support if it needs correcting.
              </div>
              <div>
                <Label htmlFor="candidateId">Candidate ID</Label>
                <Input
                  id="candidateId"
                  value={candidate.candidateNumber ?? candidate.applicantNumber}
                  readOnly
                  disabled
                  className="bg-neutral-100 text-neutral-500 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={field("email")}
                  invalid={!!errors.email}
                />
                <FieldError>{errors.email}</FieldError>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" value={values.phone} onChange={field("phone")} invalid={!!errors.phone} />
                <FieldError>{errors.phone}</FieldError>
              </div>
              {contactState.message && <FieldError>{contactState.message}</FieldError>}
              <Button type="submit" disabled={!dirty || contactPending} className="self-start">
                {contactPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>
        </div>

        <div>
          <h3 className="mb-3">Candidate ID card</h3>
          <div className="rounded-xl p-[var(--space-5)] text-white" style={{ background: "#1668e3" }}>
            <div className="flex items-center gap-2">
              <LogoMark size={28} />
              <div className="font-heading font-semibold text-[14px]">Lavelle Institute</div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <div className="w-[58px] h-[58px] rounded-md border border-dashed border-white/35 bg-white/10 flex-none overflow-hidden flex items-center justify-center">
                {displayPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9.5px] text-white/60 text-center leading-tight">Photo</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-heading font-bold text-[17px] text-accent-2 truncate">
                  {candidate.firstName} {candidate.lastName}
                </div>
                <div className="text-[12.5px] text-white/75 tabular-nums mt-0.5">
                  {candidate.candidateNumber ?? candidate.applicantNumber}
                </div>
              </div>
            </div>

            {idCard && cohortStatus && (
              <div className="mt-3 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                {cohortStatus.statusLine}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-5 pt-3 border-t border-dashed border-white/25 text-[11px] text-white/70">
              <span>Cohort · {cohortStatus?.intakeLabel ?? "—"}</span>
              <span>
                Valid thru ·{" "}
                {idCard ? new Date(idCard.validUntil).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}
              </span>
            </div>
          </div>
          <p className="text-[11.5px] text-neutral-500 mt-3 leading-[1.5]">
            Issued automatically once your enrolment fee is confirmed, and valid for the duration of your enrolment.
            The card regenerates whenever your photo is updated.
          </p>
        </div>
      </div>

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

      <div>
        <Link href="/portal/dashboard" className={buttonClassName("secondary")}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
