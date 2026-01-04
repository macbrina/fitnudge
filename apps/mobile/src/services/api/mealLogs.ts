import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type HealthRating = "healthy" | "okay" | "unhealthy";

export interface MealLog {
  id: string;
  user_id: string;
  goal_id?: string;
  challenge_id?: string;
  meal_type: MealType;
  meal_name?: string;
  meal_description?: string;
  logged_date: string;
  logged_time?: string;
  estimated_protein?: number;
  estimated_calories?: number;
  health_rating?: HealthRating;
  notes?: string;
  photo_url?: string; // Single photo URL
  created_at: string;
  updated_at: string;
}

export interface CreateMealLogRequest {
  meal_type: MealType;
  logged_date: string; // Format: YYYY-MM-DD
  meal_name?: string;
  meal_description?: string;
  logged_time?: string; // Format: HH:MM:SS
  goal_id?: string;
  challenge_id?: string;
  estimated_protein?: number;
  estimated_calories?: number;
  health_rating?: HealthRating;
  notes?: string;
  photo_url?: string; // Single photo URL or base64 data URL
  use_ai_estimation?: boolean; // Defaults to true
}

export interface UpdateMealLogRequest {
  meal_type?: MealType;
  meal_name?: string;
  meal_description?: string;
  logged_time?: string;
  estimated_protein?: number;
  estimated_calories?: number;
  health_rating?: HealthRating;
  notes?: string;
  photo_url?: string;
}

export interface NutritionEstimation {
  estimated_calories: number;
  estimated_protein: number;
  health_rating: HealthRating;
  confidence: "high" | "medium" | "low";
  suggested_name?: string; // AI-suggested meal name from vision analysis
}

export interface EstimateNutritionRequest {
  meal_description: string;
  meal_name?: string;
  photo_url?: string; // Photo URL or base64 data URL for vision analysis
}

export interface MealHistoryParams {
  goal_id?: string;
  challenge_id?: string;
  page?: number;
  limit?: number;
}

export interface MealHistoryResponse {
  data: MealLog[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

class MealLogsService extends BaseApiService {
  /**
   * Estimate nutrition for a meal using AI
   */
  async estimateNutrition(
    request: EstimateNutritionRequest
  ): Promise<ApiResponse<NutritionEstimation>> {
    return this.post<NutritionEstimation>(ROUTES.MEALS.ESTIMATE_NUTRITION, request);
  }

  /**
   * Log a new meal
   */
  async logMeal(data: CreateMealLogRequest): Promise<ApiResponse<MealLog>> {
    return this.post<MealLog>(ROUTES.MEALS.CREATE, data);
  }

  /**
   * Get meal logs for the current user
   */
  async getMealLogs(params?: {
    start_date?: string;
    end_date?: string;
    goal_id?: string;
    challenge_id?: string;
    meal_type?: MealType;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<MealLog[]>> {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append("start_date", params.start_date);
    if (params?.end_date) queryParams.append("end_date", params.end_date);
    if (params?.goal_id) queryParams.append("goal_id", params.goal_id);
    if (params?.challenge_id) queryParams.append("challenge_id", params.challenge_id);
    if (params?.meal_type) queryParams.append("meal_type", params.meal_type);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const url = queryParams.toString()
      ? `${ROUTES.MEALS.LIST}?${queryParams.toString()}`
      : ROUTES.MEALS.LIST;

    return this.get<MealLog[]>(url);
  }

  /**
   * Update a meal log
   */
  async updateMealLog(
    mealLogId: string,
    data: UpdateMealLogRequest
  ): Promise<ApiResponse<MealLog>> {
    return this.put<MealLog>(ROUTES.MEALS.UPDATE(mealLogId), data);
  }

  /**
   * Delete a meal log
   */
  async deleteMealLog(mealLogId: string): Promise<ApiResponse<void>> {
    return this.delete(ROUTES.MEALS.DELETE(mealLogId));
  }

  /**
   * Get paginated meal history for infinite scroll
   */
  async getMealHistory(params: MealHistoryParams): Promise<ApiResponse<MealHistoryResponse>> {
    const queryParams = new URLSearchParams();
    if (params.goal_id) queryParams.append("goal_id", params.goal_id);
    if (params.challenge_id) queryParams.append("challenge_id", params.challenge_id);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const url = queryParams.toString()
      ? `${ROUTES.MEALS.HISTORY}?${queryParams.toString()}`
      : ROUTES.MEALS.HISTORY;

    return this.get<MealHistoryResponse>(url);
  }
}

export const mealLogsService = new MealLogsService();
