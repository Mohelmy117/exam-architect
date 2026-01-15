-- 1. Create a view for student-safe questions (without correct_answer, solution, explanation)
CREATE VIEW public.student_exam_questions 
WITH (security_invoker = on) AS
SELECT 
  id,
  exam_id,
  question_text,
  question_type,
  options,
  image_url,
  order_index,
  created_at
FROM public.questions;

-- Grant access to the view
GRANT SELECT ON public.student_exam_questions TO anon, authenticated;

-- 2. Add session_id column to exam_attempts for tracking anonymous students
ALTER TABLE public.exam_attempts ADD COLUMN session_id TEXT;

-- Create index for efficient lookup
CREATE INDEX idx_exam_attempts_session_id ON public.exam_attempts(session_id);

-- 3. Create a secure function to submit exam and calculate score server-side
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
  p_attempt_id UUID,
  p_session_id TEXT,
  p_answers JSONB
)
RETURNS TABLE (score INTEGER, correct_count INTEGER, total_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id UUID;
  v_correct INTEGER := 0;
  v_total INTEGER;
  v_score INTEGER;
  question_record RECORD;
BEGIN
  -- Verify attempt exists, belongs to session, and is not already submitted
  SELECT exam_id INTO v_exam_id
  FROM exam_attempts
  WHERE id = p_attempt_id 
    AND session_id = p_session_id 
    AND submitted_at IS NULL;
  
  IF v_exam_id IS NULL THEN
    RAISE EXCEPTION 'Invalid attempt, session mismatch, or already submitted';
  END IF;
  
  -- Calculate score by comparing with correct answers
  FOR question_record IN 
    SELECT q.id, q.correct_answer 
    FROM questions q
    WHERE q.exam_id = v_exam_id
  LOOP
    IF p_answers->>question_record.id::TEXT = question_record.correct_answer THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;
  
  -- Get total question count
  SELECT COUNT(*) INTO v_total FROM questions WHERE exam_id = v_exam_id;
  
  -- Calculate percentage score
  IF v_total > 0 THEN
    v_score := ROUND((v_correct::NUMERIC / v_total) * 100);
  ELSE
    v_score := 0;
  END IF;
  
  -- Update attempt with server-calculated score
  UPDATE exam_attempts
  SET 
    answers = p_answers,
    score = v_score,
    submitted_at = NOW()
  WHERE id = p_attempt_id AND session_id = p_session_id;
  
  RETURN QUERY SELECT v_score, v_correct, v_total;
END;
$$;

-- 4. Create a function to start an exam attempt with session tracking
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_exam_id UUID,
  p_session_id TEXT,
  p_student_name TEXT DEFAULT NULL,
  p_student_email TEXT DEFAULT NULL
)
RETURNS TABLE (attempt_id UUID, started_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_started_at TIMESTAMPTZ;
BEGIN
  -- Verify exam exists and is published
  IF NOT EXISTS (SELECT 1 FROM exams WHERE id = p_exam_id AND is_published = true) THEN
    RAISE EXCEPTION 'Exam not found or not published';
  END IF;
  
  -- Create the attempt
  INSERT INTO exam_attempts (exam_id, session_id, student_name, student_email, answers)
  VALUES (p_exam_id, p_session_id, p_student_name, p_student_email, '{}'::jsonb)
  RETURNING id, exam_attempts.started_at INTO v_attempt_id, v_started_at;
  
  RETURN QUERY SELECT v_attempt_id, v_started_at;
END;
$$;

-- 5. Drop the permissive UPDATE policy
DROP POLICY IF EXISTS "Students can update their own attempt by id" ON exam_attempts;

-- 6. Create a restrictive policy that requires session_id match
CREATE POLICY "Students can update their own attempt with session" 
  ON exam_attempts 
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Note: With the RPC functions handling inserts and updates securely,
-- we deny direct UPDATE access. All updates go through the RPC functions.

-- 7. Update the INSERT policy to use RPC instead
DROP POLICY IF EXISTS "Anyone can create exam attempts for published exams" ON exam_attempts;

-- Deny direct INSERT - all inserts go through RPC
CREATE POLICY "No direct insert - use RPC" 
  ON exam_attempts 
  FOR INSERT
  WITH CHECK (false);

-- 8. Grant execute on the functions
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt TO anon, authenticated;