import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  socialService,
  CreatePostRequest,
  CreateCommentRequest,
  UserProfile,
} from "@/services/api";

// Query Keys
export const socialQueryKeys = {
  feed: ["social", "feed"] as const,
  posts: {
    all: ["social", "posts"] as const,
    detail: (id: string) => ["social", "posts", "detail", id] as const,
    byUser: (userId: string) => ["social", "posts", "user", userId] as const,
    search: (query: string) => ["social", "posts", "search", query] as const,
    trending: () => ["social", "posts", "trending"] as const,
  },
  comments: (postId: string) => ["social", "comments", postId] as const,
  users: {
    profile: (id: string) => ["social", "users", "profile", id] as const,
    followers: (id: string) => ["social", "users", "followers", id] as const,
    following: (id: string) => ["social", "users", "following", id] as const,
    search: (query: string) => ["social", "users", "search", query] as const,
  },
  hashtags: {
    trending: () => ["social", "hashtags", "trending"] as const,
  },
  notifications: ["social", "notifications"] as const,
} as const;

// Social Hooks
export const useFeed = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.feed, page, limit],
    queryFn: () => socialService.getFeed(page, limit),
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const usePost = (postId: string) => {
  return useQuery({
    queryKey: socialQueryKeys.posts.detail(postId),
    queryFn: () => socialService.getPost(postId),
    enabled: !!postId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: CreatePostRequest) => socialService.createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.feed });
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.posts.all });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.feed });
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.posts.all });
    },
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.likePost(postId),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.feed });
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.posts.detail(postId),
      });
    },
  });
};

export const useUnlikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.unlikePost(postId),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.feed });
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.posts.detail(postId),
      });
    },
  });
};

export const useComments = (
  postId: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.comments(postId), page, limit],
    queryFn: () => socialService.getComments(postId, page, limit),
    enabled: !!postId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: CreateCommentRequest) =>
      socialService.createComment(comment),
    onSuccess: (_, { post_id }) => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.comments(post_id),
      });
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.posts.detail(post_id),
      });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => socialService.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "comments"] });
    },
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => socialService.followUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.users.profile(userId),
      });
      queryClient.invalidateQueries({
        queryKey: ["social", "users", "followers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["social", "users", "following"],
      });
    },
  });
};

export const useUnfollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => socialService.unfollowUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.users.profile(userId),
      });
      queryClient.invalidateQueries({
        queryKey: ["social", "users", "followers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["social", "users", "following"],
      });
    },
  });
};

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: socialQueryKeys.users.profile(userId),
    queryFn: () => socialService.getUserProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUserPosts = (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.posts.byUser(userId), page, limit],
    queryFn: () => socialService.getUserPosts(userId, page, limit),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useFollowers = (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.followers(userId), page, limit],
    queryFn: () => socialService.getFollowers(userId, page, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useFollowing = (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.following(userId), page, limit],
    queryFn: () => socialService.getFollowing(userId, page, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSearchUsers = (
  query: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.search(query), page, limit],
    queryFn: () => socialService.searchUsers(query, page, limit),
    enabled: !!query && query.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useSearchPosts = (
  query: string,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: [...socialQueryKeys.posts.search(query), page, limit],
    queryFn: () => socialService.searchPosts(query, page, limit),
    enabled: !!query && query.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useTrendingPosts = () => {
  return useQuery({
    queryKey: socialQueryKeys.posts.trending(),
    queryFn: () => socialService.getTrendingPosts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTrendingHashtags = () => {
  return useQuery({
    queryKey: socialQueryKeys.hashtags.trending(),
    queryFn: () => socialService.getTrendingHashtags(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useNotifications = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.notifications, page, limit],
    queryFn: () => socialService.getNotifications(page, limit),
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      socialService.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.notifications,
      });
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => socialService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.notifications,
      });
    },
  });
};
