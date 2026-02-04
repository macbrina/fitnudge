"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";
import { Loading } from "@/components/Loading";

export function HomeView() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN);
  }, [isAuthenticated, isLoading, router]);

  return <Loading variant="page" />;
}
