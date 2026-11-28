import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { APP_INFO } from '../../config/appInfo';
import { InteractiveTour } from '../InteractiveTour';
import { subscribeForegroundPushMessages } from '../../lib/pushNotifications';

// Modular Components
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardTopbar } from './dashboard/DashboardTopbar';
import { DashboardMobileNavigation } from './dashboard/DashboardMobileNavigation';
import { DashboardSubscriptionBanner } from './dashboard/DashboardSubscriptionBanner';
import { DashboardShell } from './dashboard/DashboardShell';
import { DashboardWorkspace } from './dashboard/DashboardWorkspace';
import { DashboardDialogs } from './dashboard/DashboardDialogs';
import { getNavigationByRole } from './dashboard/getNavigationByRole';
import { GmailWorkspaceDialog } from '../workspace/GmailWorkspaceDialog';
import { GoogleCalendarDialog } from '../workspace/GoogleCalendarDialog';
import { GoogleContactsDialog } from '../workspace/GoogleContactsDialog';

export default function DashboardLayout() {
  const { userData, salonData, isPlatformAdmin, logout, currentUser } = useAuth();
  const navigate = useNavigate();

  // Dialog States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isFounderDetailOpen, setIsFounderDetailOpen] = useState(false);
  const [isUpdatesDialogOpen, setIsUpdatesDialogOpen] = useState(false);
  const [hasNewVersionNotice, setHasNewVersionNotice] = useState(false);
  const [isDeletionRequestedOpen, setIsDeletionRequestedOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [isGoogleCalendarOpen, setIsGoogleCalendarOpen] = useState(false);
  const [isGoogleContactsOpen, setIsGoogleContactsOpen] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('lumiere_last_seen_version');
    if (lastSeenVersion !== APP_INFO.version) {
      setHasNewVersionNotice(true);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !salonData?.id) return;
    const targetRoute =
      userData?.role === 'professional'
        ? '/dashboard/meu-painel?tab=agenda'
        : '/dashboard/agendamentos';
    return subscribeForegroundPushMessages(() => {
      navigate(targetRoute);
    });
  }, [currentUser, salonData?.id, userData?.role, navigate]);

  const navigation = getNavigationByRole(userData?.role, salonData, currentUser?.email || userData?.email, userData);

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
          onOpenGmail={() => setIsGmailOpen(true)}
          onOpenGoogleCalendar={() => setIsGoogleCalendarOpen(true)}
          onOpenGoogleContacts={() => setIsGoogleContactsOpen(true)}
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

      <GmailWorkspaceDialog
        open={isGmailOpen}
        onOpenChange={setIsGmailOpen}
        initialTab="inbox"
      />

      <GoogleCalendarDialog
        open={isGoogleCalendarOpen}
        onOpenChange={setIsGoogleCalendarOpen}
        initialTab="events"
        salonName={salonData?.name}
      />

      <GoogleContactsDialog
        open={isGoogleContactsOpen}
        onOpenChange={setIsGoogleContactsOpen}
        initialTab="google"
        salonName={salonData?.name}
      />

      <InteractiveTour />
    </DashboardShell>
  );
}
