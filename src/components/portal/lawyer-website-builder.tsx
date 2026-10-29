"use client";

import * as React from "react";
import Link from "next/link";
import {
  startLawyerWebsiteAction,
  updateLawyerWebsiteVerificationAction,
  updateLawyerWebsiteHandleAction,
  acknowledgeConductDisclaimerAction,
  updateLawyerWebsiteAboutAction,
  requestPublishLawyerWebsiteAction,
} from "@/app/actions/lawyer-website";
import { emptyActionState } from "@/lib/action-state";
import { uploadToStorage } from "@/lib/storage-upload";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardTitle, CardBody } from "@/components/ui/card";
import { Field, Label, Input, FieldError } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Tag } from "@/components/ui/tag";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  LawyerWebsiteContentSections,
  type LawyerQualificationItem,
  type LawyerExperienceItem,
  type LawyerPublicationItem,
  type LawyerActivityItem,
  type ConnectableCertificate,
} from "@/components/portal/lawyer-website-content";
import { LawyerWebsiteLookAndFeel } from "@/components/portal/lawyer-website-look-and-feel";

type EntityType = "INDIVIDUAL" | "LAW_FIRM";
type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LawyerWebsiteBuilderProps {
  site: {
    id: string;
    entityType: EntityType;
    firmName: string | null;
    handle: string;
    handleAutoSuffixedAt: Date | null;
    templateKey: string | null;
    colorThemeKey: string | null;
    fontPairingKey: string | null;
    introText: string | null;
    biographyText: string | null;
    personalStatementText: string | null;
    careerJourneyText: string | null;
    personalInterestsText: string | null;
    conductDisclaimerAcknowledgedAt: Date | null;
    verification: {
      scnNumber: string | null;
      idCardEvidenceAssetId: string | null;
      cacNumber: string | null;
      firmEvidenceAssetId: string | null;
      status: VerificationStatus;
      rejectionReason: string | null;
    } | null;
    qualifications: LawyerQualificationItem[];
    experiences: LawyerExperienceItem[];
    publications: LawyerPublicationItem[];
    activities: LawyerActivityItem[];
    isPublished: boolean;
    publishRequestedAt: Date | null;
    takenDownAt: Date | null;
    takenDownReason: string | null;
  } | null;
  candidateHasScnOnFile: boolean;
  connectableCertificates: ConnectableCertificate[];
}

const DISCLAIMER_SECTIONS = [
  {
    heading: "What you must not publish",
    body: "Under the Rules of Professional Conduct for Legal Practitioners, your website must not: name or identify any client or confidential matter without that client's consent; advertise fees, pricing or discounts; make comparative or self-aggrandising claims (e.g. \"best\", \"leading\", \"guaranteed results\"); solicit clients directly or imply formal \"specialist\" certification, which has no recognised certifying body in Nigerian practice; or offer legal advice, consultation booking, or any form of client matching through this page.",
  },
  {
    heading: "Your responsibility",
    body: "Everything you publish here — your biography, experience, qualifications, publications and activities — is your own representation of yourself. You are solely responsible for its accuracy.",
  },
  {
    heading: "Lavelle's position",
    body: "Lavelle provides the website builder as a personal branding tool and is not liable for any misinformation, inaccuracy, or professional conduct consequence arising from content you choose to publish. Lavelle reserves the right to review, reject, or take down any site that does not meet these standards.",
  },
];

export function StepCard({
  title,
  status,
  children,
}: {
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card elev="sm" className="mb-[var(--space-4)]">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {status}
      </div>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** The address display + self-service edit, with a clear notice when a same-name collision silently assigned a numeric suffix. */
function HandleStep({ handle, handleAutoSuffixedAt }: { handle: string; handleAutoSuffixedAt: Date | null }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(handle);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("handle", value);
    const result = await updateLawyerWebsiteHandleAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not update your address.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mb-[var(--space-4)]">
      {handleAutoSuffixedAt && !editing && (
        <div className="mb-2 rounded-md bg-[#fff7e6] border border-[#f0d9a8] text-[#a16207] text-[13px] px-3 py-2">
          Someone with your name already has this address, so we assigned you <code>{handle}</code> for now. You can
          choose your own below.
        </div>
      )}
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-neutral-600">learnlavelle.com/</span>
          <Input value={value} onChange={(e) => setValue(e.target.value)} dense className="max-w-[260px]" />
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false);
              setValue(handle);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-neutral-600">
          <span>Your address is:</span>
          <code className="rounded bg-neutral-100 px-2 py-0.5">learnlavelle.com/{handle}</code>
          <button type="button" className="text-accent hover:underline text-[12.5px]" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
      <FieldError>{error}</FieldError>
      {editing && <p className="mt-1.5 text-[12px] text-neutral-500">Must be based on your own name — you can add a middle name, initial or similar, but not switch to an unrelated address.</p>}
    </div>
  );
}

