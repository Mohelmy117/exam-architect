import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileUp, BookOpen, Check, ArrowRight } from 'lucide-react';
import { HoloomsLogo } from '@/components/HoloomsLogo';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <HoloomsLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="container flex flex-col items-center py-24 text-center md:py-32 lg:py-40">
            <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by AI
            </Badge>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Build smarter exams{' '}
              <span className="gradient-text">in minutes</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Create exams with AI, extract questions from PDFs, and generate
              explanations — all in one platform built for educators.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button size="lg" className="h-12 gap-2 px-8 text-base gradient-bg border-0" asChild>
                <Link to="/auth">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Everything you need to create exams
              </h2>
              <p className="mt-4 text-muted-foreground">
                From question generation to detailed explanations — streamline your
                entire exam workflow.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
              <FeatureCard
                icon={Sparkles}
                title="AI Question Generation"
                description="Enter a topic and let AI create well-structured questions with multiple choice options instantly."
              />
              <FeatureCard
                icon={FileUp}
                title="PDF Exam Import"
                description="Upload any PDF exam and automatically extract questions, answers, and formatting in seconds."
              />
              <FeatureCard
                icon={BookOpen}
                title="Smart Explanations"
                description="Generate clear, detailed explanations for every question to help students learn from their mistakes."
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-muted-foreground">
                Start for free. Upgrade when you need more.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-3xl gap-6 md:grid-cols-2">
              {/* Free */}
              <Card className="relative flex flex-col border bg-card p-8">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Free</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">$0</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Perfect for trying things out.
                  </p>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  <PricingItem>Up to 5 exams</PricingItem>
                  <PricingItem>20 AI-generated questions</PricingItem>
                  <PricingItem>PDF import</PricingItem>
                </ul>

                <Button variant="outline" className="mt-8 w-full" asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </Card>

              {/* Pro */}
              <Card className="relative flex flex-col border-2 border-primary/30 bg-card p-8 shadow-lg shadow-primary/5">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-bg border-0">
                  Most Popular
                </Badge>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pro</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">$12</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    For educators who need more power.
                  </p>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  <PricingItem>Unlimited exams</PricingItem>
                  <PricingItem>Unlimited AI questions</PricingItem>
                  <PricingItem>PDF import &amp; export</PricingItem>
                  <PricingItem>Smart explanations</PricingItem>
                  <PricingItem>Priority support</PricingItem>
                </ul>

                <Button className="mt-8 w-full gradient-bg border-0" asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="flex items-center">
              <HoloomsLogo className="h-7 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Holooms. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="group border bg-card p-6 transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function PricingItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-foreground">
      <Check className="h-4 w-4 shrink-0 text-primary" />
      {children}
    </li>
  );
}
