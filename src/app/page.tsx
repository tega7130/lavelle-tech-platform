import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface">
      <div className="max-w-md text-center px-6">
        <div className="w-11 h-11 mx-auto rounded-lg bg-accent-2 flex items-center justify-center font-heading font-bold text-2xl text-accent">
          L
        </div>
        <h1 className="mt-4 mb-2">Lavelle</h1>
        <p className="text-neutral-600 mb-6">
          Foundations build — theme, component library, shells, schema, and auth. No product
          screens live here yet.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/portal/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-accent text-accent-2 font-heading font-semibold text-sm px-4 py-[9px] no-underline hover:bg-accent-600"
          >
            Candidate shell
          </Link>
          <Link
            href="/admin/overview"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-bg text-text font-heading font-semibold text-sm px-4 py-[9px] no-underline hover:bg-neutral-100"
          >
            Admin shell
          </Link>
        </div>
      </div>
    </div>
  );
}
