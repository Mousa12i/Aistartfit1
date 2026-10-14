import { ReactNode } from 'react';
import { Dumbbell, Layers, Play, HeartPulse, User, Home, Brain, Apple, TrendingUp, Settings, Search, Bell, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntitlements } from '@/lib/entitlements-context';
import type { Tab } from '@/lib/types';

interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onNavigate?: (path: string) => void;
  children: ReactNode;
  hideNav?: boolean;
}

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'routines', label: 'Routines', icon: Layers },
  { key: 'exercises', label: 'Exercises', icon: Dumbbell },
  { key: 'workout', label: 'Workout', icon: Play },
  { key: 'nutrition', label: 'Nutrition', icon: Apple },
  { key: 'recover', label: 'Recover', icon: HeartPulse },
  { key: 'account', label: 'Account', icon: User },
];

const DESKTOP_NAV: { label: string; path: string; icon: LucideIcon; tab: Tab }[] = [
  { label: 'Home', path: '/', icon: Home, tab: 'routines' },
  { label: 'Training', path: '/training', icon: Dumbbell, tab: 'routines' },
  { label: 'Exercise Library', path: '/training', icon: Layers, tab: 'exercises' },
  { label: 'AI Coach', path: '/ai-coach', icon: Brain, tab: 'account' },
  { label: 'Nutrition', path: '/nutrition', icon: Apple, tab: 'nutrition' },
  { label: 'Progress', path: '/progress', icon: TrendingUp, tab: 'account' },
  { label: 'Recover', path: '/recovery', icon: HeartPulse, tab: 'recover' },
  { label: 'Settings', path: '/settings', icon: Settings, tab: 'account' },
];

export function AppShell({ activeTab, onTabChange, onNavigate, children, hideNav }: AppShellProps) {
  const { tier } = useEntitlements();
  const tierLabel = tier === 'plus' ? 'Pro+' : tier === 'pro' ? 'Pro' : 'Free';
  return (
    <div className="min-h-screen min-h-dvh bg-ink-bg lg:flex">
      {!hideNav && (
        <aside className="hidden w-56 flex-shrink-0 border-r border-ink-border bg-ink-bg lg:flex lg:flex-col">
          <div className="flex h-16 items-center px-5"><span className="text-xl font-black italic tracking-tight text-cloud">START<span className="text-lime">FIT</span></span></div>
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-ink-border bg-ink-surface px-3 py-2 text-[10px] text-cloud-dim"><Search className="h-3.5 w-3.5" /> Search your app</div>
          <nav className="flex-1 space-y-1 px-3">{DESKTOP_NAV.map(({ label, path, icon: Icon, tab }) => <button key={label} onClick={() => { onTabChange(tab); onNavigate?.(path); }} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors', activeTab === tab && (label === 'Recover' || label === 'Nutrition') ? 'bg-lime/10 text-lime ring-1 ring-lime/20' : 'text-cloud-dim hover:bg-ink-surface hover:text-cloud')}><Icon className="h-4 w-4" />{label}</button>)}</nav>
          <div className="border-t border-ink-border px-4 py-4"><div className="flex items-center gap-2 text-[10px] text-cloud-dim"><Bell className="h-3.5 w-3.5" /> Recovery reminders on</div></div>
        </aside>
      )}
      <div className="flex min-h-screen min-h-dvh min-w-0 flex-1 flex-col"><div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>{!hideNav && <nav className="glass-nav safe-bottom border-t border-ink-border/50 lg:hidden"><div className="mx-auto flex max-w-md items-center justify-around px-1 py-2">{TABS.map((tab) => { const isActive = activeTab === tab.key; const isCenter = tab.key === 'workout'; return <button key={tab.key} onClick={() => onTabChange(tab.key)} className="relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 transition-all active:scale-95 sm:px-3">{isActive && !isCenter && <div className="absolute inset-0 rounded-xl bg-lime/8 ring-1 ring-lime/20" />}<div className={cn('relative p-1.5 rounded-lg', isCenter && 'scale-110')}>{isCenter ? <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', isActive ? 'bg-lime-gradient shadow-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}><tab.icon className="h-5 w-5" fill={isCenter && isActive ? 'currentColor' : 'none'} /></div> : <tab.icon className={cn('h-5 w-5', isActive ? 'text-lime' : 'text-cloud-dim')} />}</div><span className={cn('text-[9px] font-medium', isActive ? 'text-lime' : 'text-cloud-dim')}>{tab.label}</span>{tab.key === 'account' && <span className="absolute -right-1 -top-1 rounded-full bg-lime px-1.5 py-0.5 text-[8px] font-black text-ink-bg">{tierLabel}</span>}</button>; })}</div></nav>}</div>
    </div>
  );
}
