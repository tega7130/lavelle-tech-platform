import { listDocumentTemplates, listDocumentCategories, listDiscountCodes } from "@/lib/document-library-reads";
import { UploadDocumentButton } from "@/components/admin/upload-document-button";
import { DocumentLibraryTable } from "@/components/admin/document-library-table";
import { DiscountCodesTable } from "@/components/admin/discount-codes-table";

function currentTimestamp() {
  return Date.now();
}

export default async function DocumentLibraryPage() {
  const [documents, categories, discountCodes] = await Promise.all([listDocumentTemplates(), listDocumentCategories(), listDiscountCodes()]);

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[var(--space-5)]">
        <div>
          <div className="font-heading font-semibold text-[17px]">Document Library</div>
          <div className="text-neutral-600 text-[12.5px] leading-[1.6] mt-1 max-w-[70ch]">
            Upload and manage contracts, MOUs, agreements and other legal or professional document templates.
          </div>
        </div>
        {documents.length > 0 && <UploadDocumentButton categories={categories} />}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No documents yet</div>
          <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">
            Upload your first document template to start building the Document Library.
          </p>
          <div className="mt-4 flex justify-center">
            <UploadDocumentButton categories={categories} />
          </div>
        </div>
      ) : (
        <DocumentLibraryTable documents={documents} categories={categories} />
      )}

      <DiscountCodesTable codes={discountCodes} now={currentTimestamp()} />
    </div>
  );
}