/** Step 0 — no site yet: choose Individual vs. Law Firm and start. */
function StartSiteStep() {
  const [entityType, setEntityType] = React.useState<EntityType>("INDIVIDUAL");
  const [firmName, setFirmName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("entityType", entityType);
    if (entityType === "LAW_FIRM") fd.set("firmName", firmName);
    const result = await startLawyerWebsiteAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not start your website.");
      return;
    }
    window.location.reload();
  }

  return (
    <StepCard title="Build your professional website">
      <p className="text-[13px] text-neutral-600 mb-[var(--space-4)] max-w-[60ch]">
        Showcase your professional background, qualifications and publications on your own page. This is a
        personal branding tool, not a directory or client-matching service.
      </p>
      <Field className="mb-[var(--space-4)]">
        <Label>Who is this website for?</Label>
        <Segmented
          name="entityType"
          value={entityType}
          onChange={(v) => setEntityType(v as EntityType)}
          options={[
            { value: "INDIVIDUAL", label: "Me, personally" },
            { value: "LAW_FIRM", label: "My law firm" },
          ]}
        />
      </Field>
      {entityType === "LAW_FIRM" && (
        <Field className="mb-[var(--space-4)] max-w-[360px]">
          <Label>Firm name</Label>
          <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Okafor & Co." />
        </Field>
      )}
      <FieldError>{error}</FieldError>
      <Button onClick={start} disabled={saving}>
        {saving ? "Starting…" : "Start my website"}
      </Button>
    </StepCard>
  );
}

/** Step 1 — identity verification evidence. Submitting always re-enters PENDING review. */
function VerificationStep({
  entityType,
  verification,
  candidateHasScnOnFile,
}: {
  entityType: EntityType;
  verification: NonNullable<LawyerWebsiteBuilderProps["site"]>["verification"];
  candidateHasScnOnFile: boolean;
}) {
  const [scnNumber, setScnNumber] = React.useState(verification?.scnNumber ?? "");
  const [cacNumber, setCacNumber] = React.useState(verification?.cacNumber ?? "");
  const [idCardAssetId, setIdCardAssetId] = React.useState<string | null>(verification?.idCardEvidenceAssetId ?? null);
  const [firmEvidenceAssetId, setFirmEvidenceAssetId] = React.useState<string | null>(verification?.firmEvidenceAssetId ?? null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleUpload(file: File, which: "idCard" | "firm") {
    setUploading(true);
    setError(null);
    try {
      const { storageKey } = await uploadToStorage(file, "lawyer_website");
      if (which === "idCard") setIdCardAssetId(storageKey);
      else setFirmEvidenceAssetId(storageKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    if (scnNumber.trim()) fd.set("scnNumber", scnNumber.trim());
    if (idCardAssetId) fd.set("idCardEvidenceAssetId", idCardAssetId);
    if (cacNumber.trim()) fd.set("cacNumber", cacNumber.trim());
    if (firmEvidenceAssetId) fd.set("firmEvidenceAssetId", firmEvidenceAssetId);
    const result = await updateLawyerWebsiteVerificationAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not submit your evidence.");
      return;
    }
    window.location.reload();
  }

  const statusTag =
    verification?.status === "APPROVED" ? (
      <Tag variant="success">Verified</Tag>
    ) : verification?.status === "REJECTED" ? (
      <Tag variant="danger">Rejected</Tag>
    ) : (
      <Tag variant="warning">Pending review</Tag>
    );

  return (
    <StepCard title="Identity verification" status={statusTag}>
      <p className="text-[13px] text-neutral-600 mb-[var(--space-4)] max-w-[60ch]">
        We ask for this to confirm you&apos;re a registered legal practitioner before your site can go live. It
        doesn&apos;t stop you from building — only from publishing until it&apos;s reviewed.
      </p>
      {verification?.status === "REJECTED" && verification.rejectionReason && (
        <p className="text-[13px] text-[#b42318] mb-[var(--space-4)]">Reason: {verification.rejectionReason}</p>
      )}

      {entityType === "INDIVIDUAL" ? (
        <>
          <Field className="mb-[var(--space-3)] max-w-[300px]">
            <Label>SCN / Bar enrolment number{candidateHasScnOnFile ? " (on file — confirm or update)" : ""}</Label>
            <Input value={scnNumber} onChange={(e) => setScnNumber(e.target.value)} placeholder="SCN12345" />
          </Field>
          <p className="text-[12px] text-neutral-500 mb-[6px]">— or, if you don&apos;t have one on file —</p>
          <Field className="mb-[var(--space-4)]">
            <Label>Upload a photo of your ID card</Label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "idCard")}
            />
            {idCardAssetId && <p className="text-[12px] text-[#15803d] mt-[6px]">Evidence uploaded ✓</p>}
          </Field>
        </>
      ) : (
        <>
          <Field className="mb-[var(--space-3)] max-w-[300px]">
            <Label>CAC / business registration number</Label>
            <Input value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} placeholder="RC1234567" />
          </Field>
          <Field className="mb-[var(--space-4)]">
            <Label>Supporting document (optional)</Label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "firm")}
            />
            {firmEvidenceAssetId && <p className="text-[12px] text-[#15803d] mt-[6px]">Document uploaded ✓</p>}
          </Field>
        </>
      )}

      <FieldError>{error}</FieldError>
      <Button onClick={submit} disabled={saving || uploading}>
        {saving ? "Submitting…" : "Submit for review"}
      </Button>
    </StepCard>
  );
}

