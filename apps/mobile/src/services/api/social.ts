import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// Social Types
export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type: "text" | "image" | "voice" | "video";
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
  is_liked?: boolean;
}

export interface CreatePostRequest {
  content: string;
  media_url?: string;
  media_type?: "text" | "image" | "voice" | "video";
  is_public?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
}

export interface CreateCommentRequest {
  post_id: string;
  content: string;
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  bio?: string;
  profile_picture_url?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following?: boolean;
  created_at: string;
}

export interface FollowRequest {
  user_id: string;
}

// Social Service
export class SocialService extends BaseApiService {
  // Posts
  async getFeed(
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<Post[]>> {
    return this.get<Post[]>(
      `${ROUTES.SOCIAL.FEED}?page=${page}&limit=${limit}`,
    );
  }

  async getPost(postId: string): Promise<ApiResponse<Post>> {
    return this.get<Post>(ROUTES.SOCIAL.POSTS.GET(postId));
  }

  async createPost(post: CreatePostRequest): Promise<ApiResponse<Post>> {
    return this.post<Post>(ROUTES.SOCIAL.POSTS.CREATE, post);
  }

  async deletePost(postId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.SOCIAL.POSTS.DELETE(postId));
  }

  async likePost(postId: string): Promise<ApiResponse> {
    return this.post(ROUTES.SOCIAL.POSTS.LIKE(postId), {});
  }

  async unlikePost(postId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.SOCIAL.POSTS.UNLIKE(postId));
  }

  // Comments
  async getComments(
    postId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<Comment[]>> {
    return this.get<Comment[]>(
      `${ROUTES.SOCIAL.POSTS.COMMENTS(postId)}?page=${page}&limit=${limit}`,
    );
  }

  async createComment(
    comment: CreateCommentRequest,
  ): Promise<ApiResponse<Comment>> {
    return this.post<Comment>(
      ROUTES.SOCIAL.POSTS.CREATE_COMMENT(comment.post_id),
      {
        content: comment.content,
      },
    );
  }

  async deleteComment(commentId: string): Promise<ApiResponse> {
    return this.delete(`/comments/${commentId}`);
  }

  // User following
  async followUser(userId: string): Promise<ApiResponse> {
    return this.post(ROUTES.SOCIAL.USERS.FOLLOW(userId), {});
  }

  async unfollowUser(userId: string): Promise<ApiResponse> {
    return this.delete(ROUTES.SOCIAL.USERS.UNFOLLOW(userId));
  }

  async getFollowers(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<UserProfile[]>> {
    return this.get<UserProfile[]>(
      `${ROUTES.SOCIAL.USERS.FOLLOWERS(userId)}?page=${page}&limit=${limit}`,
    );
  }

  async getFollowing(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<UserProfile[]>> {
    return this.get<UserProfile[]>(
      `${ROUTES.SOCIAL.USERS.FOLLOWING(userId)}?page=${page}&limit=${limit}`,
    );
  }

  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return this.get<UserProfile>(ROUTES.USERS.GET_PROFILE(userId));
  }

  async getUserPosts(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<Post[]>> {
    return this.get<Post[]>(
      `${ROUTES.USERS.GET(userId)}/posts?page=${page}&limit=${limit}`,
    );
  }

  // Search
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<UserProfile[]>> {
    return this.get<UserProfile[]>(
      `${ROUTES.SOCIAL.SEARCH.USERS}?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    );
  }

  async searchPosts(
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<Post[]>> {
    return this.get<Post[]>(
      `${ROUTES.SOCIAL.SEARCH.POSTS}?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    );
  }

  // Trending
  async getTrendingPosts(): Promise<ApiResponse<Post[]>> {
    return this.get<Post[]>(ROUTES.SOCIAL.TRENDING.POSTS);
  }

  async getTrendingHashtags(): Promise<
    ApiResponse<{ hashtag: string; count: number }[]>
  > {
    return this.get<{ hashtag: string; count: number }[]>(
      ROUTES.SOCIAL.TRENDING.HASHTAGS,
    );
  }

  // Notifications
  async getNotifications(
    page: number = 1,
    limit: number = 20,
  ): Promise<
    ApiResponse<
      {
        id: string;
        type: "like" | "comment" | "follow" | "mention";
        message: string;
        is_read: boolean;
        created_at: string;
        user?: UserProfile;
        post?: Post;
      }[]
    >
  > {
    return this.get(
      `${ROUTES.SOCIAL.NOTIFICATIONS}?page=${page}&limit=${limit}`,
    );
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiResponse> {
    return this.put(ROUTES.SOCIAL.NOTIFICATION_READ(notificationId), {});
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse> {
    return this.put(ROUTES.SOCIAL.NOTIFICATION_READ_ALL, {});
  }
}

// Export singleton instance
export const socialService = new SocialService();
