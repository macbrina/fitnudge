import { TaskDetailView } from "@/views/dashboard/tasks/TaskDetailView";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TaskDetailView params={params} />;
}
