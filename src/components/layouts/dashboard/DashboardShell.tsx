import { ReactNode } from 'react';

interface DashboardShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  mobileNav: ReactNode;
  subscriptionBanner: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ sidebar, topbar, mobileNav, subscriptionBanner, children }: DashboardShellProps) {
  return (
    <div className="dashboard-modern min-h-screen bg-background flex text-foreground font-sans antialiased">
      {sidebar}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {topbar}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {subscriptionBanner}
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
      {mobileNav}
    </div>
  );
}
