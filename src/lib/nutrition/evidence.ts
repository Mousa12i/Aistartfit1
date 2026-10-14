// Every reference here was checked against its DOI record or publisher page.
// Articles only state what the cited source supports; general physiology is
// written without a citation rather than with an invented one.

export interface Reference {
  id: string;
  short: string;
  citation: string;
  url: string;
}

const doi = (d: string) => `https://doi.org/${d}`;

export const REFERENCES: Record<string, Reference> = {
  morton2018: {
    id: 'morton2018',
    short: 'Morton et al., 2018',
    citation: 'Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376–384.',
    url: doi('10.1136/bjsports-2017-097608'),
  },
  schoenfeld2018: {
    id: 'schoenfeld2018',
    short: 'Schoenfeld & Aragon, 2018',
    citation: 'Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. J Int Soc Sports Nutr. 2018;15:10.',
    url: doi('10.1186/s12970-018-0215-1'),
  },
  jager2017: {
    id: 'jager2017',
    short: 'Jäger et al., 2017 (ISSN)',
    citation: 'Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
    url: doi('10.1186/s12970-017-0177-8'),
  },
  kerksick2017: {
    id: 'kerksick2017',
    short: 'Kerksick et al., 2017 (ISSN)',
    citation: 'Kerksick CM, Arent S, Schoenfeld BJ, et al. International Society of Sports Nutrition position stand: nutrient timing. J Int Soc Sports Nutr. 2017;14:33.',
    url: doi('10.1186/s12970-017-0189-4'),
  },
  thomas2016: {
    id: 'thomas2016',
    short: 'Thomas et al., 2016 (ACSM)',
    citation: 'Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine Joint Position Statement: Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543–568.',
    url: doi('10.1249/MSS.0000000000000852'),
  },
  mifflin1990: {
    id: 'mifflin1990',
    short: 'Mifflin et al., 1990',
    citation: 'Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241–247.',
    url: doi('10.1093/ajcn/51.2.241'),
  },
  helms2014: {
    id: 'helms2014',
    short: 'Helms et al., 2014',
    citation: 'Helms ER, Zinn C, Rowlands DS, et al. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127–138.',
    url: doi('10.1123/ijsnem.2013-0054'),
  },
  ruiz2021: {
    id: 'ruiz2021',
    short: 'Ruiz-Castellano et al., 2021',
    citation: 'Ruiz-Castellano C, Espinar S, Contreras C, et al. Achieving an optimal fat loss phase in resistance-trained athletes: a narrative review. Nutrients. 2021;13(9):3255.',
    url: doi('10.3390/nu13093255'),
  },
  iraki2019: {
    id: 'iraki2019',
    short: 'Iraki et al., 2019',
    citation: 'Iraki J, Fitschen P, Espinar S, et al. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports. 2019;7(7):154.',
    url: doi('10.3390/sports7070154'),
  },
  helms2023: {
    id: 'helms2023',
    short: 'Helms et al., 2023',
    citation: 'Helms ER, Spence AJ, Sousa C, et al. Effect of small and large energy surpluses on strength, muscle, and skinfold thickness in resistance-trained individuals: a parallel groups design. Sports Med Open. 2023;9:102.',
    url: doi('10.1186/s40798-023-00651-y'),
  },
  aragon2017: {
    id: 'aragon2017',
    short: 'Aragon et al., 2017 (ISSN)',
    citation: 'Aragon AA, Schoenfeld BJ, Wildman R, et al. International Society of Sports Nutrition position stand: diets and body composition. J Int Soc Sports Nutr. 2017;14:16.',
    url: doi('10.1186/s12970-017-0174-y'),
  },
  byrne2018: {
    id: 'byrne2018',
    short: 'Byrne et al., 2018 (MATADOR)',
    citation: 'Byrne NM, Sainsbury A, King NA, et al. Intermittent energy restriction improves weight loss efficiency in obese men: the MATADOR study. Int J Obes. 2018;42(2):129–138.',
    url: doi('10.1038/ijo.2017.206'),
  },
  peos2021: {
    id: 'peos2021',
    short: 'Peos et al., 2021 (ICECAP)',
    citation: 'Peos JJ, Helms ER, Fournier PA, et al. A 1-week diet break improves muscle endurance during an intermittent dieting regime in adult athletes: a pre-specified secondary analysis of the ICECAP trial. PLoS One. 2021;16(2):e0247292.',
    url: doi('10.1371/journal.pone.0247292'),
  },
  kreider2017: {
    id: 'kreider2017',
    short: 'Kreider et al., 2017 (ISSN)',
    citation: 'Kreider RB, Kalman DS, Antonio J, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr. 2017;14:18.',
    url: doi('10.1186/s12970-017-0173-z'),
  },
  guest2021: {
    id: 'guest2021',
    short: 'Guest et al., 2021 (ISSN)',
    citation: 'Guest NS, VanDusseldorp TA, Nelson MT, et al. International Society of Sports Nutrition position stand: caffeine and exercise performance. J Int Soc Sports Nutr. 2021;18:1.',
    url: doi('10.1186/s12970-020-00383-4'),
  },
  trexler2015: {
    id: 'trexler2015',
    short: 'Trexler et al., 2015 (ISSN)',
    citation: 'Trexler ET, Smith-Ryan AE, Stout JR, et al. International Society of Sports Nutrition position stand: beta-alanine. J Int Soc Sports Nutr. 2015;12:30.',
    url: doi('10.1186/s12970-015-0090-y'),
  },
  maughan2018: {
    id: 'maughan2018',
    short: 'Maughan et al., 2018 (IOC)',
    citation: 'Maughan RJ, Burke LM, Dvorak J, et al. IOC consensus statement: dietary supplements and the high-performance athlete. Br J Sports Med. 2018;52(7):439–455.',
    url: doi('10.1136/bjsports-2018-099027'),
  },
  mountjoy2023: {
    id: 'mountjoy2023',
    short: 'Mountjoy et al., 2023 (IOC)',
    citation: "Mountjoy M, Ackerman KE, Bailey DM, et al. 2023 International Olympic Committee's (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med. 2023;57(17):1073–1098.",
    url: doi('10.1136/bjsports-2023-106994'),
  },
  morgan1999: {
    id: 'morgan1999',
    short: 'Morgan et al., 1999 (SCOFF)',
    citation: 'Morgan JF, Reid F, Lacey JH. The SCOFF questionnaire: assessment of a new screening tool for eating disorders. BMJ. 1999;319(7223):1467–1468.',
    url: doi('10.1136/bmj.319.7223.1467'),
  },
  levinson2017: {
    id: 'levinson2017',
    short: 'Levinson et al., 2017',
    citation: 'Levinson CA, Fewell L, Brosof LC. My Fitness Pal calorie tracker usage in the eating disorders. Eat Behav. 2017;27:14–16.',
    url: doi('10.1016/j.eatbeh.2017.08.003'),
  },
  cordeiro2015: {
    id: 'cordeiro2015',
    short: 'Cordeiro et al., 2015',
    citation: 'Cordeiro F, Epstein DA, Thomaz E, et al. Barriers and negative nudges: exploring challenges in food journaling. Proceedings of CHI 2015:1159–1162.',
    url: doi('10.1145/2702123.2702155'),
  },
  frie2020: {
    id: 'frie2020',
    short: 'Frie et al., 2020',
    citation: 'Frie K, Hartmann-Boyce J, Jebb S, Oke J, Aveyard P. Patterns in weight and physical activity tracking data preceding a stop in weight monitoring: observational analysis. J Med Internet Res. 2020;22(3):e15790.',
    url: doi('10.2196/15790'),
  },
  sawka2007: {
    id: 'sawka2007',
    short: 'Sawka et al., 2007 (ACSM)',
    citation: 'Sawka MN, Burke LM, Eichner ER, et al. American College of Sports Medicine position stand: exercise and fluid replacement. Med Sci Sports Exerc. 2007;39(2):377–390.',
    url: doi('10.1249/mss.0b013e31802ca597'),
  },
  efsa2010: {
    id: 'efsa2010',
    short: 'EFSA, 2010',
    citation: 'EFSA Panel on Dietetic Products, Nutrition, and Allergies. Scientific Opinion on Dietary Reference Values for water. EFSA Journal. 2010;8(3):1459.',
    url: doi('10.2903/j.efsa.2010.1459'),
  },
  who2015: {
    id: 'who2015',
    short: 'WHO, 2015',
    citation: 'World Health Organization. Guideline: sugars intake for adults and children. Geneva: WHO; 2015.',
    url: 'https://www.who.int/publications/i/item/9789241549028',
  },
  fdaDV: {
    id: 'fdaDV',
    short: 'FDA Daily Values',
    citation: 'U.S. Food and Drug Administration. Daily Value on the Nutrition and Supplement Facts Labels.',
    url: 'https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels',
  },
  iom2005: {
    id: 'iom2005',
    short: 'IOM, 2005',
    citation: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington, DC: The National Academies Press; 2005.',
    url: 'https://nap.nationalacademies.org/catalog/10490',
  },
  shephard2012: {
    id: 'shephard2012',
    short: 'Shephard, 2012',
    citation: 'Shephard RJ. The impact of Ramadan observance upon athletic performance. Nutrients. 2012;4(6):491–505.',
    url: doi('10.3390/nu4060491'),
  },
  usdaFdc: {
    id: 'usdaFdc',
    short: 'USDA FoodData Central',
    citation: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.',
    url: 'https://fdc.nal.usda.gov',
  },
};

