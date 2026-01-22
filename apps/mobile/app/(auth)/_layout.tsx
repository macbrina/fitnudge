import { useAuthStore } from "@/stores/authStore";
import { Stack, Redirect } from "expo-router";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Redirect authenticated users to home
  if (!isLoading && isAuthenticated) {
    return <Redirect href={MOBILE_ROUTES.MAIN.HOME} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: "Login"
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: "Sign Up"
        }}
      />
      <Stack.Screen
        name="auth"
        options={{
          title: "Auth"
        }}
      />
    </Stack>
  );
}
