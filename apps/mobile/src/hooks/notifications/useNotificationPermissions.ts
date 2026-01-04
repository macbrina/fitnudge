import { useState, useEffect, useCallback } from "react";
import { notificationService } from "@/services/notifications/notificationService";
import { PermissionStatus } from "@/services/notifications/notificationTypes";

export const useNotificationPermissions = () => {
  const [status, setStatus] = useState<PermissionStatus>("undetermined");
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize permission status
    const currentStatus = notificationService.getPermissionStatus();
    setStatus(currentStatus);

    // Check if we should show soft prompt
    if (currentStatus === "undetermined") {
      setShowSoftPrompt(true);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);
    try {
      const newStatus = await notificationService.requestPermissions();
      setStatus(newStatus);
      setShowSoftPrompt(false);
      return newStatus;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      setStatus("denied");
      setShowSoftPrompt(false);
      return "denied";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermissionsWithSoftPrompt = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const newStatus = await notificationService.requestPermissions();
      setStatus(newStatus);
      setShowSoftPrompt(false);
      return newStatus === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      setStatus("denied");
      setShowSoftPrompt(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermissionDirectly = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);
    try {
      const newStatus = await notificationService.requestPermissions();
      setStatus(newStatus);
      setShowSoftPrompt(false);
      return newStatus;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      setStatus("denied");
      setShowSoftPrompt(false);
      return "denied";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hideSoftPrompt = useCallback(() => {
    setShowSoftPrompt(false);
  }, []);

  const showSoftPromptAgain = useCallback(() => {
    setShowSoftPrompt(true);
  }, []);

  const isGranted = status === "granted";
  const isDenied = status === "denied";
  const isUndetermined = status === "undetermined";
  const isProvisional = status === "provisional";

  return {
    status,
    showSoftPrompt,
    isLoading,
    isGranted,
    isDenied,
    isUndetermined,
    isProvisional,
    requestPermission,
    requestPermissionsWithSoftPrompt,
    requestPermissionDirectly,
    hideSoftPrompt,
    showSoftPromptAgain
  };
};
