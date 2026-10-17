import { useState, useEffect, type ReactNode } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { EntitlementsProvider } from '@/lib/entitlements-context';
import { AppShell } from '@/components/AppShell';
import { FloatingCoach } from '@/components/ui/FloatingCoach';
import type { Tab } from '@/lib/types';

// Screens
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Welcome } from '@/screens/onboarding/Welcome';
import { OnboardingSetup } from '@/screens/onboarding/OnboardingSetup';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { NewPasswordScreen } from '@/screens/auth/NewPasswordScreen';
import { CoachHome } from '@/screens/coach/CoachHome';
import { WeekManager } from '@/screens/coach/WeekManager';
import { CoachRulesPage, CoachSetup } from '@/screens/coach/CoachSetup';
import { COACH_TERMS_VERSION } from '@/lib/coach/api';
import { AthleteView } from '@/screens/coach/AthleteView';
import { JoinRoute, MyCoach } from '@/screens/coach/MyCoach';
import { RolePicker } from '@/screens/coach/RolePicker';
import { normalizeCode } from '@/lib/coach/insights';
import { authLinkLanding } from '@/lib/supabase';
import { Home } from '@/screens/home/Home';
import { Training } from '@/screens/training/Training';
import { ExerciseDetail } from '@/screens/training/ExerciseDetail';
import { ProgrammeDetail } from '@/screens/training/ProgrammeDetail';
import { ActiveWorkout } from '@/screens/training/ActiveWorkout';
import { WorkoutCompletion } from '@/screens/training/WorkoutCompletion';
import { WorkoutHistory } from '@/screens/progress/WorkoutHistory';
import { Progress } from '@/screens/progress/Progress';
import { AiCoach } from '@/screens/aicoach/AiCoach';
import { Profile } from '@/screens/profile/Profile';
import { EditProfile } from '@/screens/profile/EditProfile';
import { Settings } from '@/screens/profile/Settings';
import { NutritionSection } from '@/screens/nutrition/NutritionSection';
import { Recovery } from '@/screens/recovery/Recovery';
import { BiometricAssessment } from '@/screens/onboarding/BiometricAssessment';
import { RoutineGenerator } from '@/screens/training/RoutineGenerator';
import { TrainingCoach } from '@/screens/training/coach/TrainingCoach';
import { MemoryPage } from '@/screens/profile/MemoryPage';
import { ConsentProvider, useConsent } from '@/lib/consent-context';
import { HealthConsent } from '@/screens/legal/HealthConsent';
import { PrivacyPolicyPage } from '@/screens/legal/PrivacyPolicyPage';
import { AiConsentGate } from '@/components/privacy/AiConsentGate';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LanguagePicker } from '@/screens/onboarding/LanguagePicker';

