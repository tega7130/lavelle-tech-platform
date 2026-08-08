import { listCertificates, listCertificateTemplates } from "@/lib/certificate-reads";
import { AdminCertificates } from "@/components/admin/certificates";

export default async function Page() {
  const [certificates, templates] = await Promise.all([listCertificates(), listCertificateTemplates()]);
  return <AdminCertificates certificates={certificates} templates={templates} />;
}
