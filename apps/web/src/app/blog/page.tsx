import Link from "next/link";
import { Calendar, Clock, User } from "lucide-react";

// Mock blog posts data
const blogPosts = [
  {
    id: "1",
    title: "How AI is Revolutionizing Fitness Motivation",
    slug: "ai-revolutionizing-fitness-motivation",
    excerpt:
      "Discover how artificial intelligence is transforming the way we approach fitness and motivation.",
    author: "FitNudge Team",
    publishedAt: "2024-01-15",
    readTime: "5 min",
    category: "AI Motivation",
    featured: true,
  },
  {
    id: "2",
    title: "The Science Behind Habit Formation",
    slug: "science-behind-habit-formation",
    excerpt:
      "Learn the psychological principles that make habits stick and how to apply them to your fitness journey.",
    author: "Dr. Sarah Johnson",
    publishedAt: "2024-01-10",
    readTime: "7 min",
    category: "Wellness",
    featured: false,
  },
  {
    id: "3",
    title: "Building a Supportive Fitness Community",
    slug: "building-supportive-fitness-community",
    excerpt:
      "Why community matters in fitness and how to find your tribe for long-term success.",
    author: "Mike Chen",
    publishedAt: "2024-01-05",
    readTime: "6 min",
    category: "Community",
    featured: false,
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              FitNudge
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-500 hover:text-gray-900">
                Home
              </Link>
              <Link href="/blog" className="text-blue-600 font-medium">
                Blog
              </Link>
              <Link
                href="#contact"
                className="text-gray-500 hover:text-gray-900"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t("web.blog.title")}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t("web.blog.subtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Featured Article
            </h2>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/2">
                  <div className="h-64 md:h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <div className="text-center text-white">
                      <h3 className="text-2xl font-bold mb-2">AI & Fitness</h3>
                      <p className="text-blue-100">The future is here</p>
                    </div>
                  </div>
                </div>
                <div className="md:w-1/2 p-8">
                  <div className="flex items-center mb-4">
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                      {blogPosts[0].category}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {blogPosts[0].title}
                  </h3>
                  <p className="text-gray-600 mb-6">{blogPosts[0].excerpt}</p>
                  <div className="flex items-center text-sm text-gray-500 mb-6">
                    <User className="h-4 w-4 mr-2" />
                    <span className="mr-4">{blogPosts[0].author}</span>
                    <Calendar className="h-4 w-4 mr-2" />
                    <span className="mr-4">{blogPosts[0].publishedAt}</span>
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{blogPosts[0].readTime}</span>
                  </div>
                  <Link
                    href={`/blog/${blogPosts[0].slug}`}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center"
                  >
                    Read More
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* All Posts */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              All Articles
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.slice(1).map((post) => (
                <article
                  key={post.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                    <div className="text-center text-white">
                      <h4 className="text-lg font-bold">{post.category}</h4>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">{post.excerpt}</p>
                    <div className="flex items-center text-xs text-gray-500 mb-4">
                      <User className="h-3 w-3 mr-1" />
                      <span className="mr-3">{post.author}</span>
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="mr-3">{post.publishedAt}</span>
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{post.readTime}</span>
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-blue-600 font-medium hover:text-blue-700"
                    >
                      Read More →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Stay Updated
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Get the latest fitness tips, AI insights, and community stories
            delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">FitNudge</h3>
              <p className="text-gray-400">
                Your AI-powered fitness coach for a healthier, happier you.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/#features"
                    className="text-gray-400 hover:text-white"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#pricing"
                    className="text-gray-400 hover:text-white"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#download"
                    className="text-gray-400 hover:text-white"
                  >
                    Download
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/blog" className="text-gray-400 hover:text-white">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="text-gray-400 hover:text-white"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-gray-400 hover:text-white"
                  >
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#help" className="text-gray-400 hover:text-white">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    href="#terms"
                    className="text-gray-400 hover:text-white"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 FitNudge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
