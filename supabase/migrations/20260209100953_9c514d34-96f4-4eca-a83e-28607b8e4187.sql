
-- Fix the security definer view issue by making it SECURITY INVOKER
ALTER VIEW public.student_exam_questions SET (security_invoker = on);
