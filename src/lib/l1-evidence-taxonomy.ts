/**
 * T3-L1 Evidence Taxonomy
 *
 * L1 cases use explicit causal claims ("X causes Y") but are judged as:
 * - WOLF: unjustified causal claim (groundTruth=NO)
 * - SHEEP: justified causal claim (groundTruth=YES)
 * - NONE: groundTruth=AMBIGUOUS (no evidence type)
 *
 * This file is generator-oriented: each evidence type is specified with the
 * required elements + canonical structure + design notes for reliable synthesis.
 */
import type { Difficulty, GroundTruth } from '@/types';

export type EvidenceClass = 'WOLF' | 'SHEEP' | 'NONE';
export type EvidenceTier = 'CORE' | 'ADVANCED';

export type L1EvidenceCode =
  | 'W1'
  | 'W2'
  | 'W3'
  | 'W4'
  | 'W5'
  | 'W6'
  | 'W7'
  | 'W8'
  | 'W9'
  | 'W10'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8';

export interface L1EvidenceDefinition {
  code: L1EvidenceCode;
  class: Exclude<EvidenceClass, 'NONE'>;
  tier: EvidenceTier;
  label: string;

  definition: string;
  failureOrValidityMode: string;
  requiredElements: string[];
  canonicalStructure: string[];
  designNotes: string[];
  keySignalWords?: string[];
  keyPhrases?: string[]; // Key phrases to include (especially for SHEEP types)

  // New fields from spec
  validationChecklist?: string[]; // Validation checklist questions
  difficultyCalibration?: {
    easy: string;
    medium: string;
    hard: string;
  };
  domainExamples?: Array<{
    domain: string;
    example: string;
    notes?: string;
  }>;
  completeExample?: {
    scenario: string;
    claim: string;
    groundTruth: string;
    explanation: string;
    difficulty?: string;
  };
  scenarioTemplate?: string; // More prescriptive template with placeholders

  /**
   * Ground-truth implied by the evidence class.
   * - WOLF => NO
   * - SHEEP => YES
   */
  impliedGroundTruth: Exclude<GroundTruth, 'AMBIGUOUS'>;
}

export interface L1DifficultyRubric {
  easy: string[];
  medium: string[];
  hard: string[];
}

export const L1_DIFFICULTY_RUBRIC: L1DifficultyRubric = {
  easy: [
    'Evidence/trap is explicit in the scenario text (no hidden denominator, no subtle conditioning).',
    'Few moving parts: 1 plausible alternative explanation at most.',
    'No numeric scaffolding required; reader can spot it from narrative structure.',
  ],
  medium: [
    'Trap/evidence is present but partly implicit (e.g., confounder hinted in background, sample restriction inferable).',
    'Plausible but incomplete “research-y” framing makes the wrong inference feel reasonable.',
    'May require noticing unit-of-analysis or a missing comparison group.',
  ],
  hard: [
    'Requires explicit numeric structure or multi-group reasoning (e.g., Simpson’s Paradox).',
    'Near-miss cues: scenario tempts mixing types (e.g., selection + confounding), but must remain single-type.',
    'Subtle conditioning/selection or statistical intuition (base rates, regression to mean).',
  ],
};

