import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  Sun,
  Moon,
} from 'lucide-react';
import holoomsLogo from '@/assets/holooms-logo.png';
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

  // Derive page title from current route
  const getPageTitle = () => {
    const match = navItems.find((item) => location.pathname === item.to);
    if (match) return match.label;
    if (location.pathname.startsWith('/exams/edit')) return 'Edit Exam';
    if (location.pathname.startsWith('/exams/create')) return 'Create Exam';
    return 'Dashboard';
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 hidden h-screen flex-col md:flex',
            'bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
            'transition-[width] duration-300 ease-in-out',
            sidebarOpen ? 'w-[260px]' : 'w-[68px]'
          )}
        >
          {/* Header: Hamburger + Logo */}
          <div className="flex h-14 items-center gap-3 shrink-0 px-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0',
                'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            {sidebarOpen && (
              <Link to="/dashboard">
                <img src={holoomsLogo} alt="Holooms" className="h-9 w-auto" />
              </Link>
            )}
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
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </nav>

          {/* Bottom Section */}
          <div className="shrink-0 border-t border-sidebar-border px-2 py-3 space-y-1">
            {/* User email */}
            {sidebarOpen && user?.email && (
              <p className="truncate text-xs text-sidebar-foreground/50 px-3 pb-1">
                {user.email}
              </p>
            )}

            {/* Theme Toggle */}
            <div className={cn(
              'flex items-center rounded-lg px-3 py-2 transition-colors',
              'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              !sidebarOpen && 'justify-center px-0'
            )}>
              <ThemeToggle />
              {sidebarOpen && (
                <span className="ml-3 text-sm font-medium">Theme</span>
              )}
            </div>

            {/* Sign Out */}
            {sidebarOpen ? (
              <button
                onClick={handleSignOut}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
                      'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
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
            'bg-sidebar text-sidebar-foreground',
            'transition-transform duration-300 ease-in-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between px-4">
              <Link to="/dashboard">
                <img src={holoomsLogo} alt="Holooms" className="h-9 w-auto" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border px-2 py-3 space-y-1">
              {user?.email && (
                <p className="truncate text-xs text-sidebar-foreground/50 px-3 pb-1">
                  {user.email}
                </p>
              )}
              <div className="flex items-center px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <ThemeToggle />
                <span className="ml-3 text-sm font-medium">Theme</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150"
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
          {/* Mobile header - only hamburger + brand */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src={holoomsLogo} alt="Holooms" className="h-8 w-auto" />
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
