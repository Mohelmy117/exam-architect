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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Exam, Question, ExamAttempt } from '@/types/exam';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, Lightbulb, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';

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
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});

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

  const toggleExplanation = (questionId: string) => {
    setOpenExplanations(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const isCorrect = (questionId: string, correctAnswer: string) => {
    return answers[questionId] === correctAnswer;
  };

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

  // Results view after submission
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <h1 className="text-lg font-semibold">{exam.title} - Results</h1>
            <div className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
              Score: {score}%
            </div>
          </div>
        </header>

        <main className="container py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardContent className="py-8 text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-primary" />
                <h2 className="mt-4 text-2xl font-bold">Exam Completed!</h2>
                <p className="mt-2 text-muted-foreground">
                  Review your answers and explanations below
                </p>
                <div className="mt-6 inline-flex items-center gap-4 rounded-lg bg-background p-4 shadow-sm">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Your Score</p>
                    <p className="text-3xl font-bold text-primary">{score}%</p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Correct</p>
                    <p className="text-3xl font-bold">
                      {questions.filter(q => isCorrect(q.id!, q.correct_answer)).length}/{questions.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {questions.map((question, index) => {
              const correct = isCorrect(question.id!, question.correct_answer);
              const hasExplanation = question.explanation || question.solution;
              
              return (
                <Card 
                  key={question.id} 
                  className={`transition-all ${correct ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {correct ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        Question {index + 1}
                      </CardTitle>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${correct ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
                        {correct ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
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

                    <div className="space-y-2 rounded-lg bg-background/80 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Your answer:</span>
                        <span className={`font-medium ${correct ? 'text-green-600' : 'text-red-600'}`}>
                          {answers[question.id!] || 'No answer'}
                        </span>
                      </div>
                      {!correct && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Correct answer:</span>
                          <span className="font-medium text-green-600">{question.correct_answer}</span>
                        </div>
                      )}
                    </div>

                    {hasExplanation && (
                      <Collapsible
                        open={openExplanations[question.id!]}
                        onOpenChange={() => toggleExplanation(question.id!)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-yellow-500" />
                              Explanation
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${openExplanations[question.id!] ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="rounded-lg border bg-yellow-50/50 p-4 dark:bg-yellow-950/20">
                            {question.explanation && (
                              <div className="space-y-2">
                                <h4 className="flex items-center gap-2 font-semibold text-yellow-800 dark:text-yellow-200">
                                  <Lightbulb className="h-4 w-4" />
                                  AI Explanation
                                </h4>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">
                                  {question.explanation}
                                </p>
                              </div>
                            )}
                            {question.solution && (
                              <div className={`space-y-2 ${question.explanation ? 'mt-4 border-t border-yellow-200 pt-4 dark:border-yellow-800' : ''}`}>
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                                  Solution from Exam
                                </h4>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">
                                  {question.solution}
                                </p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
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