export type ArticleCategory = 'Basics' | 'Training' | 'Goals' | 'Health & safety' | 'Practical';

export interface ArticleSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  readMinutes: number;
  sections: ArticleSection[];
  refs: string[];
}

export const ARTICLES: Article[] = [
  {
    id: 'energy',
    title: 'How your calorie target is set',
    summary: 'The formula, the activity multiplier, the goal adjustment — and how the app corrects itself with your real data.',
    category: 'Basics',
    readMinutes: 3,
    refs: ['mifflin1990', 'ruiz2021', 'iraki2019', 'helms2023'],
    sections: [
      {
        heading: '1. Resting energy',
        paragraphs: [
          'The starting point is your resting energy expenditure from the Mifflin–St Jeor equation, which uses weight, height, age and sex. If you prefer not to give your sex, the app uses the midpoint of the two equations.',
        ],
      },
      {
        heading: '2. Daily activity',
        paragraphs: ['Resting energy is multiplied by an activity factor from 1.2 (mostly sitting) to 1.9 (very hard daily training or physical work). This gives an estimate of maintenance calories.'],
      },
      {
        heading: '3. Your goal',
        bullets: [
          'Fat loss: you choose a weekly rate of 0.25–1% of body weight. Losing 0.5–1% per week is the range recommended for keeping muscle in trained people.',
          'Lean gain: 0.1–0.5% per week. 0.25–0.5% suits novice and intermediate lifters; advanced lifters should go slower.',
          'The weekly rate is turned into daily calories using about 7,700 kcal per kg of body-weight change. This is an approximation — bodies adapt — which is why the app re-checks against your real data.',
        ],
      },
      {
        heading: '4. Correcting with real data',
        paragraphs: [
          'After two to three weeks of logging food and weighing in, the app compares what you ate with how your trend weight moved. That gives a personal estimate of maintenance that replaces the formula. Changes are applied at most 250 kcal at a time, and only when you accept them.',
        ],
      },
      {
        heading: 'Safety rules built in',
        bullets: [
          'Never below your estimated resting energy, or 1,200 kcal (women) / 1,500 kcal (men).',
          'Deficit capped at 25% below maintenance; surplus capped at 15% above — larger surpluses mostly add fat rather than muscle.',
          'No deficit for under-18s or during pregnancy, and no weight goals if the wellbeing check-in suggests support could help.',
        ],
      },
    ],
  },
  {
    id: 'protein',
    title: 'Protein: how much and how often',
    summary: 'Daily targets by goal, how to split them across meals, and when more makes sense.',
    category: 'Basics',
    readMinutes: 3,
    refs: ['morton2018', 'jager2017', 'helms2014', 'ruiz2021', 'schoenfeld2018', 'kerksick2017'],
    sections: [
      {
        heading: 'Daily amount',
        bullets: [
          'For building muscle with resistance training, the benefit of extra protein levels off at about 1.6 g per kg per day; the upper confidence limit was about 2.2 g/kg.',
          'For most people who exercise, 1.4–2.0 g/kg per day is enough.',
          'When dieting while lean and resistance trained, needs rise: 2.3–3.1 g per kg of fat-free mass, or 2.2–3.0 g per kg of body weight in a fat-loss phase.',
        ],
      },
      {
        heading: 'Per meal',
        bullets: [
          'About 0.4 g/kg per meal across at least four meals reaches 1.6 g/kg/day; up to 0.55 g/kg per meal reaches 2.2 g/kg/day.',
          'Doses of roughly 20–40 g every 3–4 hours work well for most people.',
        ],
      },
      {
        heading: 'Good to know',
        bullets: [
          'If your BMI is above 30, the app calculates protein from a reference weight so the target is not inflated.',
          'With kidney disease, follow the protein advice of your doctor or renal dietitian.',
          'Protein powder is a convenient food, not a requirement.',
        ],
      },
    ],
  },
  {
    id: 'carbs',
    title: 'Carbohydrate and training',
    summary: 'Why carbs scale with training load and how to fuel around sessions.',
    category: 'Training',
    readMinutes: 2,
    refs: ['thomas2016', 'ruiz2021', 'kerksick2017'],
    sections: [
      {
        heading: 'Match carbs to the work',
        bullets: [
          'Light or skill-based training: about 3–5 g per kg per day.',
          'Moderate training of about an hour a day: about 5–7 g per kg per day.',
          'Long, hard endurance training needs more.',
        ],
      },
      {
        heading: 'Around sessions',
        paragraphs: ['Eating a meal with protein and carbohydrate within 2–3 hours before and after training is a practical pattern for lifters, including during fat loss.'],
      },
      {
        heading: 'Training-day carb shift',
        paragraphs: [
          'The optional carb shift moves some carbohydrate from rest days to training days while keeping your weekly total the same. Weekly totals matter most for body composition; the shift is a preference for training energy and hunger, not a fat-loss trick.',
        ],
      },
    ],
  },
  {
    id: 'fats',
    title: 'Fats: ranges and quality',
    summary: 'How much fat to eat and which fats to watch.',
    category: 'Basics',
    readMinutes: 2,
    refs: ['iom2005', 'fdaDV'],
    sections: [
      {
        paragraphs: [
          'For adults, 20–35% of energy from fat is the accepted range. The app starts at 25% and never goes below 20%, because fat carries vitamins A, D, E and K and supports hormone production.',
        ],
      },
      {
        heading: 'Quality',
        bullets: [
          'Saturated fat: the FDA Daily Value is 20 g on a 2,000 kcal diet (about 10% of energy). The app scales this limit to your calories.',
          'Avoid industrial trans fats where possible.',
          'Oily fish (salmon, sardines, mackerel) provide the omega-3 fats EPA and DHA.',
        ],
      },
    ],
  },
  {
    id: 'fibre-sugar-salt',
    title: 'Fibre, sugar and salt',
    summary: 'Three numbers worth watching beyond calories and protein.',
    category: 'Basics',
    readMinutes: 2,
    refs: ['iom2005', 'fdaDV', 'who2015', 'sawka2007'],
    sections: [
      {
        heading: 'Fibre',
        paragraphs: ['Aim for about 14 g of fibre per 1,000 kcal you eat (that is the 28 g Daily Value on a 2,000 kcal diet). Beans, lentils, oats, wholegrains, fruit and vegetables are the easiest sources.'],
      },
      {
        heading: 'Sugar',
        paragraphs: [
          'The WHO recommends keeping free sugars below 10% of energy, with further benefit below 5%. Free sugars are sugars added to food plus those in honey, syrups and fruit juice. Most food databases only report total sugars, which also include natural sugars in fruit and milk — so the app shows total sugars and, where available, added sugars.',
        ],
      },
      {
        heading: 'Salt',
        paragraphs: ['The Daily Value for sodium is 2,300 mg. People who sweat heavily in long sessions lose sodium too and may need more around training — individual sweat testing is the best guide.'],
      },
    ],
  },
  {
    id: 'hydration',
    title: 'Hydration',
    summary: 'Daily water needs and how to drink around training.',
    category: 'Training',
    readMinutes: 2,
    refs: ['efsa2010', 'sawka2007'],
    sections: [
      {
        bullets: [
          'Adequate total water intake (from drinks and food) is about 2.0 L a day for women and 2.5 L for men in temperate conditions.',
          'During exercise, aim to avoid losing more than 2% of body weight through sweat. Weighing yourself before and after a session shows your personal sweat loss.',
          'The app uses 35 ml per kg of body weight as a simple daily drinks target — add more on hot or long training days.',
        ],
      },
    ],
  },
  {
    id: 'cutting',
    title: 'Fat loss without losing muscle',
    summary: 'Rate of loss, protein, training and diet breaks — what the evidence supports.',
    category: 'Goals',
    readMinutes: 4,
    refs: ['ruiz2021', 'helms2014', 'aragon2017', 'byrne2018', 'peos2021', 'mountjoy2023'],
    sections: [
      {
        heading: 'Pace',
        paragraphs: ['Lose about 0.5–1% of body weight per week. Slower loss helps keep muscle, especially if you are already lean.'],
      },
      {
        heading: 'What protects muscle',
        bullets: [
          'High protein: 2.2–3.0 g per kg of body weight, spread over 3–6 meals.',
          'Keep lifting — resistance training is the signal to keep muscle.',
          'Meals with protein and carbohydrate within 2–3 hours of training.',
        ],
      },
      {
        heading: 'Diet breaks',
        paragraphs: [
          'In men with obesity, alternating two weeks of dieting with two weeks at maintenance led to more weight and fat loss than continuous dieting. In resistance-trained athletes, a one-week break reduced hunger and improved leg endurance but did not change fat mass. The evidence is mixed, so breaks are optional in the app.',
        ],
      },
      {
        heading: 'Watch for under-fuelling',
        paragraphs: ['Constant tiredness, frequent illness or injury, stalled performance, or loss of periods can signal that energy intake is too low for your training. See the article on under-fuelling.'],
      },
    ],
  },
  {
    id: 'bulking',
    title: 'Lean gain: building muscle without much fat',
    summary: 'Why a small surplus beats a big one.',
    category: 'Goals',
    readMinutes: 3,
    refs: ['iraki2019', 'helms2023', 'morton2018', 'schoenfeld2018'],
    sections: [
      {
        heading: 'Pace',
        bullets: [
          'Novice and intermediate lifters: gain about 0.25–0.5% of body weight per week.',
          'Advanced lifters: go slower — muscle growth is slower, so extra weight is mostly fat.',
        ],
      },
      {
        heading: 'Small surplus',
        paragraphs: [
          'In trained lifters given a 5% or 15% surplus for eight weeks, faster weight gain mainly increased skinfold thickness (fat), while muscle and strength gains were similar. The app caps the surplus at 15% and adjusts with your real rate of gain.',
        ],
      },
      {
        heading: 'Protein',
        paragraphs: ['1.6–2.2 g per kg per day, about 0.4–0.55 g/kg per meal over 3–6 meals.'],
      },
    ],
  },
  {
    id: 'scale',
    title: 'Why the scale jumps around',
    summary: 'Daily weight is noisy. The trend line is what matters.',
    category: 'Practical',
    readMinutes: 2,
    refs: ['frie2020'],
    sections: [
      {
        paragraphs: [
          'Your weight can change by a kilo or more overnight without any change in body fat. Water shifts with salt, carbohydrate (stored glycogen holds water), digestion, hormones, sleep and hard training.',
          'The app draws a smoothed trend line through your weigh-ins and bases every decision on the trend over two to three weeks, never on a single morning.',
          'In a study of smart-scale users, people tended to stop weighing after their weight crept up. Seeing the trend — instead of one bad number — is designed to make those days less discouraging.',
        ],
      },
      {
        heading: 'For cleaner data',
        bullets: ['Weigh first thing in the morning after the toilet, before food and drink.', 'Same scale, same place, similar clothing.', 'Three or more weigh-ins a week give a reliable trend.'],
      },
    ],
  },
  {
    id: 'timing',
    title: 'Meal timing and protein distribution',
    summary: 'What timing adds once your daily totals are right.',
    category: 'Training',
    readMinutes: 2,
    refs: ['kerksick2017', 'jager2017', 'ruiz2021'],
    sections: [
      {
        bullets: [
          'Daily totals of energy and protein matter most. Timing fine-tunes the result.',
          'Protein doses of about 20–40 g every 3–4 hours support muscle protein synthesis across the day.',
          '30–40 g of casein protein before sleep can increase overnight muscle protein synthesis.',
          'Aim to eat a meal with protein and carbohydrate within 2–3 hours before and after training.',
        ],
      },
    ],
  },
  {
    id: 'supplements',
    title: 'Supplements graded by evidence',
    summary: 'What works, for whom, at what dose — and what to skip.',
    category: 'Training',
    readMinutes: 4,
    refs: ['maughan2018', 'kreider2017', 'guest2021', 'trexler2015', 'morton2018'],
    sections: [
      {
        paragraphs: [
          'Supplements can add a little on top of good food, sleep and training — not replace them. Products can be contaminated with banned substances, so athletes who are drug-tested should choose third-party tested products.',
        ],
      },
    ],
  },
  {
    id: 'reds',
    title: 'Under-fuelling (REDs)',
    summary: 'When energy intake is too low for training, health and performance suffer.',
    category: 'Health & safety',
    readMinutes: 2,
    refs: ['mountjoy2023'],
    sections: [
      {
        paragraphs: [
          'Relative Energy Deficiency in Sport (REDs) happens when there is not enough energy left for the body after training. It can affect hormones, bones, immunity, mood and performance — in women and in men.',
        ],
      },
      {
        heading: 'Warning signs',
        bullets: ['Constant tiredness or poor sleep', 'Frequent illness or injuries, including stress fractures', 'Performance stalls or drops despite training', 'Missed or stopped periods; low libido', 'Feeling cold, dizzy or irritable'],
      },
      {
        paragraphs: ['If these sound familiar, talk to a doctor or a registered sports dietitian. The app flags very low intakes and never plans below a safety floor.'],
      },
    ],
  },
  {
    id: 'tracking-wellbeing',
    title: 'Tracking and your wellbeing',
    summary: 'Logging helps many people — and some people not at all. Here is how the app handles that.',
    category: 'Health & safety',
    readMinutes: 3,
    refs: ['levinson2017', 'cordeiro2015', 'morgan1999'],
    sections: [
      {
        paragraphs: [
          'In a clinic sample of people with eating disorders, about three in four had used a calorie-tracking app, and most of them felt it contributed to their eating disorder. That shows how people experienced it, not proof that apps cause eating disorders — but it is a good reason to be careful.',
          'The check-in uses the five SCOFF screening questions. Two or more "yes" answers suggest talking to a professional could help; the app then pauses weight goals and suggests support. It is a screen, not a diagnosis.',
        ],
      },
      {
        heading: 'No-numbers mode',
        paragraphs: ['You can hide calories and macros at any time. The diary then focuses on regular meals, protein at each meal and water, and the coach avoids numbers too.'],
      },
      {
        heading: 'Why logging gets dropped',
        paragraphs: ['Common reasons include how tedious it is, uncertain portions and conflicting database entries for the same food. The app keeps one entry per food where possible and offers favourites, recent foods and copy-a-day to keep logging quick.'],
      },
    ],
  },
  {
    id: 'ramadan',
    title: 'Training through Ramadan',
    summary: 'Keeping performance up while fasting from dawn to sunset.',
    category: 'Practical',
    readMinutes: 2,
    refs: ['shephard2012'],
    sections: [
      {
        paragraphs: [
          'For most people the effects of Ramadan fasting on overall nutrition are small. Athletes can see some drop in anaerobic effort, endurance and strength — mostly from lower glycogen and fluid — especially when days are long and hot.',
        ],
      },
      {
        heading: 'Practical tactics',
        bullets: [
          'Protect sleep; a nap can help.',
          'Make the evening meals carbohydrate-rich and include protein; choose slower-digesting foods at suhoor.',
          'Spread fluids from iftar to bedtime rather than all at once.',
          'Schedule hard sessions where you can eat and drink soon after — for example shortly before iftar or later in the evening.',
          'In the diary, log suhoor under Breakfast and iftar under Dinner.',
        ],
      },
    ],
  },
  {
    id: 'food-data',
    title: 'Where the food data comes from',
    summary: 'Not all calorie numbers are equal. Here is what each badge means.',
    category: 'Practical',
    readMinutes: 2,
    refs: ['usdaFdc', 'cordeiro2015'],
    sections: [
      {
        bullets: [
          'USDA — FoodData Central, the US government food composition database. Foundation and SR Legacy foods come from laboratory analysis and standard references; Branded foods come from product labels.',
          'The built-in common foods (shown first in search) use USDA SR Legacy values per 100 g, and each one shows its FoodData Central ID so you can check it.',
          'Label — product data from Open Food Facts, entered from packaging by contributors. Check it against your pack.',
          'Mine — foods you created. Copy them from your pack label for best accuracy.',
          'Recipe and Quick add — the numbers come from the recipe card or from what you typed, so they usually include calories and macros only.',
        ],
      },
      {
        heading: 'Accuracy tips',
        bullets: ['Weigh food when you can, at least for a week, to calibrate your eye.', 'Pick raw or cooked entries to match how you weighed it — cooking changes weight.', 'Oils and sauces add up quickly; log them too.'],
      },
    ],
  },
];

