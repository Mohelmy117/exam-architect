import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Clock, Users } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">
            ExamBuilder
          </Link>
          <Button asChild>
            <Link to="/auth">Get Started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Create Exams with <span className="text-primary">AI Power</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Build professional exams in minutes. Use AI to generate questions, import from PDFs,
            or create manually. Share with students and track their progress.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/auth">Start Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Learn More</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/50 py-24">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">Features</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-6">
                <Sparkles className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">AI Generation</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate questions from any topic using advanced AI
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <FileText className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">PDF Import</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Import existing exams from PDF documents
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <Clock className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Timed Exams</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Set time limits with countdown timers
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <Users className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">Easy Sharing</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Share exams with a simple link
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2024 ExamBuilder. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
