import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ExamTimer } from '@/components/ExamTimer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Exam, Question } from '@/types/exam';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, Lightbulb, ChevronDown, CheckCircle2, XCircle, FileText, Play } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// Generate or retrieve session ID for tracking
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('exam_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('exam_session_id', sessionId);
  }
  return sessionId;
};

// Type for questions during exam (without answers)
interface StudentQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  image_url: string | null;
  order_index: number;
  created_at: string;
}

export default function TakeExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [fullQuestions, setFullQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sessionId] = useState<string>(getSessionId);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [started, setStarted] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to auth with return URL
      const returnUrl = `/exam/${id}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [authLoading, user, navigate, id]);

  // Fetch exam data when authenticated
  useEffect(() => {
    const fetchExam = async () => {
      if (!id || !user) return;

      const [examRes, questionsRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', id).eq('is_published', true).single(),
        supabase.from('student_exam_questions').select('*').eq('exam_id', id).order('order_index'),
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
        })) as StudentQuestion[];
        setQuestions(mapped);
      }

      setLoading(false);
    };

    if (user) {
      fetchExam();
    }
  }, [id, navigate, user]);

  // Get user display name and email from Google profile
  const getUserDisplayName = () => {
    if (!user) return 'Student';
    return user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student';
  };

  const getUserEmail = () => {
    return user?.email || '';
  };

  const startExam = async () => {
    if (!exam || !user) return;

    const studentName = getUserDisplayName();
    const studentEmail = getUserEmail();

    const { data, error } = await supabase.rpc('start_exam_attempt', {
      p_exam_id: exam.id,
      p_session_id: sessionId,
      p_student_name: studentName,
      p_student_email: studentEmail,
    });

    if (error || !data || data.length === 0) {
      toast.error('Failed to start exam');
      console.error('Start exam error:', error);
      return;
    }

    setAttemptId(data[0].attempt_id);
    setStartedAt(new Date(data[0].started_at));
    setStarted(true);
  };

  const submitExam = useCallback(async () => {
    if (!attemptId || submitting) return;

    setSubmitting(true);

    const { data, error } = await supabase.rpc('submit_exam_attempt', {
      p_attempt_id: attemptId,
      p_session_id: sessionId,
      p_answers: answers,
    });

    if (error || !data || data.length === 0) {
      toast.error('Failed to submit exam');
      console.error('Submit exam error:', error);
      setSubmitting(false);
      return;
    }

    const result = data[0];
    setScore(result.score);
    setCorrectCount(result.correct_count);

    const { data: fullQuestionData } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', exam?.id)
      .order('order_index');

    if (fullQuestionData) {
      setFullQuestions(fullQuestionData.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
      })) as Question[]);
    }

    setSubmitted(true);
    setSubmitting(false);
  }, [attemptId, answers, submitting, sessionId, exam?.id]);

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

  // Show loading while checking auth
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                      {correctCount}/{fullQuestions.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {fullQuestions.map((question, index) => {
              const correct = isCorrect(question.id!, question.correct_answer || '');
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

  // Pre-exam start screen - show user info and start button
  if (!started) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>{exam.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {exam.time_limit_minutes && (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Time Limit</p>
                <p className="text-2xl font-bold">{exam.time_limit_minutes} minutes</p>
              </div>
            )}

            {/* Show authenticated user info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Signed in as:</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{getUserDisplayName()}</p>
                  <p className="text-sm text-muted-foreground">{getUserEmail()}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Ready to begin</p>
                  <p className="text-muted-foreground">
                    {questions.length} questions • Your progress will be saved automatically
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={startExam} className="w-full h-12 text-base" size="lg">
              <Play className="mr-2 h-5 w-5" />
              Start Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active exam view
  const answeredCount = Object.keys(answers).filter(key => answers[key]?.trim()).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const scrollToQuestion = (questionId: string) => {
    const element = document.getElementById(`question-${questionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmitClick = () => {
    setShowSummary(true);
  };

  const handleFinalSubmit = () => {
    if (unansweredCount > 0) {
      setShowSubmitDialog(true);
    } else {
      submitExam();
    }
  };

  const goBackToExam = (questionId?: string) => {
    setShowSummary(false);
    if (questionId) {
      setTimeout(() => scrollToQuestion(questionId), 100);
    }
  };

  // Summary view
  if (showSummary) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <h1 className="text-lg font-semibold">{exam.title} - Review</h1>
            {exam.time_limit_minutes && startedAt && (
              <ExamTimer
                timeLimitMinutes={exam.time_limit_minutes}
                startedAt={startedAt}
                onTimeUp={handleTimeUp}
              />
            )}
          </div>
        </header>

        <main className="container py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Answers</CardTitle>
                <CardDescription>
                  {answeredCount} of {questions.length} questions answered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressPercent} className="h-3" />
                
                <div className="grid gap-2">
                  {questions.map((q, index) => {
                    const hasAnswer = answers[q.id]?.trim();
                    return (
                      <button
                        key={q.id}
                        onClick={() => goBackToExam(q.id)}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                          hasAnswer ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : 'border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/10'
                        }`}
                      >
                        <span className="font-medium">Question {index + 1}</span>
                        <span className={`text-sm ${hasAnswer ? 'text-green-600' : 'text-orange-600'}`}>
                          {hasAnswer ? 'Answered' : 'Unanswered'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => goBackToExam()} className="flex-1">
                    Back to Exam
                  </Button>
                  <Button onClick={handleFinalSubmit} disabled={submitting} className="flex-1">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Exam
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit with unanswered questions?</AlertDialogTitle>
              <AlertDialogDescription>
                You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. 
                Are you sure you want to submit?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction onClick={submitExam}>Submit Anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main exam taking view
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container space-y-3 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">{exam.title}</h1>
            <div className="flex items-center gap-4">
              {exam.time_limit_minutes && startedAt && (
                <ExamTimer
                  timeLimitMinutes={exam.time_limit_minutes}
                  startedAt={startedAt}
                  onTimeUp={handleTimeUp}
                />
              )}
              <Button onClick={handleSubmitClick} disabled={submitting}>
                <FileText className="mr-2 h-4 w-4" />
                Review & Submit
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progress: {answeredCount} of {questions.length} answered
              </span>
              <span className="font-medium text-primary">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            
            <div className="flex flex-wrap gap-1.5 pt-1">
              {questions.map((q, index) => {
                const hasAnswer = answers[q.id]?.trim();
                return (
                  <button
                    key={q.id}
                    onClick={() => scrollToQuestion(q.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors ${
                      hasAnswer
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} id={`question-${question.id}`} className="scroll-mt-32">
              <CardHeader>
                <CardTitle className="text-base">Question {index + 1}</CardTitle>
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

                {question.question_type === 'multiple_choice' || question.question_type === 'true_false' ? (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
                  >
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                        <Label htmlFor={`${question.id}-${optIndex}`} className="cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    placeholder="Type your answer here..."
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                    rows={4}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
