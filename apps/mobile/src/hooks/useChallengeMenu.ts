import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { MOBILE_ROUTES } from "@/lib/routes";
import { Challenge } from "@/services/api/challenges";
import { useLeaveChallenge } from "@/hooks/api/useChallenges";
import { BottomMenuSection } from "@/components/ui/BottomMenuSheet";

interface UseChallengeMenuOptions {
  challenge: Challenge;
  onClose: () => void;
  onLeft?: () => void;
  onCancelled?: () => void;
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
  isDetailScreen = false,
}: UseChallengeMenuOptions) {
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const leaveChallenge = useLeaveChallenge();

  // Determine challenge status
  const isCreator = challenge.is_creator === true;
  const isParticipant = challenge.is_participant === true;
  const isCompleted = challenge.status === "completed";
  const isCancelled = challenge.status === "cancelled";
  const isActive =
    challenge.status === "active" || challenge.is_active === true;
  const isUpcoming = challenge.status === "upcoming";

  const handleLeave = async () => {
    const confirmed = await showConfirm({
      title: t("challenges.leave_title") || "Leave Challenge?",
      message:
        t("challenges.leave_confirm") ||
        "Are you sure you want to leave this challenge?",
      showCancel: true,
    });
    if (!confirmed) return;

    try {
      await leaveChallenge.mutateAsync(challenge.id);
      showToast({
        title: t("common.success"),
        message: t("challenges.leave_success") || "You have left the challenge",
        variant: "success",
      });
      onLeft?.();
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message: t("challenges.leave_error") || "Failed to leave challenge",
        variant: "error",
      });
    }
  };

  const handleCancel = async () => {
    // TODO: Implement cancel challenge API
    showAlert({
      title: t("common.coming_soon") || "Coming Soon",
      message:
        t("challenges.cancel_coming_soon") ||
        "Cancel functionality coming soon",
    });
  };

  const handleDelete = async () => {
    // TODO: Implement delete challenge API
    showAlert({
      title: t("common.coming_soon") || "Coming Soon",
      message:
        t("challenges.delete_coming_soon") ||
        "Delete functionality coming soon",
    });
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
          },
        },
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
        },
      },
    ];

    // Add invite option for participants/creators
    if (isParticipant || isCreator) {
      secondaryOptions.push({
        id: "invite",
        label: t("challenges.invite_users") || "Invite Users",
        icon: "person-add-outline",
        onPress: handleInvite,
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
            destructive: true,
          },
        ],
      });
    }

    // Creator actions
    if (isCreator && !isCompleted && !isCancelled) {
      const creatorOptions: BottomMenuSection["options"] = [];

      // Cancel option (for active/upcoming challenges)
      if (isActive || isUpcoming) {
        creatorOptions.push({
          id: "cancel",
          label: t("challenges.cancel") || "Cancel Challenge",
          icon: "close-circle-outline",
          description:
            t("challenges.cancel_desc") || "End the challenge for everyone",
          onPress: () => {
            onClose();
            handleCancel();
          },
          destructive: true,
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
    handleDelete,
    handleInvite,
    isLeaving: leaveChallenge.isPending,
  };
}
