import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, CheckCircle, AlertCircle, Lightbulb, ChevronDown, CheckCircle2, XCircle, Play, LogOut, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('exam_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('exam_session_id', sessionId);
  }
  return sessionId;
};

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
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [animDirection, setAnimDirection] = useState<'left' | 'right' | null>(null);
  const examActiveRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = `/exam/${id}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [authLoading, user, navigate, id]);

  // Fetch exam data
  useEffect(() => {
    const fetchExam = async () => {
      if (!id || !user) return;

      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', id)
        .single();

      if (examError || !examData) {
        toast.error('Exam not found');
        navigate('/');
        return;
      }

      const isSoloOwner = examData.solo_mode && examData.created_by === user.id;
      if (!examData.is_published && !isSoloOwner) {
        toast.error('Exam not found or not published');
        navigate('/');
        return;
      }

      setExam(examData);

      // Check if user already has a submitted attempt for this exam
      const { data: existingAttempts } = await supabase
        .from('exam_attempts')
        .select('id, submitted_at')
        .eq('exam_id', id)
        .eq('session_id', getSessionId())
        .not('submitted_at', 'is', null);

      if (existingAttempts && existingAttempts.length > 0) {
        setAlreadySubmitted(true);
        setLoading(false);
        return;
      }

      const { data: questionsData } = await supabase
        .from('student_exam_questions')
        .select('*')
        .eq('exam_id', id)
        .order('order_index');

      if (questionsData) {
        const mapped = questionsData.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
        })) as StudentQuestion[];
        setQuestions(mapped);
      }

      setLoading(false);
    };

    if (user) fetchExam();
  }, [id, navigate, user]);

  // beforeunload protection
  useEffect(() => {
    if (!examActiveRef.current) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Leaving this page will submit your exam.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [started, submitted]);

  // Track exam active state
  useEffect(() => {
    examActiveRef.current = started && !submitted;
  }, [started, submitted]);

  const getUserDisplayName = () => {
    if (!user) return 'Student';
    return user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student';
  };

  const getUserEmail = () => user?.email || '';

  const startExam = async () => {
    if (!exam || !user) return;

    const { data, error } = await supabase.rpc('start_exam_attempt', {
      p_exam_id: exam.id!,
      p_session_id: sessionId,
      p_student_name: getUserDisplayName(),
      p_student_email: getUserEmail(),
    });

    if (error || !data || data.length === 0) {
      toast.error('Failed to start exam');
      return;
    }

    setAttemptId(data[0].attempt_id);
    setStartedAt(new Date(data[0].started_at));
    setStarted(true);
    examActiveRef.current = true;
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
      setSubmitting(false);
      return;
    }

    const result = data[0];
    setScore(result.score);
    setCorrectCount(result.correct_count);

    const { data: fullQuestionData } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', exam?.id!)
      .order('order_index');

    if (fullQuestionData) {
      setFullQuestions(fullQuestionData.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
      })) as Question[]);
    }

    examActiveRef.current = false;
    setSubmitted(true);
    setSubmitting(false);
  }, [attemptId, answers, submitting, sessionId, exam?.id]);

  const handleTimeUp = useCallback(() => {
    toast.warning('Time is up! Submitting your exam...');
    submitExam();
  }, [submitExam]);

  const handleExitExam = () => setShowExitDialog(true);

  const confirmExit = async () => {
    setShowExitDialog(false);
    await submitExam();
  };

  const toggleExplanation = (questionId: string) => {
    setOpenExplanations(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const isCorrect = (questionId: string, correctAnswer: string) => answers[questionId] === correctAnswer;

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setAnimDirection(index > currentQuestionIndex ? 'right' : 'left');
    setCurrentQuestionIndex(index);
    setTimeout(() => setAnimDirection(null), 300);
  };

  // Loading states
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already submitted block
  if (alreadySubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="mx-auto h-16 w-16 text-destructive" />
            <h2 className="text-xl font-bold">Attempt Already Submitted</h2>
            <p className="text-muted-foreground">
              This exam attempt has already been submitted. You cannot re-enter this attempt.
            </p>
            <Button onClick={() => navigate('/')} variant="outline" className="mt-4">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-medium">Exam not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Results View ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <h1 className="text-lg font-semibold">{exam.title} — Results</h1>
            <div className="rounded-lg bg-primary px-4 py-2 text-primary-foreground font-semibold">
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
                <p className="mt-2 text-muted-foreground">Review your answers and explanations below</p>
                <div className="mt-6 inline-flex items-center gap-4 rounded-lg bg-background p-4 shadow-sm">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Your Score</p>
                    <p className="text-3xl font-bold text-primary">{score}%</p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Correct</p>
                    <p className="text-3xl font-bold">{correctCount}/{fullQuestions.length}</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/')} variant="outline" className="mt-6">
                  Go Home
                </Button>
              </CardContent>
            </Card>

            {fullQuestions.map((question, index) => {
              const correct = isCorrect(question.id!, question.correct_answer || '');
              const hasExplanation = question.explanation || question.solution;

              return (
                <Card
                  key={question.id}
                  className={cn('transition-all', correct
                    ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'
                    : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {correct ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                        Question {index + 1}
                      </CardTitle>
                      <span className={cn('rounded-full px-3 py-1 text-xs font-medium', correct
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      )}>
                        {correct ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-lg">{question.question_text}</p>
                    {question.image_url && <img src={question.image_url} alt="Question" className="max-h-64 rounded-lg object-contain" />}
                    <div className="space-y-2 rounded-lg bg-background/80 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Your answer:</span>
                        <span className={cn('font-medium', correct ? 'text-green-600' : 'text-red-600')}>
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
                      <Collapsible open={openExplanations[question.id!]} onOpenChange={() => toggleExplanation(question.id!)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" /> Explanation</span>
                            <ChevronDown className={cn('h-4 w-4 transition-transform', openExplanations[question.id!] && 'rotate-180')} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="rounded-lg border bg-yellow-50/50 p-4 dark:bg-yellow-950/20">
                            {question.explanation && (
                              <div className="space-y-2">
                                <h4 className="flex items-center gap-2 font-semibold text-yellow-800 dark:text-yellow-200"><Lightbulb className="h-4 w-4" /> AI Explanation</h4>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">{question.explanation}</p>
                              </div>
                            )}
                            {question.solution && (
                              <div className={cn('space-y-2', question.explanation && 'mt-4 border-t border-yellow-200 pt-4 dark:border-yellow-800')}>
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Solution</h4>
                                <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">{question.solution}</p>
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

  // ─── Pre-exam Start Screen ────────────────────────────────
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
                  <p className="text-muted-foreground">{questions.length} questions • Your progress will be saved automatically</p>
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

  // ─── Active Exam — Immersive Mode ─────────────────────────
  const answeredCount = Object.keys(answers).filter(key => answers[key]?.trim()).length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-background via-background to-accent/30">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between border-b bg-card/80 backdrop-blur-xl px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden sm:inline">{exam.title}</span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {exam.time_limit_minutes && startedAt && (
            <ExamTimer timeLimitMinutes={exam.time_limit_minutes} startedAt={startedAt} onTimeUp={handleTimeUp} />
          )}
          <Button variant="destructive" size="sm" onClick={handleExitExam}>
            <LogOut className="mr-2 h-4 w-4" />
            Exit Exam
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative z-10 px-4 md:px-6 pt-2">
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Question Area */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6">
        <div
          className={cn(
            'w-full max-w-2xl transition-all duration-300 ease-out',
            animDirection === 'right' && 'animate-fade-in',
            animDirection === 'left' && 'animate-fade-in',
          )}
          key={currentQuestionIndex}
        >
          <Card className="border bg-card/90 backdrop-blur-sm shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-muted-foreground">
                  Question {currentQuestionIndex + 1}
                </CardTitle>
                {answers[currentQuestion?.id]?.trim() && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Answered
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg font-medium leading-relaxed">{currentQuestion?.question_text}</p>

              {currentQuestion?.image_url && (
                <img src={currentQuestion.image_url} alt="Question" className="max-h-64 rounded-lg object-contain" />
              )}

              {currentQuestion?.question_type === 'multiple_choice' || currentQuestion?.question_type === 'true_false' ? (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={(value) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))}
                  className="space-y-3"
                >
                  {currentQuestion.options.map((option, optIndex) => (
                    <div
                      key={optIndex}
                      className={cn(
                        'flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/50',
                        answers[currentQuestion.id] === option && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }))}
                    >
                      <RadioGroupItem value={option} id={`${currentQuestion.id}-${optIndex}`} />
                      <Label htmlFor={`${currentQuestion.id}-${optIndex}`} className="cursor-pointer flex-1 text-base">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion?.id] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                  rows={4}
                  className="text-base"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Navigation */}
      <footer className="relative z-10 border-t bg-card/80 backdrop-blur-xl px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          {/* Question dots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => goToQuestion(i)}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-all',
                  i === currentQuestionIndex
                    ? 'w-6 bg-primary'
                    : answers[q.id]?.trim()
                      ? 'bg-primary/40'
                      : 'bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={() => setShowSubmitDialog(true)} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Exam
            </Button>
          ) : (
            <Button onClick={() => goToQuestion(currentQuestionIndex + 1)}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>

      {/* Exit Exam Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Exit Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <p>If you exit now, your exam will be submitted automatically.</p>
              <p className="font-semibold text-foreground">You will NOT be able to return to this attempt again.</p>
              <p>Your current score will be calculated and may affect your evaluation.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Exit & Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount < questions.length ? (
                <span>You have answered {answeredCount} of {questions.length} questions. {questions.length - answeredCount} question{questions.length - answeredCount > 1 ? 's are' : ' is'} unanswered. Are you sure you want to submit?</span>
              ) : (
                <span>You have answered all {questions.length} questions. Ready to submit?</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSubmitDialog(false); submitExam(); }}>
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
