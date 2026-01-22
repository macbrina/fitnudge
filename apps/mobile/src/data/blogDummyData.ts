/**
 * Blog Dummy Data
 *
 * Realistic dummy data matching the backend BlogPost schema.
 * Used for development/preview while blog endpoints are being built.
 *
 * Remove this file once backend blog API is fully implemented.
 */

import { BlogPost, BlogCategory } from "@/services/api/blog";

// ==========================================
// CATEGORIES
// ==========================================

export const DUMMY_CATEGORIES: BlogCategory[] = [
  {
    id: "cat-1",
    name: "Fitness Tips",
    slug: "fitness-tips",
    description: "Expert advice for your workout routine"
  },
  {
    id: "cat-2",
    name: "Nutrition",
    slug: "nutrition",
    description: "Healthy eating guides and meal prep"
  },
  {
    id: "cat-3",
    name: "Mindset",
    slug: "mindset",
    description: "Mental health and motivation"
  },
  {
    id: "cat-4",
    name: "Success Stories",
    slug: "success-stories",
    description: "Real transformation journeys"
  },
  {
    id: "cat-5",
    name: "Workout Guides",
    slug: "workout-guides",
    description: "Step-by-step exercise tutorials"
  }
];

// ==========================================
// BLOG POSTS
// ==========================================

