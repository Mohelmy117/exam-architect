-- Add explanation column to questions table for AI-generated explanations
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS explanation TEXT;