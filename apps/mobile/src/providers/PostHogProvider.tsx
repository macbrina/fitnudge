import React, { useEffect } from "react";
import { PostHogProvider as PostHogProviderBase } from "posthog-react-native";
import { useAuthStore } from "@/stores/authStore";
import { posthog, identifyUser, resetUser } from "@/lib/posthog";

interface PostHogProviderProps {
  children: React.ReactNode;
}

export const PostHogProvider: React.FC<PostHogProviderProps> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuthStore();

  // Handle user identification when auth state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      // Identify user with PostHog
      identifyUser(user.id, {
        email: user.email,
        username: user.username,
        created_at: user.created_at,
        // Add any other user properties you want to track
      });
    } else if (!isAuthenticated) {
      // Reset user when logged out
      resetUser();
    }
  }, [isAuthenticated, user]);

  return <PostHogProviderBase client={posthog}>{children}</PostHogProviderBase>;
};

export default PostHogProvider;
