export interface Question {
  id?: string;
  exam_id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correct_answer: string;
  image_url?: string;
  solution?: string;
  explanation?: string;
  order_index: number;
  // Enhanced structured fields for image-based questions
  context?: string;           // Background/context of the question
  given_info?: string;        // Given information extracted from text/image
  required_info?: string;     // What is being asked/required to find
  image_analysis?: string;    // AI analysis of the diagram/image
}

export interface Exam {
  id?: string;
  title: string;
  description?: string;
  created_by?: string;
  time_limit_minutes?: number | null;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExamWithQuestions extends Exam {
  questions: Question[];
}

export interface ExamAttempt {
  id?: string;
  exam_id: string;
  student_name?: string;
  student_email?: string;
  answers?: Record<string, string>;
  score?: number;
  started_at?: string;
  submitted_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  plan: string;
  ai_questions_generated: number;
  ai_questions_limit: number;
}
