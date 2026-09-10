import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { APP_INFO } from '../../config/appInfo';
import { InteractiveTour } from '../InteractiveTour';

// Modular Components
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardTopbar } from './dashboard/DashboardTopbar';
import { DashboardMobileNavigation } from './dashboard/DashboardMobileNavigation';
import { DashboardSubscriptionBanner } from './dashboard/DashboardSubscriptionBanner';
import { DashboardShell } from './dashboard/DashboardShell';
import { DashboardWorkspace } from './dashboard/DashboardWorkspace';
import { DashboardDialogs } from './dashboard/DashboardDialogs';
import { getNavigationByRole } from './dashboard/getNavigationByRole';

export default function DashboardLayout() {
  const { userData, salonData, isPlatformAdmin, logout } = useAuth();

  // Dialog States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isFounderDetailOpen, setIsFounderDetailOpen] = useState(false);
  const [isUpdatesDialogOpen, setIsUpdatesDialogOpen] = useState(false);
  const [hasNewVersionNotice, setHasNewVersionNotice] = useState(false);
  const [isDeletionRequestedOpen, setIsDeletionRequestedOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('lumiere_last_seen_version');
    if (lastSeenVersion !== APP_INFO.version) {
      setHasNewVersionNotice(true);
    }
  }, []);

  const navigation = getNavigationByRole(userData?.role);

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          navigation={navigation}
          isPlatformAdmin={!!isPlatformAdmin}
          userData={userData}
          salonData={salonData}
          hasNewVersionNotice={hasNewVersionNotice}
          onOpenUpdates={() => setIsUpdatesDialogOpen(true)}
          onOpenDeletionModal={() => setIsDeletionRequestedOpen(true)}
          logout={logout}
        />
      }
      topbar={
        <DashboardTopbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onOpenRoadmap={() => setIsRoadmapOpen(true)}
          onOpenFounderDetail={() => setIsFounderDetailOpen(true)}
          onOpenUpdates={() => setIsUpdatesDialogOpen(true)}
          navigation={navigation}
        />
      }
      mobileNav={
        <DashboardMobileNavigation
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          navigation={navigation}
          isPlatformAdmin={!!isPlatformAdmin}
          userData={userData}
          salonData={salonData}
          hasNewVersionNotice={hasNewVersionNotice}
          onOpenGuide={() => setIsGuideOpen(true)}
          onOpenRoadmap={() => setIsRoadmapOpen(true)}
          onOpenUpdates={() => setIsUpdatesDialogOpen(true)}
          onOpenDeletionModal={() => setIsDeletionRequestedOpen(true)}
          logout={logout}
        />
      }
      subscriptionBanner={
        <DashboardSubscriptionBanner
          salonData={salonData}
          isPlatformAdmin={!!isPlatformAdmin}
        />
      }
    >
      <DashboardWorkspace />

      <DashboardDialogs
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
        isFounderDetailOpen={isFounderDetailOpen}
        setIsFounderDetailOpen={setIsFounderDetailOpen}
        isRoadmapOpen={isRoadmapOpen}
        setIsRoadmapOpen={setIsRoadmapOpen}
        isUpdatesDialogOpen={isUpdatesDialogOpen}
        setIsUpdatesDialogOpen={setIsUpdatesDialogOpen}
        setHasNewVersionNotice={setHasNewVersionNotice}
        isDeletionRequestedOpen={isDeletionRequestedOpen}
        setIsDeletionRequestedOpen={setIsDeletionRequestedOpen}
        isDeletingAccount={isDeletingAccount}
        setIsDeletingAccount={setIsDeletingAccount}
        isPlatformAdmin={!!isPlatformAdmin}
        salonData={salonData}
        userData={userData}
      />

      <InteractiveTour />
    </DashboardShell>
  );
}
