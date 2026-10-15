// English source text. Every other language is written from this, for its own readers.
// {name}-style placeholders are filled in by t(key, { name: ... }).

export const en = {
  // ---- app-wide ----
  'app.loading': 'Loading StartFit...',
  'app.settingUpProfile': 'Setting up your profile...',
  'common.back': 'Back',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.close': 'Close',

  // ---- navigation ----
  'nav.routines': 'Routines',
  'nav.exercises': 'Exercises',
  'nav.workout': 'Workout',
  'nav.nutrition': 'Nutrition',
  'nav.recover': 'Recover',
  'nav.account': 'Account',
  'nav.home': 'Home',
  'nav.training': 'Training',
  'nav.exerciseLibrary': 'Exercise Library',
  'nav.aiCoach': 'AI Coach',
  'nav.progress': 'Progress',
  'nav.settings': 'Settings',
  'nav.search': 'Search your app',
  'nav.remindersOn': 'Recovery reminders on',
  'tier.free': 'Free',

  // ---- welcome ----
  'welcome.imageAlt': 'Athlete training',
  'welcome.title1': 'Train Smarter.',
  'welcome.title2': 'Become Stronger.',
  'welcome.subtitle': 'Your premium fitness companion. Personalised workouts, expert guidance, and AI-powered coaching — all in one app.',
  'welcome.getStarted': 'Get Started',
  'welcome.haveAccount': 'I already have an account',
  'welcome.featureWorkouts': 'Workouts',
  'welcome.featureCoach': 'AI Coach',
  'welcome.featureRecovery': 'Recovery',

  // ---- sign in / sign up ----
  'auth.welcomeBack': 'Welcome back',
  'auth.createAccount': 'Create account',
  'auth.resetPassword': 'Reset password',
  'auth.signinSubtitle': 'Sign in to continue your fitness journey.',
  'auth.signupSubtitle': 'Start your fitness journey today.',
  'auth.resetSubtitle': "Enter your email and we'll send you a reset link.",
  'auth.notConfigured': 'Sign-in is not available right now. Please try again later.',
  'auth.fillAll': 'Please fill in all fields.',
  'auth.passwordShort': 'Password must be at least 6 characters.',
  'auth.enterName': 'Please enter your name.',
  'auth.created': 'Account created! Check your email if confirmation is required, or sign in with your credentials.',
  'auth.resetSent': 'Password reset link sent to your email.',
  'auth.name': 'Name',
  'auth.namePlaceholder': 'Your name',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgot': 'Forgot password?',
  'auth.signIn': 'Sign In',
  'auth.createAccountButton': 'Create Account',
  'auth.sendReset': 'Send Reset Link',
  'auth.backToSignIn': 'Back to sign in',
  'auth.noAccount': "Don't have an account?",
  'auth.haveAccount': 'Already have an account?',
  'auth.signUpLink': 'Sign up',
  'auth.signInLink': 'Sign in',
  'auth.privacySignup': 'By creating an account you confirm you have read our',
  'auth.privacyRead': 'Read our',
  'auth.privacyPolicy': 'Privacy Policy',

  // ---- language ----
  'lang.pickTitle': 'Choose your language',
  'lang.pickSubtitle': 'StartFit will use it everywhere: menus, plans, explanations and the coaches. You can change it any time in Settings.',
  'lang.settingsTitle': 'Language',
  'lang.settingsDescription': 'The language of the whole app and the coaches',
  'lang.saveError': 'Could not save your language. Please try again.',
  'lang.partialNote': 'Some screens are still being written in this language and show English for now.',

  // ---- settings (shell) ----
  'settings.title': 'Settings',
  'settings.preferences': 'Preferences',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Partial<Record<MessageKey, string>>;
