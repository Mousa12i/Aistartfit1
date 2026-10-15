import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  ChevronLeft, Bell, Shield, Globe, Trash2, Info,
  ChevronRight, Lock, FileText, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useConsent } from '@/lib/consent-context';
import { deleteMyAccount } from '@/lib/privacy';
import { LANGUAGES, useI18n } from '@/lib/i18n';

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { profile, updateProfile, signOut } = useAuth();
  const { t, lang, dir, setLanguage } = useI18n();
  const [langError, setLangError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(profile?.notification_enabled ?? true);
  const [unitSystem, setUnitSystem] = useState(profile?.unit_system ?? 'metric');
  const [savingNotif, setSavingNotif] = useState(false);
  const consent = useConsent();
  const navigate = useNavigate();
  const [savingAi, setSavingAi] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);

  const handleNotificationToggle = async () => {
    setSavingNotif(true);
    const newValue = !notifications;
    setNotifications(newValue);
    await updateProfile({ notification_enabled: newValue });
    setSavingNotif(false);
  };

  const toggleAi = async () => {
    setSavingAi(true);
    setPrivacyError(null);
    try {
      await consent.set('third_party_ai', !consent.ai);
    } catch (e) {
      setPrivacyError(e instanceof Error ? e.message : 'Could not save your choice.');
    } finally {
      setSavingAi(false);
    }
  };

  const withdrawHealth = async () => {
    setShowWithdraw(false);
    setPrivacyError(null);
    try {
      await consent.set('health_data', false);
    } catch (e) {
      setPrivacyError(e instanceof Error ? e.message : 'Could not save your choice.');
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      await signOut().catch(() => undefined);
      // Device-only data (favourites, exercise notes, drafts) goes too.
      try { window.localStorage.clear(); } catch { /* storage unavailable */ }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account. Nothing was deleted.');
      setDeleting(false);
    }
  };

  const handleUnitChange = async (system: 'metric' | 'imperial') => {
    setUnitSystem(system);
    await updateProfile({ unit_system: system });
  };

  return (
    <div className="min-h-screen bg-ink-bg pb-6 animate-fade-in">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </button>
        <h1 className="text-display-sm text-cloud font-semibold">{t('settings.title')}</h1>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Language */}
        <div data-testid="settings-language" dir={dir}>
          <h3 className="text-sm font-semibold text-cloud mb-3">{t('lang.settingsTitle')}</h3>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim">
                <Globe className="w-4 h-4" />
              </div>
              <p className="text-xs text-cloud-dim">{t('lang.settingsDescription')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLangError(null);
                    setLanguage(l.code).catch(() => setLangError(t('lang.saveError')));
                  }}
                  aria-pressed={lang === l.code}
                  data-testid={`settings-lang-${l.code}`}
                  className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors', lang === l.code ? 'border-lime/60 bg-lime/10 text-lime' : 'border-ink-border bg-ink-elevated text-cloud')}
                >
                  <span dir={l.dir}>{l.native}</span>
                </button>
              ))}
            </div>
            {lang !== 'en' && <p className="mt-2 text-[11px] text-cloud-dim">{t('lang.partialNote')}</p>}
            {langError && <p className="mt-2 text-xs text-rust">{langError}</p>}
          </Card>
        </div>

        {/* Preferences */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">{t('settings.preferences')}</h3>
          <Card className="divide-y divide-ink-border">
            <ToggleRow
              icon={<Bell className="w-4 h-4" />}
              label="Notifications"
              description="Workout reminders and updates"
              value={notifications}
              onToggle={handleNotificationToggle}
              loading={savingNotif}
            />
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-cloud">Measurement Units</p>
                  <p className="text-xs text-cloud-dim">Weight and distance units</p>
                </div>
              </div>
              <div className="flex gap-2 ml-11">
                <button
                  onClick={() => handleUnitChange('metric')}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                    unitSystem === 'metric' ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                  )}
                >
                  Metric (kg, km)
                </button>
                <button
                  onClick={() => handleUnitChange('imperial')}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                    unitSystem === 'imperial' ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                  )}
                >
                  Imperial (lb, mi)
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Privacy */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Privacy & Data</h3>
          <div data-testid="privacy-settings">
          <Card className="divide-y divide-ink-border">
            <ToggleRow
              icon={<Bot className="w-4 h-4" />}
              label="AI coaches"
              description={consent.ai ? 'On — your messages and the data a coach needs are sent to OpenAI when you use a coach' : 'Off — nothing is sent to the AI provider'}
              value={consent.ai}
              onToggle={() => void toggleAi()}
              loading={savingAi || !consent.available}
              testId="toggle-ai"
            />
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="w-full flex items-center gap-3 p-4 hover:bg-ink-elevated/40 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-cloud">Privacy Policy</p>
                <p className="text-xs text-cloud-dim">What we collect, why, who we share it with, your rights</p>
              </div>
              <ChevronRight className="w-4 h-4 text-cloud-dim" />
            </button>
            <button
              type="button"
              onClick={() => setShowWithdraw(true)}
              disabled={!consent.available}
              className="w-full flex items-center gap-3 p-4 hover:bg-ink-elevated/40 transition-colors text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-cloud">Withdraw health-data consent</p>
                <p className="text-xs text-cloud-dim">StartFit stops until you agree again. Your data is kept unless you delete your account</p>
              </div>
              <ChevronRight className="w-4 h-4 text-cloud-dim" />
            </button>
            <button
              type="button"
              onClick={() => { setDeleteText(''); setDeleteError(null); setShowDelete(true); }}
              data-testid="delete-account"
              className="w-full flex items-center gap-3 p-4 hover:bg-rust/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-rust/10 flex items-center justify-center text-rust flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-rust">Delete account</p>
                <p className="text-xs text-cloud-dim">Permanently delete your account and all its data</p>
              </div>
              <ChevronRight className="w-4 h-4 text-cloud-dim" />
            </button>
          </Card>
          </div>
          {privacyError && <p className="mt-2 text-xs text-rust">{privacyError}</p>}
        </div>

        {/* About */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">About</h3>
          <Card className="divide-y divide-ink-border">
            <InfoRow icon={<Info className="w-4 h-4" />} label="StartFit" description="Version 1.0.0" />
            <InfoRow icon={<Shield className="w-4 h-4" />} label="Security" description="Encrypted connections; each account can only reach its own data" />
          </Card>
        </div>

        {/* Sign Out */}
        <Button variant="destructive" size="lg" onClick={() => setShowSignOut(true)} className="w-full">
          Sign Out
        </Button>
      </div>

      <ConfirmDialog
        open={showSignOut}
        title="Sign Out?"
        message="You'll need to sign in again to access your data."
        confirmLabel="Sign Out"
        variant="destructive"
        onConfirm={() => signOut()}
        onCancel={() => setShowSignOut(false)}
      />

      <ConfirmDialog
        open={showWithdraw}
        title="Withdraw consent?"
        message="StartFit uses your health and fitness data for everything it does, so the app will stop until you agree again. Your data stays in your account. To erase it, delete your account instead."
        confirmLabel="Withdraw"
        variant="destructive"
        onConfirm={() => void withdrawHealth()}
        onCancel={() => setShowWithdraw(false)}
      />

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Delete account">
          <div className="w-full max-w-sm rounded-2xl border border-ink-border bg-ink-surface p-5">
            <h2 className="text-lg font-semibold text-cloud">Delete your account?</h2>
            <p className="mt-2 text-sm leading-relaxed text-cloud-dim">
              This permanently deletes your account and everything in it: profile, workouts, plans you made, meals, check-ins, recovery and cycle data, coach chats and memory. An active subscription is cancelled first. This cannot be undone.
            </p>
            <p className="mt-2 text-xs text-cloud-dim">Type <b className="text-cloud">DELETE</b> to confirm.</p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              autoCapitalize="characters"
              aria-label="Type DELETE to confirm"
              data-testid="delete-confirm-input"
              className="mt-2 w-full rounded-lg border border-ink-border bg-ink-elevated px-3 py-2.5 text-sm text-cloud focus:border-rust/50 focus:outline-none"
            />
            {deleteError && <p className="mt-2 text-xs text-rust">{deleteError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setShowDelete(false)} disabled={deleting} className="flex-1 rounded-xl bg-ink-elevated py-3 text-sm font-semibold text-cloud">Cancel</button>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleteText.trim() !== 'DELETE' || deleting}
                data-testid="delete-confirm"
                className="flex-1 rounded-xl bg-rust py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ icon, label, description, value, onToggle, loading, testId }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  loading?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-cloud">{label}</p>
        <p className="text-xs text-cloud-dim">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        data-testid={testId}
        onClick={onToggle}
        disabled={loading}
        className={cn(
          'w-11 h-6 rounded-full transition-all relative',
          value ? 'bg-lime' : 'bg-ink-border'
        )}
      >
        <div className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
          value ? 'left-5' : 'left-0.5'
        )} />
      </button>
    </div>
  );
}

function InfoRow({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-cloud">{label}</p>
        <p className="text-xs text-cloud-dim">{description}</p>
      </div>
    </div>
  );
}
