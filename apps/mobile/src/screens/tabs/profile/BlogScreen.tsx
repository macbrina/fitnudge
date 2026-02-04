/**
 * BlogScreen - Dribbble-Inspired Design
 *
 * A beautiful, magazine-style blog screen with:
 * - Featured hero post with large image
 * - Category filter chips
 * - Grid/List view toggle
 * - Elegant card designs with glassmorphism
 * - Smooth animations and micro-interactions
 *
 * Opens posts in in-app browser via useInAppBrowser.
 */

import { AdBanner, NativeAdCard } from "@/components/ads";
import BackButton from "@/components/ui/BackButton";
import { useInAppBrowser } from "@/components/ui/InAppBrowser";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { trackBlogPostView, useBlogCategories, useBlogPosts } from "@/hooks/api/useBlogPosts";
import { useShowAds } from "@/hooks/useShowAds";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { toRN } from "@/lib/units";
import { BlogCategory, BlogPost } from "@/services/api/blog";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { formatRelativeTime } from "@/utils/helper";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BLOG_BASE_URL = Constants.expoConfig?.extra?.blogUrl || "https://fitnudge.app/blog";

// View modes
type ViewMode = "grid" | "list";

export default function BlogScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { openBrowser } = useInAppBrowser();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Check if ads should be shown (free users only)
  const showAds = useShowAds();

  const {
    data: posts,
    isLoading,
    isFetching,
    refetch,
    isRefetching
  } = useBlogPosts({
    limit: 20,
    category: selectedCategory || undefined
  });
  const { data: categories } = useBlogCategories();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Show loading when changing categories (not initial load, not pull-to-refresh)
  const isChangingCategory = isFetching && !isLoading && !isRefetching;

  // Get selected category name for empty state
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) return null;
    return categories?.find((cat) => cat.slug === selectedCategory)?.name || selectedCategory;
  }, [selectedCategory, categories]);

  // Featured post (first one)
  const featuredPost = useMemo(() => (posts && posts.length > 0 ? posts[0] : null), [posts]);

  // Rest of posts
  const regularPosts = useMemo(() => (posts ? posts.slice(1) : []), [posts]);

  const handleOpenPost = useCallback(
    (post: BlogPost) => {
      trackBlogPostView(post.id);
      const postUrl = `${BLOG_BASE_URL}/${post.slug}`;
      openBrowser({
        url: postUrl,
        title: post.title,
        showOpenInBrowser: true,
        toolbarColor: brandColors.primary,
        controlsColor: colors.text.primary
      });
    },
    [openBrowser, brandColors.primary, colors.text.primary]
  );

  const renderCategoryChip = (category: BlogCategory | null, index: number) => {
    const isSelected = selectedCategory === (category?.slug || null);
    const isAll = category === null;

    return (
      <TouchableOpacity
        key={category?.id || "all"}
        onPress={() => setSelectedCategory(category?.slug || null)}
        style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
        activeOpacity={0.7}
      >
        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
          {isAll ? t("common.all") || "All" : category?.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFeaturedPost = () => {
    if (!featuredPost) return null;

    return (
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => handleOpenPost(featuredPost)}
          style={styles.featuredCard}
        >
          <ImageBackground
            source={{ uri: featuredPost.featured_image_url }}
            style={styles.featuredImage}
            imageStyle={styles.featuredImageStyle}
            resizeMode="cover"
          >
            {/* Gradient Overlay */}
            <Svg style={styles.gradientOverlay}>
              <Defs>
                <SvgLinearGradient id="featuredGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="rgba(0,0,0,0)" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="rgba(0,0,0,0.2)" stopOpacity="0.2" />
                  <Stop offset="1" stopColor="rgba(0,0,0,0.9)" stopOpacity="0.9" />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#featuredGradient)" />
            </Svg>

            {/* Featured Badge */}
            <View style={styles.featuredBadgeContainer}>
              <View style={styles.featuredBadge}>
                <Ionicons name="flame" size={12} color="#FF6B35" />
                <Text style={styles.featuredBadgeText}>{t("blog.featured") || "Featured"}</Text>
              </View>
              <View style={styles.readingTimeBadge}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.9)" />
                <Text style={styles.readingTimeText}>
                  {featuredPost.reading_time_minutes} min read
                </Text>
              </View>
            </View>

            {/* Content */}
            <View style={styles.featuredContent}>
              {/* Category */}
              {featuredPost.categories[0] && (
                <View style={styles.featuredCategory}>
                  <Text style={styles.featuredCategoryText}>{featuredPost.categories[0].name}</Text>
                </View>
              )}

              {/* Title */}
              <Text style={styles.featuredTitle} numberOfLines={3}>
                {featuredPost.title}
              </Text>

              {/* Excerpt */}
              {featuredPost.excerpt && (
                <Text style={styles.featuredExcerpt} numberOfLines={2}>
                  {featuredPost.excerpt}
                </Text>
              )}

              {/* Author Row */}
              <View style={styles.authorRow}>
                <View style={styles.authorInfo}>
                  <View style={styles.authorAvatar}>
                    {featuredPost.author.profile_picture_url ? (
                      <ImageBackground
                        source={{ uri: featuredPost.author.profile_picture_url }}
                        style={styles.authorAvatarImage}
                        imageStyle={{ borderRadius: 14 }}
                      />
                    ) : (
                      <Ionicons name="person" size={14} color="rgba(255,255,255,0.8)" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.authorName}>{featuredPost.author.name}</Text>
                    <Text style={styles.postDate}>
                      {formatRelativeTime(featuredPost.published_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.readMore}>
                  <Text style={styles.readMoreText}>{t("blog.read") || "Read"}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBlogCard = (post: BlogPost, index: number) => {
    if (viewMode === "grid") {
      return (
        <Animated.View
          key={post.id}
          entering={FadeInUp.delay(100 + index * 50).duration(400)}
          style={styles.gridCardWrapper}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleOpenPost(post)}
            style={styles.gridCard}
          >
            <ImageBackground
              source={{ uri: post.featured_image_url }}
              style={styles.gridCardImage}
              imageStyle={styles.gridCardImageStyle}
              resizeMode="cover"
            >
              <Svg style={styles.gridGradient}>
                <Defs>
                  <SvgLinearGradient id={`gridGrad-${post.id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.4" stopColor="rgba(0,0,0,0)" stopOpacity="0" />
                    <Stop offset="1" stopColor="rgba(0,0,0,0.85)" stopOpacity="0.85" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#gridGrad-${post.id})`} />
              </Svg>
              <View style={styles.gridCardContent}>
                <Text style={styles.gridCardTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.gridCardMeta}>
                  {post.reading_time_minutes} min · {formatRelativeTime(post.published_at)}
                </Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    // List view
    return (
      <Animated.View key={post.id} entering={FadeInUp.delay(100 + index * 50).duration(400)}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleOpenPost(post)}
          style={styles.listCard}
        >
          {/* Thumbnail */}
          <ImageBackground
            source={{ uri: post.featured_image_url }}
            style={styles.listCardImage}
            imageStyle={styles.listCardImageStyle}
            resizeMode="cover"
          >
            {post.categories[0] && (
              <View style={styles.listCategoryBadge}>
                <Text style={styles.listCategoryText}>{post.categories[0].name}</Text>
              </View>
            )}
          </ImageBackground>

          {/* Content */}
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle} numberOfLines={2}>
              {post.title}
            </Text>

            <View style={styles.listCardMeta}>
              <View style={styles.listAuthorRow}>
                <View style={styles.listAuthorAvatar}>
                  {post.author.profile_picture_url ? (
                    <ImageBackground
                      source={{ uri: post.author.profile_picture_url }}
                      style={styles.listAuthorAvatarImage}
                      imageStyle={{ borderRadius: 10 }}
                    />
                  ) : (
                    <Ionicons name="person" size={10} color={colors.text.tertiary} />
                  )}
                </View>
                <Text style={styles.listAuthorName} numberOfLines={1}>
                  {post.author.name}
                </Text>
              </View>

              <View style={styles.listMetaRight}>
                <Ionicons name="time-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.listMetaText}>{post.reading_time_minutes} min</Text>
              </View>
            </View>

            <Text style={styles.listDate}>{formatRelativeTime(post.published_at)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      {/* Featured skeleton */}
      <SkeletonBox
        width={SCREEN_WIDTH - 32}
        height={280}
        borderRadius={toRN(tokens.borderRadius["2xl"])}
        style={{ marginHorizontal: 16, marginBottom: 24 }}
      />
      {/* List skeletons */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.listSkeletonRow}>
          <SkeletonBox width={100} height={100} borderRadius={toRN(tokens.borderRadius.xl)} />
          <View style={styles.listSkeletonContent}>
            <SkeletonBox width="90%" height={16} borderRadius={4} />
            <SkeletonBox width="60%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
            <SkeletonBox width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <BackButton
        title={t("profile.blog") || "Blog"}
        onPress={() => router.back()}
        titleCentered
        rightInput={
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setViewMode("list")}
              style={[styles.viewToggleButton, viewMode === "list" && styles.viewToggleActive]}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === "list" ? brandColors.primary : colors.text.tertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode("grid")}
              style={[styles.viewToggleButton, viewMode === "grid" && styles.viewToggleActive]}
            >
              <Ionicons
                name="grid"
                size={18}
                color={viewMode === "grid" ? brandColors.primary : colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {renderCategoryChip(null, -1)}
          {categories?.map((cat, i) => renderCategoryChip(cat, i))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        renderLoadingState()
      ) : (
        <View style={styles.contentWrapper}>
          {/* Category change loading overlay */}
          {isChangingCategory && (
            <View style={styles.categoryLoadingOverlay}>
              <ActivityIndicator size="large" color={brandColors.primary} />
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              !featuredPost && regularPosts.length === 0 && styles.scrollContentEmpty
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={brandColors.primary}
              />
            }
          >
            {/* Featured Post */}
            {featuredPost && renderFeaturedPost()}

            {/* Ad after featured post - high visibility placement */}
            {featuredPost && showAds && <AdBanner unitId="HOME_BANNER" showUpgradeCTA={false} />}

            {/* Section Title */}
            {regularPosts.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t("blog.latest") || "Latest Articles"}</Text>
                <Text style={styles.sectionCount}>{regularPosts.length} posts</Text>
              </View>
            )}

            {/* Posts Grid/List with interspersed native ads */}
            {viewMode === "grid" ? (
              <View style={styles.gridContainer}>
                {regularPosts.map((post, index) => (
                  <React.Fragment key={post.id}>
                    {renderBlogCard(post, index)}
                    {/* Show compact native ad every 2 posts (after each row), blends with grid cards */}
                    {showAds && (index + 1) % 2 === 0 && index < regularPosts.length - 1 && (
                      <View style={styles.gridCardWrapper}>
                        <NativeAdCard variant="compact" style={styles.gridAdCard} />
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.listContainer}>
                {regularPosts.map((post, index) => (
                  <React.Fragment key={post.id}>
                    {renderBlogCard(post, index)}
                    {/* Show horizontal native ad every 3 posts (matches list card style) */}
                    {showAds && (index + 1) % 3 === 0 && index < regularPosts.length - 1 && (
                      <NativeAdCard variant="horizontal" />
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Empty state */}
            {!featuredPost && regularPosts.length === 0 && !isChangingCategory && (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={selectedCategory ? "filter-outline" : "newspaper-outline"}
                  size={64}
                  color={colors.text.tertiary}
                />
                <Text style={styles.emptyTitle}>
                  {selectedCategory
                    ? t("blog.no_posts_category") || "No Posts Found"
                    : t("blog.no_posts") || "No Posts Yet"}
                </Text>
                <Text style={styles.emptyDescription}>
                  {selectedCategory
                    ? `${t("blog.no_posts_category_description") || "No articles in"} "${selectedCategoryName}". ${t("blog.try_another_category") || "Try another category."}`
                    : t("blog.no_posts_description") || "Check back soon for new content!"}
                </Text>
                {selectedCategory && (
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedCategory(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={brandColors.primary} />
                    <Text style={styles.clearFilterText}>
                      {t("blog.show_all") || "Show All Posts"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },

  // Header
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  headerCenter: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  headerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${brand.primary}15`,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    letterSpacing: -0.5
  },
  viewToggle: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.elevated,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: 4
  },
  viewToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  viewToggleActive: {
    backgroundColor: `${brand.primary}15`
  },

  // Categories
  categoryContainer: {
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  categoryScroll: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[2])
  },
  categoryChip: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  categoryChipSelected: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  categoryChipText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  categoryChipTextSelected: {
    color: "#FFFFFF",
    fontFamily: fontFamily.semiBold
  },

  // Content wrapper
  contentWrapper: {
    flex: 1,
    position: "relative" as const
  },
  categoryLoadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.05)",
    zIndex: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },

  // Scroll
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  scrollContentEmpty: {
    flexGrow: 1
  },

  // Featured Card
  featuredCard: {
    margin: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12
  },
  featuredImage: {
    height: 320,
    justifyContent: "space-between" as const
  },
  featuredImageStyle: {
    borderRadius: toRN(tokens.borderRadius["2xl"])
  },
  gradientOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  featuredBadgeContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    padding: toRN(tokens.spacing[4])
  },
  featuredBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  featuredBadgeText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.bold,
    color: "#FF6B35",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  readingTimeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  readingTimeText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.95)"
  },
  featuredContent: {
    padding: toRN(tokens.spacing[4])
  },
  featuredCategory: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[1]),
    backgroundColor: `${brand.primary}`,
    borderRadius: toRN(tokens.borderRadius.md),
    marginBottom: toRN(tokens.spacing[2])
  },
  featuredCategoryText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  featuredTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
    lineHeight: toRN(tokens.typography.fontSize["2xl"]) * 1.25,
    marginBottom: toRN(tokens.spacing[2]),
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  featuredExcerpt: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: "rgba(255,255,255,0.85)",
    lineHeight: toRN(tokens.typography.fontSize.sm) * 1.5,
    marginBottom: toRN(tokens.spacing[3])
  },
  authorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const
  },
  authorInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)"
  },
  authorAvatarImage: {
    width: 32,
    height: 32
  },
  authorName: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },
  postDate: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: "rgba(255,255,255,0.7)"
  },
  readMore: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: toRN(tokens.borderRadius.full)
  },
  readMoreText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF"
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    letterSpacing: -0.3
  },
  sectionCount: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },

  // Grid View
  gridContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    paddingHorizontal: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  gridCardWrapper: {
    width: (SCREEN_WIDTH - 48) / 2
  },
  gridAdCard: {
    margin: 0,
    height: 180 // Match gridCardImage height
  },
  gridCard: {
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  gridCardImage: {
    height: 180,
    justifyContent: "flex-end" as const
  },
  gridCardImageStyle: {
    borderRadius: toRN(tokens.borderRadius.xl)
  },
  gridGradient: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  gridCardContent: {
    padding: toRN(tokens.spacing[3])
  },
  gridCardTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
    marginBottom: 4
  },
  gridCardMeta: {
    fontSize: 10,
    fontFamily: fontFamily.medium,
    color: "rgba(255,255,255,0.7)"
  },

  // List View
  listContainer: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3])
  },
  listCard: {
    flexDirection: "row" as const,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  listCardImage: {
    width: 110,
    height: 110
  },
  listCardImageStyle: {
    borderRadius: 0
  },
  listCategoryBadge: {
    position: "absolute" as const,
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4
  },
  listCategoryText: {
    fontSize: 9,
    fontFamily: fontFamily.semiBold,
    color: "#FFFFFF",
    textTransform: "uppercase" as const
  },
  listCardContent: {
    flex: 1,
    padding: toRN(tokens.spacing[3]),
    justifyContent: "space-between" as const
  },
  listCardTitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    lineHeight: toRN(tokens.typography.fontSize.base) * 1.35
  },
  listCardMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginTop: toRN(tokens.spacing[2])
  },
  listAuthorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    flex: 1
  },
  listAuthorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const
  },
  listAuthorAvatarImage: {
    width: 20,
    height: 20
  },
  listAuthorName: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    flex: 1
  },
  listMetaRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4
  },
  listMetaText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  listDate: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: 4
  },

  // Loading
  loadingContainer: {
    flex: 1,
    paddingTop: toRN(tokens.spacing[4])
  },
  listSkeletonRow: {
    flexDirection: "row" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[3]),
    gap: toRN(tokens.spacing[3])
  },
  listSkeletonContent: {
    flex: 1,
    justifyContent: "center" as const
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: toRN(tokens.spacing[16]),
    paddingHorizontal: toRN(tokens.spacing[8])
  },
  emptyTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginTop: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2])
  },
  emptyDescription: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const
  },
  clearFilterButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[2.5]),
    backgroundColor: `${brand.primary}10`,
    borderRadius: toRN(tokens.borderRadius.full),
    borderWidth: 1,
    borderColor: `${brand.primary}30`
  },
  clearFilterText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  }
});