function AppContent() {
  const { session, profile, loading, profileLoading, recovering } = useAuth();
  const consent = useConsent();
  const { t, chosen: languageChosen } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>('routines');

  // Sync active tab with route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/home') setActiveTab('routines');
    else if (path.startsWith('/training') || path.startsWith('/exercise') || path.startsWith('/programme') || path.startsWith('/workout')) setActiveTab('routines');
    else if (path.startsWith('/recovery')) setActiveTab('recover');
    else if (path.startsWith('/nutrition')) setActiveTab('nutrition');
    else if (path.startsWith('/profile') || path.startsWith('/settings') || path.startsWith('/progress') || path.startsWith('/edit-profile') || path.startsWith('/workout-history')) setActiveTab('account');
    else if (path.startsWith('/ai-coach') || path.startsWith('/memory')) setActiveTab('account');
  }, [location.pathname]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-bg flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-3 border-ink-border border-t-lime rounded-full animate-spin" />
        <p className="text-sm text-cloud-dim mt-4">{t('app.loading')}</p>
      </div>
    );
  }

  // Back from a confirmation / reset link: the tokens were in the hash, which the router would read as a path.
  if (session && authLinkLanding && /access_token|type=/.test(location.pathname + location.hash)) {
    return <Navigate to="/" replace />;
  }

  if (session && recovering) return <NewPasswordScreen />;

  // Public privacy policy — reachable signed in or out (App Store 5.1.1(i), Google Play User Data policy)
  if (location.pathname === '/privacy') {
    return <PrivacyPolicyPage onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />;
  }

  // Not authenticated — show welcome / auth
  if (!session) {
    // An invite link opened before signing in: keep the coach code, then create the account.
    if (location.pathname.startsWith('/join/')) {
      try { localStorage.setItem('startfit.joinCode', normalizeCode(decodeURIComponent(location.pathname.slice(6)))); } catch { /* ignore */ }
      return <AuthScreen initialMode="signup" onBack={() => navigate('/')} />;
    }
    if (location.pathname === '/signin') {
      return <AuthScreen initialMode="signin" onBack={() => navigate('/')} />;
    }
    if (location.pathname === '/signup') {
      return <AuthScreen initialMode="signup" onBack={() => navigate('/')} />;
    }
    if (location.pathname === '/onboarding-setup') {
      return <Navigate to="/" replace />;
    }
    if (location.pathname === '/get-started') {
      return (
        <AuthScreen initialMode="signup" onBack={() => navigate('/')} />
      );
    }
    return (
      <Welcome
        onGetStarted={() => navigate('/signup')}
        onSignIn={() => navigate('/signin')}
      />
    );
  }

  // Authenticated but profile not loaded yet
  if (profileLoading && !profile) {
    return (
      <div className="min-h-screen bg-ink-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-ink-border border-t-lime rounded-full animate-spin" />
        <p className="text-xs text-cloud-dim mt-3">{t('app.settingUpProfile')}</p>
      </div>
    );
  }

  // Right after sign-in: ask which language the whole app (and the coaches) should use.
  if (profile && !languageChosen) {
    return <LanguagePicker />;
  }

  // Explicit consent to health-data processing comes before any health data is collected (UK GDPR Art. 9(2)(a))
  if (consent.loading) {
    return (
      <div className="min-h-screen bg-ink-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-ink-border border-t-lime rounded-full animate-spin" />
      </div>
    );
  }
  if (consent.available && !consent.health) {
    return <HealthConsent />;
  }

  // Coach or athlete (asked once; an invite link already answers it).
  if (profile && !profile.account_type && !location.pathname.startsWith('/join/')) {
    return <RolePicker />;
  }

  // Authenticated but onboarding not completed
  // Coaches skip the athlete questionnaire (they can fill their own profile later from Edit profile).
  const isCoach = profile?.account_type === 'coach';
  if (profile && !profile.onboarding_completed && !isCoach) {
    if (location.pathname === '/onboarding-setup') {
      return (
        <OnboardingSetup
          onComplete={() => navigate('/')}
          onBack={() => navigate('/')}
        />
      );
    }
    return <Navigate to="/onboarding-setup" replace />;
  }

  // Coaches set up their public profile and accept the coach rules before anything else (athletes cannot join before).
  if (isCoach && profile?.coach_terms_version !== COACH_TERMS_VERSION && location.pathname !== '/coach/rules') {
    return <CoachSetup />;
  }

  // Authenticated with onboarding complete — main app
  const navigateToScreen = (screen: { name: string; [key: string]: string | null }) => {
    switch (screen.name) {
      case 'home': navigate('/'); break;
      case 'training': navigate('/training'); break;
      case 'ai-coach': navigate('/ai-coach'); break;
      case 'profile': navigate('/profile'); break;
      case 'exercise-library': navigate('/training'); break;
      case 'exercise-detail': navigate(`/exercise/${screen.exerciseId}`); break;
      case 'programme-detail': navigate(`/programme/${screen.planId}`); break;
      case 'active-workout': navigate(`/workout/${screen.planId ?? 'free'}`); break;
      case 'workout-completion': navigate(`/workout-complete/${screen.sessionId}`); break;
      case 'workout-history': navigate('/workout-history'); break;
      case 'progress': navigate('/progress'); break;
      case 'settings': navigate('/settings'); break;
      case 'edit-profile': navigate('/edit-profile'); break;
      case 'nutrition': navigate('/nutrition'); break;
      case 'recovery': navigate('/recovery'); break;
      case 'biometric-assessment': navigate('/biometric-assessment'); break;
      case 'exercise-vault': navigate('/exercise-vault'); break;
      case 'training-coach': navigate('/training/coach'); break;
      case 'start-exercise': navigate(`/workout/free?exercise=${screen.exerciseId}`); break;
      case 'routine-generator': navigate('/routine-generator'); break;
      case 'memory': navigate('/memory'); break;
      case 'goal-plan': navigate('/nutrition/goal'); break;
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'routines': navigate('/training'); break;
      case 'exercises': navigate('/training'); break;
      case 'workout': navigate('/'); break;
      case 'nutrition': navigate('/nutrition'); break;
      case 'recover': navigate('/recovery'); break;
      case 'account': navigate('/profile'); break;
    }
  };

  // Determine if we should hide bottom nav
  const hideNavRoutes = ['/workout/'];
  const fullScreenRoute = hideNavRoutes.some((r) => location.pathname.startsWith(r)) ||
    location.pathname === '/onboarding-setup' || location.pathname === '/coach/profile';

  // Determine if this is an exercise detail page (full-screen viewer)
  const isExerciseDetail = location.pathname.startsWith('/exercise/');
  // The nutrition coach is a full-height chat with its own input bar and back button,
  // so the bottom nav and the floating overlays are hidden there.
  const isNutritionCoach = location.pathname.startsWith('/nutrition/coach') || location.pathname.startsWith('/training/coach');
  // Exercise and routine pages have their own back button and a fixed action bar at the bottom.
  const hasOwnActionBar = isExerciseDetail || location.pathname.startsWith('/programme/');
  const hideNav = fullScreenRoute || isNutritionCoach || hasOwnActionBar;
  // Coach screens have their own chat bar; the floating AI coach button would cover it.
  const isCoachRoute = location.pathname.startsWith('/coach') || location.pathname.startsWith('/my-coach') || (isCoach && location.pathname === '/');

  return (
    <>
      <AppShell isCoach={isCoach} activeTab={activeTab} onTabChange={handleTabChange} onNavigate={(path) => navigate(path)} hideNav={hideNav}>
        <Routes>
          <Route path="/" element={isCoach ? <ErrorBoundary label="Coach"><CoachHome /></ErrorBoundary> : <Home onNavigate={navigateToScreen} onTabChange={handleTabChange} />} />
          <Route path="/me" element={<Home onNavigate={navigateToScreen} onTabChange={handleTabChange} />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/training" element={<Training onNavigate={navigateToScreen} />} />
          <Route path="/training/coach" element={<ErrorBoundary label="Training coach"><TrainingCoach /></ErrorBoundary>} />
          <Route path="/memory" element={<ErrorBoundary label="Memory"><MemoryPage /></ErrorBoundary>} />
          <Route path="/exercise/:exerciseId" element={<ExerciseDetailWrapper />} />
          <Route path="/programme/:planId" element={<ProgrammeDetailWrapper />} />
          <Route path="/workout/:planId" element={<ActiveWorkoutWrapper />} />
          <Route path="/workout-complete/:sessionId" element={<WorkoutCompletionWrapper />} />
          <Route path="/workout-history" element={<WorkoutHistory onBack={() => navigate('/profile')} onNavigate={navigateToScreen} />} />
          <Route path="/progress" element={<Progress onBack={() => navigate('/')} onNavigate={navigateToScreen} />} />
          <Route path="/ai-coach" element={<AiConsentRoute><AiCoach /></AiConsentRoute>} />
          <Route path="/profile" element={<ErrorBoundary label="Account"><Profile onNavigate={navigateToScreen} /></ErrorBoundary>} />
          <Route path="/edit-profile" element={<EditProfile onBack={() => navigate('/profile')} />} />
          <Route path="/settings" element={<Settings onBack={() => navigate('/profile')} />} />
          <Route path="/nutrition/*" element={<ErrorBoundary label="Nutrition"><NutritionSection /></ErrorBoundary>} />
          <Route path="/recovery" element={<ErrorBoundary label="Recovery"><Recovery onBack={() => navigate('/')} /></ErrorBoundary>} />
          <Route path="/biometric-assessment" element={<BiometricAssessment onBack={() => navigate('/profile')} onComplete={() => navigate('/profile')} />} />
          <Route path="/routine-generator" element={<AiConsentRoute><RoutineGenerator onBack={() => navigate('/training')} /></AiConsentRoute>} />
          <Route path="/coach" element={isCoach ? <Navigate to="/" replace /> : <ErrorBoundary label="Coach"><CoachHome /></ErrorBoundary>} />
          <Route path="/coach/profile" element={<ErrorBoundary label="Coach profile"><CoachSetup mode="edit" /></ErrorBoundary>} />
          <Route path="/coach/rules" element={<ErrorBoundary label="Coach rules"><CoachRulesPage /></ErrorBoundary>} />
          <Route path="/coach/week" element={<ErrorBoundary label="Week"><WeekManager /></ErrorBoundary>} />
          <Route path="/coach/athlete/:id" element={<ErrorBoundary label="Athlete"><AthleteView /></ErrorBoundary>} />
          <Route path="/my-coach" element={<ErrorBoundary label="My coach"><MyCoach /></ErrorBoundary>} />
          <Route path="/join/:code" element={<JoinRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      {/* On the nutrition coach page these overlays are only hidden (not unmounted) so they keep their state. */}
      {!fullScreenRoute && !hasOwnActionBar && !isCoachRoute && (
        <div className={isNutritionCoach ? 'hidden' : undefined}>
          <FloatingCoach />
        </div>
      )}
    </>
  );
}

// Wrapper components to extract route params
import { useParams, useSearchParams } from 'react-router-dom';

function ExerciseDetailWrapper() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  if (!exerciseId) return <Navigate to="/training" replace />;
  return (
    <ExerciseDetail
      key={exerciseId}
      exerciseId={exerciseId}
      onBack={() => navigate(-1)}
      onStartExercise={(id) => navigate(`/workout/free?exercise=${id}`)}
      onOpenExercise={(id) => navigate(`/exercise/${id}`)}
    />
  );
}

