export type Tier = 'free' | 'pro' | 'plus';

export type RecoveryFeature =
  | 'recoveryBodyMap'
  | 'recoveryLogging'
  | 'recoveryMusclePercent'
  | 'recoveryWhyBasic'
  | 'recoveryCoach'
  | 'recoveryFreshMuscle'
  | 'recoveryWeeklyVolume'
  | 'recoveryLoadTrend'
  | 'recoveryDoctor'
  | 'recoveryWeeklyReport'
  | 'recoveryPerformanceCheck'
  | 'recoveryPersonalProfile'
  | 'recoveryManualOverride'
  | 'recoveryInjuryAdaptive'
  | 'recoveryHrvTracking'
  | 'recoveryAiChat'
  // Recovery Doctor v2
  | 'recoveryAnalytics'
  | 'recoveryDeload'
  | 'recoveryReturnToTraining'
  | 'recoveryFingerprint'
  | 'recoveryWhatWorks'
  | 'recoveryPdf';

export interface TierConfig {
  label: string;
  price: number;
  weeklyPrice: number;
  dailyPrice: number;
  coach: number;
  ranges: ('week' | 'month' | '3m' | 'all')[];
  volume: boolean;
  trend: boolean;
  recs: number;
  mealPlan: boolean;
  biometric: boolean;
  feats: string[];
  recovery: Record<RecoveryFeature, boolean>;
}

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    label: 'Free',
    price: 0,
    weeklyPrice: 0,
    dailyPrice: 0,
    coach: 5,
    ranges: ['week', 'month'],
    volume: false,
    trend: false,
    recs: 1,
    mealPlan: false,
    biometric: false,
    feats: [
      'Full workout logging, rest timer, history',
      'Animated exercise demos',
      'Basic progress and weight charts',
      'Calorie and protein estimates, meal and water log',
      'Rule-based Coach: 5 actions a day',
      '1 plan recommendation at a time',
    ],
    recovery: {
      recoveryBodyMap: true,
      recoveryLogging: true,
      recoveryMusclePercent: true,
      recoveryWhyBasic: true,
      recoveryCoach: false,
      recoveryFreshMuscle: false,
      recoveryWeeklyVolume: false,
      recoveryLoadTrend: false,
      recoveryDoctor: false,
      recoveryWeeklyReport: false,
      recoveryPerformanceCheck: false,
      recoveryPersonalProfile: false,
      recoveryManualOverride: false,
      recoveryInjuryAdaptive: false,
      recoveryHrvTracking: false,
      recoveryAiChat: true,
      recoveryAnalytics: false,
      recoveryDeload: false,
      recoveryReturnToTraining: false,
      recoveryFingerprint: false,
      recoveryWhatWorks: false,
      recoveryPdf: false,
    },
  },
  pro: {
    label: 'Pro',
    price: 9.99,
    weeklyPrice: 3.50,
    dailyPrice: 1.49,
    coach: 30,
    ranges: ['week', 'month', '3m'],
    volume: true,
    trend: false,
    recs: 5,
    mealPlan: true,
    biometric: false,
    feats: [
      'Everything in Free',
      'Full Exercise Vault access (153+ exercises)',
      'Pro muscle & equipment filtering',
      'Training volume & strength analytics',
      'Daily meal plan targets & macros',
      'Coach: 30 actions a day',
      'Up to 5 plan recommendations',
    ],
    recovery: {
      recoveryBodyMap: true,
      recoveryLogging: true,
      recoveryMusclePercent: true,
      recoveryWhyBasic: true,
      recoveryCoach: true,
      recoveryFreshMuscle: true,
      recoveryWeeklyVolume: true,
      recoveryLoadTrend: true,
      recoveryDoctor: true,
      recoveryWeeklyReport: true,
      recoveryPerformanceCheck: true,
      recoveryPersonalProfile: false,
      recoveryManualOverride: false,
      recoveryInjuryAdaptive: false,
      recoveryHrvTracking: false,
      recoveryAiChat: true,
      recoveryAnalytics: true,
      recoveryDeload: true,
      recoveryReturnToTraining: true,
      recoveryFingerprint: false,
      recoveryWhatWorks: false,
      recoveryPdf: false,
    },
  },
  plus: {
    label: 'Pro+',
    price: 14.99,
    weeklyPrice: 5.99,
    dailyPrice: 1.49,
    coach: 100,
    ranges: ['week', 'month', '3m', 'all'],
    volume: true,
    trend: true,
    recs: 99,
    mealPlan: true,
    biometric: true,
    feats: [
      'Everything in Pro',
      'AI Biometric Routine Generator (o3-mini)',
      'Injury avoidance & joint-safe exercise algorithms',
      'Continuous AI coach with deep physiological reasoning',
      'All-time progress range & per-exercise strength trends',
      'Coach: 100 actions a day',
      'Unlimited plan recommendations',
      'PDF Blueprint export for all routines',
    ],
    recovery: {
      recoveryBodyMap: true,
      recoveryLogging: true,
      recoveryMusclePercent: true,
      recoveryWhyBasic: true,
      recoveryCoach: true,
      recoveryFreshMuscle: true,
      recoveryWeeklyVolume: true,
      recoveryLoadTrend: true,
      recoveryDoctor: true,
      recoveryWeeklyReport: true,
      recoveryPerformanceCheck: true,
      recoveryPersonalProfile: true,
      recoveryManualOverride: true,
      recoveryInjuryAdaptive: true,
      recoveryHrvTracking: true,
      recoveryAiChat: true,
      recoveryAnalytics: true,
      recoveryDeload: true,
      recoveryReturnToTraining: true,
      recoveryFingerprint: true,
      recoveryWhatWorks: true,
      recoveryPdf: true,
    },
  },
};

export const TIER_ORDER: Tier[] = ['free', 'pro', 'plus'];

export interface BlueprintProduct {
  id: string;
  name: string;
  duration: string;
  price: number;
  priceInPence: number;
  description: string;
  weeks: number;
}

export const BLUEPRINTS: BlueprintProduct[] = [
  { id: 'bp_1w', name: '1-Week Blueprint', duration: '1 week', price: 3.50, priceInPence: 350, description: 'Custom AI-generated single-week training program', weeks: 1 },
  { id: 'bp_2w', name: '2-Weeks Blueprint', duration: '2 weeks', price: 5.99, priceInPence: 599, description: 'Two-week progressive training plan with exercise substitutions', weeks: 2 },
  { id: 'bp_4w', name: '4-Weeks Blueprint', duration: '1 month', price: 9.99, priceInPence: 999, description: 'Full month transformation program with periodised progression', weeks: 4 },
  { id: 'bp_3m', name: '3-Month Transformation', duration: '3 months', price: 19.99, priceInPence: 1999, description: 'Complete 12-week periodised program with deload weeks and progression', weeks: 12 },
  { id: 'bp_6m', name: '6-Month Complete Blueprint', duration: '6 months', price: 34.99, priceInPence: 3499, description: 'Ultimate 24-week transformation with multiple mesocycles and nutrition framework', weeks: 24 },
];
