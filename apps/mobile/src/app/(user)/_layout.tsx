import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { MOBILE_ROUTES } from "@/lib/routes";

export default function UserLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href={MOBILE_ROUTES.AUTH.LOGIN} />;
  }

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(onboarding)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(goals)"
          options={{
            headerShown: false,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
