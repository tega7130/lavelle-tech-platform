"use client";

import * as React from "react";
import {
  addQualificationAction,
  deleteQualificationAction,
  reorderQualificationsAction,
  addExperienceAction,
  deleteExperienceAction,
  reorderExperiencesAction,
  addPublicationAction,
  updatePublicationAction,
  deletePublicationAction,
  reorderPublicationsAction,
  addActivityAction,
  deleteActivityAction,
  reorderActivitiesAction,
} from "@/app/actions/lawyer-website";
import { emptyActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/portal/lawyer-website-builder";
import { Field, Label, Input, FieldError } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Tag } from "@/components/ui/tag";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

type QualificationSource = "MANUAL" | "LAVELLE_CERTIFICATE";

export interface LawyerQualificationItem {
  id: string;
  source: QualificationSource;
  title: string;
  issuer: string | null;
  year: number | null;
}

export interface LawyerExperienceItem {
  id: string;
  organisation: string;
  roleTitle: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  description: string | null;
}

export interface LawyerPublicationItem {
  id: string;
  kind: "EXTERNAL_LINK" | "NATIVE_ARTICLE";
  title: string;
  externalUrl: string | null;
  excerpt: string | null;
  body: string | null;
  slug: string | null;
  isPublished: boolean;
}

export interface LawyerActivityItem {
  id: string;
  title: string;
  description: string | null;
  year: number | null;
}

export interface ConnectableCertificate {
  id: string;
  programmeTitle: string;
  issuedAt: Date;
}

/** Up/down reorder — swaps with the adjacent item and sends the full new order, same shape for every list below. */
function moveItem<T extends { id: string }>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function ReorderButtons({ onUp, onDown, upDisabled, downDisabled }: { onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={onUp} disabled={upDisabled} aria-label="Move up" className="text-neutral-500 hover:text-text disabled:opacity-30 text-xs leading-none px-1">
        ▲
      </button>
      <button type="button" onClick={onDown} disabled={downDisabled} aria-label="Move down" className="text-neutral-500 hover:text-text disabled:opacity-30 text-xs leading-none px-1">
        ▼
      </button>
    </div>
  );
}

