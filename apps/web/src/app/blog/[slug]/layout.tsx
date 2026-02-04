import type { Metadata } from "next";
import { fetchBlogPostForMetadata } from "@/lib/blog/server";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://fitnudge.app";

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchBlogPostForMetadata(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const description = post.excerpt?.slice(0, 160) || post.title;
  const ogImage = post.featured_image_url
    ? post.featured_image_url.startsWith("http")
      ? post.featured_image_url
      : `${baseUrl}${post.featured_image_url.startsWith("/") ? "" : "/"}${post.featured_image_url}`
    : `${baseUrl}/og-image.jpg`;

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      images: [ogImage],
      url: `${baseUrl}/blog/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default function BlogPostLayout({ children }: Props) {
  return <>{children}</>;
}
