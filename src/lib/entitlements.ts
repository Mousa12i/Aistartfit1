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
      'The full exercise library with animated demos',
      'Progress and weight charts',
      'Calorie and macro targets, meal and water log',
      'Recovery body map with muscle recovery %',
      'AI Coach: 5 actions a day',
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
      'Training volume analytics',
      'Recovery Doctor, weekly recovery report and lighter-week planning',
      'Recovery coach, load trend and return-to-training guide',
      'AI Coach: 30 actions a day',
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
      'Generated routines work around the limitations you enter',
      'Per-exercise strength trends',
      'Personal recovery profile, HRV tracking and recovery PDF report',
      'AI Coach: 100 actions a day',
      'PDF export of your generated routines',
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
  { id: 'bp_1w', name: '1-Week Blueprint', duration: '1 week', price: 3.50, priceInPence: 350, description: 'One custom AI training week built from your profile, with form cues and a PDF', weeks: 1 },
  { id: 'bp_2w', name: '2-Weeks Blueprint', duration: '2 weeks', price: 5.99, priceInPence: 599, description: 'One custom AI programme with a 2-week progression plan and a PDF', weeks: 2 },
  { id: 'bp_4w', name: '4-Weeks Blueprint', duration: '1 month', price: 9.99, priceInPence: 999, description: 'One custom AI programme with a week-by-week plan for 4 weeks and a PDF', weeks: 4 },
  { id: 'bp_3m', name: '3-Month Transformation', duration: '3 months', price: 19.99, priceInPence: 1999, description: 'One custom AI programme with a 12-week progression plan, lighter weeks included, and a PDF', weeks: 12 },
  { id: 'bp_6m', name: '6-Month Complete Blueprint', duration: '6 months', price: 34.99, priceInPence: 3499, description: 'One custom AI programme with a 24-week progression plan, lighter weeks included, and a PDF', weeks: 24 },
];
