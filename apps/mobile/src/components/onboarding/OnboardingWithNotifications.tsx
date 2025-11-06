import React, { useState } from "react";
import { OnboardingCarousel } from "./OnboardingCarousel";
import { NotificationPermissionModal } from "../notifications/NotificationPermissionModal";
import { useNotificationPermissions } from "@/hooks/notifications/useNotificationPermissions";

interface OnboardingWithNotificationsProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingWithNotifications: React.FC<
  OnboardingWithNotificationsProps
> = ({ onComplete, onSkip }) => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const { showSoftPrompt, requestPermissionDirectly, hideSoftPrompt } =
    useNotificationPermissions();

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // The notification permission modal will be shown automatically
    // if showSoftPrompt is true
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    onSkip();
  };

  const handleNotificationAccept = async () => {
    await requestPermissionDirectly();
    hideSoftPrompt();
    onComplete();
  };

  const handleNotificationDecline = () => {
    hideSoftPrompt();
    onComplete();
  };

  const handleNotificationMaybeLater = () => {
    hideSoftPrompt();
    onComplete();
  };

  if (showOnboarding) {
    return (
      <OnboardingCarousel
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  return (
    <NotificationPermissionModal
      visible={showSoftPrompt}
      onAccept={handleNotificationAccept}
      onDecline={handleNotificationDecline}
      onMaybeLater={handleNotificationMaybeLater}
    />
  );
};
