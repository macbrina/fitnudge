import { BaseApiService } from "./base";

export interface Exercise {
  id: string;
  name: string;
  body_part?: string;
  equipment?: string;
  target_muscle?: string;
  secondary_muscles?: string[];
  instructions?: string[];
  description?: string;
  difficulty?: string;
  category?: string;
  mp4_url?: string;
}

export interface ExerciseListResponse {
  exercises: Exercise[];
  total: number;
}

export interface SearchExercisesParams {
  query?: string;
  body_part?: string;
  equipment?: string;
  difficulty?: string;
  category?: string;
  target_muscle?: string;
  limit?: number;
}

class ExercisesService extends BaseApiService {
  /**
   * Get exercise details by ID
   */
  async getExerciseById(exerciseId: string): Promise<Exercise> {
    const response = await this.get<Exercise>(`/exercises/${exerciseId}`);
    if (!response.data) {
      throw new Error(`Exercise ${exerciseId} not found`);
    }
    return response.data;
  }

  /**
   * Search exercises with filters
   */
  async searchExercises(params: SearchExercisesParams = {}): Promise<ExerciseListResponse> {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.append("query", params.query);
    if (params.body_part) queryParams.append("body_part", params.body_part);
    if (params.equipment) queryParams.append("equipment", params.equipment);
    if (params.difficulty) queryParams.append("difficulty", params.difficulty);
    if (params.category) queryParams.append("category", params.category);
    if (params.target_muscle) queryParams.append("target_muscle", params.target_muscle);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/exercises?${queryString}` : "/exercises";

    const response = await this.get<ExerciseListResponse>(url);
    return response.data || { exercises: [], total: 0 };
  }

  /**
   * Get popular exercises
   */
  async getPopularExercises(limit: number = 20): Promise<ExerciseListResponse> {
    const response = await this.get<ExerciseListResponse>(`/exercises/popular/list?limit=${limit}`);
    return response.data || { exercises: [], total: 0 };
  }
}

export const exercisesService = new ExercisesService();
