import RulesDocsAdminPage from "./RulesDocsAdminPage";

export default async function RulesDocsPage(props: {
  searchParams?: Promise<{
    doc?: string | string[];
  }>;
}) {
  const searchParams = await props.searchParams;
  const docParam = searchParams?.doc;
  const selectedDocumentId = Array.isArray(docParam) ? docParam[0] : docParam;

  return <RulesDocsAdminPage selectedDocumentId={selectedDocumentId} />;
}
