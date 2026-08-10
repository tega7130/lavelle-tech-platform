import { listInvigilationWindows } from "@/lib/invigilation-reads";
import { Invigilation } from "@/components/admin/invigilation";

export default async function Page() {
  const windows = await listInvigilationWindows();
  return <Invigilation windows={windows} />;
}
