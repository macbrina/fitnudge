import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  socialService,
  CreatePostRequest,
  CreateCommentRequest,
  UserProfile
} from "@/services/api";

// Query Keys
export const socialQueryKeys = {
  feed: ["social", "feed"] as const,
  posts: {
    all: ["social", "posts"] as const,
    detail: (id: string) => ["social", "posts", "detail", id] as const,
    byUser: (userId: string) => ["social", "posts", "user", userId] as const,
    search: (query: string) => ["social", "posts", "search", query] as const,
    trending: () => ["social", "posts", "trending"] as const
  },
  comments: (postId: string) => ["social", "comments", postId] as const,
  users: {
    profile: (id: string) => ["social", "users", "profile", id] as const,
    followers: (id: string) => ["social", "users", "followers", id] as const,
    following: (id: string) => ["social", "users", "following", id] as const,
    search: (query: string) => ["social", "users", "search", query] as const
  },
  hashtags: {
    trending: () => ["social", "hashtags", "trending"] as const
  },
  notifications: ["social", "notifications"] as const
} as const;

// Social Hooks
export const useFeed = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.feed, page, limit],
    queryFn: () => socialService.getFeed(page, limit),
    staleTime: 30 * 1000 // 30 seconds
  });
};

export const usePost = (postId: string) => {
  return useQuery({
    queryKey: socialQueryKeys.posts.detail(postId),
    queryFn: () => socialService.getPost(postId),
    enabled: !!postId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: CreatePostRequest) => socialService.createPost(post),
    // Optimistic update - add to feed instantly
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: socialQueryKeys.feed });

      const previousFeed = queryClient.getQueryData(socialQueryKeys.feed);

      // Create optimistic post
      const optimisticPost = {
        id: `temp-${Date.now()}`,
        ...newPost,
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        is_liked: false
      };

      // Prepend to feed
      queryClient.setQueryData(socialQueryKeys.feed, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [optimisticPost, ...old.data] };
      });

      return { previousFeed };
    },
    onError: (err, newPost, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(socialQueryKeys.feed, context.previousFeed);
      }
    },
    onSuccess: (response) => {
      const realPost = response?.data;
      if (realPost) {
        queryClient.setQueryData(socialQueryKeys.feed, (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter((p: any) => !p.id?.startsWith?.("temp-"));
          return { ...old, data: [realPost, ...filtered] };
        });
      }
    }
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.deletePost(postId),
    // Optimistic update - remove from feed instantly
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: socialQueryKeys.feed });

      const previousFeed = queryClient.getQueryData(socialQueryKeys.feed);

      queryClient.setQueryData(socialQueryKeys.feed, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((p: any) => p.id !== postId) };
      });

      return { previousFeed };
    },
    onError: (err, postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(socialQueryKeys.feed, context.previousFeed);
      }
    }
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.likePost(postId),
    // Optimistic update - toggle like instantly
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: socialQueryKeys.feed });
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.posts.detail(postId)
      });

      const previousFeed = queryClient.getQueryData(socialQueryKeys.feed);
      const previousPost = queryClient.getQueryData(socialQueryKeys.posts.detail(postId));

      // Update in feed
      queryClient.setQueryData(socialQueryKeys.feed, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: any) =>
            p.id === postId ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 } : p
          )
        };
      });

      // Update post detail
      queryClient.setQueryData(socialQueryKeys.posts.detail(postId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            is_liked: true,
            likes_count: (old.data.likes_count || 0) + 1
          }
        };
      });

      return { previousFeed, previousPost };
    },
    onError: (err, postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(socialQueryKeys.feed, context.previousFeed);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(socialQueryKeys.posts.detail(postId), context.previousPost);
      }
    }
  });
};

export const useUnlikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => socialService.unlikePost(postId),
    // Optimistic update - toggle unlike instantly
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: socialQueryKeys.feed });
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.posts.detail(postId)
      });

      const previousFeed = queryClient.getQueryData(socialQueryKeys.feed);
      const previousPost = queryClient.getQueryData(socialQueryKeys.posts.detail(postId));

      // Update in feed
      queryClient.setQueryData(socialQueryKeys.feed, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: any) =>
            p.id === postId
              ? {
                  ...p,
                  is_liked: false,
                  likes_count: Math.max(0, (p.likes_count || 0) - 1)
                }
              : p
          )
        };
      });

      // Update post detail
      queryClient.setQueryData(socialQueryKeys.posts.detail(postId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            is_liked: false,
            likes_count: Math.max(0, (old.data.likes_count || 0) - 1)
          }
        };
      });

      return { previousFeed, previousPost };
    },
    onError: (err, postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(socialQueryKeys.feed, context.previousFeed);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(socialQueryKeys.posts.detail(postId), context.previousPost);
      }
    }
  });
};