function QualificationsSection({ items, certificates }: { items: LawyerQualificationItem[]; certificates: ConnectableCertificate[] }) {
  const [list, setList] = React.useState(items);
  const [source, setSource] = React.useState<QualificationSource>("MANUAL");
  const [title, setTitle] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [year, setYear] = React.useState("");
  const [certificateId, setCertificateId] = React.useState(certificates[0]?.id ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("source", source);
    if (source === "MANUAL") {
      fd.set("title", title);
      if (issuer) fd.set("issuer", issuer);
      if (year) fd.set("year", year);
    } else {
      fd.set("certificateId", certificateId);
    }
    const result = await addQualificationAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not add this qualification.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    setList((l) => l.filter((i) => i.id !== id));
    await deleteQualificationAction(id);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(list, index, direction);
    setList(next);
    await reorderQualificationsAction(next.map((i) => i.id));
  }

  return (
    <StepCard title="Qualifications">
      <ul className="flex flex-col gap-2 mb-[var(--space-4)]">
        {list.map((item, i) => (
          <li key={item.id} className="flex items-start gap-2 rounded-md border border-neutral-200 p-2.5">
            <ReorderButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === list.length - 1} />
            <div className="flex-1">
              <div className="text-[13px] font-medium">{item.title}</div>
              <div className="text-[12px] text-neutral-500">
                {item.source === "LAVELLE_CERTIFICATE" ? <Tag variant="accent">Verified by Lavelle</Tag> : [item.issuer, item.year].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button type="button" onClick={() => remove(item.id)} className="text-[12px] text-[#b42318] hover:underline">
              Remove
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-[13px] text-neutral-500">No qualifications added yet.</li>}
      </ul>

      {certificates.length > 0 && (
        <Field className="mb-[var(--space-3)]">
          <Segmented
            name="qualificationSource"
            value={source}
            onChange={(v) => setSource(v as QualificationSource)}
            options={[
              { value: "MANUAL", label: "Add manually" },
              { value: "LAVELLE_CERTIFICATE", label: "Connect a Lavelle certificate" },
            ]}
          />
        </Field>
      )}

      {source === "LAVELLE_CERTIFICATE" && certificates.length > 0 ? (
        <Field className="mb-[var(--space-3)] max-w-[360px]">
          <Label>Certificate</Label>
          <select
            value={certificateId}
            onChange={(e) => setCertificateId(e.target.value)}
            className="w-full h-11 box-border rounded-md border border-neutral-300 bg-bg px-3 text-sm"
          >
            {certificates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.programmeTitle} ({c.issuedAt.getFullYear()})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="flex flex-wrap gap-3 mb-[var(--space-3)]">
          <Field className="max-w-[260px] flex-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="LL.M, Commercial Law" />
          </Field>
          <Field className="max-w-[220px] flex-1">
            <Label>Issuer (optional)</Label>
            <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="University of Lagos" />
          </Field>
          <Field className="max-w-[120px]">
            <Label>Year (optional)</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
          </Field>
        </div>
      )}
      <FieldError>{error}</FieldError>
      <Button onClick={add} disabled={saving}>
        {saving ? "Adding…" : "Add qualification"}
      </Button>
    </StepCard>
  );
}

function ExperienceSection({ items }: { items: LawyerExperienceItem[] }) {
  const [list, setList] = React.useState(items);
  const [organisation, setOrganisation] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [startYear, setStartYear] = React.useState("");
  const [endYear, setEndYear] = React.useState("");
  const [isCurrent, setIsCurrent] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("organisation", organisation);
    fd.set("roleTitle", roleTitle);
    fd.set("startYear", startYear);
    if (!isCurrent && endYear) fd.set("endYear", endYear);
    fd.set("isCurrent", String(isCurrent));
    if (description) fd.set("description", description);
    const result = await addExperienceAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not add this entry.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    setList((l) => l.filter((i) => i.id !== id));
    await deleteExperienceAction(id);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(list, index, direction);
    setList(next);
    await reorderExperiencesAction(next.map((i) => i.id));
  }

  return (
    <StepCard title="Experience">
      <ul className="flex flex-col gap-2 mb-[var(--space-4)]">
        {list.map((item, i) => (
          <li key={item.id} className="flex items-start gap-2 rounded-md border border-neutral-200 p-2.5">
            <ReorderButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === list.length - 1} />
            <div className="flex-1">
              <div className="text-[13px] font-medium">
                {item.roleTitle}, {item.organisation}
              </div>
              <div className="text-[12px] text-neutral-500">
                {item.startYear} – {item.isCurrent ? "Present" : item.endYear ?? ""}
              </div>
            </div>
            <button type="button" onClick={() => remove(item.id)} className="text-[12px] text-[#b42318] hover:underline">
              Remove
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-[13px] text-neutral-500">No experience added yet.</li>}
      </ul>

      <div className="flex flex-wrap gap-3 mb-[var(--space-3)]">
        <Field className="max-w-[220px] flex-1">
          <Label>Organisation</Label>
          <Input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Banwo & Ighodalo" />
        </Field>
        <Field className="max-w-[220px] flex-1">
          <Label>Role</Label>
          <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Senior Associate" />
        </Field>
        <Field className="max-w-[110px]">
          <Label>Start year</Label>
          <Input value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="2019" />
        </Field>
        {!isCurrent && (
          <Field className="max-w-[110px]">
            <Label>End year</Label>
            <Input value={endYear} onChange={(e) => setEndYear(e.target.value)} placeholder="2023" />
          </Field>
        )}
      </div>
      <label className="flex items-center gap-[8px] mb-[var(--space-3)] text-[13px] cursor-pointer">
        <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} className="accent-accent" />
        <span>This is my current role</span>
      </label>
      <Field className="mb-[var(--space-3)]">
        <Label>Description (optional)</Label>
        <RichTextEditor value={description} onChange={setDescription} placeholder="What you did in this role." />
      </Field>
      <FieldError>{error}</FieldError>
      <Button onClick={add} disabled={saving}>
        {saving ? "Adding…" : "Add experience"}
      </Button>
    </StepCard>
  );
}

function PublicationsSection({ items }: { items: LawyerPublicationItem[] }) {
  const [list, setList] = React.useState(items);
  const [kind, setKind] = React.useState<"EXTERNAL_LINK" | "NATIVE_ARTICLE">("EXTERNAL_LINK");
  const [title, setTitle] = React.useState("");
  const [externalUrl, setExternalUrl] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");

  async function add() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("title", title);
    if (kind === "EXTERNAL_LINK") fd.set("externalUrl", externalUrl);
    else {
      if (excerpt) fd.set("excerpt", excerpt);
      if (body) fd.set("body", body);
    }
    const result = await addPublicationAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not add this publication.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    setList((l) => l.filter((i) => i.id !== id));
    await deletePublicationAction(id);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(list, index, direction);
    setList(next);
    await reorderPublicationsAction(next.map((i) => i.id));
  }

  async function saveEdit(item: LawyerPublicationItem) {
    const fd = new FormData();
    fd.set("kind", item.kind);
    fd.set("title", item.title);
    fd.set("body", editBody);
    if (item.excerpt) fd.set("excerpt", item.excerpt);
    const result = await updatePublicationAction(item.id, emptyActionState, fd);
    if (result.ok) window.location.reload();
  }

  async function togglePublished(item: LawyerPublicationItem) {
    const fd = new FormData();
    fd.set("kind", item.kind);
    fd.set("title", item.title);
    if (item.body) fd.set("body", item.body);
    if (item.excerpt) fd.set("excerpt", item.excerpt);
    fd.set("isPublished", String(!item.isPublished));
    const result = await updatePublicationAction(item.id, emptyActionState, fd);
    if (result.ok) window.location.reload();
  }

  return (
    <StepCard title="Publications">
      <p className="text-[13px] text-neutral-600 mb-[var(--space-3)] max-w-[60ch]">
        Link to articles or books published elsewhere, or write an article directly here — each one gets its own
        shareable page once your site is live.
      </p>
      <ul className="flex flex-col gap-2 mb-[var(--space-4)]">
        {list.map((item, i) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2.5">
            <div className="flex items-start gap-2">
              <ReorderButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === list.length - 1} />
              <div className="flex-1">
                <div className="text-[13px] font-medium">{item.title}</div>
                <div className="text-[12px] text-neutral-500 flex items-center gap-1.5">
                  {item.kind === "EXTERNAL_LINK" ? (
                    <span>External link</span>
                  ) : (
                    <>
                      <span>Native article</span>
                      {item.isPublished ? <Tag variant="success">Published</Tag> : <Tag variant="neutral">Draft</Tag>}
                    </>
                  )}
                </div>
              </div>
              {item.kind === "NATIVE_ARTICLE" && (
                <button
                  type="button"
                  className="text-[12px] text-accent hover:underline"
                  onClick={() => {
                    setEditingId(editingId === item.id ? null : item.id);
                    setEditBody(item.body ?? "");
                  }}
                >
                  {editingId === item.id ? "Close" : "Edit"}
                </button>
              )}
              {item.kind === "NATIVE_ARTICLE" && (
                <button type="button" className="text-[12px] text-accent hover:underline" onClick={() => togglePublished(item)}>
                  {item.isPublished ? "Unpublish" : "Publish"}
                </button>
              )}
              <button type="button" onClick={() => remove(item.id)} className="text-[12px] text-[#b42318] hover:underline">
                Remove
              </button>
            </div>
            {editingId === item.id && (
              <div className="pl-7">
                <RichTextEditor value={editBody} onChange={setEditBody} placeholder="Write the article." />
                <Button className="mt-2" onClick={() => saveEdit({ ...item, body: editBody })}>
                  Save article
                </Button>
              </div>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="text-[13px] text-neutral-500">No publications added yet.</li>}
      </ul>

      <Field className="mb-[var(--space-3)]">
        <Segmented
          name="publicationKind"
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          options={[
            { value: "EXTERNAL_LINK", label: "Link to a publication" },
            { value: "NATIVE_ARTICLE", label: "Write an article here" },
          ]}
        />
      </Field>
      <Field className="mb-[var(--space-3)] max-w-[420px]">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enforcing Arbitral Awards in Nigeria" />
      </Field>
      {kind === "EXTERNAL_LINK" ? (
        <Field className="mb-[var(--space-3)] max-w-[420px]">
          <Label>Link (including a bookstore link, for a published book)</Label>
          <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://" />
        </Field>
      ) : (
        <>
          <Field className="mb-[var(--space-3)] max-w-[420px]">
            <Label>Excerpt (optional)</Label>
            <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short summary" />
          </Field>
          <Field className="mb-[var(--space-3)]">
            <Label>Article</Label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Write your article." />
          </Field>
        </>
      )}
      <FieldError>{error}</FieldError>
      <Button onClick={add} disabled={saving}>
        {saving ? "Adding…" : "Add publication"}
      </Button>
    </StepCard>
  );
}

function ActivitiesSection({ items }: { items: LawyerActivityItem[] }) {
  const [list, setList] = React.useState(items);
  const [title, setTitle] = React.useState("");
  const [year, setYear] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    if (year) fd.set("year", year);
    if (description) fd.set("description", description);
    const result = await addActivityAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not add this entry.");
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    setList((l) => l.filter((i) => i.id !== id));
    await deleteActivityAction(id);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(list, index, direction);
    setList(next);
    await reorderActivitiesAction(next.map((i) => i.id));
  }

  return (
    <StepCard title="Activities & memberships">
      <p className="text-[13px] text-neutral-600 mb-[var(--space-3)] max-w-[60ch]">
        Professional memberships, speaking engagements, and achievements.
      </p>
      <ul className="flex flex-col gap-2 mb-[var(--space-4)]">
        {list.map((item, i) => (
          <li key={item.id} className="flex items-start gap-2 rounded-md border border-neutral-200 p-2.5">
            <ReorderButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === list.length - 1} />
            <div className="flex-1">
              <div className="text-[13px] font-medium">{item.title}</div>
              {item.year && <div className="text-[12px] text-neutral-500">{item.year}</div>}
            </div>
            <button type="button" onClick={() => remove(item.id)} className="text-[12px] text-[#b42318] hover:underline">
              Remove
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-[13px] text-neutral-500">Nothing added yet.</li>}
      </ul>

      <div className="flex flex-wrap gap-3 mb-[var(--space-3)]">
        <Field className="max-w-[300px] flex-1">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Member, Nigerian Bar Association" />
        </Field>
        <Field className="max-w-[110px]">
          <Label>Year (optional)</Label>
          <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" />
        </Field>
      </div>
      <Field className="mb-[var(--space-3)]">
        <Label>Description (optional)</Label>
        <RichTextEditor value={description} onChange={setDescription} placeholder="Any extra detail." />
      </Field>
      <FieldError>{error}</FieldError>
      <Button onClick={add} disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </Button>
    </StepCard>
  );
}

export function LawyerWebsiteContentSections({
  qualifications,
  experiences,
  publications,
  activities,
  connectableCertificates,
}: {
  qualifications: LawyerQualificationItem[];
  experiences: LawyerExperienceItem[];
  publications: LawyerPublicationItem[];
  activities: LawyerActivityItem[];
  connectableCertificates: ConnectableCertificate[];
}) {
  return (
    <>
      <QualificationsSection items={qualifications} certificates={connectableCertificates} />
      <ExperienceSection items={experiences} />
      <PublicationsSection items={publications} />
      <ActivitiesSection items={activities} />
    </>
  );
}
