import { LegalDocumentEditorView } from "@/views/dashboard/legal-documents/LegalDocumentEditorView";

export default async function EditLegalDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LegalDocumentEditorView docId={id} />;
}
