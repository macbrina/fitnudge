import { BlogPostEditorView } from "@/views/dashboard/blog/BlogPostEditorView";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BlogPostEditorView postId={id} />;
}
