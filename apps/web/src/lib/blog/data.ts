// Dummy blog data emulating database content
import type { BlogPost, BlogCategory, BlogTag, BlogAuthor } from "./types";

export const authors: BlogAuthor[] = [
  {
    id: "author-1",
    name: "Sarah Mitchell",
    avatar: "/images/authors/sarah.jpg",
    bio: "Behavioral psychologist and habit formation expert with 10+ years of research experience.",
  },
  {
    id: "author-2",
    name: "Alex Chen",
    avatar: "/images/authors/alex.jpg",
    bio: "AI researcher and tech enthusiast passionate about using technology for personal growth.",
  },
  {
    id: "author-3",
    name: "FitNudge Team",
    avatar: "/images/authors/team.jpg",
    bio: "The team behind FitNudge, dedicated to helping you build lasting habits.",
  },
];

export const categories: BlogCategory[] = [
  {
    id: "cat-1",
    name: "Habit Science",
    slug: "habit-science",
    description:
      "Research-backed insights into habit formation and behavioral change",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-2",
    name: "AI & Technology",
    slug: "ai-technology",
    description:
      "How AI is revolutionizing personal development and accountability",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-3",
    name: "Success Stories",
    slug: "success-stories",
    description:
      "Real stories from people who transformed their lives with better habits",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-4",
    name: "Tips & Strategies",
    slug: "tips-strategies",
    description: "Practical advice for building and maintaining habits",
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const tags: BlogTag[] = [
  {
    id: "tag-1",
    name: "Motivation",
    slug: "motivation",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-2",
    name: "Productivity",
    slug: "productivity",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-3",
    name: "Accountability",
    slug: "accountability",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-4",
    name: "AI Coach",
    slug: "ai-coach",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-5",
    name: "Goal Setting",
    slug: "goal-setting",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-6",
    name: "Mindfulness",
    slug: "mindfulness",
    created_at: "2024-01-01T00:00:00Z",
  },
];

const post1Content = `<article>
<p class="lead">Building new habits isn't about willpower—it's about understanding how your brain works. In this comprehensive guide, we'll explore the science behind habit formation and give you practical strategies to make positive changes stick.</p>

<h2>Understanding the Habit Loop</h2>
<p>Every habit follows a simple three-part pattern known as the <strong>habit loop</strong>, first identified by researchers at MIT. This loop consists of:</p>
<ul>
<li><strong>Cue:</strong> The trigger that initiates the behavior</li>
<li><strong>Routine:</strong> The behavior itself</li>
<li><strong>Reward:</strong> The benefit you get from doing the behavior</li>
</ul>

<blockquote>
<p>"Habits are not destiny. They can be ignored, changed, or replaced. But the reason the discovery of the habit loop is so important is that it reveals a basic truth: When a habit emerges, the brain stops fully participating in decision making."</p>
<cite>— Charles Duhigg, The Power of Habit</cite>
</blockquote>

<h2>Why Consistency Beats Intensity</h2>
<p>One of the biggest mistakes people make when trying to build new habits is going too hard too fast. Research shows that <em>consistency</em> is far more important than intensity when it comes to habit formation.</p>
<p>A study published in the European Journal of Social Psychology found that it takes an average of <strong>66 days</strong> for a new behavior to become automatic. However, this can range from 18 to 254 days depending on the complexity of the habit and the individual.</p>

<h2>The Role of Identity in Habit Change</h2>
<p>Perhaps the most powerful lever for lasting change is shifting your identity. Instead of focusing on what you want to achieve (goals), focus on who you want to become (identity).</p>
<p>For example:</p>
<ul>
<li>Instead of "I want to read more books," think "I am a reader"</li>
<li>Instead of "I want to exercise regularly," think "I am an active person"</li>
<li>Instead of "I want to meditate daily," think "I am someone who prioritizes mental clarity"</li>
</ul>

<h2>Practical Strategies for Building Habits</h2>
<h3>1. Start Incredibly Small</h3>
<p>Make your new habit so easy you can't say no. Want to read more? Start with one page. Want to exercise? Start with one push-up. The goal is to establish the routine first.</p>

<h3>2. Stack Your Habits</h3>
<p>Link your new habit to an existing one. This is called <strong>habit stacking</strong>. The formula is: "After I [CURRENT HABIT], I will [NEW HABIT]."</p>

<h3>3. Design Your Environment</h3>
<p>Make good habits easy and bad habits hard by modifying your environment. Put your running shoes by the door, keep healthy snacks visible, and remove temptations from your immediate environment.</p>

<h2>How FitNudge Applies These Principles</h2>
<p>FitNudge is built on these evidence-based principles. Our AI coach helps you:</p>
<ul>
<li>Set up personalized cues and reminders at optimal times</li>
<li>Track your streaks to reinforce consistency</li>
<li>Celebrate small wins to strengthen the reward loop</li>
<li>Connect with accountability partners for social motivation</li>
</ul>

<p>Ready to start building better habits? <a href="/#waitlist-section">Join our waitlist</a> and be among the first to experience AI-powered accountability.</p>
</article>`;

const post2Content = `<article>
<p class="lead">Artificial intelligence is transforming how we approach personal development. From personalized motivation to adaptive goal tracking, AI coaches are changing the game for habit building.</p>

<h2>The Problem with Traditional Accountability</h2>
<p>Traditional accountability methods—like workout buddies, coaches, or apps with generic reminders—often fall short because they don't adapt to <em>you</em>. They don't know when you're struggling, what motivates you, or how to adjust when life gets in the way.</p>

<h2>Enter AI-Powered Coaching</h2>
<p>Modern AI can analyze patterns in your behavior, understand your preferences, and deliver personalized interventions at exactly the right moment. Here's what makes AI accountability different:</p>

<h3>Personalized Motivation</h3>
<p>AI learns what kind of messages resonate with you. Some people respond to tough love, others to gentle encouragement. An AI coach adapts its communication style to maximize your motivation.</p>

<h3>Optimal Timing</h3>
<p>Through pattern recognition, AI can identify the best times to send you reminders and check-ins. It learns your schedule, your energy patterns, and your habits to intervene when you're most likely to act.</p>

<h3>Adaptive Goal Setting</h3>
<p>AI can help adjust your goals based on your progress. Having a tough week? Your AI coach might suggest scaling back temporarily. On a roll? It might challenge you to push a little harder.</p>

<blockquote>
<p>"The best accountability partner is one who knows you intimately, is available 24/7, and never judges you. AI makes this possible for everyone."</p>
</blockquote>

<h2>The Future of AI Accountability</h2>
<p>We're just scratching the surface of what's possible. Future AI coaches will be able to:</p>
<ul>
<li>Integrate with wearables for real-time health data</li>
<li>Predict potential habit slip-ups before they happen</li>
<li>Create personalized reward systems based on what motivates you</li>
<li>Connect you with like-minded accountability partners</li>
</ul>

<p>FitNudge is at the forefront of this revolution. Our AI doesn't just remind you—it understands you, adapts to you, and grows with you on your journey to better habits.</p>
</article>`;

const post3Content = `<article>
<p class="lead">Meet Maria, a 34-year-old marketing manager who had tried and failed to establish a running habit more times than she could count. This is her story of how simple daily nudges transformed her relationship with exercise.</p>

<h2>"I Was the Queen of Starting Over"</h2>
<p>"Every January, I'd sign up for a gym membership. Every February, I'd stop going. I bought running shoes, fitness trackers, and downloaded every workout app you can imagine. Nothing stuck."</p>
<p>Sound familiar? Maria's story resonates with millions of people who struggle with consistency. The motivation is there, but somewhere along the way, life gets in the way.</p>

<h2>The Turning Point</h2>
<p>"I realized that my problem wasn't motivation—it was accountability. I had no one checking in on me, no one to answer to except myself. And I was really good at making excuses to myself."</p>
<p>Maria started using a daily check-in system. Every morning at 7 AM, she'd receive a simple question: <em>"Did you run today?"</em> The answer was just yes or no, but having to answer honestly every single day changed everything.</p>

<h2>The Power of Streaks</h2>
<p>"After my first week of consistent runs, I saw my streak counter at 7. It was just a number, but I felt so proud. By day 14, I couldn't bear the thought of breaking that streak."</p>
<ul>
<li>Week 1: Running for 10 minutes, 3 times</li>
<li>Week 4: Running for 20 minutes, 4 times</li>
<li>Week 8: Running for 30 minutes, 5 times</li>
<li>Week 12: Completed first 5K race!</li>
</ul>

<h2>Lessons Learned</h2>
<p>Maria's journey taught her several valuable lessons:</p>
<ol>
<li><strong>Small steps matter:</strong> She started with just 10 minutes, not an hour</li>
<li><strong>Accountability works:</strong> Having to answer honestly kept her honest</li>
<li><strong>Streaks are motivating:</strong> Watching her streak grow became its own reward</li>
<li><strong>Community helps:</strong> Connecting with other runners kept her inspired</li>
</ol>

<blockquote>
<p>"I used to think I wasn't a 'runner.' Now I know that identity isn't something you are—it's something you become through consistent action."</p>
<cite>— Maria, FitNudge user</cite>
</blockquote>

<h2>Your Story Could Be Next</h2>
<p>Maria's transformation didn't require a personal trainer, expensive equipment, or superhuman willpower. It just required showing up consistently, one day at a time.</p>
<p>Ready to write your own success story? <a href="/#waitlist-section">Join FitNudge</a> and let us help you stay accountable to your goals.</p>
</article>`;

const post4Content = `<article>
<p class="lead">How you start your morning sets the tone for your entire day. These five habits, backed by research, can help you maximize your productivity and well-being.</p>

<h2>1. Wake Up at a Consistent Time</h2>
<p>Your body's circadian rhythm thrives on consistency. Waking up at the same time every day—even on weekends—helps regulate your sleep-wake cycle and improves sleep quality.</p>
<p><strong>Pro tip:</strong> Set your wake-up time and stick to it for 21 days. After that, you'll find yourself naturally waking up before your alarm.</p>

<h2>2. Hydrate Before Caffeine</h2>
<p>After 7-8 hours of sleep, your body is dehydrated. Before reaching for coffee, drink a full glass of water to:</p>
<ul>
<li>Kickstart your metabolism</li>
<li>Flush out toxins</li>
<li>Improve mental alertness</li>
<li>Boost energy levels naturally</li>
</ul>

<h2>3. Move Your Body</h2>
<p>Even 10 minutes of movement in the morning can dramatically improve your day. Options include:</p>
<ul>
<li>Light stretching or yoga</li>
<li>A short walk around the block</li>
<li>Quick bodyweight exercises</li>
<li>Dancing to your favorite song</li>
</ul>

<h2>4. Practice Mindfulness</h2>
<p>Starting your day with even 5 minutes of meditation or deep breathing can reduce stress and improve focus throughout the day. Apps like FitNudge can send you gentle reminders to take this important mental pause.</p>

<h2>5. Set Your Intention</h2>
<p>Before diving into tasks, take a moment to identify your top 1-3 priorities for the day. Ask yourself: "What would make today a success?"</p>

<h2>Making It Stick</h2>
<p>The key to establishing a morning routine is to start small and build gradually. Don't try to implement all five habits at once. Pick one, master it, then add another.</p>
<p>FitNudge can help you build your perfect morning routine with personalized reminders and streak tracking. <a href="/#waitlist-section">Get started today</a>.</p>
</article>`;

const post5Content = `<article>
<p class="lead">There's a reason every successful person talks about their support system. Accountability partners aren't just nice to have—they're one of the most powerful tools for achieving your goals.</p>

<h2>The Research Is Clear</h2>
<p>A study by the American Society of Training and Development found that:</p>
<ul>
<li>Having a specific goal increases success rate to <strong>50%</strong></li>
<li>Committing to someone increases success rate to <strong>65%</strong></li>
<li>Having regular check-ins increases success rate to <strong>95%</strong></li>
</ul>
<p>That's nearly double the success rate just by adding accountability!</p>

<h2>Why Accountability Works</h2>
<h3>Social Commitment</h3>
<p>We're wired to keep our promises to others. When you tell someone you'll do something, breaking that commitment feels worse than breaking a promise to yourself.</p>

<h3>Positive Pressure</h3>
<p>Knowing someone is checking in on you creates healthy pressure to follow through. It's not about judgment—it's about having someone who cares about your progress.</p>

<h3>Celebration and Support</h3>
<p>An accountability partner celebrates your wins and supports you through setbacks. This emotional connection makes the journey more enjoyable and sustainable.</p>

<h2>Finding the Right Partner</h2>
<p>The best accountability partners share these qualities:</p>
<ol>
<li><strong>Reliability:</strong> They show up consistently</li>
<li><strong>Honesty:</strong> They'll tell you the truth, kindly</li>
<li><strong>Similar commitment level:</strong> They're as invested as you are</li>
<li><strong>Complementary schedules:</strong> You can check in regularly</li>
</ol>

<h2>Digital Accountability in the Modern Age</h2>
<p>While in-person accountability is powerful, technology has opened up new possibilities. FitNudge combines the best of both worlds:</p>
<ul>
<li>AI coach available 24/7 for daily check-ins</li>
<li>Connect with human accountability partners in the app</li>
<li>Send and receive "nudges" to keep each other on track</li>
<li>Celebrate streaks and milestones together</li>
</ul>

<p>Ready to experience the accountability partner effect? <a href="/#waitlist-section">Join FitNudge</a> and connect with your perfect accountability match.</p>
</article>`;

export const blogPosts: BlogPost[] = [
  {
    id: "post-1",
    title:
      "The Science of Habit Formation: Why Small Changes Lead to Big Results",
    slug: "science-of-habit-formation",
    excerpt:
      "Discover the neuroscience behind habit loops and learn how understanding your brain can help you build lasting positive changes in your life.",
    featured_image: "/images/blog/habit-science.jpg",
    content: post1Content,
    author: authors[0],
    status: "published",
    published_at: "2024-01-15T10:00:00Z",
    created_at: "2024-01-10T08:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    categories: [categories[0]],
    tags: [tags[0], tags[2], tags[4]],
    read_time: 8,
  },
  {
    id: "post-2",
    title: "How AI is Revolutionizing Personal Accountability",
    slug: "ai-revolutionizing-accountability",
    excerpt:
      "Explore how artificial intelligence is creating personalized, adaptive accountability systems that understand your unique patterns and motivations.",
    featured_image: "/images/blog/ai-accountability.jpg",
    content: post2Content,
    author: authors[1],
    status: "published",
    published_at: "2024-01-12T09:00:00Z",
    created_at: "2024-01-08T14:00:00Z",
    updated_at: "2024-01-12T09:00:00Z",
    categories: [categories[1]],
    tags: [tags[3], tags[0], tags[2]],
    read_time: 6,
  },
  {
    id: "post-3",
    title: "From Couch to 5K: How Daily Nudges Changed My Life",
    slug: "couch-to-5k-success-story",
    excerpt:
      "Read Maria's inspiring journey from struggling with consistency to completing her first 5K race, all with the help of daily accountability check-ins.",
    featured_image: "/images/blog/success-story-1.jpg",
    content: post3Content,
    author: authors[2],
    status: "published",
    published_at: "2024-01-10T11:00:00Z",
    created_at: "2024-01-05T16:00:00Z",
    updated_at: "2024-01-10T11:00:00Z",
    categories: [categories[2]],
    tags: [tags[0], tags[2]],
    read_time: 5,
  },
  {
    id: "post-4",
    title: "5 Morning Routine Habits That Will Transform Your Day",
    slug: "morning-routine-habits",
    excerpt:
      "Start your day right with these science-backed morning habits that boost productivity, energy, and mental clarity.",
    featured_image: "/images/blog/morning-routine.jpg",
    content: post4Content,
    author: authors[0],
    status: "published",
    published_at: "2024-01-08T08:00:00Z",
    created_at: "2024-01-03T10:00:00Z",
    updated_at: "2024-01-08T08:00:00Z",
    categories: [categories[3]],
    tags: [tags[1], tags[5], tags[4]],
    read_time: 4,
  },
  {
    id: "post-5",
    title: "The Accountability Partner Effect: Why We Do Better Together",
    slug: "accountability-partner-effect",
    excerpt:
      "Research shows we're 65% more likely to meet goals with an accountability partner. Learn how to leverage social support for your habit journey.",
    featured_image: "/images/blog/accountability-partners.jpg",
    content: post5Content,
    author: authors[1],
    status: "published",
    published_at: "2024-01-05T14:00:00Z",
    created_at: "2024-01-01T09:00:00Z",
    updated_at: "2024-01-05T14:00:00Z",
    categories: [categories[0], categories[3]],
    tags: [tags[2], tags[0]],
    read_time: 6,
  },
  {
    id: "post-6",
    title: "Breaking Bad Habits: A Step-by-Step Guide",
    slug: "breaking-bad-habits-guide",
    excerpt:
      "Learn the proven strategies to identify, interrupt, and replace unwanted habits with positive alternatives.",
    featured_image: "/images/blog/breaking-habits.jpg",
    content: post1Content,
    author: authors[0],
    status: "published",
    published_at: "2024-01-03T10:00:00Z",
    created_at: "2023-12-28T08:00:00Z",
    updated_at: "2024-01-03T10:00:00Z",
    categories: [categories[0]],
    tags: [tags[0], tags[4]],
    read_time: 7,
  },
  {
    id: "post-7",
    title: "The Power of Micro-Habits: Small Steps, Big Changes",
    slug: "power-of-micro-habits",
    excerpt:
      "Discover how tiny daily actions can compound into life-changing results over time.",
    featured_image: "/images/blog/micro-habits.jpg",
    content: post2Content,
    author: authors[2],
    status: "published",
    published_at: "2024-01-02T09:00:00Z",
    created_at: "2023-12-25T14:00:00Z",
    updated_at: "2024-01-02T09:00:00Z",
    categories: [categories[3]],
    tags: [tags[1], tags[4]],
    read_time: 5,
  },
  {
    id: "post-8",
    title: "Mindful Goal Setting: Aligning Your Habits with Your Values",
    slug: "mindful-goal-setting",
    excerpt:
      "Learn how to set goals that truly resonate with your core values for lasting motivation.",
    featured_image: "/images/blog/mindful-goals.jpg",
    content: post3Content,
    author: authors[0],
    status: "published",
    published_at: "2023-12-28T11:00:00Z",
    created_at: "2023-12-20T16:00:00Z",
    updated_at: "2023-12-28T11:00:00Z",
    categories: [categories[0], categories[3]],
    tags: [tags[4], tags[5]],
    read_time: 6,
  },
  {
    id: "post-9",
    title: "How to Stay Motivated When Progress Feels Slow",
    slug: "staying-motivated-slow-progress",
    excerpt:
      "Practical tips for maintaining momentum when you can't see immediate results from your efforts.",
    featured_image: "/images/blog/slow-progress.jpg",
    content: post4Content,
    author: authors[1],
    status: "published",
    published_at: "2023-12-25T08:00:00Z",
    created_at: "2023-12-18T10:00:00Z",
    updated_at: "2023-12-25T08:00:00Z",
    categories: [categories[3]],
    tags: [tags[0], tags[2]],
    read_time: 5,
  },
  {
    id: "post-10",
    title: "The Role of Sleep in Habit Formation",
    slug: "sleep-and-habit-formation",
    excerpt:
      "Understanding how quality sleep affects your ability to build and maintain new habits.",
    featured_image: "/images/blog/sleep-habits.jpg",
    content: post5Content,
    author: authors[2],
    status: "published",
    published_at: "2023-12-20T14:00:00Z",
    created_at: "2023-12-15T09:00:00Z",
    updated_at: "2023-12-20T14:00:00Z",
    categories: [categories[0]],
    tags: [tags[1], tags[5]],
    read_time: 4,
  },
];

// Helper function to get posts by category
export function getPostsByCategory(categorySlug: string): BlogPost[] {
  return blogPosts.filter((post) =>
    post.categories.some((cat) => cat.slug === categorySlug),
  );
}

// Helper function to get posts by tag
export function getPostsByTag(tagSlug: string): BlogPost[] {
  return blogPosts.filter((post) =>
    post.tags.some((tag) => tag.slug === tagSlug),
  );
}

// Helper function to get post by slug
export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

// Helper function to get featured posts
export function getFeaturedPosts(limit: number = 3): BlogPost[] {
  return blogPosts
    .filter((post) => post.status === "published")
    .sort(
      (a, b) =>
        new Date(b.published_at || "").getTime() -
        new Date(a.published_at || "").getTime(),
    )
    .slice(0, limit);
}

// Helper function to get related posts
export function getRelatedPosts(
  currentPost: BlogPost,
  limit: number = 3,
): BlogPost[] {
  const currentCategoryIds = currentPost.categories.map((c) => c.id);
  const currentTagIds = currentPost.tags.map((t) => t.id);

  return blogPosts
    .filter((post) => post.id !== currentPost.id && post.status === "published")
    .map((post) => {
      const categoryScore = post.categories.filter((c) =>
        currentCategoryIds.includes(c.id),
      ).length;
      const tagScore = post.tags.filter((t) =>
        currentTagIds.includes(t.id),
      ).length;
      return { post, score: categoryScore * 2 + tagScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
}
