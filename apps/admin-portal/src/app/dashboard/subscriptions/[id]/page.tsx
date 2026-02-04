import { SubscriptionDetailView } from "@/views/dashboard/subscriptions/SubscriptionDetailView";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubscriptionDetailView subscriptionId={id} />;
}
