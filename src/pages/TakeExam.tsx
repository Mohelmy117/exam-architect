import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExamTimer } from '@/components/ExamTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Exam, Question, ExamAttempt } from '@/types/exam';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function TakeExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Student info
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const fetchExam = async () => {
      if (!id) return;

      const [examRes, questionsRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', id).eq('is_published', true).single(),
        supabase.from('questions').select('*').eq('exam_id', id).order('order_index'),
      ]);

      if (examRes.error || !examRes.data) {
        toast.error('Exam not found or not published');
        navigate('/');
        return;
      }

      setExam(examRes.data);

      if (questionsRes.data) {
        const mapped = questionsRes.data.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
        })) as Question[];
        setQuestions(mapped);
      }

      setLoading(false);
    };

    fetchExam();
  }, [id, navigate]);

  const startExam = async () => {
    if (!exam) return;

    const { data, error } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        student_name: studentName,
        student_email: studentEmail,
        answers: {},
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to start exam');
      return;
    }

    setAttemptId(data.id);
    setStartedAt(new Date(data.started_at));
    setStarted(true);
  };

  const submitExam = useCallback(async () => {
    if (!attemptId || submitting) return;

    setSubmitting(true);

    // Calculate score
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id!] === q.correct_answer) {
        correct++;
      }
    });

    const calculatedScore = Math.round((correct / questions.length) * 100);

    const { error } = await supabase
      .from('exam_attempts')
      .update({
        answers,
        score: calculatedScore,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    if (error) {
      toast.error('Failed to submit exam');
      setSubmitting(false);
      return;
    }

    setScore(calculatedScore);
    setSubmitted(true);
    setSubmitting(false);
  }, [attemptId, answers, questions, submitting]);

  const handleTimeUp = useCallback(() => {
    toast.warning('Time is up! Submitting your exam...');
    submitExam();
  }, [submitExam]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-medium">Exam not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-success" />
            <h2 className="mt-4 text-2xl font-bold">Exam Submitted!</h2>
            <p className="mt-2 text-muted-foreground">Thank you for completing the exam.</p>
            <div className="mt-6 rounded-lg bg-muted p-6">
              <p className="text-sm text-muted-foreground">Your Score</p>
              <p className="text-4xl font-bold">{score}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>{exam.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exam.time_limit_minutes && (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Time Limit</p>
                <p className="text-2xl font-bold">{exam.time_limit_minutes} minutes</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Your Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <Button onClick={startExam} className="w-full" disabled={!studentName.trim()}>
              Start Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-lg font-semibold">{exam.title}</h1>
          <div className="flex items-center gap-4">
            {exam.time_limit_minutes && startedAt && (
              <ExamTimer
                timeLimitMinutes={exam.time_limit_minutes}
                startedAt={startedAt}
                onTimeUp={handleTimeUp}
              />
            )}
            <Button onClick={submitExam} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Submit Exam'
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} className="question-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Question {index + 1} of {questions.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg">{question.question_text}</p>

                {question.image_url && (
                  <img
                    src={question.image_url}
                    alt="Question"
                    className="max-h-64 rounded-lg object-contain"
                  />
                )}

                {question.question_type === 'multiple_choice' && (
                  <RadioGroup
                    value={answers[question.id!] || ''}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [question.id!]: value })
                    }
                  >
                    {(question.options || []).map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                        <Label htmlFor={`${question.id}-${optIndex}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.question_type === 'true_false' && (
                  <RadioGroup
                    value={answers[question.id!] || ''}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [question.id!]: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="True" id={`${question.id}-true`} />
                      <Label htmlFor={`${question.id}-true`}>True</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="False" id={`${question.id}-false`} />
                      <Label htmlFor={`${question.id}-false`}>False</Label>
                    </div>
                  </RadioGroup>
                )}

                {question.question_type === 'short_answer' && (
                  <Textarea
                    value={answers[question.id!] || ''}
                    onChange={(e) =>
                      setAnswers({ ...answers, [question.id!]: e.target.value })
                    }
                    placeholder="Type your answer here..."
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={submitExam} size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Exam'
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
