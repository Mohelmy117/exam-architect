import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, PlusCircle, Users, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ exams: 0, questions: 0, attempts: 0, aiRemaining: 50 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const [examsRes, profileRes] = await Promise.all([
        supabase.from('exams').select('id', { count: 'exact' }).eq('created_by', user.id),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
      ]);

      const examIds = examsRes.data?.map((e) => e.id) || [];
      let questionsCount = 0;
      let attemptsCount = 0;

      if (examIds.length > 0) {
        const [questionsRes, attemptsRes] = await Promise.all([
          supabase.from('questions').select('id', { count: 'exact' }).in('exam_id', examIds),
          supabase.from('exam_attempts').select('id', { count: 'exact' }).in('exam_id', examIds),
        ]);
        questionsCount = questionsRes.count || 0;
        attemptsCount = attemptsRes.count || 0;
      }

      const profile = profileRes.data;
      const aiRemaining = profile
        ? profile.ai_questions_limit - profile.ai_questions_generated
        : 50;

      setStats({
        exams: examsRes.count || 0,
        questions: questionsCount,
        attempts: attemptsCount,
        aiRemaining,
      });
    };

    fetchStats();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your exams.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.exams}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.questions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Exam Attempts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.attempts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">AI Questions Left</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aiRemaining}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with creating or managing your exams</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button asChild>
              <Link to="/exams/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Exam
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/exams">
                <FileText className="mr-2 h-4 w-4" />
                View My Exams
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