export interface SupplementEvidence {
  name: string;
  grade: 'Strong' | 'Good for specific uses' | 'Food-first' | 'Only if deficient' | 'Weak';
  use: string;
  dose: string;
  caution: string;
  refs: string[];
}

export const SUPPLEMENTS: SupplementEvidence[] = [
  {
    name: 'Creatine monohydrate',
    grade: 'Strong',
    use: 'More strength and lean mass from resistance training; repeated high-intensity efforts.',
    dose: '3–5 g a day. Optional loading: about 0.3 g/kg a day for 5–7 days.',
    caution: 'Body weight often rises slightly at first because muscles store more water. Choose third-party tested products.',
    refs: ['kreider2017', 'maughan2018'],
  },
  {
    name: 'Caffeine',
    grade: 'Strong',
    use: 'Endurance, strength and high-intensity performance.',
    dose: '3–6 mg per kg about 60 minutes before exercise; lower doses can also work.',
    caution: 'Can disturb sleep and cause jitters; high doses (around 9 mg/kg) raise side effects.',
    refs: ['guest2021', 'maughan2018'],
  },
  {
    name: 'Beta-alanine',
    grade: 'Good for specific uses',
    use: 'Hard efforts lasting about 1–4 minutes.',
    dose: '4–6 g a day in divided doses for at least 2–4 weeks.',
    caution: 'Harmless tingling of the skin is common; split doses reduce it.',
    refs: ['trexler2015', 'maughan2018'],
  },
  {
    name: 'Nitrate (e.g. beetroot juice)',
    grade: 'Good for specific uses',
    use: 'Endurance and some high-intensity work.',
    dose: 'As used in studies, taken a few hours before exercise.',
    caution: 'Effects are smaller in highly trained athletes.',
    refs: ['maughan2018'],
  },
  {
    name: 'Sodium bicarbonate',
    grade: 'Good for specific uses',
    use: 'Repeated or sustained high-intensity efforts.',
    dose: 'As used in studies; trial it in training first.',
    caution: 'Stomach upset is common.',
    refs: ['maughan2018'],
  },
  {
    name: 'Protein powder',
    grade: 'Food-first',
    use: 'A convenient way to reach your daily protein target.',
    dose: 'Counts towards your daily protein like any food.',
    caution: 'No benefit beyond reaching your target.',
    refs: ['morton2018'],
  },
  {
    name: 'Vitamin D, iron',
    grade: 'Only if deficient',
    use: 'Correcting a deficiency confirmed by a blood test.',
    dose: 'As prescribed.',
    caution: 'Taking iron without a deficiency can be harmful. Test first, with medical advice.',
    refs: ['maughan2018'],
  },
  {
    name: 'Products not listed here',
    grade: 'Weak',
    use: 'Most other products marketed for fat loss or muscle gain have little good evidence behind them.',
    dose: '—',
    caution: 'Supplements can be contaminated with banned or harmful substances. Be most careful with products that promise dramatic results.',
    refs: ['maughan2018'],
  },
];

export function articleById(id: string | null | undefined): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}
