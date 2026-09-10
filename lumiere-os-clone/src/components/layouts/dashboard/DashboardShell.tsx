import { ReactNode } from 'react';

interface DashboardShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  mobileNav: ReactNode;
  subscriptionBanner: ReactNode;
  children: ReactNode;
}

export function DashboardShell({
  sidebar,
  topbar,
  mobileNav,
  subscriptionBanner,
  children
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#050505] flex text-white font-sans antialiased">
      {/* Sidebar Desktop Component */}
      {sidebar}

      {/* Main Page Area Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        {/* Topbar Navigation Header */}
        {topbar}

        {/* Subscription / Warranty Banner alerts */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {subscriptionBanner}
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileNav}
    </div>
  );
}
