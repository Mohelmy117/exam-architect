import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Exam } from '@/types/exam';
import { Edit, Trash2, Copy, ExternalLink, Clock, PlusCircle, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function ExamsList() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load exams');
    } else {
      setExams(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExams();
  }, [user]);

  const copyExamLink = (examId: string) => {
    const link = `${window.location.origin}/exam/${examId}`;
    navigator.clipboard.writeText(link);
    toast.success('Exam link copied to clipboard!');
  };

  const deleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;

    const { error } = await supabase.from('exams').delete().eq('id', examId);
    if (error) {
      toast.error('Failed to delete exam');
    } else {
      toast.success('Exam deleted');
      fetchExams();
    }
  };

  const togglePublish = async (exam: Exam) => {
    const { error } = await supabase
      .from('exams')
      .update({ is_published: !exam.is_published })
      .eq('id', exam.id);

    if (error) {
      toast.error('Failed to update exam');
    } else {
      toast.success(exam.is_published ? 'Exam unpublished' : 'Exam published');
      fetchExams();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Exams</h1>
            <p className="text-muted-foreground">Manage and share your exams</p>
          </div>
          <Button asChild>
            <Link to="/exams/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Exam
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : exams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No exams yet. Create your first exam!</p>
              <Button asChild className="mt-4">
                <Link to="/exams/create">Create Exam</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam) => (
              <Card key={exam.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {exam.title}
                        {exam.is_published ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{exam.description || 'No description'}</CardDescription>
                    </div>
                    {exam.time_limit_minutes && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {exam.time_limit_minutes} min
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/exams/edit/${exam.id}`}>
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyExamLink(exam.id!)}
                      disabled={!exam.is_published}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Copy Link
                    </Button>
                    <Button variant="default" size="sm" asChild disabled={!exam.is_published}>
                      <Link to={`/exam/${exam.id}`}>
                        <Play className="mr-1 h-4 w-4" />
                        Start Exam
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild disabled={!exam.is_published}>
                      <a href={`/exam/${exam.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Preview
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePublish(exam)}
                    >
                      {exam.is_published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteExam(exam.id!)}
                    >
                      <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
