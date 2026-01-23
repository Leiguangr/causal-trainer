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
    ],
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

