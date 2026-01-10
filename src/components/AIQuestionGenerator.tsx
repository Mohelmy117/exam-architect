import { useState } from 'react';
import { Question } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIQuestionGeneratorProps {
  onQuestionsGenerated: (questions: Question[]) => void;
  remainingQuestions: number;
}

export function AIQuestionGenerator({ onQuestionsGenerated, remainingQuestions }: AIQuestionGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);

  const generateQuestions = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    if (numQuestions > remainingQuestions) {
      toast.error(`You can only generate ${remainingQuestions} more questions with your plan`);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: { topic, numQuestions, additionalContext },
      });

      if (error) throw error;

      if (data.questions && data.questions.length > 0) {
        onQuestionsGenerated(data.questions);
        toast.success(`Generated ${data.questions.length} questions`);
        setTopic('');
        setAdditionalContext('');
      } else {
        toast.error('No questions were generated');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Question Generator
        </CardTitle>
        <CardDescription>
          Generate exam questions from a topic using AI. You have {remainingQuestions} questions remaining.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {remainingQuestions <= 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            You've reached your AI generation limit. Upgrade your plan for more.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., World War II, Photosynthesis, JavaScript Arrays"
            disabled={remainingQuestions <= 0}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="numQuestions">Number of Questions</Label>
          <Input
            id="numQuestions"
            type="number"
            min={1}
            max={Math.min(20, remainingQuestions)}
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value) || 1)}
            disabled={remainingQuestions <= 0}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="context">Additional Context (optional)</Label>
          <Textarea
            id="context"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="e.g., Focus on causes and effects, include dates, for high school level"
            disabled={remainingQuestions <= 0}
          />
        </div>

        <Button
          onClick={generateQuestions}
          disabled={loading || remainingQuestions <= 0}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Questions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
