import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Challenge } from "@/services/api/challenges";
import { useLeaveChallenge, useCancelChallenge } from "@/hooks/api/useChallenges";
import { BottomMenuSection } from "@/components/ui/BottomMenuSheet";

interface UseChallengeMenuOptions {
  challenge: Challenge;
  onClose: () => void;
  onLeft?: () => void;
  onCancelled?: () => void;
  /** Callback when edit is requested (for opening edit modal) */
  onEdit?: () => void;
  /** Whether we're on the detail screen (skip "View Details" option) */
  isDetailScreen?: boolean;
}

/**
 * Shared hook for building challenge menu sections
 * Used in ChallengeCard and ChallengeDetailScreen
 */
export function useChallengeMenu({
  challenge,
  onClose,
  onLeft,
  onCancelled,
  onEdit,
  isDetailScreen = false
}: UseChallengeMenuOptions) {
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const leaveChallenge = useLeaveChallenge();
  const cancelChallenge = useCancelChallenge();

  // Determine challenge status
  const isCreator = challenge.is_creator === true;
  const isParticipant = challenge.is_participant === true;
  const isCompleted = challenge.status === "completed";
  const isCancelled = challenge.status === "cancelled";
  const isActive = challenge.status === "active";
  const isUpcoming = challenge.status === "upcoming";

  // Check if join deadline is still valid (for invites)
  const isJoinDeadlineValid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use join_deadline if set, otherwise use start_date
    const deadlineStr = challenge.join_deadline || challenge.start_date;
    if (!deadlineStr) return false;

    const deadline = new Date(deadlineStr);
    deadline.setHours(23, 59, 59, 999); // End of day

    return deadline >= today;
  }, [challenge.join_deadline, challenge.start_date]);

  const handleLeave = async () => {
    const confirmed = await showConfirm({
      title: t("challenges.leave_title") || "Leave Challenge?",
      message: t("challenges.leave_confirm") || "Are you sure you want to leave this challenge?",
      showCancel: true
    });
    if (!confirmed) return;

    try {
      await leaveChallenge.mutateAsync(challenge.id);
      showToast({
        title: t("common.success"),
        message: t("challenges.leave_success") || "You have left the challenge",
        variant: "success"
      });
      onLeft?.();
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("challenges.leave_error") || "Failed to leave challenge",
        variant: "error"
      });
    }
  };

  const handleCancel = async () => {
    const participantCount = challenge.participants_count || 0;
    const confirmMessage =
      participantCount > 0
        ? t("challenges.cancel_confirm_with_participants", {
            count: participantCount
          }) ||
          `This will end the challenge for all ${participantCount} participant(s). This action cannot be undone.`
        : t("challenges.cancel_confirm") ||
          "Are you sure you want to cancel this challenge? This action cannot be undone.";

    const confirmed = await showConfirm({
      title: t("challenges.cancel_title") || "Cancel Challenge?",
      message: confirmMessage,
      variant: "error",
      confirmLabel: t("challenges.cancel_confirm_button") || "Cancel Challenge",
      cancelLabel: t("common.nevermind") || "Nevermind",
      showCancel: true
    });

    if (!confirmed) return;

    try {
      await cancelChallenge.mutateAsync({ challengeId: challenge.id });
      showToast({
        title: t("common.success"),
        message: t("challenges.cancel_success") || "Challenge has been cancelled",
        variant: "success"
      });
      onCancelled?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        t("challenges.cancel_error") ||
        "Failed to cancel challenge";
      showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    }
  };

  const handleInvite = () => {
    onClose();
    router.push(MOBILE_ROUTES.CHALLENGES.INVITE_USERS(challenge.id));
  };

  // Build menu sections
  const buildMenuSections = (): BottomMenuSection[] => {
    const sections: BottomMenuSection[] = [];

    // Primary actions (only if not on detail screen)
    if (!isDetailScreen) {
      const primaryOptions: BottomMenuSection["options"] = [
        {
          id: "view-details",
          label: t("challenges.view_details") || "View Details",
          icon: "eye-outline",
          onPress: () => {
            onClose();
            router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(challenge.id));
          }
        }
      ];

      sections.push({ id: "primary", options: primaryOptions });
    }

    // Leaderboard & Invite actions
    const secondaryOptions: BottomMenuSection["options"] = [
      {
        id: "view-leaderboard",
        label: t("challenges.view_leaderboard") || "View Leaderboard",
        icon: "trophy-outline",
        onPress: () => {
          onClose();
          router.push(MOBILE_ROUTES.CHALLENGES.LEADERBOARD(challenge.id));
        }
      }
    ];

    // Add invite option for participants/creators only if join deadline hasn't passed
    // and challenge is still active or upcoming
    const canInvite =
      (isParticipant || isCreator) && isJoinDeadlineValid && (isActive || isUpcoming);

    if (canInvite) {
      secondaryOptions.push({
        id: "invite",
        label: t("challenges.invite_users") || "Invite Users",
        icon: "person-add-outline",
        onPress: handleInvite
      });
    }

    sections.push({ id: "secondary", options: secondaryOptions });

    // Participation actions (leave for non-creators)
    if (!isCreator && isParticipant && !isCompleted && !isCancelled) {
      sections.push({
        id: "participation",
        options: [
          {
            id: "leave",
            label: t("challenges.leave") || "Leave Challenge",
            icon: "exit-outline",
            onPress: () => {
              onClose();
              handleLeave();
            },
            destructive: true
          }
        ]
      });
    }

    // Creator actions
    if (isCreator && !isCompleted && !isCancelled) {
      const creatorOptions: BottomMenuSection["options"] = [];

      // Edit option (only for upcoming challenges)
      if (isUpcoming && onEdit) {
        creatorOptions.push({
          id: "edit",
          label: t("challenges.edit_challenge") || "Edit Challenge",
          icon: "create-outline",
          description:
            t("challenges.edit_challenge_desc") ||
            "Edit title, description, deadline, or participants",
          onPress: () => {
            onClose();
            onEdit();
          }
        });
      }

      // Cancel option (for active/upcoming challenges)
      if (isActive || isUpcoming) {
        creatorOptions.push({
          id: "cancel",
          label: t("challenges.cancel") || "Cancel Challenge",
          icon: "close-circle-outline",
          description: t("challenges.cancel_desc") || "End the challenge for everyone",
          onPress: () => {
            onClose();
            handleCancel();
          },
          destructive: true
        });
      }

      if (creatorOptions.length > 0) {
        sections.push({ id: "creator", options: creatorOptions });
      }
    }

    return sections;
  };

  return {
    menuSections: buildMenuSections(),
    handleLeave,
    handleCancel,
    handleInvite,
    isLeaving: leaveChallenge.isPending,
    isCancelling: cancelChallenge.isPending,
    isJoinDeadlineValid
  };
}
