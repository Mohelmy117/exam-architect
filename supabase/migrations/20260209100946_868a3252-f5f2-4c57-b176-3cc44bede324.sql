
-- Add solo_mode column to exams table
ALTER TABLE public.exams ADD COLUMN solo_mode boolean NOT NULL DEFAULT false;

-- Update RLS: Allow exam owner to view their own exams even if not published (already exists)
-- Add policy: Allow exam owner to take their own solo_mode exam
-- We need to allow the owner to start attempts on their own solo_mode exams
-- This requires updating the start_exam_attempt function

-- Create or replace the start_exam_attempt function to support solo_mode
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_exam_id uuid,
  p_session_id text,
  p_student_name text DEFAULT NULL,
  p_student_email text DEFAULT NULL
)
RETURNS TABLE(attempt_id uuid, started_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid;
  v_started_at timestamptz;
  v_exam_exists boolean;
  v_is_published boolean;
  v_is_solo boolean;
  v_created_by uuid;
BEGIN
  -- Check exam exists and get its properties
  SELECT e.is_published, e.solo_mode, e.created_by
  INTO v_is_published, v_is_solo, v_created_by
  FROM exams e
  WHERE e.id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  -- Allow if published OR if solo_mode and user is the owner
  IF NOT v_is_published AND NOT (v_is_solo AND v_created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;

  -- If solo mode, only the owner can start
  IF v_is_solo AND v_created_by != auth.uid() THEN
    RAISE EXCEPTION 'This exam is only available in solo mode for the owner';
  END IF;

  -- Insert attempt
  INSERT INTO exam_attempts (exam_id, session_id, student_name, student_email)
  VALUES (p_exam_id, p_session_id, p_student_name, p_student_email)
  RETURNING id, exam_attempts.started_at INTO v_attempt_id, v_started_at;

  RETURN QUERY SELECT v_attempt_id, v_started_at;
END;
$$;

-- Update the SELECT policy on exams to also allow owner to view solo_mode exams for taking
-- The existing "Users can view their own exams" policy already covers this since it checks created_by = auth.uid()

-- Update the questions SELECT policy to also allow solo_mode exam questions to be visible to the owner
-- The existing policy already allows viewing questions if created_by = auth.uid() OR is_published = true
-- For solo_mode, since the owner is the one taking it, created_by = auth.uid() already covers it

-- We need to ensure student_exam_questions view works for solo_mode too
-- Let's recreate the view to include solo_mode exams for the owner
DROP VIEW IF EXISTS public.student_exam_questions;
CREATE VIEW public.student_exam_questions AS
SELECT 
  q.id,
  q.exam_id,
  q.question_text,
  q.question_type,
  q.options,
  q.order_index,
  q.image_url,
  q.created_at
FROM questions q
JOIN exams e ON e.id = q.exam_id
WHERE e.is_published = true 
   OR (e.solo_mode = true AND e.created_by = auth.uid());
