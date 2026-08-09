import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { listCandidateMarks } from "@/lib/marking-reads";

type CandidateMarks = Awaited<ReturnType<typeof listCandidateMarks>>;

const BAND_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  MERIT: "accent",
  PASS: "warning",
  REFER: "danger",
};
const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

export function CandidateAssessmentsTab({ marks }: { marks: CandidateMarks }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card elev="sm" className="p-0 gap-0 overflow-x-auto">
        <h4 className="m-0 px-[var(--space-4)] pt-[var(--space-4)] pb-2 font-heading font-semibold text-[15px]">Quizzes</h4>
        {marks.quizzes.length === 0 ? (
          <div className="text-neutral-500 text-[12.5px] px-[var(--space-4)] pb-[var(--space-4)]">No quiz attempts yet.</div>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Module</Th>
                <Th>Score</Th>
                <Th>Date taken</Th>
                <Th>Attempts</Th>
              </Tr>
            </Thead>
            <Tbody>
              {marks.quizzes.map((q, i) => (
                <Tr key={i}>
                  <Td className="pl-[var(--space-4)] font-medium">{q.module}</Td>
                  <Td className="tabular-nums">{q.scorePercent != null ? `${q.scorePercent}%` : "—"}</Td>
                  <Td>{q.date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
                  <Td>{q.attempts}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <Card elev="sm" className="p-0 gap-0 overflow-x-auto">
        <h4 className="m-0 px-[var(--space-4)] pt-[var(--space-4)] pb-2 font-heading font-semibold text-[15px]">Drafting exercises</h4>
        {marks.drafting.length === 0 ? (
          <div className="text-neutral-500 text-[12.5px] px-[var(--space-4)] pb-[var(--space-4)]">No drafting exercises submitted yet.</div>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Lecture</Th>
                <Th>Submitted</Th>
                <Th>Grade</Th>
                <Th>Graded by</Th>
                <Th>Graded date</Th>
                <Th className="text-right pr-[var(--space-4)]"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {marks.drafting.map((d) => (
                <Tr key={d.id}>
                  <Td className="pl-[var(--space-4)] font-medium">{d.lecture}</Td>
                  <Td>{d.submittedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—"}</Td>
                  <Td>
                    {d.state === "RETURNED" ? (
                      <Tag variant={(d.band ? BAND_TAG[d.band] : "neutral") as TagVariant}>
                        {d.scorePercent}% — {d.band ? BAND_LABEL[d.band] : ""}
                      </Tag>
                    ) : (
                      <Tag variant="warning">Pending review</Tag>
                    )}
                  </Td>
                  <Td className="text-neutral-600">{d.markedByName ?? "—"}</Td>
                  <Td className="text-neutral-600">
                    {d.markedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—"}
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    {d.state !== "RETURNED" && (
                      <a href="/admin/marking">
                        <Button variant="primary" className="h-[31px] px-[11px] text-xs">
                          Grade now
                        </Button>
                      </a>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
