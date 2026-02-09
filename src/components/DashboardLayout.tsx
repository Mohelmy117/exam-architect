import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Menu,
  X,
  Home,
  FileText,
  PlusCircle,
  LogOut,
  Settings,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/exams', label: 'My Exams', icon: FileText },
  { to: '/exams/create', label: 'Create Exam', icon: PlusCircle },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 hidden h-screen flex-col md:flex',
            'bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]',
            'transition-[width] duration-300 ease-in-out',
            sidebarOpen ? 'w-[260px]' : 'w-[68px]'
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'flex h-14 items-center shrink-0',
              sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'
            )}
          >
            {sidebarOpen && (
              <Link
                to="/dashboard"
                className="text-base font-semibold tracking-tight text-[hsl(var(--sidebar-accent-foreground))] transition-opacity duration-200"
              >
                Holooms
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                'text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))]'
              )}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;

              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
                    !sidebarOpen && 'justify-center px-0'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {sidebarOpen && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );

              if (!sidebarOpen) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] border-[hsl(var(--sidebar-border))]"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </nav>

          {/* Bottom Section */}
          <div className="shrink-0 border-t border-[hsl(var(--sidebar-border))] px-2 py-3 space-y-1">
            {/* User email */}
            {sidebarOpen && (
              <p className="truncate text-xs text-[hsl(var(--sidebar-muted))] px-3 pb-1">
                {user?.email}
              </p>
            )}

            {/* Theme Toggle */}
            <div className={cn('flex items-center rounded-lg px-3 py-1.5', !sidebarOpen && 'justify-center px-0')}>
              <ThemeToggle />
              {sidebarOpen && (
                <span className="ml-3 text-sm text-[hsl(var(--sidebar-foreground))]">Theme</span>
              )}
            </div>

            {/* Sign Out */}
            {sidebarOpen ? (
              <button
                onClick={handleSignOut}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                )}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Sign Out</span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className={cn(
                      'flex w-full items-center justify-center rounded-lg py-2.5 transition-colors duration-150',
                      'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                    )}
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] border-[hsl(var(--sidebar-border))]"
                >
                  Sign Out
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </aside>

        {/* Mobile Overlay */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300',
            mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 h-screen w-[280px] md:hidden',
            'bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]',
            'transition-transform duration-300 ease-in-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between px-4">
              <Link
                to="/dashboard"
                className="text-base font-semibold tracking-tight text-[hsl(var(--sidebar-accent-foreground))]"
              >
                Holooms
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                        : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[hsl(var(--sidebar-border))] px-2 py-3 space-y-1">
              <p className="truncate text-xs text-[hsl(var(--sidebar-muted))] px-3 pb-1">
                {user?.email}
              </p>
              <div className="flex items-center px-3 py-1.5">
                <ThemeToggle />
                <span className="ml-3 text-sm text-[hsl(var(--sidebar-foreground))]">Theme</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors duration-150"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-[margin] duration-300 ease-in-out',
            sidebarOpen ? 'md:ml-[260px]' : 'md:ml-[68px]'
          )}
        >
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-foreground">Holooms</span>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
