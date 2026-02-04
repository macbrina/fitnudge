"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@fitnudge/ui";
import {
  useSubscriptionPlansList,
  useSubscriptionPlanUpdate,
} from "@/hooks/api/useSubscriptionPlans";
import {
  usePlanFeaturesList,
  usePlanFeatureUpdate,
} from "@/hooks/api/usePlanFeatures";
import type { SubscriptionPlanItem, PlanFeatureItem } from "@/lib/api";
import { Skeleton } from "@fitnudge/ui";
import { Pencil, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export function SubscriptionPlansView() {
  const { t } = useTranslation();
  const { data: plansData, isLoading: plansLoading, error } = useSubscriptionPlansList();
  const updatePlanMutation = useSubscriptionPlanUpdate();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null);
  const [planForm, setPlanForm] = useState<Record<string, unknown>>({});

  const plans = plansData?.items ?? [];

  const openEditPlan = (plan: SubscriptionPlanItem) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      active_goal_limit: plan.active_goal_limit,
      product_id_ios_monthly: plan.product_id_ios_monthly ?? "",
      product_id_ios_annual: plan.product_id_ios_annual ?? "",
      product_id_android_monthly: plan.product_id_android_monthly ?? "",
      product_id_android_annual: plan.product_id_android_annual ?? "",
      exit_offer_enabled: plan.exit_offer_enabled,
      exit_offer_monthly_price: plan.exit_offer_monthly_price ?? "",
      exit_offer_annual_price: plan.exit_offer_annual_price ?? "",
    });
  };

  const closeEditPlan = () => {
    setEditingPlan(null);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    try {
      await updatePlanMutation.mutateAsync({
        id: editingPlan.id,
        payload: {
          name: String(planForm.name),
          description: planForm.description ? String(planForm.description) : null,
          monthly_price: Number(planForm.monthly_price),
          annual_price: Number(planForm.annual_price),
          active_goal_limit: Number(planForm.active_goal_limit),
          product_id_ios_monthly: planForm.product_id_ios_monthly
            ? String(planForm.product_id_ios_monthly)
            : null,
          product_id_ios_annual: planForm.product_id_ios_annual
            ? String(planForm.product_id_ios_annual)
            : null,
          product_id_android_monthly: planForm.product_id_android_monthly
            ? String(planForm.product_id_android_monthly)
            : null,
          product_id_android_annual: planForm.product_id_android_annual
            ? String(planForm.product_id_android_annual)
            : null,
          exit_offer_enabled: Boolean(planForm.exit_offer_enabled),
          exit_offer_monthly_price: planForm.exit_offer_monthly_price
            ? Number(planForm.exit_offer_monthly_price)
            : null,
          exit_offer_annual_price: planForm.exit_offer_annual_price
            ? Number(planForm.exit_offer_annual_price)
            : null,
        },
      });
      toast.success(t("admin.subscription_plans.saved"));
      closeEditPlan();
    } catch {
      toast.error(t("admin.subscription_plans.save_failed"));
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-gray-600 dark:text-gray-400">
        {t("admin.pages.subscription_plans_description")}
      </p>

      {plansLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="space-y-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isExpanded={selectedPlanId === plan.id}
              onToggle={() =>
                setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)
              }
              onEdit={() => openEditPlan(plan)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && closeEditPlan()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("admin.subscription_plans.edit")} {editingPlan?.name}
            </DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.name")}
                </label>
                <Input
                  value={String(planForm.name ?? "")}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.monthly_price")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={planForm.monthly_price ?? ""}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      monthly_price: e.target.value,
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.annual_price")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={planForm.annual_price ?? ""}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      annual_price: e.target.value,
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.active_goal_limit")}
                </label>
                <Input
                  type="number"
                  value={planForm.active_goal_limit ?? ""}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      active_goal_limit: e.target.value,
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.product_id_ios_monthly")}
                </label>
                <Input
                  value={String(planForm.product_id_ios_monthly ?? "")}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      product_id_ios_monthly: e.target.value,
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.subscription_plans.product_id_android_monthly")}
                </label>
                <Input
                  value={String(planForm.product_id_android_monthly ?? "")}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      product_id_android_monthly: e.target.value,
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="exit_offer"
                  checked={Boolean(planForm.exit_offer_enabled)}
                  onChange={(e) =>
                    setPlanForm((f) => ({
                      ...f,
                      exit_offer_enabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="exit_offer" className="text-sm">
                  {t("admin.subscription_plans.exit_offer_enabled")}
                </label>
              </div>
              {planForm.exit_offer_enabled && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {t("admin.subscription_plans.exit_offer_monthly_price")}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planForm.exit_offer_monthly_price ?? ""}
                      onChange={(e) =>
                        setPlanForm((f) => ({
                          ...f,
                          exit_offer_monthly_price: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {t("admin.subscription_plans.exit_offer_annual_price")}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planForm.exit_offer_annual_price ?? ""}
                      onChange={(e) =>
                        setPlanForm((f) => ({
                          ...f,
                          exit_offer_annual_price: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditPlan}>
              <X className="h-4 w-4" />
              {t("admin.app_config.cancel")}
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={updatePlanMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {updatePlanMutation.isPending
                ? t("admin.app_config.saving")
                : t("admin.app_config.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanCard({
  plan,
  isExpanded,
  onToggle,
  onEdit,
}: {
  plan: SubscriptionPlanItem;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { data: featuresData, isLoading: featuresLoading } = usePlanFeaturesList(
    plan.id,
    isExpanded
  );
  const updateFeatureMutation = usePlanFeatureUpdate();
  const features = featuresData?.items ?? [];

  const handleToggleFeature = async (feature: PlanFeatureItem) => {
    try {
      await updateFeatureMutation.mutateAsync({
        id: feature.id,
        planId: plan.id,
        payload: { is_enabled: !feature.is_enabled },
      });
      toast.success(t("admin.plan_features.updated"));
    } catch {
      toast.error(t("admin.plan_features.update_failed"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <CardTitle>{plan.name}</CardTitle>
          <span className="text-sm font-normal text-gray-500">
            ${plan.monthly_price}/mo · {plan.active_goal_limit} goals
          </span>
        </button>
        <Button variant="ghost" size="icon-sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {featuresLoading ? (
            <Skeleton className="h-32 w-full rounded" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.plan_features.feature_key")}</TableHead>
                  <TableHead>{t("admin.plan_features.feature_name")}</TableHead>
                  <TableHead>{t("admin.plan_features.feature_value")}</TableHead>
                  <TableHead>{t("admin.plan_features.is_enabled")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-sm">
                      {f.feature_key}
                    </TableCell>
                    <TableCell>{f.feature_name}</TableCell>
                    <TableCell>{f.feature_value ?? "—"}</TableCell>
                    <TableCell>{f.is_enabled ? "✓" : "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFeature(f)}
                        disabled={updateFeatureMutation.isPending}
                      >
                        {f.is_enabled
                          ? t("admin.plan_features.disable")
                          : t("admin.plan_features.enable")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