/** Step 2 — the one-time disclaimer. Re-confirmed again at Publish in Phase 4, not here. */
function DisclaimerStep({ acknowledgedAt }: { acknowledgedAt: Date | null }) {
  const [checked, setChecked] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("acknowledged", "true");
    const result = await acknowledgeConductDisclaimerAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not record your acknowledgement.");
      return;
    }
    window.location.reload();
  }

  if (acknowledgedAt) {
    return (
      <StepCard title="Professional conduct disclaimer" status={<Tag variant="success">Acknowledged</Tag>}>
        <p className="text-[13px] text-neutral-600">
          Acknowledged on {acknowledgedAt.toLocaleDateString()}. You&apos;ll be asked to reconfirm this each time
          you publish.
        </p>
      </StepCard>
    );
  }

  return (
    <StepCard title="Professional conduct disclaimer">
      <div className="flex flex-col gap-[var(--space-3)] mb-[var(--space-4)]">
        {DISCLAIMER_SECTIONS.map((s) => (
          <div key={s.heading}>
            <div className="font-heading font-semibold text-[13px] mb-1">{s.heading}</div>
            <p className="text-[13px] text-neutral-600 max-w-[64ch]">{s.body}</p>
          </div>
        ))}
      </div>
      <label className="flex items-start gap-[8px] mb-[var(--space-4)] text-[13px] cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-[3px] accent-accent" />
        <span>I have read and agree to the above.</span>
      </label>
      <FieldError>{error}</FieldError>
      <Button onClick={submit} disabled={!checked || saving}>
        {saving ? "Saving…" : "Accept and continue"}
      </Button>
    </StepCard>
  );
}

/** Step 3 — the five independent About fields. */
function AboutStep({
  initial,
}: {
  initial: Pick<
    NonNullable<LawyerWebsiteBuilderProps["site"]>,
    "introText" | "biographyText" | "personalStatementText" | "careerJourneyText" | "personalInterestsText"
  >;
}) {
  const [intro, setIntro] = React.useState(initial.introText ?? "");
  const [bio, setBio] = React.useState(initial.biographyText ?? "");
  const [statement, setStatement] = React.useState(initial.personalStatementText ?? "");
  const [journey, setJourney] = React.useState(initial.careerJourneyText ?? "");
  const [interests, setInterests] = React.useState(initial.personalInterestsText ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("introText", intro);
    fd.set("biographyText", bio);
    fd.set("personalStatementText", statement);
    fd.set("careerJourneyText", journey);
    fd.set("personalInterestsText", interests);
    const result = await updateLawyerWebsiteAboutAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save.");
      return;
    }
    setSaved(true);
  }

  return (
    <StepCard title="About">
      <p className="text-[13px] text-neutral-600 mb-[var(--space-4)] max-w-[60ch]">
        Each of these is independent and optional — fill in only what you want visible.
      </p>
      {[
        { label: "Professional introduction", value: intro, set: setIntro, placeholder: "A short, one-paragraph introduction." },
        { label: "Biography", value: bio, set: setBio, placeholder: "Your fuller professional biography." },
        { label: "Personal statement", value: statement, set: setStatement, placeholder: "What drew you into this field of law?" },
        { label: "Career journey", value: journey, set: setJourney, placeholder: "How your career has developed over time." },
        { label: "Personal interests (optional)", value: interests, set: setInterests, placeholder: "Hobbies and interests outside of law." },
      ].map((f) => (
        <Field key={f.label} className="mb-[var(--space-4)]">
          <Label>{f.label}</Label>
          <RichTextEditor value={f.value} onChange={f.set} placeholder={f.placeholder} />
        </Field>
      ))}
      <FieldError>{error}</FieldError>
      {saved && <p className="text-[12px] text-[#15803d] mb-[6px]">Saved.</p>}
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save About section"}
      </Button>
    </StepCard>
  );
}

