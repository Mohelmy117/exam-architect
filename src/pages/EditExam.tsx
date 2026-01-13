import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { QuestionEditor } from '@/components/QuestionEditor';
import { AIQuestionGenerator } from '@/components/AIQuestionGenerator';
import { PDFExamParser } from '@/components/PDFExamParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Question, Exam } from '@/types/exam';
import { toast } from 'sonner';
import { Loader2, Save, Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EditExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiRemaining, setAiRemaining] = useState(50);

  const [exam, setExam] = useState<Exam>({
    title: '',
    description: '',
    time_limit_minutes: null,
    is_published: false,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [timerEnabled, setTimerEnabled] = useState(false);

  useEffect(() => {
    const fetchExam = async () => {
      if (!id || !user) return;

      const [examRes, questionsRes, profileRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', id).eq('created_by', user.id).single(),
        supabase.from('questions').select('*').eq('exam_id', id).order('order_index'),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
      ]);

      if (examRes.error || !examRes.data) {
        toast.error('Exam not found');
        navigate('/exams');
        return;
      }

      setExam(examRes.data);
      setTimerEnabled(!!examRes.data.time_limit_minutes);

      if (questionsRes.data) {
        const mapped = questionsRes.data.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
        })) as Question[];
        setQuestions(mapped);
      }

      if (profileRes.data) {
        setAiRemaining(profileRes.data.ai_questions_limit - profileRes.data.ai_questions_generated);
      }

      setLoading(false);
    };

    fetchExam();
  }, [id, user, navigate]);

  const handleAIQuestions = (generated: Question[]) => {
    setPreviewQuestions(generated);
  };

  const handlePDFQuestions = (parsed: Question[]) => {
    setPreviewQuestions(parsed);
  };

  const addPreviewToExam = () => {
    const indexed = previewQuestions.map((q, i) => ({
      ...q,
      order_index: questions.length + i,
    }));
    setQuestions([...questions, ...indexed]);
    setPreviewQuestions([]);
    toast.success('Questions added to exam');
  };

  const saveExam = async () => {
    if (!exam.title.trim()) {
      toast.error('Please enter an exam title');
      return;
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    setSaving(true);
    try {
      const { error: examError } = await supabase
        .from('exams')
        .update({
          title: exam.title,
          description: exam.description,
          time_limit_minutes: timerEnabled ? exam.time_limit_minutes : null,
          is_published: exam.is_published,
        })
        .eq('id', id);

      if (examError) throw examError;

      // Delete existing questions and insert new ones
      await supabase.from('questions').delete().eq('exam_id', id);

      const questionsToInsert = questions.map((q) => ({
        exam_id: id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        image_url: q.image_url,
        solution: q.solution,
        explanation: q.explanation,
        order_index: q.order_index,
      }));

      const { error: questionsError } = await supabase.from('questions').insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast.success('Exam updated successfully!');
      navigate('/exams');
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/exams">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Exam</h1>
            <p className="text-muted-foreground">Modify your exam questions and settings</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Exam Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={exam.title}
                    onChange={(e) => setExam({ ...exam, title: e.target.value })}
                    placeholder="e.g., Midterm Exam - Biology 101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={exam.description || ''}
                    onChange={(e) => setExam({ ...exam, description: e.target.value })}
                    placeholder="Instructions for students..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="timer">Enable Timer</Label>
                      <p className="text-sm text-muted-foreground">Set a time limit for this exam</p>
                    </div>
                  </div>
                  <Switch
                    id="timer"
                    checked={timerEnabled}
                    onCheckedChange={setTimerEnabled}
                  />
                </div>
                {timerEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      min={1}
                      value={exam.time_limit_minutes || ''}
                      onChange={(e) =>
                        setExam({ ...exam, time_limit_minutes: parseInt(e.target.value) || null })
                      }
                      placeholder="e.g., 60"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionEditor questions={questions} onChange={setQuestions} />
              </CardContent>
            </Card>

            {previewQuestions.length > 0 && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Preview Generated Questions ({previewQuestions.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <QuestionEditor questions={previewQuestions} onChange={setPreviewQuestions} />
                  <div className="flex gap-2">
                    <Button onClick={addPreviewToExam}>Add All to Exam</Button>
                    <Button variant="outline" onClick={() => setPreviewQuestions([])}>
                      Discard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Tabs defaultValue="ai">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai">AI Generate</TabsTrigger>
                <TabsTrigger value="pdf">PDF Import</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="mt-4">
                <AIQuestionGenerator
                  onQuestionsGenerated={handleAIQuestions}
                  remainingQuestions={aiRemaining}
                />
              </TabsContent>
              <TabsContent value="pdf" className="mt-4">
                <PDFExamParser onQuestionsGenerated={handlePDFQuestions} />
              </TabsContent>
            </Tabs>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="publish">Published</Label>
                    <Switch
                      id="publish"
                      checked={exam.is_published}
                      onCheckedChange={(checked) => setExam({ ...exam, is_published: checked })}
                    />
                  </div>
                  <Button onClick={saveExam} disabled={saving} className="w-full">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
