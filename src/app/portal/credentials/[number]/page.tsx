import { notFound, redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getOwnCertificate } from "@/lib/certificate-candidate-reads";
import { CertificateView } from "@/components/portal/certificate-view";

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const certificate = await getOwnCertificate(number);
  if (!certificate) notFound();

  return <CertificateView certificate={certificate} />;
}