export const DUMMY_BLOG_POSTS: BlogPost[] = [
  {
    id: "post-1",
    title: "5 Science-Backed Habits That Actually Build Consistency",
    slug: "5-habits-build-consistency",
    excerpt:
      "Discover the psychology behind habit formation and learn practical strategies to make your fitness routine stick for good.",
    featured_image_url:
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-1",
      name: "Dr. Sarah Chen",
      profile_picture_url: "https://randomuser.me/api/portraits/women/44.jpg"
    },
    published_at: "2026-01-10T09:00:00Z",
    created_at: "2026-01-08T14:30:00Z",
    updated_at: "2026-01-10T09:00:00Z",
    categories: [DUMMY_CATEGORIES[0], DUMMY_CATEGORIES[2]],
    tags: [
      { id: "tag-1", name: "habits", slug: "habits" },
      { id: "tag-2", name: "consistency", slug: "consistency" },
      { id: "tag-3", name: "motivation", slug: "motivation" }
    ],
    reading_time_minutes: 6,
    view_count: 2847
  },
  {
    id: "post-2",
    title: "The Ultimate Guide to Home Workouts Without Equipment",
    slug: "home-workouts-no-equipment",
    excerpt:
      "No gym? No problem. Build strength and endurance with these bodyweight exercises you can do anywhere.",
    featured_image_url:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-2",
      name: "Marcus Johnson",
      profile_picture_url: "https://randomuser.me/api/portraits/men/32.jpg"
    },
    published_at: "2026-01-08T10:00:00Z",
    created_at: "2026-01-06T16:45:00Z",
    updated_at: "2026-01-08T10:00:00Z",
    categories: [DUMMY_CATEGORIES[4]],
    tags: [
      { id: "tag-4", name: "home-workout", slug: "home-workout" },
      { id: "tag-5", name: "bodyweight", slug: "bodyweight" },
      { id: "tag-6", name: "beginners", slug: "beginners" }
    ],
    reading_time_minutes: 8,
    view_count: 4123
  },
  {
    id: "post-3",
    title: "How I Lost 30 Pounds Using Just Accountability Partners",
    slug: "lost-30-pounds-accountability",
    excerpt:
      "Real story: How finding the right accountability partner transformed my fitness journey completely.",
    featured_image_url:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-3",
      name: "Emily Rodriguez",
      profile_picture_url: "https://randomuser.me/api/portraits/women/68.jpg"
    },
    published_at: "2026-01-05T08:00:00Z",
    created_at: "2026-01-03T11:20:00Z",
    updated_at: "2026-01-05T08:00:00Z",
    categories: [DUMMY_CATEGORIES[3]],
    tags: [
      { id: "tag-7", name: "transformation", slug: "transformation" },
      { id: "tag-8", name: "accountability", slug: "accountability" },
      { id: "tag-9", name: "weight-loss", slug: "weight-loss" }
    ],
    reading_time_minutes: 5,
    view_count: 7892
  },
  {
    id: "post-4",
    title: "Meal Prep 101: Save Time and Crush Your Nutrition Goals",
    slug: "meal-prep-101-guide",
    excerpt:
      "Learn how to prep a week's worth of healthy meals in just 2 hours. Includes shopping lists and recipes.",
    featured_image_url:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-4",
      name: "Chef Alex Kim",
      profile_picture_url: "https://randomuser.me/api/portraits/men/75.jpg"
    },
    published_at: "2026-01-02T12:00:00Z",
    created_at: "2025-12-30T09:15:00Z",
    updated_at: "2026-01-02T12:00:00Z",
    categories: [DUMMY_CATEGORIES[1]],
    tags: [
      { id: "tag-10", name: "meal-prep", slug: "meal-prep" },
      { id: "tag-11", name: "nutrition", slug: "nutrition" },
      { id: "tag-12", name: "recipes", slug: "recipes" }
    ],
    reading_time_minutes: 10,
    view_count: 5634
  },
  {
    id: "post-5",
    title: "Morning vs Evening Workouts: What Science Actually Says",
    slug: "morning-vs-evening-workouts",
    excerpt:
      "The debate ends here. We dive into the research to find the optimal workout time for your goals.",
    featured_image_url:
      "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-1",
      name: "Dr. Sarah Chen",
      profile_picture_url: "https://randomuser.me/api/portraits/women/44.jpg"
    },
    published_at: "2025-12-28T07:00:00Z",
    created_at: "2025-12-26T15:30:00Z",
    updated_at: "2025-12-28T07:00:00Z",
    categories: [DUMMY_CATEGORIES[0]],
    tags: [
      { id: "tag-13", name: "workout-timing", slug: "workout-timing" },
      { id: "tag-14", name: "research", slug: "research" },
      { id: "tag-15", name: "optimization", slug: "optimization" }
    ],
    reading_time_minutes: 7,
    view_count: 3256
  },
  {
    id: "post-6",
    title: "The Mindset Shift That Changed Everything for Me",
    slug: "mindset-shift-changed-everything",
    excerpt:
      "Stop chasing motivation. Start building systems. Here's how I finally made fitness a non-negotiable.",
    featured_image_url:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop",
    status: "published",
    author: {
      id: "author-5",
      name: "Jordan Blake",
      profile_picture_url: "https://randomuser.me/api/portraits/men/22.jpg"
    },
    published_at: "2025-12-22T09:00:00Z",
    created_at: "2025-12-20T10:45:00Z",
    updated_at: "2025-12-22T09:00:00Z",
    categories: [DUMMY_CATEGORIES[2], DUMMY_CATEGORIES[3]],
    tags: [
      { id: "tag-16", name: "mindset", slug: "mindset" },
      { id: "tag-17", name: "systems", slug: "systems" },
      { id: "tag-18", name: "lifestyle", slug: "lifestyle" }
    ],
    reading_time_minutes: 4,
    view_count: 6421
  }
];

/**
 * Get dummy blog posts (simulates API response)
 * @param limit - Maximum number of posts to return
 * @param category - Optional category slug to filter by
 */
export function getDummyBlogPosts(limit: number = 10, category?: string): BlogPost[] {
  let posts = DUMMY_BLOG_POSTS;

  // Filter by category if provided
  if (category) {
    posts = posts.filter((post) => post.categories.some((cat) => cat.slug === category));
  }

  return posts.slice(0, limit);
}

/**
 * Get featured dummy posts (most viewed)
 */
export function getFeaturedDummyPosts(limit: number = 3): BlogPost[] {
  return [...DUMMY_BLOG_POSTS]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, limit);
}
