import { ReportDetailView } from "@/views/dashboard/user-reports/ReportDetailView";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetailView reportId={id} />;
}
