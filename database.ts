/**
 * Minimal hand-written types for the tables Phase 1 code touches directly.
 *
 * Once the schema is applied to a real Supabase project, replace this file
 * by generating full types instead of maintaining it by hand:
 *
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF \
 *     > src/types/database.ts
 *
 * Keeping the generated file in sync after every migration is the
 * recommended workflow going forward; this file only needs to be complete
 * enough to type-check Phase 1 routes and components.
 */

export type UserRole = "student" | "teacher" | "admin";
export type QuestionType =
  | "multiple_choice"
  | "fill_in_blank"
  | "true_false"
  | "matching"
  | "drag_and_drop"
  | "word_order"
  | "short_answer"
  | "essay"
  | "listening"
  | "image_based"
  | "speaking";
export type ActivityKind = "practice" | "test";
export type ActivityStatus = "draft" | "published" | "private" | "scheduled" | "closed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          role: UserRole;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      teacher_profiles: {
        Row: { profile_id: string; school_name: string | null; bio: string | null };
        Insert: { profile_id: string; school_name?: string | null; bio?: string | null };
        Update: Partial<Database["public"]["Tables"]["teacher_profiles"]["Row"]>;
      };
      student_profiles: {
        Row: { profile_id: string; grade_level: string | null; coin_balance: number };
        Insert: { profile_id: string; grade_level?: string | null; coin_balance?: number };
        Update: Partial<Database["public"]["Tables"]["student_profiles"]["Row"]>;
      };
      classes: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          description: string | null;
          class_code: string;
          code_active: boolean;
          allow_self_join: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["classes"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Row"]>;
      };
      class_memberships: {
        Row: { class_id: string; student_id: string; joined_at: string };
        Insert: { class_id: string; student_id: string };
        Update: never;
      };
      activities: {
        Row: {
          id: string;
          owner_id: string;
          kind: ActivityKind;
          title: string;
          topic_id: string | null;
          status: ActivityStatus;
          visibility: string;
          grade_visibility: "hidden" | "released";
          max_attempts: number | null;
          time_limit_seconds: number | null;
          randomize_question_order: boolean;
          randomize_answer_order: boolean;
          show_correct_answers: boolean;
          passing_score_percent: number | null;
          opens_at: string | null;
          closes_at: string | null;
          password: string | null;
          coin_rewards_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          owner_id: string;
          kind: ActivityKind;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
      };
      activity_questions: {
        Row: { id: string; activity_id: string; question_id: string; sort_order: number; points: number };
        Insert: Omit<Database["public"]["Tables"]["activity_questions"]["Row"], "id"> & { id?: string };
        Update: never;
      };
      questions: {
        Row: {
          id: string;
          owner_id: string;
          topic_id: string | null;
          type: QuestionType;
          prompt: string;
          data: Record<string, unknown>;
          explanation: string | null;
          media_url: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["questions"]["Row"]> & {
          owner_id: string;
          type: QuestionType;
          prompt: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
      };
      attempts: {
        Row: {
          id: string;
          activity_id: string;
          student_id: string;
          attempt_number: number;
          started_at: string;
          submitted_at: string | null;
          score_percent: number | null;
          raw_score: number | null;
          max_score: number | null;
          passed: boolean | null;
          grade_released: boolean;
          time_spent_seconds: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["attempts"]["Row"]> & {
          activity_id: string;
          student_id: string;
          attempt_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["attempts"]["Row"]>;
      };
      attempt_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          response: Record<string, unknown>;
          is_correct: boolean | null;
          points_awarded: number | null;
          teacher_feedback: string | null;
          ai_suggested_score: number | null;
          ai_feedback: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["attempt_answers"]["Row"]> & {
          attempt_id: string;
          question_id: string;
          response: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["attempt_answers"]["Row"]>;
      };
      coin_transactions: {
        Row: {
          id: string;
          student_id: string;
          amount: number;
          reason: string;
          related_attempt_id: string | null;
          related_item_id: string | null;
          related_badge_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["coin_transactions"]["Row"]> & {
          student_id: string;
          amount: number;
          reason: string;
        };
        Update: never;
      };
      practice_reward_history: {
        Row: { student_id: string; activity_id: string; tier: 1 | 2 | 3; first_earned_at: string; times_earned: number };
        Insert: Partial<Database["public"]["Tables"]["practice_reward_history"]["Row"]> & {
          student_id: string;
          activity_id: string;
          tier: 1 | 2 | 3;
        };
        Update: Partial<Database["public"]["Tables"]["practice_reward_history"]["Row"]>;
      };
    };
  };
}
