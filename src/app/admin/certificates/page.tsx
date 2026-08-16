import { listCertificates, listCertificateTemplates, listWithheldCandidates } from "@/lib/certificate-reads";
import { AdminCertificates } from "@/components/admin/certificates";

export default async function Page() {
  const [certificates, templates, withheld] = await Promise.all([
    listCertificates(),
    listCertificateTemplates(),
    listWithheldCandidates(),
  ]);
  return <AdminCertificates certificates={certificates} templates={templates} withheld={withheld} />;
}
