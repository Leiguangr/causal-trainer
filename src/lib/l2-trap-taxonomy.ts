/**
 * L2 Trap Taxonomy (T1-T17)
 *
 * L2 cases focus on 17 specific trap types organized into 6 families.
 * Each trap type has a core "hidden question" that must be asked to resolve ambiguity.
 *
 * This file is generator-oriented: each trap type includes required elements,
 * canonical structure, case skeleton, example patterns, and common pitfalls.
 */

export type L2TrapType = 
  | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9'
  | 'T10' | 'T11' | 'T12' | 'T13' | 'T14' | 'T15' | 'T16' | 'T17';

export type L2TrapFamily = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export interface L2TrapDefinition {
  code: L2TrapType;
  family: L2TrapFamily;
  familyName: string;
  name: string;
  definition: string;
  hiddenQuestionPattern: string;
  requiredElements: string[];
  canonicalStructure: string[];
  caseSkeleton: string[];
  examplePattern: string[];
  commonPitfalls: string[];
  coreHiddenQuestion: string;
}

export const L2_TRAP_TYPES: L2TrapType[] = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
  'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17'
];

export const L2_TRAP_TAXONOMY: L2TrapDefinition[] = [
  // Family F1 — Selection Effects
  {
    code: 'T1',
    family: 'F1',
    familyName: 'Selection Effects',
    name: 'SELECTION (Non-random Sampling)',
    definition: 'Observed X–Y relationship is biased because the sample is not representative of the target population.',
    hiddenQuestionPattern: 'Who is systematically excluded from observation?',
    requiredElements: [
      'X and Y observed only for a selected subset S',
      'Selection correlated with X, Y, or both',
      'No explicit failure data'
    ],
    canonicalStructure: [
      'X → Y',
      'X → S ← Y',
      '(analysis conditioned on S)'
    ],
    caseSkeleton: [
      'Narrative describes survey, study, or dataset',
      'Participation requires motivation, access, health, interest, etc.',
      'Claim generalizes beyond observed group'
    ],
    examplePattern: [
      'Studying fitness by surveying gym members',
      'Measuring app satisfaction from active users only'
    ],
    commonPitfalls: [
      'Confusing with survivorship (T2)',
      'Omitting explicit selection mechanism'
    ],
    coreHiddenQuestion: 'Who is missing or conditioned away?'
  },
  {
    code: 'T2',
    family: 'F1',
    familyName: 'Selection Effects',
    name: 'SURVIVORSHIP',
    definition: 'Only entities that persist long enough are observed; failures are invisible.',
    hiddenQuestionPattern: 'What happened to the failures?',
    requiredElements: [
      'Observation conditional on "surviving," "lasting," or "remaining"',
      'Implicit attrition or filtering over time'
    ],
    canonicalStructure: [
      'X → Y',
      'Y → Survival',
      '(observe only Survival = 1)'
    ],
    caseSkeleton: [
      'Analysis of "successful" companies, students, patients, products',
      'No data on dropouts, bankruptcies, deaths, withdrawals'
    ],
    examplePattern: [
      'Traits of long-lasting startups',
      'Longevity of award winners'
    ],
    commonPitfalls: [
      'Making failure explicit (removes ambiguity)',
      'Treating as selection without time element'
    ],
    coreHiddenQuestion: 'Who is missing or conditioned away?'
  },
  {
    code: 'T3',
    family: 'F1',
    familyName: 'Selection Effects',
    name: 'COLLIDER (Conditioning on a Common Effect)',
    definition: 'Conditioning on a variable caused by both X and Y induces spurious correlation.',
    hiddenQuestionPattern: 'Are we conditioning on a variable caused by both X and Y?',
    requiredElements: [
      'Z caused by both X and Y',
      'Analysis explicitly or implicitly conditioned on Z'
    ],
    canonicalStructure: [
      'X → Z ← Y',
      '(condition on Z)'
    ],
    caseSkeleton: [
      'Sample restricted to hospitalized, admitted, approved, hired',
      'Observed inverse or paradoxical association'
    ],
    examplePattern: [
      'Among hospitalized patients, one risk factor appears protective'
    ],
    commonPitfalls: [
      'Treating Z as confounder instead of collider',
      'Forgetting explicit conditioning'
    ],
    coreHiddenQuestion: 'Who is missing or conditioned away?'
  },
  {
    code: 'T4',
    family: 'F1',
    familyName: 'Selection Effects',
    name: 'IMMORTAL TIME',
    definition: 'Study design misclassifies time during which outcome could not have occurred.',
    hiddenQuestionPattern: 'Was there a period during which the outcome was impossible?',
    requiredElements: [
      'Time-to-event setting',
      'Exposure defined after study start',
      'Outcome requires survival until exposure'
    ],
    canonicalStructure: [
      'Start → (Immortal Time) → Exposure → Outcome'
    ],
    caseSkeleton: [
      'Comparing treated vs untreated without aligning start times',
      'Exposure assigned post hoc'
    ],
    examplePattern: [
      'Award winners "live longer" because they had to survive to win'
    ],
    commonPitfalls: [
      'No explicit timing',
      'Confusing with survivorship alone'
    ],
    coreHiddenQuestion: 'Who is missing or conditioned away?'
  },
  // Family F2 — Statistical Artifacts
  {
    code: 'T5',
    family: 'F2',
    familyName: 'Statistical Artifacts',
    name: 'REGRESSION TO THE MEAN',
    definition: 'Extreme values naturally move toward the average on re-measurement.',
    hiddenQuestionPattern: 'Were subjects selected for extreme initial values?',
    requiredElements: [
      'Selection based on unusually high or low baseline Y',
      'Follow-up measurement of same variable'
    ],
    canonicalStructure: [
      'Y₁ (extreme) → Y₂ (closer to mean)',
      '(no causal X required)'
    ],
    caseSkeleton: [
      '"Improvement" after intervention given to worst performers'
    ],
    examplePattern: [
      'Athletes decline after peak season',
      'Test scores rebound after unusually bad year'
    ],
    commonPitfalls: [
      'Adding unnecessary causal X',
      'Failing to mention selection on extremes'
    ],
    coreHiddenQuestion: 'Is this pattern mathematical rather than causal?'
  },
  {
    code: 'T6',
    family: 'F2',
    familyName: 'Statistical Artifacts',
    name: 'ECOLOGICAL FALLACY',
    definition: 'Group-level correlations do not imply individual-level relationships.',
    hiddenQuestionPattern: 'Does the pattern hold within each subgroup?',
    requiredElements: [
      'Aggregated data across groups',
      'Claim about individuals'
    ],
    canonicalStructure: [
      'Group averages: X̄g ↔ Ȳg',
      'Individuals: Xi ? Yi'
    ],
    caseSkeleton: [
      'Country/state comparisons',
      'Organizational or demographic aggregates'
    ],
    examplePattern: [
      'Countries with higher chocolate consumption have more Nobel laureates'
    ],
    commonPitfalls: [
      'Providing individual-level evidence (removes ambiguity)'
    ],
    coreHiddenQuestion: 'Is this pattern mathematical rather than causal?'
  },
  // Family F3 — Confounding
  {
    code: 'T7',
    family: 'F3',
    familyName: 'Confounding',
    name: 'CONFOUNDER',
    definition: 'Unmeasured variable causes both X and Y.',
    hiddenQuestionPattern: 'Is there an unmeasured common cause?',
    requiredElements: [
      'Plausible Z influencing both X and Y',
      'Z not controlled or measured'
    ],
    canonicalStructure: [
      'Z → X',
      'Z → Y'
    ],
    caseSkeleton: [
      'Lifestyle, environment, genetics, SES as implicit Z'
    ],
    examplePattern: [
      'Coffee drinking and lung cancer (smoking)'
    ],
    commonPitfalls: [
      'Making Z explicit and measured',
      'Confusing with collider'
    ],
    coreHiddenQuestion: 'What common cause is missing or misinterpreted?'
  },
  {
    code: 'T8',
    family: 'F3',
    familyName: 'Confounding',
    name: "SIMPSON'S PARADOX",
    definition: 'Aggregate association reverses after stratifying by confounder.',
    hiddenQuestionPattern: 'What happens when we stratify by Z?',
    requiredElements: [
      'Aggregate trend stated',
      'Plausible stratification variable Z'
    ],
    canonicalStructure: [
      'Z → X',
      'Z → Y',
      '(aggregation masks strata)'
    ],
    caseSkeleton: [
      'Overall disparity claim',
      'Department, subgroup, or baseline imbalance'
    ],
    examplePattern: [
      'UC Berkeley admissions case'
    ],
    commonPitfalls: [
      'Explicitly giving stratified results (no ambiguity)'
    ],
    coreHiddenQuestion: 'What common cause is missing or misinterpreted?'
  },
  {
    code: 'T9',
    family: 'F3',
    familyName: 'Confounding',
    name: 'CONF-MED (Confounder–Mediator Ambiguity)',
    definition: 'Variable Z could be confounder or mediator depending on timing.',
    hiddenQuestionPattern: 'Did Z occur before X or after X?',
    requiredElements: [
      'Temporal ambiguity between X and Z',
      'Z associated with both X and Y'
    ],
    canonicalStructure: [
      'Confounder: Z → X → Y',
      'Mediator: X → Z → Y'
    ],
    caseSkeleton: [
      'Behavior adoption + health/environment change'
    ],
    examplePattern: [
      'Exercise, cholesterol, and heart disease'
    ],
    commonPitfalls: [
      'Fixing the timeline',
      'Treating Z as clearly mediator'
    ],
    coreHiddenQuestion: 'What common cause is missing or misinterpreted?'
  },
  // Family F4 — Direction Errors
  {
    code: 'T10',
    family: 'F4',
    familyName: 'Direction Errors',
    name: 'REVERSE CAUSATION',
    definition: 'Claimed direction X → Y may actually be Y → X.',
    hiddenQuestionPattern: 'Did X precede Y or did Y precede X?',
    requiredElements: [
      'Temporal ambiguity',
      'Plausible reverse explanation'
    ],
    canonicalStructure: [
      'Claimed: X → Y',
      'Actual:  Y → X'
    ],
    caseSkeleton: [
      'Behavior correlated with psychological or health state'
    ],
    examplePattern: [
      'TV watching and depression'
    ],
    commonPitfalls: [
      'Making time ordering explicit'
    ],
    coreHiddenQuestion: 'Which way does causation flow (possibly over time)?'
  },
  {
    code: 'T11',
    family: 'F4',
    familyName: 'Direction Errors',
    name: 'FEEDBACK (Bidirectional Causation)',
    definition: 'X and Y reinforce each other in a loop.',
    hiddenQuestionPattern: 'Is there a reinforcing loop between X and Y?',
    requiredElements: [
      'Mutual plausibility',
      'Dynamic or longitudinal framing'
    ],
    canonicalStructure: [
      'X ↔ Y'
    ],
    caseSkeleton: [
      'Performance ↔ confidence',
      'Trust ↔ compliance'
    ],
    examplePattern: [
      'Self-esteem and academic success'
    ],
    commonPitfalls: [
      'Treating as simple reverse causation'
    ],
    coreHiddenQuestion: 'Which way does causation flow (possibly over time)?'
  },
  {
    code: 'T12',
    family: 'F4',
    familyName: 'Direction Errors',
    name: 'TEMPORAL (Time-Varying Confounding)',
    definition: 'Confounding structure changes over time due to prior exposure.',
    hiddenQuestionPattern: 'Does the confounder change as a result of past X?',
    requiredElements: [
      'Multiple time points',
      'Z affected by earlier X and affecting later X/Y'
    ],
    canonicalStructure: [
      'X₁ → Z₁ → X₂ → Y'
    ],
    caseSkeleton: [
      'Treatment adjustments over time',
      'Adaptive policies'
    ],
    examplePattern: [
      'Medication affecting organ function affecting dosing'
    ],
    commonPitfalls: [
      'Single-time-point framing'
    ],
    coreHiddenQuestion: 'Which way does causation flow (possibly over time)?'
  },
  // Family F5 — Information Bias
  {
    code: 'T13',
    family: 'F5',
    familyName: 'Information Bias',
    name: 'MEASUREMENT BIAS',
    definition: 'Exposure or outcome measured with differential accuracy.',
    hiddenQuestionPattern: 'Does measurement accuracy differ between groups?',
    requiredElements: [
      'True variable X vs measured X*',
      'Differential surveillance or detection'
    ],
    canonicalStructure: [
      'X → Y',
      'U → X*',
      '(X* observed, not X)'
    ],
    caseSkeleton: [
      'Diagnosed vs undiagnosed groups',
      'Differential testing intensity'
    ],
    examplePattern: [
      'Sicker patients get more diagnoses'
    ],
    commonPitfalls: [
      'Random (non-differential) error only'
    ],
    coreHiddenQuestion: 'Is what we measured equal to what we think we measured?'
  },
  {
    code: 'T14',
    family: 'F5',
    familyName: 'Information Bias',
    name: 'RECALL BIAS',
    definition: 'Outcome influences recall of prior exposure.',
    hiddenQuestionPattern: 'Do cases remember past exposure differently than controls?',
    requiredElements: [
      'Retrospective self-report',
      'Salient outcome'
    ],
    canonicalStructure: [
      'X → Y',
      'Y → X*'
    ],
    caseSkeleton: [
      'Surveys after diagnosis',
      'Retrospective interviews'
    ],
    examplePattern: [
      'Mothers recalling pregnancy exposures'
    ],
    commonPitfalls: [
      'Prospective design (removes ambiguity)'
    ],
    coreHiddenQuestion: 'Is what we measured equal to what we think we measured?'
  },
  // Family F6 — Mechanism Failures
  {
    code: 'T15',
    family: 'F6',
    familyName: 'Mechanism Failures',
    name: 'MECHANISM (Wrong Causal Path)',
    definition: 'Intervention targets a proxy or side path, not the true cause.',
    hiddenQuestionPattern: 'Did the intervention block the true causal mechanism?',
    requiredElements: [
      'Multiple plausible mechanisms',
      'Intervention targets only one'
    ],
    canonicalStructure: [
      'X → M₁ → Y',
      'X → M₂ → Y',
      '(intervention hits wrong M)'
    ],
    caseSkeleton: [
      'Policy or training aimed at improvement',
      'Outcome unchanged'
    ],
    examplePattern: [
      'Teaching "critical thinking" for rote tests'
    ],
    commonPitfalls: [
      'No clear mechanism distinction'
    ],
    coreHiddenQuestion: 'Does the intervention actually target the causal mechanism?'
  },
  {
    code: 'T16',
    family: 'F6',
    familyName: 'Mechanism Failures',
    name: "GOODHART'S LAW",
    definition: 'Metric ceases to be informative once optimized against.',
    hiddenQuestionPattern: 'Is the metric being gamed?',
    requiredElements: [
      'Proxy metric M',
      'Incentives tied to M',
      'Behavioral adaptation'
    ],
    canonicalStructure: [
      'Before: M → Y',
      'After:  optimize M, M ↛ Y'
    ],
    caseSkeleton: [
      'KPIs, rankings, quotas'
    ],
    examplePattern: [
      'Hospitals avoiding high-risk patients'
    ],
    commonPitfalls: [
      'No incentive change described'
    ],
    coreHiddenQuestion: 'Does the intervention actually target the causal mechanism?'
  },
  {
    code: 'T17',
    family: 'F6',
    familyName: 'Mechanism Failures',
    name: 'BACKFIRE',
    definition: 'Intervention triggers compensatory behavior reversing effect.',
    hiddenQuestionPattern: 'Could the intervention provoke an opposing response?',
    requiredElements: [
      'Intervention I',
      'Human or system response C',
      'Net effect ambiguous or negative'
    ],
    canonicalStructure: [
      'I → Y (+)',
      'I → C → Y (−)'
    ],
    caseSkeleton: [
      'Warnings, bans, incentives'
    ],
    examplePattern: [
      'Anti-drug campaigns increasing curiosity'
    ],
    commonPitfalls: [
      'Assuming linear compliance'
    ],
    coreHiddenQuestion: 'Does the intervention actually target the causal mechanism?'
  }
];

/**
 * Get trap definition by code
 */
export function getL2TrapByCode(code: L2TrapType): L2TrapDefinition | undefined {
  return L2_TRAP_TAXONOMY.find(t => t.code === code);
}

/**
 * Get all trap types for a given family
 */
export function getL2TrapsByFamily(family: L2TrapFamily): L2TrapDefinition[] {
  return L2_TRAP_TAXONOMY.filter(t => t.family === family);
}

/**
 * Get all trap types (for selection/diversity)
 */
export function getAllL2TrapTypes(): L2TrapType[] {
  return L2_TRAP_TYPES;
}