export const useComments = (postId: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.comments(postId), page, limit],
    queryFn: () => socialService.getComments(postId, page, limit),
    enabled: !!postId,
    staleTime: 1 * 60 * 1000 // 1 minute
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: CreateCommentRequest) => socialService.createComment(comment),
    // Optimistic update - add comment instantly
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.comments(newComment.post_id)
      });

      const previousComments = queryClient.getQueryData(
        socialQueryKeys.comments(newComment.post_id)
      );

      // Create optimistic comment
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        ...newComment,
        created_at: new Date().toISOString()
      };

      // Add to comments
      queryClient.setQueryData(socialQueryKeys.comments(newComment.post_id), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: [...old.data, optimisticComment] };
      });

      // Increment comment count on post
      queryClient.setQueryData(socialQueryKeys.posts.detail(newComment.post_id), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            comments_count: (old.data.comments_count || 0) + 1
          }
        };
      });

      return { previousComments, postId: newComment.post_id };
    },
    onError: (err, newComment, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          socialQueryKeys.comments(newComment.post_id),
          context.previousComments
        );
      }
    },
    onSuccess: (response, { post_id }) => {
      const realComment = response?.data;
      if (realComment) {
        queryClient.setQueryData(socialQueryKeys.comments(post_id), (old: any) => {
          if (!old?.data) return old;
          const filtered = old.data.filter((c: any) => !c.id?.startsWith?.("temp-"));
          return { ...old, data: [...filtered, realComment] };
        });
      }
    }
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, postId }: { commentId: string; postId: string }) =>
      socialService.deleteComment(commentId),
    // Optimistic update - remove comment instantly
    onMutate: async ({ commentId, postId }) => {
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.comments(postId)
      });

      const previousComments = queryClient.getQueryData(socialQueryKeys.comments(postId));

      // Remove from comments
      queryClient.setQueryData(socialQueryKeys.comments(postId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c: any) => c.id !== commentId)
        };
      });

      // Decrement comment count on post
      queryClient.setQueryData(socialQueryKeys.posts.detail(postId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            comments_count: Math.max(0, (old.data.comments_count || 0) - 1)
          }
        };
      });

      return { previousComments, postId };
    },
    onError: (err, { postId }, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(socialQueryKeys.comments(postId), context.previousComments);
      }
    }
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => socialService.followUser(userId),
    // Optimistic update - toggle follow instantly
    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.users.profile(userId)
      });

      const previousProfile = queryClient.getQueryData(socialQueryKeys.users.profile(userId));

      // Update profile
      queryClient.setQueryData(socialQueryKeys.users.profile(userId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            is_following: true,
            followers_count: (old.data.followers_count || 0) + 1
          }
        };
      });

      return { previousProfile };
    },
    onError: (err, userId, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(socialQueryKeys.users.profile(userId), context.previousProfile);
      }
    }
  });
};

export const useUnfollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => socialService.unfollowUser(userId),
    // Optimistic update - toggle unfollow instantly
    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: socialQueryKeys.users.profile(userId)
      });

      const previousProfile = queryClient.getQueryData(socialQueryKeys.users.profile(userId));

      // Update profile
      queryClient.setQueryData(socialQueryKeys.users.profile(userId), (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            is_following: false,
            followers_count: Math.max(0, (old.data.followers_count || 0) - 1)
          }
        };
      });

      return { previousProfile };
    },
    onError: (err, userId, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(socialQueryKeys.users.profile(userId), context.previousProfile);
      }
    }
  });
};

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: socialQueryKeys.users.profile(userId),
    queryFn: () => socialService.getUserProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useUserPosts = (userId: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.posts.byUser(userId), page, limit],
    queryFn: () => socialService.getUserPosts(userId, page, limit),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

export const useFollowers = (userId: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.followers(userId), page, limit],
    queryFn: () => socialService.getFollowers(userId, page, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useFollowing = (userId: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.following(userId), page, limit],
    queryFn: () => socialService.getFollowing(userId, page, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useSearchUsers = (query: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.users.search(query), page, limit],
    queryFn: () => socialService.searchUsers(query, page, limit),
    enabled: !!query && query.length > 2,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

export const useSearchPosts = (query: string, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.posts.search(query), page, limit],
    queryFn: () => socialService.searchPosts(query, page, limit),
    enabled: !!query && query.length > 2,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};

export const useTrendingPosts = () => {
  return useQuery({
    queryKey: socialQueryKeys.posts.trending(),
    queryFn: () => socialService.getTrendingPosts(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTrendingHashtags = () => {
  return useQuery({
    queryKey: socialQueryKeys.hashtags.trending(),
    queryFn: () => socialService.getTrendingHashtags(),
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
};

export const useNotifications = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: [...socialQueryKeys.notifications, page, limit],
    queryFn: () => socialService.getNotifications(page, limit),
    staleTime: 30 * 1000 // 30 seconds
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => socialService.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.notifications
      });
    }
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => socialService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialQueryKeys.notifications
      });
    }
  });
};
