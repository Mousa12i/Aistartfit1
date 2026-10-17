// StartFit coach rules: what every coach agrees to before athletes can join them.
//
// Each rule says only what its source supports. Where a rule is StartFit's own policy (how the app works,
// what happens on a breach) it carries no source.
//
// Sources (checked 17 Oct 2026):
// - CIMSPA Member Code of Conduct (Aug 2022), the UK sport and physical activity professional body.
// - ICO training module on special category data (UK GDPR Art. 9: health data needs extra protection).
// - Association for Nutrition, Nutrition Professions Comparison (Apr 2024): "dietitian" is a title protected by
//   statute for HCPC registrants; "nutritionist" is not.
// - ASA / CAP advice on weight control (rules 13.3, 13.8, 13.10) and on testimonials (rules 3.47–3.50).
// - ACSM pre-participation screening (Riebe 2015): signs and symptoms that need medical clearance.

import type { MessageKey } from '../i18n';

export interface RuleSource { id: string; short: string; url: string }

export const RULE_SOURCES: Record<string, RuleSource> = {
  cimspa: { id: 'cimspa', short: 'CIMSPA Code of Conduct, 2022', url: 'https://www.cimspa.co.uk/globalassets/document-downloads-library-all/about/policies/cimspa-member_code_of_conduct_final_aug22.pdf' },
  ico: { id: 'ico', short: 'ICO, special category data', url: 'https://ICO.ORG.UK/media/for-organisations/training/4022202/module-4-processing-special-category-data.pdf' },
  afn: { id: 'afn', short: 'Association for Nutrition, 2024', url: 'https://www.associationfornutrition.org/wp-content/uploads/2024/04/Nutrition-Professions-Comparison-Document-04.2024.pdf' },
  capWeight: { id: 'capWeight', short: 'ASA/CAP, weight control', url: 'https://www.asa.org.uk/advice-online/weight-control-general.html' },
  capTestimonials: { id: 'capTestimonials', short: 'ASA/CAP, testimonials', url: 'https://www.asa.org.uk/advice-online/weight-control-testimonials.html' },
  riebe: { id: 'riebe', short: 'Riebe et al., 2015 (ACSM)', url: 'https://doi.org/10.1249/MSS.0000000000000664' },
};

export interface Rule { key: MessageKey; sources: string[] }
export interface RuleSection { id: string; title: MessageKey; rules: Rule[] }

export const COACH_RULES: RuleSection[] = [
  {
    id: 'scope',
    title: 'rules.scopeTitle',
    rules: [
      { key: 'rules.scope1', sources: ['cimspa'] },
      { key: 'rules.scope2', sources: ['riebe', 'cimspa'] },
    ],
  },
  {
    id: 'nutrition',
    title: 'rules.nutritionTitle',
    rules: [
      { key: 'rules.nutrition1', sources: ['afn', 'cimspa'] },
      { key: 'rules.nutrition2', sources: ['afn'] },
      { key: 'rules.nutrition3', sources: ['cimspa'] },
    ],
  },
  {
    id: 'honesty',
    title: 'rules.honestyTitle',
    rules: [
      { key: 'rules.honesty1', sources: ['cimspa'] },
      { key: 'rules.honesty2', sources: ['capWeight'] },
      { key: 'rules.honesty3', sources: ['capTestimonials'] },
      { key: 'rules.honesty4', sources: ['cimspa'] },
    ],
  },
  {
    id: 'privacy',
    title: 'rules.privacyTitle',
    rules: [
      { key: 'rules.privacy1', sources: ['ico'] },
      { key: 'rules.privacy2', sources: ['ico'] },
      { key: 'rules.privacy3', sources: [] },
      { key: 'rules.privacy4', sources: [] },
      { key: 'rules.privacy5', sources: [] },
    ],
  },
  {
    id: 'conduct',
    title: 'rules.conductTitle',
    rules: [
      { key: 'rules.conduct1', sources: ['cimspa'] },
      { key: 'rules.conduct2', sources: ['capWeight', 'cimspa'] },
      { key: 'rules.conduct3', sources: ['cimspa'] },
    ],
  },
  {
    id: 'responsibility',
    title: 'rules.responsibilityTitle',
    rules: [
      { key: 'rules.responsibility1', sources: ['cimspa'] },
      { key: 'rules.responsibility2', sources: [] },
    ],
  },
];

export const SPECIALTIES = [
  'fat_loss', 'muscle_gain', 'strength', 'powerlifting', 'bodybuilding', 'sports', 'endurance',
  'beginners', 'women', 'older_adults', 'mobility', 'nutrition_habits', 'return_to_training',
] as const;
export type Specialty = (typeof SPECIALTIES)[number];
export const MAX_SPECIALTIES = 6;