function ProgrammeDetailWrapper() {
  const { planId } = useParams();
  const navigate = useNavigate();
  if (!planId) return <Navigate to="/training" replace />;
  return (
    <ProgrammeDetail
      planId={planId}
      onBack={() => navigate('/training')}
      onStartWorkout={(pid, day) => navigate(day == null ? `/workout/${pid}` : `/workout/${pid}?day=${day}`)}
      onOpenExercise={(id) => navigate(`/exercise/${id}`)}
      onOpenPlan={(pid) => navigate(`/training/coach?routine=${pid}`)}
      onOpenProgramme={(pid) => navigate(`/programme/${pid}`)}
    />
  );
}

function ActiveWorkoutWrapper() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pid = planId === 'free' ? null : (planId ?? null);
  const dayParam = params.get('day');
  const day = dayParam != null && /^\d+$/.test(dayParam) ? Number(dayParam) : null;
  return (
    <ActiveWorkout
      key={`${planId}-${day ?? ''}-${params.get('exercise') ?? ''}`}
      planId={pid}
      day={day}
      exerciseId={pid ? null : params.get('exercise')}
      onBack={() => navigate('/training')}
      onComplete={(sessionId) => navigate(`/workout-complete/${sessionId}`)}
    />
  );
}

function WorkoutCompletionWrapper() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  if (!sessionId) return <Navigate to="/" replace />;
  return (
    <WorkoutCompletion
      sessionId={sessionId}
      onBack={() => navigate('/training')}
      onGoHome={() => navigate('/')}
      onRefuel={() => navigate('/nutrition/add?meal=post_workout')}
    />
  );
}

function AiConsentRoute({ children }: { children: ReactNode }) {
  return (
    <AiConsentGate fallbackWrapper={(card) => <div className="min-h-screen bg-ink-bg px-5 pt-10 pb-28"><div className="mx-auto max-w-md">{card}</div></div>}>
      {children}
    </AiConsentGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
      <ConsentProvider>
        <EntitlementsProvider>
          <HashRouter>
            <AppContent />
          </HashRouter>
        </EntitlementsProvider>
      </ConsentProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