/** The real Publish step — re-confirms the disclaimer on every click (never reused from Phase 1's one-time acknowledgement), and reflects whatever state the site is actually in. */
function PublishStep({
  handle,
  isPublished,
  publishRequestedAt,
  takenDownAt,
  takenDownReason,
  verificationStatus,
}: {
  handle: string;
  isPublished: boolean;
  publishRequestedAt: Date | null;
  takenDownAt: Date | null;
  takenDownReason: string | null;
  verificationStatus: VerificationStatus | undefined;
}) {
  const [checked, setChecked] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const url = `learnlavelle.com/${handle}`;

  async function publish() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("acknowledged", "true");
    const result = await requestPublishLawyerWebsiteAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not publish your site.");
      return;
    }
    window.location.reload();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`https://${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isPublished) {
    return (
      <StepCard title="Your website is live" status={<Tag variant="success">Published</Tag>}>
        <div className="flex items-center gap-2">
          <code className="rounded bg-neutral-100 px-2 py-0.5 text-[13px]">{url}</code>
          <Button variant="secondary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </StepCard>
    );
  }

  return (
    <StepCard title="Publish">
      {takenDownAt && (
        <p className="text-[13px] text-[#b42318] mb-3">
          Your site was taken down{takenDownReason ? `: ${takenDownReason}` : "."} Resolve this before publishing again.
        </p>
      )}
      {publishRequestedAt && verificationStatus === "PENDING" && (
        <p className="text-[13px] text-[#a16207] mb-3">
          Submitted — waiting on identity verification review. We&apos;ll publish your site automatically once it&apos;s approved.
        </p>
      )}
      <label className="flex items-start gap-[8px] mb-[var(--space-3)] text-[13px] cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-[3px] accent-accent" />
        <span>I confirm this content complies with the professional conduct disclaimer above.</span>
      </label>
      <FieldError>{error}</FieldError>
      <Button onClick={publish} disabled={!checked || saving}>
        {saving ? "Publishing…" : "Publish"}
      </Button>
    </StepCard>
  );
}

export function LawyerWebsiteBuilder({ site, candidateHasScnOnFile, connectableCertificates }: LawyerWebsiteBuilderProps) {
  return (
    <div className="max-w-[720px]">
      <div className="mb-[var(--space-6)]">
        <div className="font-heading font-semibold text-[19px]">My Website</div>
        <p className="mt-1.5 max-w-[64ch] text-[13px] text-neutral-600">
          Build your personal professional website. It stays private to you until it&apos;s published.
        </p>
      </div>

      {!site ? (
        <StartSiteStep />
      ) : (
        <>
          <HandleStep handle={site.handle} handleAutoSuffixedAt={site.handleAutoSuffixedAt} />
          <VerificationStep entityType={site.entityType} verification={site.verification} candidateHasScnOnFile={candidateHasScnOnFile} />
          <DisclaimerStep acknowledgedAt={site.conductDisclaimerAcknowledgedAt} />
          <AboutStep initial={site} />
          <LawyerWebsiteContentSections
            qualifications={site.qualifications}
            experiences={site.experiences}
            publications={site.publications}
            activities={site.activities}
            connectableCertificates={connectableCertificates}
          />
          <LawyerWebsiteLookAndFeel templateKey={site.templateKey} colorThemeKey={site.colorThemeKey} fontPairingKey={site.fontPairingKey} />

          <div className="mb-[var(--space-4)]">
            <Link href="/portal/website/preview" target="_blank" className={buttonClassName("secondary")}>
              Preview
            </Link>
          </div>
          <PublishStep
            handle={site.handle}
            isPublished={site.isPublished}
            publishRequestedAt={site.publishRequestedAt}
            takenDownAt={site.takenDownAt}
            takenDownReason={site.takenDownReason}
            verificationStatus={site.verification?.status}
          />
        </>
      )}
    </div>
  );
}