export const L1_EVIDENCE_TYPES: L1EvidenceDefinition[] = [
  // ---------------------------------------------------------------------------
  // WOLF (Core) — Unjustified causal claims
  // ---------------------------------------------------------------------------
  {
    code: 'W1',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Selection Bias',
    definition: 'A causal claim is generalized from a non-representative sample to a broader population.',
    failureOrValidityMode: 'Sample ≠ population. The observed association may not hold outside the selected group.',
    requiredElements: [
      'Sampling method is non-random or selective',
      'Sample differs systematically from target population',
      'Claim generalizes beyond the sample',
      'No correction (weighting, randomization, adjustment)',
    ],
    canonicalStructure: [
      'Researchers studied [biased subgroup] and observed an X–Y association.',
      'They concluded X causes Y in the broader population.',
    ],
    designNotes: [
      'Bias may be explicit (“surveyed long-term users”) or implicit (“hospital patients”).',
      'Do not introduce statistical controls or acknowledgments of bias.',
      'Make the sample sound reasonable at first glance.',
    ],
    scenarioTemplate: 'Researchers surveyed [biased sample] and found that [X relates to Y]. They concluded that [X causes Y] in the general population.',
    validationChecklist: [
      'Is the sample clearly non-representative?',
      'Does the claim generalize beyond the sample?',
      'Would a random sample likely show a different result?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Selection mechanism explicitly stated',
      medium: 'Selection implied by sample description',
      hard: 'Selection subtle; requires inference about who is included',
    },
    domainExamples: [
      { domain: 'Health', example: 'Hospital patients (sicker than general population)' },
      { domain: 'Education', example: 'Survey respondents (more engaged than non-respondents)' },
      { domain: 'Business', example: 'Successful companies (ignoring failed companies)' },
      { domain: 'Technology', example: 'App users who did not uninstall (satisfied users only)' },
      { domain: 'Finance', example: 'Investors who stayed in market (risk-tolerant survivors)' },
      { domain: 'Social Media', example: 'Viral posts (not representative of all posts)' },
      { domain: 'Medicine', example: 'Clinical trial volunteers (healthier, more motivated)' },
      { domain: 'Workplace', example: 'Employees who stayed (survivors, not those who left)' },
      { domain: 'Research', example: 'Published studies (publication bias)' },
      { domain: 'Consumer', example: 'Online reviewers (extreme opinions overrepresented)' },
    ],
    completeExample: {
      scenario: 'A software company surveyed users who had been using their product for over 2 years and found 95% satisfaction. They concluded that their software causes high user satisfaction and used this finding in their marketing materials.',
      claim: 'The software causes high user satisfaction.',
      groundTruth: 'NO',
      explanation: 'Selection Bias: Only long-term users were surveyed. Dissatisfied users likely stopped using the software and were not included in the survey. Why Flawed: The 95% satisfaction rate reflects survivor bias in the sample, not the software\'s effect on all users who tried it.',
      difficulty: 'Easy',
    },
    keySignalWords: ['surveyed', 'studied', 'found', 'concluded', 'general population', 'non-random', 'selected', 'biased sample'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W2',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Survivorship Bias',
    definition: 'Only successful or surviving cases are observed; failures are invisible.',
    failureOrValidityMode: 'Conditioning on success induces misleading associations (collider bias).',
    requiredElements: [
      'Only survivors/successes observed',
      'Failures missing or unobserved',
      'X attributed as cause of success Y',
      'Plausible failed cases with X exist',
    ],
    canonicalStructure: [
      'Looking only at successful cases, researchers found they all had X.',
      'They concluded X causes success (Y).',
    ],
    designNotes: [
      'Explicitly restrict the dataset to winners/survivors/successes.',
      'Do not mention the unseen denominator explicitly—let it be inferable.',
      'Classic domains: startups, careers, recovery stories.',
    ],
    scenarioTemplate: 'Looking at [successful cases], researchers found they all [had X]. They concluded that [X leads to success/Y].',
    validationChecklist: [
      'Are only successful or surviving cases observed?',
      'Are failures invisible or excluded?',
      'Is X attributed as cause of success Y?',
      'Do plausible failed cases with X exist but are unobserved?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Survivorship mechanism explicitly stated',
      medium: 'Survivorship implied by sample description',
      hard: 'Survivorship subtle; requires inference about missing failures',
    },
    domainExamples: [
      { domain: 'Business', example: 'Successful startups (failed startups invisible)' },
      { domain: 'Music', example: 'Famous musicians and practice habits' },
      { domain: 'Military', example: 'Returning aircraft damage patterns' },
      { domain: 'Architecture', example: 'Ancient buildings that survived' },
      { domain: 'Investing', example: 'Successful investors\' strategies' },
      { domain: 'Academia', example: 'Published researchers (file drawer effect)' },
      { domain: 'Sports', example: 'Professional athletes\' training' },
      { domain: 'Restaurants', example: 'Long-standing restaurants only' },
      { domain: 'Books', example: 'Bestselling authors\' habits' },
      { domain: 'Medicine', example: 'Recovered patients only' },
    ],
    completeExample: {
      scenario: 'A business magazine analyzed 50 highly successful entrepreneurs and found that 80% of them had dropped out of college. The article concluded that dropping out of college increases your chances of entrepreneurial success and encouraged young entrepreneurs to consider leaving school.',
      claim: 'Dropping out of college causes increased entrepreneurial success.',
      groundTruth: 'NO',
      explanation: 'Survivorship Bias: The analysis only included successful entrepreneurs. Many college dropouts who attempted entrepreneurship and failed are not visible in the dataset. Why Flawed: Without knowing outcomes among all who attempted entrepreneurship (including failures), we cannot infer that dropping out helps.',
      difficulty: 'Medium',
    },
    keySignalWords: ['successful', 'survivors', 'winners', 'only', 'found they all', 'concluded', 'leads to success'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W3',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Healthy User Bias',
    definition: 'People who voluntarily adopt X differ systematically from those who do not, and those differences drive Y.',
    failureOrValidityMode: 'Self-selection confounding; X is a marker of a healthy lifestyle, not the cause.',
    requiredElements: [
      'X is a voluntary health behavior',
      'Choosers of X differ systematically',
      'Lifestyle could drive Y',
      'Evidence is observational',
    ],
    canonicalStructure: [
      'An observational study found people who do X have better Y.',
      'Researchers concluded X causes Y.',
    ],
    designNotes: [
      'Strongest when X is preventive (supplements, exercise, screening).',
      'Avoid mentioning randomization or assignment.',
      'Health-conscious confounder can be implicit.',
    ],
    validationChecklist: [
      'Is X a voluntary health behavior or choice?',
      'Do people who choose X differ systematically from those who do not?',
      'Could Y be driven by overall lifestyle, not X specifically?',
      'Is evidence observational (not randomized)?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Health-conscious confounder explicitly mentioned',
      medium: 'Health-conscious confounder implied but not named',
      hard: 'Health-conscious confounder not mentioned; must be inferred from context',
    },
    domainExamples: [
      { domain: 'Supplements', example: 'Vitamin takers (health-conscious in general)' },
      { domain: 'Exercise', example: 'Gym members (already fit, health-aware)' },
      { domain: 'Diet', example: 'Organic food buyers (wealthy, health-aware)' },
      { domain: 'Screening', example: 'Health checkup attendees (proactive about health)' },
      { domain: 'Wellness', example: 'Meditation practitioners' },
      { domain: 'Vaccination', example: 'Early adopters (correlated behaviors)' },
      { domain: 'Preventive care', example: 'Regular dental visits' },
      { domain: 'Lifestyle', example: 'Non-smokers (bundle of behaviors)' },
      { domain: 'Fitness', example: 'Sports participants' },
      { domain: 'Medicine', example: 'Preventive medication adherence' },
    ],
    completeExample: {
      scenario: 'A 10-year study tracked 20,000 adults and found that those who took daily multivitamins had 20% lower mortality rates than those who did not. The researchers concluded that taking multivitamins extends lifespan and recommended daily supplementation.',
      claim: 'Taking multivitamins causes longer lifespan.',
      groundTruth: 'NO',
      explanation: 'Healthy User Bias: People who take daily vitamins tend to be more health-conscious overall and differ in diet, exercise, smoking, care-seeking, and socioeconomic status. Why Flawed: Without randomization, we cannot separate the effect of vitamins from the effect of being the type of person who takes vitamins.',
      difficulty: 'Medium',
    },
    keySignalWords: ['voluntary', 'chose', 'observational study', 'found', 'concluded', 'health behavior', 'lifestyle'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W5',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Ecological Fallacy',
    definition: 'Inferring individual-level causation from group-level correlations.',
    failureOrValidityMode: 'Aggregate associations do not imply individual effects.',
    requiredElements: [
      'Data is group-level (countries, states, schools)',
      'Claim is individual-level',
      'Within-group variation ignored',
      'Individual-level relationship could differ',
    ],
    canonicalStructure: [
      'At the group level, higher X is associated with higher Y.',
      'Researchers concluded individual X causes individual Y.',
    ],
    designNotes: [
      'Explicitly name the aggregation unit.',
      'The individual claim must be clearly stated.',
      'Avoid any individual-level evidence.',
    ],
    validationChecklist: [
      'Is data at group or aggregate level (countries, states, schools)?',
      'Is claim about individual-level causation?',
      'Is within-group variation ignored?',
      'Could individual-level relationship differ?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Aggregation unit explicitly stated and individual claim clearly made',
      medium: 'Aggregation unit clear but individual claim somewhat implicit',
      hard: 'Aggregation subtle; requires inference about unit of analysis',
    },
    domainExamples: [
      { domain: 'Health', example: 'Countries: chocolate consumption → Nobel prizes' },
      { domain: 'Education', example: 'States: class size → test scores' },
      { domain: 'Economics', example: 'Countries: X → GDP per capita' },
      { domain: 'Crime', example: 'Cities: police presence → crime rates' },
      { domain: 'Environment', example: 'Countries: car ownership → lifespan' },
      { domain: 'Politics', example: 'States: turnout → outcomes' },
      { domain: 'Social', example: 'Countries: religiosity → happiness' },
      { domain: 'Diet', example: 'Countries: fat intake → heart disease' },
      { domain: 'Technology', example: 'Countries: phone use → productivity' },
      { domain: 'Labor', example: 'Countries: immigration → wages' },
    ],
    completeExample: {
      scenario: 'A study found that countries with higher per-capita chocolate consumption have more Nobel Prize winners per capita. The researchers suggested that eating chocolate improves cognitive function and increases your chances of winning a Nobel Prize.',
      claim: 'Eating chocolate causes improved cognitive function (individual level).',
      groundTruth: 'NO',
      explanation: 'Ecological Fallacy: The data is country-level, but the claim is about individuals. The analysis does not show that Nobel Prize winners personally eat more chocolate. Why Flawed: Aggregate correlation cannot establish individual-level causation.',
      difficulty: 'Easy',
    },
    keySignalWords: ['countries', 'states', 'cities', 'group level', 'aggregate', 'per capita', 'individual', 'concluded'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W7',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Confounding',
    definition: 'A third variable Z causes both X and Y, producing a spurious association.',
    failureOrValidityMode: 'Common cause: Z → X and Z → Y.',
    requiredElements: [
      'Observed X–Y association described',
      'Z is present (explicit or implied)',
      'Z plausibly causes X',
      'Z plausibly causes Y',
      'Claim explicitly states “X causes Y”',
      'No control for Z',
    ],
    canonicalStructure: [
      'People who do X tend to have Y.',
      'Researchers concluded X causes Y.',
      '(Z is mentioned or inferable in background context.)',
    ],
    designNotes: [
      'Z can be socioeconomic status, motivation, health, age, etc.',
      'Medium difficulty cases hide Z in plain sight.',
      'Do not say “after controlling for Z”.',
    ],
    scenarioTemplate: 'Studies show that people who [do X] tend to [have Y]. Researchers concluded that [X causes Y]. Hidden in scenario: Z (for example, socioeconomic status, age, or lifestyle) explains both X and Y.',
    validationChecklist: [
      'Is Z a plausible common cause of both X and Y?',
      'Would controlling for Z reduce or eliminate the X–Y association?',
      'Is the scenario realistic and domain-appropriate?',
      'Is the causal claim clearly stated?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Z is explicitly mentioned in the scenario',
      medium: 'Z is implied but not named',
      hard: 'Z is not mentioned; must be inferred from context',
    },
    domainExamples: [
      { domain: 'Health', example: 'Exercise → Longevity (Z = SES, genetics)' },
      { domain: 'Education', example: 'Private school → College admission (Z = family wealth)' },
      { domain: 'Business', example: 'Training program → Productivity (Z = motivated employees)' },
      { domain: 'Technology', example: 'Early adoption → Success (Z = tech-savvy personality)' },
      { domain: 'Finance', example: 'Financial advisor → Wealth (Z = already wealthy)' },
      { domain: 'Environment', example: 'Organic food → Health (Z = health-conscious lifestyle)' },
      { domain: 'Social', example: 'Marriage → Happiness (Z = personality traits)' },
      { domain: 'Medicine', example: 'Vitamin supplements → Health (Z = health awareness)' },
      { domain: 'Sports', example: 'Expensive equipment → Performance (Z = dedication)' },
      { domain: 'Policy', example: 'Neighborhood programs → Safety (Z = community engagement)' },
    ],
    completeExample: {
      scenario: 'A large observational study followed 50,000 adults over 10 years. The researchers found that people who drink wine regularly have 25% lower rates of heart disease compared to non-drinkers. The study concluded that moderate wine consumption protects against heart disease.',
      claim: 'Wine consumption causes reduced heart disease risk.',
      groundTruth: 'NO',
      explanation: 'Confounder (Z): Socioeconomic status and overall lifestyle factors. Wine drinkers tend to have higher income, better diet, more exercise, and better access to healthcare. Why Flawed: The study is observational. People who choose to drink wine moderately differ systematically from non-drinkers in ways that independently affect heart disease risk.',
      difficulty: 'Medium',
    },
    keySignalWords: ['tend to', 'found', 'concluded', 'observational', 'associated with', 'confounder', 'third variable'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W9',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Reverse Causation',
    definition: 'The causal arrow is reversed: Y actually causes X.',
    failureOrValidityMode: 'Correlation without temporal or design evidence misidentifies direction.',
    requiredElements: [
      'X–Y association described',
      'Claim: X causes Y',
      'Reverse (Y → X) is plausible',
      'No evidence ruling out reverse causation',
    ],
    canonicalStructure: [
      'A study found X is associated with Y.',
      'Researchers concluded X causes Y.',
    ],
    designNotes: [
      'Works best with psychological or behavioral outcomes.',
      'Explicit timing is not required—ambiguity is key.',
      'Avoid longitudinal or experimental cues.',
    ],
    validationChecklist: [
      'Is X–Y association described?',
      'Does claim state X causes Y?',
      'Is reverse (Y → X) plausible?',
      'Is there no evidence ruling out reverse causation?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Reverse causation explicitly mentioned as alternative',
      medium: 'Reverse causation implied but not stated',
      hard: 'Reverse causation not mentioned; must be inferred from context',
    },
    domainExamples: [
      { domain: 'Health', example: 'Inactivity → Depression (reverse plausible)' },
      { domain: 'Education', example: 'Library visits → Reading ability' },
      { domain: 'Business', example: 'Confidence → Success' },
      { domain: 'Social', example: 'Social media → Loneliness' },
      { domain: 'Economics', example: 'Poor health → Poverty' },
      { domain: 'Psychology', example: 'Avoidance → Anxiety' },
      { domain: 'Medicine', example: 'Treatment-seeking → Illness severity' },
      { domain: 'Technology', example: 'Tool adoption → Skill' },
      { domain: 'Finance', example: 'Financial literacy → Wealth' },
      { domain: 'Relationships', example: 'Communication issues → Conflict' },
    ],
    completeExample: {
      scenario: 'A study found that teenagers who spend more time on social media report higher levels of loneliness. The researchers concluded that social media use causes loneliness in teenagers and recommended that parents limit their children\'s screen time.',
      claim: 'Social media use causes loneliness.',
      groundTruth: 'NO',
      explanation: 'Reverse Causation: Lonely teenagers may turn to social media seeking connection. Loneliness can drive social media use. Why Flawed: Without a design that identifies direction (for example, longitudinal timing or random assignment), the causal arrow is not determined.',
      difficulty: 'Medium',
    },
    keySignalWords: ['found', 'associated with', 'concluded', 'causes', 'reverse', 'direction'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W10',
    class: 'WOLF',
    tier: 'CORE',
    label: 'Post Hoc Fallacy',
    definition: 'Because Y followed X, X is assumed to have caused Y.',
    failureOrValidityMode: 'Temporal order ≠ causation.',
    requiredElements: [
      'X occurs before Y',
      'Claim relies on timing',
      'No mechanism or control',
      'Alternative explanations plausible',
    ],
    canonicalStructure: [
      'After X happened, Y occurred.',
      'Therefore, X caused Y.',
    ],
    designNotes: [
      'Everyday scenarios work best.',
      'Avoid mentioning baselines, trends, or comparison groups.',
      'Especially effective in medicine and personal anecdotes.',
    ],
    validationChecklist: [
      'Is there a clear temporal sequence (X happened before Y)?',
      'Is causal claim based primarily on timing?',
      'Is there no mechanistic or controlled evidence?',
      'Are alternative explanations plausible (coincidence, natural progression)?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Temporal sequence explicit and alternative explanations obvious',
      medium: 'Temporal sequence clear but alternative explanations less obvious',
      hard: 'Temporal sequence subtle; requires inference about timing',
    },
    domainExamples: [
      { domain: 'Medicine', example: 'Took remedy, cold resolved (natural recovery)' },
      { domain: 'Sports', example: 'Changed routine, then won (coincidence)' },
      { domain: 'Business', example: 'New CEO, profits rose (market conditions)' },
      { domain: 'Weather', example: 'Rain dance, then rain (coincidence)' },
      { domain: 'Technology', example: 'Software update, speed improved (other changes)' },
      { domain: 'Policy', example: 'New law, crime dropped (trend already occurring)' },
      { domain: 'Personal', example: 'Lucky socks, passed exam (chance)' },
      { domain: 'Agriculture', example: 'Planting ritual, good harvest (weather)' },
      { domain: 'Health', example: 'Started supplement, felt better (placebo)' },
      { domain: 'Economics', example: 'Tax cut, economy grew (global factors)' },
    ],
    completeExample: {
      scenario: 'A patient suffering from a cold took an herbal remedy recommended by a friend. Three days later, the cold symptoms were completely gone. The patient concluded that the herbal remedy cured the cold and recommended it to others.',
      claim: 'The herbal remedy cured the cold.',
      groundTruth: 'NO',
      explanation: 'Post Hoc Fallacy: The only evidence is that the remedy preceded recovery. Common colds often resolve in 3–7 days without treatment. Why Flawed: Without a control group, we cannot attribute the recovery to the remedy rather than natural healing.',
      difficulty: 'Easy',
    },
    keySignalWords: ['after', 'then', 'followed by', 'therefore', 'caused', 'temporal', 'timing'],
    impliedGroundTruth: 'NO',
  },

  // ---------------------------------------------------------------------------
  // WOLF (Advanced) — Unjustified causal claims
  // ---------------------------------------------------------------------------
  {
    code: 'W4',
    class: 'WOLF',
    tier: 'ADVANCED',
    label: 'Regression to the Mean',
    definition: 'Extreme values tend to move closer to the average upon retesting, even without intervention.',
    failureOrValidityMode: 'Change is incorrectly attributed to X, when it is partly or wholly a statistical artifact.',
    requiredElements: [
      'Selection based on extreme Y values',
      'Intervention X applied after selection',
      'Subsequent measurement closer to average',
      'Improvement attributed to X',
      'No control group of equally extreme non-treated cases',
    ],
    canonicalStructure: [
      'Subjects were selected because they had extreme Y.',
      'After intervention X, Y moved toward average.',
      'Researchers concluded X caused improvement.',
    ],
    designNotes: [
      'Must explicitly mention extremeness at baseline (“worst performers”, “most severe cases”).',
      'Do not include a control group.',
      'Works well in education, medicine, performance metrics.',
    ],
    keySignalWords: ['worst performers', 'lowest scores', 'most severe', 'dramatic improvement', 'returned to normal'],
    validationChecklist: [
      'Is selection based on extreme Y values (highest or lowest)?',
      'Is intervention X applied after selection?',
      'Does retest show movement toward average?',
      'Is change attributed to intervention, not statistical artifact?',
      'Is there no control group of similarly extreme cases without intervention?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Extremeness explicitly stated and statistical artifact obvious',
      medium: 'Extremeness clear but statistical artifact less obvious',
      hard: 'Extremeness subtle; requires statistical intuition about regression to mean',
    },
    domainExamples: [
      { domain: 'Education', example: 'Worst performers selected, then improved after tutoring' },
      { domain: 'Medicine', example: 'Most severe cases selected, then improved after treatment' },
      { domain: 'Sports', example: 'Lowest performers selected, then improved after training' },
      { domain: 'Performance', example: 'Bottom performers selected, then improved after intervention' },
    ],
    completeExample: {
      scenario: 'A school identified the 50 students with the lowest scores on the fall math exam (bottom 10%) and enrolled them in an intensive after-school tutoring program. On the spring exam, these students\' scores improved by an average of 15 points. The school board concluded that the tutoring program was highly effective.',
      claim: 'The tutoring program caused the score improvement.',
      groundTruth: 'NO',
      explanation: 'Regression to Mean: Students were selected because they scored extremely low. Some of that low performance reflects temporary factors. On retest, scores can improve even without tutoring. Why Flawed: Without a control group of equally low-scoring students who did not receive tutoring, the tutoring effect cannot be separated from regression to the mean.',
      difficulty: 'Medium',
    },
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W6',
    class: 'WOLF',
    tier: 'ADVANCED',
    label: 'Base Rate Neglect',
    definition: 'Failure to incorporate prior probabilities when interpreting diagnostic evidence.',
    failureOrValidityMode: 'Confusing P(A|B) with P(B|A); overstating diagnostic/causal certainty.',
    requiredElements: [
      'Low base rate stated or implied',
      'Test sensitivity/specificity described',
      'Misinterpretation of conditional probability',
      'Claim dramatically overstates likelihood',
    ],
    canonicalStructure: [
      'A test is described as “highly accurate.”',
      'A positive result is interpreted as near-certainty of the condition.',
      'Base rates are ignored.',
    ],
    designNotes: [
      'Include explicit numbers (even simple ones).',
      'Avoid solving the math in-text; let the error stand.',
      'Keep the mismatch qualitative: rare condition + nonzero false positives.',
      'MUST provide base rates and test properties in text.',
    ],
    validationChecklist: [
      'Is low base rate stated or implied?',
      'Are test properties provided (sensitivity and specificity, or equivalent)?',
      'Is interpretation confusing conditional probabilities?',
      'Does claim overstate P(Condition | Positive)?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Base rate and test properties explicitly stated, error obvious',
      medium: 'Base rate and test properties clear but error less obvious',
      hard: 'Base rate or test properties implicit; requires statistical reasoning',
    },
    domainExamples: [
      { domain: 'Medicine', example: 'Rare disease screening with high sensitivity but low base rate' },
      { domain: 'Diagnostics', example: 'Test for rare condition with false positives' },
    ],
    completeExample: {
      scenario: 'A screening test for a rare disease (affecting 1 in 1,000 people) has 99% sensitivity and 95% specificity. A patient tests positive. The doctor says they almost certainly have the disease because the test is "99% accurate."',
      claim: 'A positive test means you almost certainly have the disease.',
      groundTruth: 'NO',
      explanation: 'Base Rate Neglect: The doctor confused P(Positive | Disease) with P(Disease | Positive). Illustration (per 100,000 people): 100 have disease → 99 test positive (true positives). 99,900 do not have disease → 4,995 test positive (false positives). P(Disease | Positive) = 99/(99 + 4,995) ≈ 2%',
      difficulty: 'Medium',
    },
    keySignalWords: ['base rate', 'sensitivity', 'specificity', 'accurate', 'almost certainly', 'highly accurate'],
    impliedGroundTruth: 'NO',
  },
  {
    code: 'W8',
    class: 'WOLF',
    tier: 'ADVANCED',
    label: "Simpson’s Paradox",
    definition: 'A trend in aggregate data reverses or disappears when stratified by a confounder Z.',
    failureOrValidityMode: 'Pooling heterogeneous groups produces misleading comparisons.',
    requiredElements: [
      'Aggregate data supports X → Y',
      'Stratified data contradicts aggregate conclusion',
      'Z affects both X and Y',
      'Numerical data provided',
    ],
    canonicalStructure: [
      'Overall, Group A outperforms Group B.',
      'When broken down by Z, Group B outperforms A in every subgroup.',
      'Claim relies on the aggregate comparison.',
    ],
    designNotes: [
      'Numbers are mandatory.',
      'Must show directional reversal, not just attenuation.',
      'Make it “causal-looking” but invalid due to aggregation.',
    ],
    validationChecklist: [
      'Does aggregate data support X → Y pattern?',
      'Does stratified data contradict aggregate conclusion?',
      'Does Z affect both X and Y?',
      'Is numerical data provided?',
      'Is ground truth unambiguously NO?',
    ],
    difficultyCalibration: {
      easy: 'Numbers explicit and reversal obvious',
      medium: 'Numbers clear but reversal less obvious',
      hard: 'Numbers present but reversal requires careful analysis',
    },
    domainExamples: [
      { domain: 'Medicine', example: 'Hospital success rates by risk level' },
      { domain: 'Education', example: 'Admission rates by department and gender' },
    ],
    completeExample: {
      scenario: 'Hospital A has an overall surgery success rate of 90%, while Hospital B has 85%. A health board recommended Hospital A. However, the detailed data shows: Low-risk patients: Hospital A: 95%; Hospital B: 98%. High-risk patients: Hospital A: 65%; Hospital B: 70%. Hospital A treats 80% high-risk patients; Hospital B treats only 20%.',
      claim: 'Hospital A provides better surgical care overall.',
      groundTruth: 'NO',
      explanation: 'Simpson\'s Paradox: Hospital B has better outcomes within both risk groups. Hospital A\'s higher overall rate reflects a different patient mix, not better care.',
      difficulty: 'Medium',
    },
    keySignalWords: ['overall', 'aggregate', 'when broken down', 'stratified', 'subgroup', 'reversal'],
    impliedGroundTruth: 'NO',
  },

  // ---------------------------------------------------------------------------
  // SHEEP (Core) — Justified causal claims
  // ---------------------------------------------------------------------------
  {
    code: 'S1',
    class: 'SHEEP',
    tier: 'CORE',
    label: 'Randomized Controlled Trial (RCT)',
    definition: 'Random assignment to treatment and control groups.',
    failureOrValidityMode: 'Randomization eliminates confounding.',
    requiredElements: [
      'Explicit random assignment',
      'Treatment + control groups',
      'Outcome measured in both',
      'Difference attributed to treatment',
    ],
    canonicalStructure: [
      'Participants were randomly assigned to treatment or control.',
      'The treatment group showed better Y.',
      'Therefore, X causes Y.',
    ],
    designNotes: [
      'Use explicit language: “randomly assigned”.',
      'Blinding/placebo strengthens but is optional.',
      'Do not undermine with attrition or imbalance.',
    ],
    keyPhrases: [
      'randomly assigned',
      'randomized',
      'random allocation',
      'treatment group vs. control group',
      'placebo-controlled',
      'double-blind',
    ],
    validationChecklist: [
      'Is random assignment explicitly stated?',
      'Are treatment group and control group identified?',
      'Is outcome measured in both groups?',
      'Is difference attributed to treatment?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Random assignment explicit and control group clear',
      medium: 'Random assignment clear but some details implicit',
      hard: 'Random assignment implied but requires inference',
    },
    domainExamples: [
      { domain: 'Education', example: 'Random assignment of students to curriculum' },
      { domain: 'Medicine', example: 'Random assignment to treatment or placebo' },
      { domain: 'Psychology', example: 'Random assignment to intervention or control' },
    ],
    completeExample: {
      scenario: 'A school district wanted to evaluate a new math curriculum. They randomly assigned 500 students to either the new curriculum or the standard curriculum, ensuring that classrooms were balanced on prior math ability, socioeconomic status, and school. After one year, students in the new curriculum scored 12 points higher on standardized tests than the control group (p < 0.001).',
      claim: 'The new curriculum causes improved math performance.',
      groundTruth: 'YES',
      explanation: 'Why Valid: Random assignment ensures that the treatment and control groups are comparable. The 12-point difference can be attributed to the curriculum, not to confounders.',
      difficulty: 'Easy',
    },
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S2',
    class: 'SHEEP',
    tier: 'CORE',
    label: 'Natural Experiment',
    definition: 'An external, exogenous event assigns treatment “as if random”.',
    failureOrValidityMode: 'Assignment is independent of potential outcomes.',
    requiredElements: [
      'External event/policy',
      'Event not caused by Y',
      'Treated vs. untreated comparison',
      'Groups similar pre-event',
    ],
    canonicalStructure: [
      'An external event caused some units to receive X but not others.',
      'Outcomes diverged after the event.',
      'Therefore, X causes Y.',
    ],
    designNotes: [
      'Pre-trend similarity is crucial.',
      'Emphasize lack of choice or anticipation.',
      'Border/cutoff comparisons work well.',
    ],
    validationChecklist: [
      'Is external event/policy creating variation in X?',
      'Is event plausibly exogenous (not caused by Y)?',
      'Is there comparison between affected and unaffected groups?',
      'Were groups similar before the event?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'External event explicit and pre-trend similarity clear',
      medium: 'External event clear but pre-trend similarity implied',
      hard: 'External event or pre-trend similarity requires inference',
    },
    domainExamples: [
      { domain: 'Economics', example: 'Minimum wage change at state border' },
      { domain: 'Policy', example: 'Policy change affecting some regions but not others' },
    ],
    completeExample: {
      scenario: 'In 2015, State A suddenly raised its minimum wage from $7.25 to $10.00 per hour, while neighboring State B kept its minimum wage at $7.25. Researchers compared employment in counties along the state border before and after the change. Before 2015, employment trends in border counties were nearly identical. After the increase, employment in State A\'s border counties declined by 3% relative to State B\'s.',
      claim: 'The minimum wage increase caused reduced employment.',
      groundTruth: 'YES',
      explanation: 'Why Valid: The policy change was exogenous. Border counties are highly comparable. Workers didn\'t choose which state to be in based on future minimum wage changes.',
      difficulty: 'Easy',
    },
    keySignalWords: ['external event', 'policy change', 'exogenous', 'border', 'comparison', 'before and after'],
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S3',
    class: 'SHEEP',
    tier: 'CORE',
    label: 'Lottery / Quasi-Random Assignment',
    definition: 'Treatment assigned randomly among those who all want it.',
    failureOrValidityMode: 'Lottery eliminates selection bias among applicants.',
    requiredElements: [
      'Random or lottery mechanism',
      'Winners vs. non-winners',
      'All applicants wanted treatment',
      'Outcomes measured for both',
    ],
    canonicalStructure: [
      'Eligible applicants entered a lottery for X.',
      'Winners received X; others did not.',
      'Outcomes differed → X causes Y.',
    ],
    designNotes: [
      'Explicitly state that both groups applied.',
      'Avoid crossover/compliance complications.',
      'Keep it clean and “as-if randomized”.',
    ],
    validationChecklist: [
      'Is lottery or random assignment mechanism described?',
      'Are winners vs. non-winners compared?',
      'Did all applicants want treatment?',
      'Is outcome measured for both groups?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Lottery mechanism explicit and both groups clearly defined',
      medium: 'Lottery mechanism clear but some details implicit',
      hard: 'Lottery mechanism implied but requires inference',
    },
    domainExamples: [
      { domain: 'Health', example: 'Medicaid lottery assignment' },
      { domain: 'Education', example: 'School voucher lottery' },
    ],
    completeExample: {
      scenario: 'In 2008, Oregon expanded Medicaid but had limited spots. They used a lottery to randomly select 30,000 winners from 90,000 low-income applicants. Researchers compared lottery winners (who received Medicaid) to non-winners (who remained uninsured). Winners had 40% higher rates of outpatient care and significantly lower rates of depression.',
      claim: 'Medicaid coverage causes increased healthcare utilization.',
      groundTruth: 'YES',
      explanation: 'Why Valid: All 90,000 applicants wanted Medicaid coverage. The lottery randomly determined who got coverage. Any difference can be attributed to having insurance.',
      difficulty: 'Easy',
    },
    keySignalWords: ['lottery', 'randomly selected', 'winners', 'non-winners', 'applicants'],
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S4',
    class: 'SHEEP',
    tier: 'CORE',
    label: 'Controlled Ablation',
    definition: 'Removing X causes Y to disappear or change, holding everything else constant.',
    failureOrValidityMode: 'Demonstrates necessity of X for Y.',
    requiredElements: [
      'X present, Y observed',
      'X removed in controlled way',
      'Y disappears or changes',
      'No other changes',
    ],
    canonicalStructure: [
      'When X was removed, Y no longer occurred (or changed).',
      'All other conditions remained identical.',
      'Therefore, X causes Y.',
    ],
    designNotes: [
      'Best in biology/engineering/systems.',
      '“Only difference” language is essential.',
      'Avoid compensatory mechanisms.',
    ],
    validationChecklist: [
      'Was X present and Y observed?',
      'Was X removed in a controlled manner?',
      'Did Y disappear or significantly change?',
      'Did nothing else change during the ablation?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Ablation explicit and control of other factors clear',
      medium: 'Ablation clear but control of other factors implied',
      hard: 'Ablation or control requires inference',
    },
    domainExamples: [
      { domain: 'Biology', example: 'Gene knockout experiments' },
      { domain: 'Engineering', example: 'Component removal in systems' },
    ],
    completeExample: {
      scenario: 'To test whether gene ABC is necessary for tumor growth, researchers created genetically identical mice with gene ABC knocked out. When exposed to a carcinogen under identical conditions, normal mice developed tumors within 8 weeks, but ABC-knockout mice did not develop any tumors even after 16 weeks.',
      claim: 'Gene ABC causes (is necessary for) tumor growth.',
      groundTruth: 'YES',
      explanation: 'Why Valid: The only difference between the two groups is the presence or absence of gene ABC. All other factors were identical. The disappearance of tumors when ABC is removed demonstrates ABC\'s causal role.',
      difficulty: 'Easy',
    },
    keySignalWords: ['removed', 'knocked out', 'eliminated', 'no longer occurred', 'identical conditions', 'only difference'],
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S5',
    class: 'SHEEP',
    tier: 'CORE',
    label: 'Mechanism + Dose-Response',
    definition: 'A known causal mechanism plus a graded dose-response relationship.',
    failureOrValidityMode: 'Mechanism explains how; dose-response shows causal strength.',
    requiredElements: [
      'Established mechanism X → Y',
      'Dose-response gradient',
      'Higher exposure → stronger effect',
      'Mechanism scientifically accepted',
    ],
    canonicalStructure: [
      'X affects Y through a known mechanism.',
      'Higher levels of X lead to stronger changes in Y.',
      'Therefore, X causes Y.',
    ],
    designNotes: [
      'Mechanism must be explicit, not speculative.',
      'Numeric gradients strengthen clarity but need not be computed.',
      'Avoid confounding narratives.',
    ],
    validationChecklist: [
      'Is known mechanism connecting X to Y described?',
      'Is dose-response relationship (gradient effect) shown?',
      'Does higher exposure lead to stronger effect?',
      'Is mechanism scientifically established?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Mechanism and dose-response both explicit',
      medium: 'Mechanism or dose-response clear but other implied',
      hard: 'Mechanism or dose-response requires inference',
    },
    domainExamples: [
      { domain: 'Toxicology', example: 'Lead exposure and cognitive impairment' },
      { domain: 'Medicine', example: 'Drug dosage and effect gradient' },
    ],
    completeExample: {
      scenario: 'Lead is known to interfere with neurotransmitter function by blocking calcium channels in neurons. Studies of children across multiple countries show a clear dose-response relationship: blood lead levels of 5, 10, and 20 μg/dL are associated with IQ reductions of approximately 2, 4, and 8 points respectively.',
      claim: 'Lead exposure causes cognitive impairment.',
      groundTruth: 'YES',
      explanation: 'Why Valid: (1) Known biological mechanism. (2) Clear dose-response gradient. The combination provides strong causal evidence.',
      difficulty: 'Easy',
    },
    keySignalWords: ['known mechanism', 'dose-response', 'gradient', 'higher levels', 'stronger effect', 'scientifically established'],
    impliedGroundTruth: 'YES',
  },

  // ---------------------------------------------------------------------------
  // SHEEP (Advanced) — Justified causal claims
  // ---------------------------------------------------------------------------
  {
    code: 'S6',
    class: 'SHEEP',
    tier: 'ADVANCED',
    label: 'Instrumental Variable',
    definition: 'An instrument Z affects Y only through X, allowing causal inference despite confounding.',
    failureOrValidityMode: 'IV logic identifies causal effect when exclusion restriction holds.',
    requiredElements: [
      'Instrument Z described',
      'Z affects X strongly',
      'Z does not directly affect Y',
      'Confounding between X and Y acknowledged',
      'Claim based on IV logic',
    ],
    canonicalStructure: [
      'Z influences whether subjects receive X.',
      'Z has no plausible direct effect on Y (only through X).',
      'Differences in Y are attributed to X.',
    ],
    designNotes: [
      'Must explicitly state the exclusion restriction in plain language.',
      'Avoid jargon unless explained.',
      'Common domains: education, health access, geography.',
    ],
    validationChecklist: [
      'Is instrument Z described?',
      'Does Z affect X strongly?',
      'Does Z not directly affect Y?',
      'Is confounding between X and Y acknowledged?',
      'Is claim based on IV logic?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'IV logic explicit and exclusion restriction clear',
      medium: 'IV logic clear but exclusion restriction implied',
      hard: 'IV logic or exclusion restriction requires inference',
    },
    domainExamples: [
      { domain: 'Education', example: 'Distance to college as instrument for education\'s effect on earnings' },
      { domain: 'Health', example: 'Geographic variation as instrument for healthcare access' },
    ],
    keySignalWords: ['instrument', 'exclusion restriction', 'affects only through', 'no direct effect'],
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S7',
    class: 'SHEEP',
    tier: 'ADVANCED',
    label: 'Difference-in-Differences',
    definition: 'Compare changes over time between treated and control groups.',
    failureOrValidityMode: 'Parallel pre-treatment trends justify counterfactual inference.',
    requiredElements: [
      'Treatment group and control group',
      'Pre-treatment outcome trends described',
      'Intervention at a known time',
      'Post-treatment divergence',
      'Parallel trends assumption stated or implied',
    ],
    canonicalStructure: [
      'Before X, both groups followed similar trends.',
      'After X, only treated group changed.',
      'Difference-in-differences attributed to X.',
    ],
    designNotes: [
      'Must include an explicit time dimension.',
      'Pre-trend similarity is essential.',
      'Avoid contemporaneous shocks that affect only one group.',
    ],
    validationChecklist: [
      'Are treatment group and control group identified?',
      'Are pre-treatment outcome trends described?',
      'Is intervention at a known time?',
      'Is there post-treatment divergence?',
      'Is parallel trends assumption stated or implied?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Parallel trends explicit and time dimension clear',
      medium: 'Parallel trends clear but time dimension implied',
      hard: 'Parallel trends or time dimension requires inference',
    },
    domainExamples: [
      { domain: 'Policy', example: 'Smoking rates in states with vs. without tax increases' },
      { domain: 'Economics', example: 'Employment before and after policy changes' },
    ],
    keySignalWords: ['before', 'after', 'parallel trends', 'similar trends', 'diverged', 'difference-in-differences'],
    impliedGroundTruth: 'YES',
  },
  {
    code: 'S8',
    class: 'SHEEP',
    tier: 'ADVANCED',
    label: 'Regression Discontinuity',
    definition: 'Treatment assigned based on crossing a cutoff in a continuous variable.',
    failureOrValidityMode: 'Units just above and below cutoff are effectively randomized (locally).',
    requiredElements: [
      'Continuous assignment variable',
      'Explicit cutoff rule',
      'Treatment differs sharply at cutoff',
      'Comparison of near-cutoff units',
      'Claim restricted to local causal effect',
    ],
    canonicalStructure: [
      'Units above threshold receive X; those just below do not.',
      'Outcomes differ sharply at cutoff for near-threshold units.',
      'Difference attributed to X (local effect).',
    ],
    designNotes: [
      'Emphasize local comparison, not global claims.',
      'Avoid manipulation of the running variable.',
      'Best in policy, education, eligibility rules.',
    ],
    validationChecklist: [
      'Is continuous assignment variable described?',
      'Is explicit cutoff rule stated?',
      'Does treatment differ sharply at cutoff?',
      'Is comparison of near-cutoff units made?',
      'Is claim restricted to local causal effect?',
      'Is ground truth unambiguously YES?',
    ],
    difficultyCalibration: {
      easy: 'Cutoff rule explicit and local comparison clear',
      medium: 'Cutoff rule clear but local comparison implied',
      hard: 'Cutoff rule or local comparison requires inference',
    },
    domainExamples: [
      { domain: 'Education', example: 'Scholarship awarded to students scoring 70+; compare students scoring 69 vs. 70' },
      { domain: 'Policy', example: 'Benefits eligibility based on income threshold' },
    ],
    keySignalWords: ['cutoff', 'threshold', 'above', 'below', 'near-cutoff', 'local effect', 'discontinuity'],
    impliedGroundTruth: 'YES',
  },
];

export function getL1EvidenceByCode(code: L1EvidenceCode): L1EvidenceDefinition | undefined {
  return L1_EVIDENCE_TYPES.find(t => t.code === code);
}

export function getL1EvidenceByClass(cls: Exclude<EvidenceClass, 'NONE'>): L1EvidenceDefinition[] {
  return L1_EVIDENCE_TYPES.filter(t => t.class === cls);
}

export function inferEvidenceClassFromGroundTruth(gt: GroundTruth): EvidenceClass {
  if (gt === 'YES') return 'SHEEP';
  if (gt === 'NO') return 'WOLF';
  return 'NONE';
}

export function inferDifficultyForL1(evidence: L1EvidenceDefinition): Difficulty {
  // Conservative defaults; generator can override.
  if (evidence.tier === 'ADVANCED') return 'hard';
  // Core: many can be medium; keep a simple deterministic mapping.
  if (evidence.code === 'W10') return 'easy';
  if (evidence.code === 'W1' || evidence.code === 'W2' || evidence.code === 'S1') return 'easy';
  return 'medium';
}

