import React, { useState } from "react";
import { View, Text, Button, Alert, ScrollView } from "react-native";
import {
  // Services
  authService,
  userService,
  goalsService,
  checkInsService,
  socialService,
  // Hooks
  useLogin,
  useSignup,
  useCurrentUser,
  useGoals,
  useCreateGoal,
  useCheckIns,
  useCreateCheckIn,
  useFeed,
  useCreatePost,
} from "../../hooks/api";

/**
 * Example component showing the new modular API structure
 * This demonstrates how to use organized services and hooks
 */
export default function ModularApiExample() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth hooks
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const { data: currentUser } = useCurrentUser();

  // Goals hooks
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const createGoalMutation = useCreateGoal();

  // Check-ins hooks
  const { data: checkIns } = useCheckIns();
  const createCheckInMutation = useCreateCheckIn();

  // Social hooks
  const { data: feed } = useFeed();
  const createPostMutation = useCreatePost();

  // Direct service usage examples
  const handleDirectAuth = async () => {
    try {
      const response = await authService.login({ email, password });
      if (response.data) {
        Alert.alert("Success", `Logged in as ${response.data.user.name}`);
      } else {
        Alert.alert("Error", response.error || "Login failed");
      }
    } catch (error) {
      Alert.alert("Error", "Network error occurred");
    }
  };

  const handleDirectUser = async () => {
    try {
      const response = await userService.getCurrentUser();
      if (response.data) {
        Alert.alert(
          "User Info",
          `Name: ${response.data.name}\nPlan: ${response.data.plan}`
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get user");
    }
  };

  const handleDirectGoals = async () => {
    try {
      const response = await goalsService.getGoals();
      if (response.data) {
        Alert.alert("Goals", `You have ${response.data.length} goals`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get goals");
    }
  };

  const handleDirectCheckIns = async () => {
    try {
      const response = await checkInsService.getCheckIns();
      if (response.data) {
        Alert.alert("Check-ins", `You have ${response.data.length} check-ins`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get check-ins");
    }
  };

  const handleDirectSocial = async () => {
    try {
      const response = await socialService.getFeed();
      if (response.data) {
        Alert.alert("Feed", `Feed has ${response.data.length} posts`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get feed");
    }
  };

  // Hook-based examples
  const handleLoginWithHook = async () => {
    try {
      await loginMutation.mutateAsync({ email, password });
      Alert.alert("Success", "Logged in with React Query!");
    } catch (error) {
      Alert.alert("Error", "Login failed");
    }
  };

  const handleCreateGoalWithHook = async () => {
    try {
      await createGoalMutation.mutateAsync({
        title: "Daily Exercise",
        description: "30 minutes of cardio",
        category: "fitness",
        frequency: "daily",
        target_days: 7,
        reminder_times: ["07:00"],
        is_active: true,
      });
      Alert.alert("Success", "Goal created with React Query!");
    } catch (error) {
      Alert.alert("Error", "Failed to create goal");
    }
  };

  const handleCreateCheckInWithHook = async () => {
    if (!goals?.data?.[0]) {
      Alert.alert("Error", "No goals available");
      return;
    }

    try {
      await createCheckInMutation.mutateAsync({
        goal_id: goals.data[0].id,
        date: new Date().toISOString().split("T")[0],
        completed: true,
        reflection: "Great workout today!",
        mood: 5,
      });
      Alert.alert("Success", "Check-in created with React Query!");
    } catch (error) {
      Alert.alert("Error", "Failed to create check-in");
    }
  };

  const handleCreatePostWithHook = async () => {
    try {
      await createPostMutation.mutateAsync({
        content: "Just completed my daily workout! 💪 #fitness #motivation",
        is_public: true,
      });
      Alert.alert("Success", "Post created with React Query!");
    } catch (error) {
      Alert.alert("Error", "Failed to create post");
    }
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 20 }}>
        Modular API Examples
      </Text>

      {/* Direct Service Usage */}
      <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
        Direct Service Usage:
      </Text>

      <Button title="Direct Auth Service" onPress={handleDirectAuth} />
      <Button title="Direct User Service" onPress={handleDirectUser} />
      <Button title="Direct Goals Service" onPress={handleDirectGoals} />
      <Button title="Direct Check-ins Service" onPress={handleDirectCheckIns} />
      <Button title="Direct Social Service" onPress={handleDirectSocial} />

      {/* Hook-based Usage */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "bold",
          marginTop: 20,
          marginBottom: 10,
        }}
      >
        React Query Hooks:
      </Text>

      <Button
        title="Login with Hook"
        onPress={handleLoginWithHook}
        disabled={loginMutation.isPending}
      />

      <Button
        title="Create Goal with Hook"
        onPress={handleCreateGoalWithHook}
        disabled={createGoalMutation.isPending}
      />

      <Button
        title="Create Check-in with Hook"
        onPress={handleCreateCheckInWithHook}
        disabled={createCheckInMutation.isPending}
      />

      <Button
        title="Create Post with Hook"
        onPress={handleCreatePostWithHook}
        disabled={createPostMutation.isPending}
      />

      {/* Data Display */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "bold",
          marginTop: 20,
          marginBottom: 10,
        }}
      >
        Live Data:
      </Text>

      <Text style={{ marginBottom: 5 }}>
        User: {currentUser?.data?.name || "Not logged in"}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Goals: {goalsLoading ? "Loading..." : goals?.data?.length || 0}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Check-ins: {checkIns?.data?.length || 0}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Feed Posts: {feed?.data?.length || 0}
      </Text>

      {/* Status Indicators */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "bold",
          marginTop: 20,
          marginBottom: 10,
        }}
      >
        Status:
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Login:{" "}
        {loginMutation.isPending
          ? "Loading..."
          : loginMutation.isSuccess
            ? "Success"
            : loginMutation.isError
              ? "Error"
              : "Idle"}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Create Goal:{" "}
        {createGoalMutation.isPending
          ? "Loading..."
          : createGoalMutation.isSuccess
            ? "Success"
            : createGoalMutation.isError
              ? "Error"
              : "Idle"}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Create Check-in:{" "}
        {createCheckInMutation.isPending
          ? "Loading..."
          : createCheckInMutation.isSuccess
            ? "Success"
            : createCheckInMutation.isError
              ? "Error"
              : "Idle"}
      </Text>

      <Text style={{ marginBottom: 5 }}>
        Create Post:{" "}
        {createPostMutation.isPending
          ? "Loading..."
          : createPostMutation.isSuccess
            ? "Success"
            : createPostMutation.isError
              ? "Error"
              : "Idle"}
      </Text>
    </ScrollView>
  );
}
