import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Loader2, TrendingUp, Users, Target, Award, BarChart3 } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
}

interface Attempt {
  id: string;
  exam_id: string;
  score: number | null;
  student_name: string | null;
  student_email: string | null;
  started_at: string;
  submitted_at: string | null;
}

interface Question {
  id: string;
  exam_id: string;
  question_text: string;
  correct_answer: string | null;
}

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('exams')
        .select('id, title')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      setExams(data || []);
    };
    fetchExams();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || exams.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const examIds = selectedExam === 'all' ? exams.map(e => e.id) : [selectedExam];

      const [attemptsRes, questionsRes] = await Promise.all([
        supabase
          .from('exam_attempts')
          .select('*')
          .in('exam_id', examIds)
          .not('submitted_at', 'is', null),
        supabase
          .from('questions')
          .select('*')
          .in('exam_id', examIds),
      ]);

      setAttempts(attemptsRes.data || []);
      setQuestions(questionsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user, exams, selectedExam]);

  // Calculate statistics
  const completedAttempts = attempts.filter(a => a.submitted_at && a.score !== null);
  const totalAttempts = completedAttempts.length;
  const averageScore = totalAttempts > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts)
    : 0;
  const passRate = totalAttempts > 0
    ? Math.round((completedAttempts.filter(a => (a.score || 0) >= 60).length / totalAttempts) * 100)
    : 0;
  const highestScore = totalAttempts > 0
    ? Math.max(...completedAttempts.map(a => a.score || 0))
    : 0;

  // Score distribution data
  const scoreRanges = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 },
  ];
  
  const scoreDistribution = scoreRanges.map(({ range, min, max }) => ({
    range,
    count: completedAttempts.filter(a => {
      const score = a.score || 0;
      return score >= min && score <= max;
    }).length,
  }));

  // Pass/Fail pie chart data
  const passFailData = [
    { name: 'Passed', value: completedAttempts.filter(a => (a.score || 0) >= 60).length, color: 'hsl(var(--chart-2))' },
    { name: 'Failed', value: completedAttempts.filter(a => (a.score || 0) < 60).length, color: 'hsl(var(--chart-1))' },
  ].filter(d => d.value > 0);

  // Attempts over time (last 30 days)
  const last30Days = [...Array(30)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  const attemptsOverTime = last30Days.map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attempts: completedAttempts.filter(a => 
      a.submitted_at?.split('T')[0] === date
    ).length,
  }));

  // Top performers
  const topPerformers = [...completedAttempts]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5)
    .map(a => ({
      name: a.student_name || a.student_email?.split('@')[0] || 'Anonymous',
      score: a.score || 0,
      exam: exams.find(e => e.id === a.exam_id)?.title || 'Unknown Exam',
    }));

  // Exam comparison (for "all" view)
  const examComparison = exams.map(exam => {
    const examAttempts = completedAttempts.filter(a => a.exam_id === exam.id);
    const avgScore = examAttempts.length > 0
      ? Math.round(examAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / examAttempts.length)
      : 0;
    return {
      name: exam.title.length > 15 ? exam.title.substring(0, 15) + '...' : exam.title,
      average: avgScore,
      attempts: examAttempts.length,
    };
  }).filter(e => e.attempts > 0);

  if (loading && exams.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Track student performance and exam insights</p>
          </div>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select exam" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {exams.map(exam => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : totalAttempts === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {exams.length === 0 
                  ? "Create your first exam and share it with students to see analytics here."
                  : "Share your exams with students to start collecting performance data."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAttempts}</div>
                  <p className="text-xs text-muted-foreground">completed attempts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averageScore}%</div>
                  <p className="text-xs text-muted-foreground">across all attempts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{passRate}%</div>
                  <p className="text-xs text-muted-foreground">scored 60% or above</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{highestScore}%</div>
                  <p className="text-xs text-muted-foreground">best performance</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>Number of students in each score range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="range" className="text-xs" />
                        <YAxis allowDecimals={false} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Pass/Fail Ratio */}
              <Card>
                <CardHeader>
                  <CardTitle>Pass/Fail Ratio</CardTitle>
                  <CardDescription>Students who passed vs failed (60% threshold)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={passFailData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {passFailData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attempts Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Submissions Over Time</CardTitle>
                <CardDescription>Number of exam submissions in the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attemptsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        interval="preserveStartEnd"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis allowDecimals={false} className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="attempts" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>Students with the highest scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {topPerformers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No data available</p>
                  ) : (
                    <div className="space-y-4">
                      {topPerformers.map((performer, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                              index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                              index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{performer.name}</p>
                              <p className="text-xs text-muted-foreground">{performer.exam}</p>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">{performer.score}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Exam Comparison (only for "all" view) */}
              {selectedExam === 'all' && examComparison.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Comparison</CardTitle>
                    <CardDescription>Average scores across different exams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={examComparison} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" domain={[0, 100]} className="text-xs" />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={100} 
                            className="text-xs"
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value, name) => [
                              name === 'average' ? `${value}%` : value,
                              name === 'average' ? 'Avg Score' : 'Attempts'
                            ]}
                          />
                          <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}