import { ChevronRight, Activity, Sparkles, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WelcomeProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function Welcome({ onGetStarted, onSignIn }: WelcomeProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="absolute inset-0">
        <img
          src="/hero-onboarding.webp"
          alt="Athlete training"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-overlay" />
      </div>

      <div className="relative flex-1 flex flex-col justify-end px-6 pb-10 safe-top">
        <div className="flex items-center gap-2.5 mb-8 animate-fade-in-up">
          <div className="w-11 h-11 rounded-xl bg-lime flex items-center justify-center shadow-lime">
            <Dumbbell className="w-6 h-6 text-ink-bg" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold text-cloud tracking-tight">StartFit</span>
        </div>

        <h1 className="text-display-xl leading-[1.05] mb-4 text-balance animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-cloud block">Train Smarter.</span>
          <span className="text-lime block">Become Stronger.</span>
        </h1>

        <p className="text-base text-cloud-dim leading-relaxed max-w-sm mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Your premium fitness companion. Personalised workouts, expert guidance, and AI-powered coaching — all in one app.
        </p>

        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Button size="lg" onClick={onGetStarted} className="w-full">
            Get Started
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button size="lg" variant="ghost" onClick={onSignIn} className="w-full text-cloud/80 hover:text-cloud">
            I already have an account
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 mt-8 text-cloud-muted animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            <span className="text-xs">Workouts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">AI Coach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4" />
            <span className="text-xs">27 Exercises</span>
          </div>
        </div>
      </div>
    </div>
  );
}
