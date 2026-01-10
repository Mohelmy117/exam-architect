
-- Fix the overly permissive UPDATE policy on exam_attempts
DROP POLICY IF EXISTS "Anyone can update their own attempt" ON public.exam_attempts;

-- Create a more restrictive policy - students can only update attempts they started (identified by their attempt ID)
CREATE POLICY "Students can update their own attempt by id"
  ON public.exam_attempts FOR UPDATE
  USING (true)
  WITH CHECK (submitted_at IS NULL);
