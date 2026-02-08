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
            'fixed left-0 top-0 z-40 hidden h-screen border-r bg-sidebar transition-all duration-300 md:block',
            sidebarOpen ? 'w-64' : 'w-16'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar Header — hamburger + logo always visible */}
            <div className="flex h-16 items-center gap-2 border-b px-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Link
                to="/dashboard"
                className={cn(
                  'text-lg font-semibold text-sidebar-foreground truncate transition-opacity duration-200',
                  !sidebarOpen && 'sr-only'
                )}
              >
                Holooms
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                const linkContent = (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
                      !sidebarOpen && 'justify-center px-0'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                );

                if (!sidebarOpen) {
                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </nav>

            {/* Bottom Section: ThemeToggle + Sign Out */}
            <div className="border-t p-3 space-y-2">
              {sidebarOpen && (
                <p className="truncate text-sm text-muted-foreground px-1">{user?.email}</p>
              )}

              {/* Theme Toggle */}
              <div className={cn('flex', sidebarOpen ? 'px-1' : 'justify-center')}>
                <ThemeToggle />
              </div>

              {/* Sign Out */}
              {sidebarOpen ? (
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleSignOut}
                  className="w-full justify-start"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Sign Out
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSignOut}
                      className="w-full"
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 h-screen w-64 border-r bg-sidebar transition-transform duration-300 md:hidden',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link to="/dashboard" className="text-lg font-semibold text-sidebar-foreground">
                Holooms
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 space-y-1 p-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t p-4 space-y-2">
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="default"
                onClick={handleSignOut}
                className="w-full justify-start"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content — no top header bar */}
        <main
          className={cn(
            'flex-1 transition-all duration-300',
            'md:ml-64',
            !sidebarOpen && 'md:ml-16'
          )}
        >
          {/* Mobile-only slim header with hamburger */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-foreground">Holooms</span>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
