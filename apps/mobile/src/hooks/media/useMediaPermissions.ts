import { useState, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";

export type MediaPermissionStatus = "undetermined" | "granted" | "denied";

export const useMediaPermissions = () => {
  const [cameraStatus, setCameraStatus] =
    useState<MediaPermissionStatus>("undetermined");
  const [libraryStatus, setLibraryStatus] =
    useState<MediaPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(false);

  const checkPermissions = useCallback(async () => {
    try {
      const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
      const libraryPermission =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      setCameraStatus(
        cameraPermission.granted
          ? "granted"
          : cameraPermission.canAskAgain
            ? "undetermined"
            : "denied",
      );

      setLibraryStatus(
        libraryPermission.granted
          ? "granted"
          : libraryPermission.canAskAgain
            ? "undetermined"
            : "denied",
      );
    } catch (error) {
      console.error("Error checking media permissions:", error);
    }
  }, []);

  useEffect(() => {
    // Initialize permission statuses
    checkPermissions();
  }, [checkPermissions]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === "granted";
      setCameraStatus(granted ? "granted" : "denied");
      return granted;
    } catch (error) {
      console.error("Failed to request camera permission:", error);
      setCameraStatus("denied");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestLibraryPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = status === "granted";
      setLibraryStatus(granted ? "granted" : "denied");
      return granted;
    } catch (error) {
      console.error("Failed to request library permission:", error);
      setLibraryStatus("denied");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const [cameraGranted, libraryGranted] = await Promise.all([
        requestCameraPermission(),
        requestLibraryPermission(),
      ]);
      return cameraGranted || libraryGranted; // At least one needs to be granted
    } catch (error) {
      console.error("Failed to request media permissions:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [requestCameraPermission, requestLibraryPermission]);

  const hasCameraPermission = cameraStatus === "granted";
  const hasLibraryPermission = libraryStatus === "granted";
  const hasAnyPermission = hasCameraPermission || hasLibraryPermission;
  const canAskCamera = cameraStatus === "undetermined";
  const canAskLibrary = libraryStatus === "undetermined";

  return {
    cameraStatus,
    libraryStatus,
    isLoading,
    hasCameraPermission,
    hasLibraryPermission,
    hasAnyPermission,
    canAskCamera,
    canAskLibrary,
    requestCameraPermission,
    requestLibraryPermission,
    requestAllPermissions,
    checkPermissions,
  };
};
