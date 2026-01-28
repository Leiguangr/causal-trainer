/**
 * CS372 Assignment 2 Taxonomy - Complete definitions for hierarchical case generation
 * Source: Assignment2_Guidelines-T3-L1.pdf, L2.pdf, L3.pdf
 *
 * This file contains the complete taxonomy for:
 * - L1: 10 WOLF types (NO) + 8 SHEEP types (YES) + AMBIGUOUS
 * - L2: 17 trap types in 6 families + AMBIGUOUS
 * - L3: 8 families with VALID/INVALID/CONDITIONAL answer types
 */

import { PearlLevel } from '@/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type L1AnswerType = 'YES' | 'NO' | 'AMBIGUOUS';
export type L2AnswerType = 'YES' | 'NO' | 'AMBIGUOUS';
export type L3AnswerType = 'VALID' | 'INVALID' | 'CONDITIONAL';

export type AmbiguityType = 'TIMING' | 'MECHANISM' | 'STRUCTURE' | 'MAGNITUDE';

export interface TrapDefinition {
  id: string;
  name: string;
  family: string;
  familyId: string;
  tier: 'Core' | 'Advanced';
  description: string;
  keyQuestion: string;
  example: string;
  validationChecklist: string[];
}

export interface SheepDefinition {
  id: string;
  name: string;
  tier: 'Core' | 'Advanced';
  description: string;
  requiredElements: string[];
  example: string;
}

export interface L3FamilyDefinition {
  id: string;
  name: string;
  coreChallenge: string;
  guidingQuestion: string;
  subtypes: string[];
  validAnswers: L3AnswerType[];
  example: string;
}

// ============================================================================
// L1 WOLF TYPES (NO cases) - 10 types in 4 families
// ============================================================================

export const L1_WOLF_TYPES: TrapDefinition[] = [
  // Selection Family (W1-W4)
  {
    id: 'W1',
    name: 'Selection Bias',
    family: 'Selection',
    familyId: 'F1',
    tier: 'Core',
    description: 'Non-random sampling creates bias - the sample is not representative of the population.',
    keyQuestion: 'Who is excluded from the sample?',
    example: 'Surveying gym members about exercise habits overstates population fitness (non-exercisers are excluded).',
    validationChecklist: [
      'Sampling method clearly creates non-representative sample',
      'The excluded group differs systematically from included group',
      'Causal claim is invalidated by selection mechanism',
    ],
  },
  {
    id: 'W2',
    name: 'Survivorship Bias',
    family: 'Selection',
    familyId: 'F1',
    tier: 'Core',
    description: 'Only survivors/successes are observed - failures are invisible.',
    keyQuestion: 'What about the failures?',
    example: 'Studying traits of successful startups misses that failed startups had the same traits.',
    validationChecklist: [
      'Only successful/surviving cases are observed',
      'Failed/non-surviving cases would contradict the pattern',
      'Causal claim ignores the missing failures',
    ],
  },
  {
    id: 'W3',
    name: 'Healthy User Bias',
    family: 'Selection',
    familyId: 'F1',
    tier: 'Core',
    description: 'Self-selection into treatment correlates with health/ability factors.',
    keyQuestion: 'Are treatment-seekers systematically different?',
    example: 'Vitamin users appear healthier, but health-conscious people take vitamins AND exercise, eat well, etc.',
    validationChecklist: [
      'Treatment is self-selected, not randomized',
      'People who choose treatment differ in relevant ways',
      'Outcome is driven by those differences, not treatment',
    ],
  },
  {
    id: 'W4',
    name: 'Regression to Mean',
    family: 'Selection',
    familyId: 'F1',
    tier: 'Advanced',
    description: 'Extreme values naturally regress toward the mean on subsequent measurement.',
    keyQuestion: 'Were subjects selected for extreme values?',
    example: 'The "Sports Illustrated cover jinx" - athletes featured after peak performances naturally regress.',
    validationChecklist: [
      'Selection based on extreme initial value',
      'Subsequent measurement shows regression toward mean',
      'Change is attributed to intervention rather than statistical artifact',
    ],
  },
  // Ecological Family (W5-W6)
  {
    id: 'W5',
    name: 'Ecological Fallacy',
    family: 'Ecological',
    familyId: 'F2',
    tier: 'Core',
    description: 'Group-level correlation does not equal individual-level correlation.',
    keyQuestion: 'Does the within-group pattern match the between-group pattern?',
    example: 'Countries with higher chocolate consumption have more Nobel laureates (aggregation masks individual variation).',
    validationChecklist: [
      'Data is at aggregate/group level',
      'Claim is about individuals',
      'Individual-level relationship may differ from aggregate',
    ],
  },
  {
    id: 'W6',
    name: 'Base Rate Neglect',
    family: 'Ecological',
    familyId: 'F2',
    tier: 'Advanced',
    description: 'Ignoring prior probabilities when interpreting conditional probabilities.',
    keyQuestion: 'What is the base rate in the population?',
    example: 'A 99% accurate test has 50% false positives when the condition is rare (1 in 1000).',
    validationChecklist: [
      'Base rate/prior probability is relevant',
      'Conditional probability is misinterpreted as absolute',
      'Ignoring base rate leads to wrong conclusion',
    ],
  },
  // Confounding Family (W7-W8)
  {
    id: 'W7',
    name: 'Confounding',
    family: 'Confounding',
    familyId: 'F3',
    tier: 'Core',
    description: 'An unmeasured variable Z causes both X and Y, creating spurious association.',
    keyQuestion: 'Is there an unmeasured common cause?',
    example: 'Coffee drinkers have higher lung cancer rates - but smoking causes both coffee drinking and cancer.',
    validationChecklist: [
      'Third variable Z exists that affects both X and Y',
      'Z is not controlled for in the analysis',
      'Removing Z would eliminate the X-Y association',
    ],
  },
  {
    id: 'W8',
    name: "Simpson's Paradox",
    family: 'Confounding',
    familyId: 'F3',
    tier: 'Advanced',
    description: 'Aggregate trend reverses when stratified by a confounding variable Z.',
    keyQuestion: 'Does the trend reverse after stratification?',
    example: "UC Berkeley appeared to discriminate against women overall, but favored women within each department.",
    validationChecklist: [
      'Aggregate data shows one direction of effect',
      'Stratified data shows opposite direction',
      'Confounding variable explains the reversal',
    ],
  },
  // Direction Family (W9-W10)
  {
    id: 'W9',
    name: 'Reverse Causation',
    family: 'Direction',
    familyId: 'F4',
    tier: 'Core',
    description: 'The assumed direction of causation is backwards: Y causes X, not X causes Y.',
    keyQuestion: 'Does Y occur before X, or does Y cause X?',
    example: 'Depressed people watch more TV - but does TV cause depression, or do depressed people seek TV?',
    validationChecklist: [
      'Temporal order is unclear or reversed',
      'Plausible mechanism for Y causing X',
      'Claimed X→Y direction is not established',
    ],
  },
  {
    id: 'W10',
    name: 'Post Hoc Fallacy',
    family: 'Direction',
    familyId: 'F4',
    tier: 'Core',
    description: 'Inferring causation purely from temporal sequence without controlling for alternatives.',
    keyQuestion: 'Is timing the only evidence for causation?',
    example: 'I wore my lucky socks and won - therefore the socks caused the win.',
    validationChecklist: [
      'Causal claim based primarily on "X before Y"',
      'No mechanism or controlled comparison',
      'Alternative explanations not ruled out',
    ],
  },
];

// ============================================================================
// L1 SHEEP TYPES (YES cases) - 8 types
// ============================================================================

export const L1_SHEEP_TYPES: SheepDefinition[] = [
  {
    id: 'S1',
    name: 'Randomized Controlled Trial',
    tier: 'Core',
    description: 'Random assignment to treatment and control groups eliminates confounding.',
    requiredElements: [
      'Random assignment explicitly stated',
      'Control group present',
      'Outcome measured in both groups',
    ],
    example: 'Patients randomly assigned to drug or placebo; drug group showed 30% improvement vs 5% in placebo.',
  },
  {
    id: 'S2',
    name: 'Natural Experiment',
    tier: 'Core',
    description: 'Exogenous event creates quasi-random variation in treatment.',
    requiredElements: [
      'Exogenous event clearly described',
      'Event is unrelated to outcome except through treatment',
      'Comparison group exists',
    ],
    example: 'A lottery determined who could buy housing in a new area; lottery winners vs losers compared.',
  },
  {
    id: 'S3',
    name: 'Lottery / Quasi-Random',
    tier: 'Core',
    description: 'Random allocation among applicants/eligible population.',
    requiredElements: [
      'Random allocation mechanism',
      'Population of applicants defined',
      'Winners vs losers compared',
    ],
    example: 'Charter school admission lottery; lottery winners outperformed lottery losers.',
  },
  {
    id: 'S4',
    name: 'Controlled Ablation',
    tier: 'Core',
    description: 'Removal of X while holding other factors constant.',
    requiredElements: [
      'X is removed/disabled in treatment condition',
      'All other factors held constant',
      'Effect on Y measured',
    ],
    example: 'Knocking out a gene in otherwise identical mice shows the gene is necessary for trait.',
  },
  {
    id: 'S5',
    name: 'Mechanism + Dose-Response',
    tier: 'Core',
    description: 'Known causal pathway plus dose-response gradient.',
    requiredElements: [
      'Mechanism of action described',
      'Dose-response relationship shown',
      'Higher dose leads to stronger effect',
    ],
    example: 'More hours of practice leads to more skill improvement, with known learning mechanisms.',
  },
  {
    id: 'S6',
    name: 'Instrumental Variable',
    tier: 'Advanced',
    description: 'An instrument Z affects X but has no direct effect on Y.',
    requiredElements: [
      'Instrument Z clearly identified',
      'Z affects X (relevance)',
      'Z has no direct effect on Y (exclusion restriction)',
    ],
    example: 'Distance to college used as instrument for education; distance affects college attendance but not earnings directly.',
  },
  {
    id: 'S7',
    name: 'Difference-in-Differences',
    tier: 'Advanced',
    description: 'Compare treated vs control before and after intervention.',
    requiredElements: [
      'Pre-treatment data for both groups',
      'Post-treatment data for both groups',
      'Parallel pre-trends assumption stated or shown',
    ],
    example: 'States that raised minimum wage vs those that did not; compared employment before and after.',
  },
  {
    id: 'S8',
    name: 'Regression Discontinuity',
    tier: 'Advanced',
    description: 'Treatment assigned by cutoff on running variable.',
    requiredElements: [
      'Running variable identified',
      'Cutoff for treatment clearly stated',
      'Comparison just above vs just below cutoff',
    ],
    example: 'Students just above vs just below scholarship cutoff; those just above performed better.',
  },
];

// ============================================================================
// L2 TRAP TYPES (17 types in 6 families)
// ============================================================================

export const L2_TRAP_FAMILIES = {
  F1: { id: 'F1', name: 'Selection Effects', traps: ['T1', 'T2', 'T3', 'T4'] },
  F2: { id: 'F2', name: 'Statistical Artifacts', traps: ['T5', 'T6'] },
  F3: { id: 'F3', name: 'Confounding', traps: ['T7', 'T8', 'T9'] },
  F4: { id: 'F4', name: 'Direction Errors', traps: ['T10', 'T11', 'T12'] },
  F5: { id: 'F5', name: 'Information Bias', traps: ['T13', 'T14'] },
  F6: { id: 'F6', name: 'Mechanism Failures', traps: ['T15', 'T16', 'T17'] },
};

export const L2_TRAP_TYPES: TrapDefinition[] = [
  // Family 1: Selection Effects (F1)
  {
    id: 'T1',
    name: 'SELECTION',
    family: 'Selection Effects',
    familyId: 'F1',
    tier: 'Core',
    description: 'Non-random sampling creates bias in intervention effect estimates.',
    keyQuestion: 'Who is excluded from the intervention study?',
    example: 'Testing a job training program only on motivated volunteers overstates its effect on general population.',
    validationChecklist: [
      'Intervention applied to non-representative sample',
      'Selection mechanism correlates with outcome',
      'Effect would differ in general population',
    ],
  },
  {
    id: 'T2',
    name: 'SURVIVORSHIP',
    family: 'Selection Effects',
    familyId: 'F1',
    tier: 'Core',
    description: 'Only survivors/successes of intervention are observed.',
    keyQuestion: 'What happened to those who dropped out or failed?',
    example: 'Studying traits of successful entrepreneurs post-intervention ignores those whose businesses failed.',
    validationChecklist: [
      'Outcome measured only on survivors/completers',
      'Dropouts/failures would show different pattern',
      'Causal claim ignores attrition',
    ],
  },
  {
    id: 'T3',
    name: 'COLLIDER',
    family: 'Selection Effects',
    familyId: 'F1',
    tier: 'Core',
    description: 'Conditioning on a common effect Z (X→Z←Y) creates spurious association.',
    keyQuestion: 'Are we conditioning on an effect of both X and Y?',
    example: 'Among hospitalized patients, diabetes appears protective against flu (both independently cause hospitalization).',
    validationChecklist: [
      'Variable Z is affected by both X and Y',
      'Analysis conditions on or selects by Z',
      'X-Y association is spurious, created by conditioning',
    ],
  },
  {
    id: 'T4',
    name: 'IMMORTAL TIME',
    family: 'Selection Effects',
    familyId: 'F1',
    tier: 'Advanced',
    description: 'Person-time is misclassified due to study design - subjects must survive to receive treatment.',
    keyQuestion: 'Did subjects have to survive a certain period to be classified as treated?',
    example: 'Oscar winners appear to live longer - but they had to survive long enough to win.',
    validationChecklist: [
      'Treatment requires survival to a certain point',
      'Time before treatment counted as "treated" time',
      'Survival advantage is artifact of classification',
    ],
  },
  // Family 2: Statistical Artifacts (F2)
  {
    id: 'T5',
    name: 'REGRESSION',
    family: 'Statistical Artifacts',
    familyId: 'F2',
    tier: 'Core',
    description: 'Extreme values regress toward the mean on subsequent measurement.',
    keyQuestion: 'Were subjects selected for extreme values before intervention?',
    example: 'Schools with lowest test scores get intervention; scores improve but would have improved anyway.',
    validationChecklist: [
      'Selection based on extreme initial value',
      'Post-intervention improvement observed',
      'No control group to distinguish from regression',
    ],
  },
  {
    id: 'T6',
    name: 'ECOLOGICAL',
    family: 'Statistical Artifacts',
    familyId: 'F2',
    tier: 'Core',
    description: 'Group-level intervention effects do not translate to individual effects.',
    keyQuestion: 'Does the group-level effect reflect individual-level causation?',
    example: 'City-wide policy appears effective at aggregate, but individual-level data shows no effect.',
    validationChecklist: [
      'Intervention measured at group/aggregate level',
      'Causal claim about individuals',
      'Individual-level effect may differ from aggregate',
    ],
  },
  // Family 3: Confounding (F3)
  {
    id: 'T7',
    name: 'CONFOUNDER',
    family: 'Confounding',
    familyId: 'F3',
    tier: 'Core',
    description: 'Standard confounding where Z is uncontrolled in intervention analysis.',
    keyQuestion: 'Is there an unmeasured common cause of treatment and outcome?',
    example: 'Hospitals with more nurses have lower mortality - but also have more resources, better staff, etc.',
    validationChecklist: [
      'Third variable Z affects both treatment and outcome',
      'Z is not controlled in analysis',
      'Effect would disappear if Z were controlled',
    ],
  },
  {
    id: 'T8',
    name: "SIMPSON'S",
    family: 'Confounding',
    familyId: 'F3',
    tier: 'Advanced',
    description: 'Aggregate intervention effect reverses when stratified by confounder Z.',
    keyQuestion: 'Does the intervention effect reverse in subgroups?',
    example: 'Treatment A appears better overall, but Treatment B is better within each severity subgroup.',
    validationChecklist: [
      'Aggregate shows one direction of effect',
      'Stratified analysis shows opposite direction',
      'Confounding variable explains reversal',
    ],
  },
  {
    id: 'T9',
    name: 'CONF-MED',
    family: 'Confounding',
    familyId: 'F3',
    tier: 'Advanced',
    description: 'Variable Z could be confounder or mediator - temporal order unclear.',
    keyQuestion: 'Does Z occur before or after the intervention?',
    example: 'Exercise associated with lower cholesterol and less heart disease - but did low cholesterol cause exercise?',
    validationChecklist: [
      'Variable Z is associated with both X and Y',
      'Temporal order of Z relative to X is unclear',
      'Adjusting for Z could remove real effect or spurious effect',
    ],
  },
  // Family 4: Direction Errors (F4)
  {
    id: 'T10',
    name: 'REVERSE',
    family: 'Direction Errors',
    familyId: 'F4',
    tier: 'Core',
    description: 'Claimed X→Y, but actual direction is Y→X.',
    keyQuestion: 'Could the outcome be causing the treatment?',
    example: 'Depressed people receive more therapy - does therapy cause depression or depression cause therapy-seeking?',
    validationChecklist: [
      'Temporal order not clearly established',
      'Plausible mechanism for Y→X',
      'Claimed intervention effect may be reversed',
    ],
  },
  {
    id: 'T11',
    name: 'FEEDBACK',
    family: 'Direction Errors',
    familyId: 'F4',
    tier: 'Advanced',
    description: 'Bidirectional causation (X↔Y) - both directions are real.',
    keyQuestion: 'Do X and Y reinforce each other?',
    example: 'Self-esteem and academic performance reinforce each other in a bidirectional loop.',
    validationChecklist: [
      'Plausible mechanism for X→Y',
      'Plausible mechanism for Y→X',
      'Unidirectional claim ignores feedback',
    ],
  },
  {
    id: 'T12',
    name: 'TEMPORAL',
    family: 'Direction Errors',
    familyId: 'F4',
    tier: 'Advanced',
    description: 'Time-varying confounding or mediation - causal structure changes over time.',
    keyQuestion: 'Does the causal structure change over time?',
    example: 'Blood pressure medication affects kidney function, which affects future medication dosing.',
    validationChecklist: [
      'Multiple time points involved',
      'Treatment affects time-varying covariate',
      'Time-varying covariate affects future treatment and outcome',
    ],
  },
  // Family 5: Information Bias (F5)
  {
    id: 'T13',
    name: 'MEASUREMENT',
    family: 'Information Bias',
    familyId: 'F5',
    tier: 'Core',
    description: 'Exposure or outcome is measured with systematic error.',
    keyQuestion: 'Is the measurement differentially accurate across groups?',
    example: 'Patients with diagnosed disease are examined more thoroughly, detecting more co-morbidities.',
    validationChecklist: [
      'Measurement error is systematic, not random',
      'Error differs by treatment/exposure status',
      'Bias direction can be determined',
    ],
  },
  {
    id: 'T14',
    name: 'RECALL',
    family: 'Information Bias',
    familyId: 'F5',
    tier: 'Core',
    description: "Participants' memory of past exposures is biased by current outcome.",
    keyQuestion: 'Does knowing the outcome affect memory of exposure?',
    example: 'Mothers of children with birth defects recall pregnancy exposures more thoroughly than control mothers.',
    validationChecklist: [
      'Exposure data collected retrospectively',
      'Outcome knowledge affects recall',
      'Differential recall creates spurious association',
    ],
  },
  // Family 6: Mechanism Failures (F6)
  {
    id: 'T15',
    name: 'MECHANISM',
    family: 'Mechanism Failures',
    familyId: 'F6',
    tier: 'Core',
    description: 'Intervention targets wrong causal path - mechanism is misunderstood.',
    keyQuestion: 'Is the intervention targeting the right causal pathway?',
    example: 'Teaching "critical thinking" to improve test scores fails because the test measures memorization.',
    validationChecklist: [
      'Intervention has a theory of change',
      'Theory of change is incorrect',
      'Intervention fails because of wrong mechanism',
    ],
  },
  {
    id: 'T16',
    name: 'GOODHART',
    family: 'Mechanism Failures',
    familyId: 'F6',
    tier: 'Core',
    description: 'Metric becomes target, ceases to be good metric.',
    keyQuestion: 'Has the metric been gamed or manipulated?',
    example: 'Hospitals penalized for high mortality stop admitting terminal patients - mortality drops but care worsens.',
    validationChecklist: [
      'Metric was valid indicator before intervention',
      'Intervention targets the metric directly',
      'Metric no longer measures what it used to measure',
    ],
  },
  {
    id: 'T17',
    name: 'BACKFIRE',
    family: 'Mechanism Failures',
    familyId: 'F6',
    tier: 'Core',
    description: 'Intervention produces opposite of intended effect.',
    keyQuestion: 'Does the intervention trigger compensatory or oppositional responses?',
    example: 'Anti-drug campaigns in schools increase teen curiosity and experimentation (reactance effect).',
    validationChecklist: [
      'Intervention has intended direction',
      'Actual effect is opposite',
      'Mechanism for backfire is plausible',
    ],
  },
];

// ============================================================================
// L3 COUNTERFACTUAL FAMILIES (8 families)
// ============================================================================

// Representative subtype clusters from T3-L3 Guidelines
// NOTE: These are representative examples, not an exhaustive list. Generation should
// cover these patterns but is not bounded by them - novel subtypes are welcome.
export const L3_FAMILIES: L3FamilyDefinition[] = [
  {
    id: 'F1',
    name: 'Deterministic Counterfactuals',
    coreChallenge: 'Mechanistic or rule-based necessity - a correct judgment hinges on identifying an invariant mechanism.',
    guidingQuestion: 'Would the mechanism still operate?',
    subtypes: [
      'Mechanistic Necessity',      // Removing an essential component breaks the outcome
      'Rule-based Determinism',     // Outcomes fixed by explicit rules (formal constraints, protocols)
      'Necessary Condition',        // The outcome cannot occur without X, given stated invariants
      'Valid State Comparison',     // Counterfactual resolved by comparing known states under same rules
      'Spurious Linkage',           // Scenario explicitly lacks a causal connection (superstition)
    ],
    validAnswers: ['VALID', 'INVALID'],
    example: 'If the circuit breaker had not tripped, the house would have caught fire (physical law determines outcome).',
  },
  {
    id: 'F2',
    name: 'Probabilistic Counterfactuals',
    coreChallenge: 'Uncertainty and stochastic outcomes - distinguishing changes in probability from deterministic claims.',
    guidingQuestion: 'How does uncertainty change what can be concluded?',
    subtypes: [
      'Sufficiency under Uncertainty',  // Individual-level dependence with stochasticity
      'Probabilistic Exposure',         // Causal links that are real but non-deterministic
      'Background Risk',                // Outcomes that can occur without X at non-trivial rates
      'Sensitivity/Chaos',              // Small changes can yield divergent trajectories
      'Chance vs Necessity',            // Separating "could have happened anyway" from mechanistic dependence
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: 'If the patient had taken the medication, they probably would not have had a heart attack (probability shift).',
  },
  {
    id: 'F3',
    name: 'Overdetermination',
    coreChallenge: 'Multiple sufficient causes - distinguishing necessity, sufficiency, and preemption under but-for queries.',
    guidingQuestion: 'Would another cause have sufficed?',
    subtypes: [
      'Symmetric Overdetermination',    // Multiple sufficient causes occur together
      'Preemption',                     // Early cause brings about Y and blocks a backup cause
      'Simultaneous Lethal Actions',    // "Double-assassin" style structures
      'Threshold Effects',              // Several factors jointly push the system past a threshold
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: 'Two assassins shoot simultaneously; either shot was sufficient. Neither is the sole cause.',
  },
  {
    id: 'F4',
    name: 'Structural vs. Contingent Causes',
    coreChallenge: 'Distinguishes proximate triggers from background enabling conditions.',
    guidingQuestion: 'Was this the trigger or the root cause?',
    subtypes: [
      'Trigger vs Structure',           // Spark vs. fuel
      'Agent vs System',                // Individual action vs. underlying constraints
      'Technological/Institutional',    // Invention/policy vs. structural necessity
      'Strategy vs Resources',          // Contingent tactics vs. structural capacity
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: 'The match caused the fire (trigger) vs oxygen being present (enabling condition).',
  },
  {
    id: 'F5',
    name: 'Temporal and Path-Dependent',
    coreChallenge: 'Sequencing, delays, windows, or accumulated history changes what can be held fixed.',
    guidingQuestion: 'Does timing or path matter?',
    subtypes: [
      'Path Dependence',                // Early choices constrain later options
      'Timing Windows',                 // Same action can succeed or fail depending on when it occurs
      'Chain Framing',                  // Proximate vs. distal links in a causal chain
      'Downstream Propagation',         // Separating warranted propagation from speculation
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: 'If the treatment had been given earlier, the patient would have survived (timing-sensitive).',
  },
  {
    id: 'F6',
    name: 'Epistemic Limits',
    coreChallenge: 'Scenario underdetermines the answer - key mechanisms unknown, measurements intrusive, or identity conditions change.',
    guidingQuestion: 'Is the counterfactual resolvable from what is stated?',
    subtypes: [
      'Unverifiable Counterfactuals',   // No feasible test or identifying evidence
      'Mechanism Dependence',           // Answer hinges on an unstated mechanism
      'Observer Effects',               // Measuring or intervening changes the system
      'Non-identity',                   // Alternative world implies a different individual or reference class
    ],
    validAnswers: ['CONDITIONAL'],
    example: 'If the unobserved genetic factor had been different... (we cannot observe the counterfactual world).',
  },
  {
    id: 'F7',
    name: 'Causal Attribution',
    coreChallenge: 'Quantifying or comparing causal contribution rather than binary but-for judgment.',
    guidingQuestion: 'How much credit does X deserve?',
    subtypes: [
      'Attributable Fraction',          // Population-level contribution
      'Individual Attribution',         // Contribution given an observed outcome (sufficiency-style)
      'Path-specific Effects',          // Distinguishing direct vs. mediated contribution
      'Principal Strata',               // Contribution defined for specific latent groups (complier logic)
      'Additionality',                  // "Would it have happened anyway?"
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: '30% of the lung cancer cases were caused by smoking (attributable fraction).',
  },
  {
    id: 'F8',
    name: 'Moral and Legal Causation',
    coreChallenge: 'Counterfactuals embedded in normative standards - correctness depends on matching the stated standard.',
    guidingQuestion: 'Who is responsible under a standard?',
    subtypes: [
      'But-for under Uncertainty',      // Causal standards with probabilistic evidence
      'Moral Luck',                     // Identical actions with divergent outcomes
      'Action vs Omission',             // Doing harm vs. allowing harm
      'Process Effects',                // Selection into legal outcomes altering observed histories
    ],
    validAnswers: ['VALID', 'INVALID', 'CONDITIONAL'],
    example: 'The driver who ran the red light caused the accident (legal proximate cause).',
  },
];

// ============================================================================
// AMBIGUITY TYPES (for AMBIGUOUS cases at any level)
// ============================================================================

export interface AmbiguityDefinition {
  type: AmbiguityType;
  name: string;
  description: string;
  exampleQuestion: string;
  hiddenQuestionTemplate: string;
}

export const AMBIGUITY_TYPES: AmbiguityDefinition[] = [
  {
    type: 'TIMING',
    name: 'Temporal Ambiguity',
    description: 'The temporal ordering of X and Y is not clearly specified.',
    exampleQuestion: 'When did X occur relative to Y?',
    hiddenQuestionTemplate: 'What is the temporal relationship between [X] and [Y]?',
  },
  {
    type: 'MECHANISM',
    name: 'Mechanism Ambiguity',
    description: 'The causal pathway from X to Y is not specified.',
    exampleQuestion: 'Does X affect Y directly or through an intermediate variable?',
    hiddenQuestionTemplate: 'Through what mechanism does [X] affect [Y]?',
  },
  {
    type: 'STRUCTURE',
    name: 'Structural Ambiguity',
    description: 'The presence or role of other variables is unclear.',
    exampleQuestion: 'Is there a confounder, mediator, or collider involved?',
    hiddenQuestionTemplate: 'What other variables exist in the causal structure between [X] and [Y]?',
  },
  {
    type: 'MAGNITUDE',
    name: 'Magnitude Ambiguity',
    description: 'The size or strength of the causal effect is not specified.',
    exampleQuestion: 'How large is the effect of X on Y?',
    hiddenQuestionTemplate: 'What is the magnitude of the effect of [X] on [Y]?',
  },
];

// ============================================================================
// MAPPING: Assignment 1 → Assignment 2 trap names
// ============================================================================

export const TRAP_NAME_MAPPING: Record<string, string> = {
  // L1 mappings (old → new)
  Selection_Bias: 'W1',
  Survivorship_Bias: 'W2',
  Healthy_User_Bias: 'W3',
  Regression_to_Mean: 'W4',
  Ecological_Fallacy: 'W5',
  Base_Rate_Neglect: 'W6',
  Confounding: 'W7',
  Simpsons_Paradox: 'W8',
  Reverse_Causation: 'W9',
  Post_Hoc_Fallacy: 'W10',
  // L2 mappings (old subtypes → new T codes)
  Confounding_by_Indication: 'T7',
  Omitted_Variable: 'T7',
  Socioeconomic: 'T7',
  Unblocked_Backdoor: 'T7',
  'Time-varying_Confounding': 'T12',
  Cross_world_Confounder: 'T7',
  'Outcome-driven_Selection': 'T10',
  Simultaneity: 'T11',
  'Reverse_Incentive_Dynamics': 'T10',
  Status_Anticipation: 'T10',
  Collider_Bias: 'T3',
  Berkson_Paradox: 'T3',
  Selection_on_Outcome: 'T1',
  Measurement_Error: 'T13',
  Regression_to_the_Mean: 'T5',
  'Scale-induced_Truncation': 'T1',
  Goodhart_Effect: 'T16',
};

// ============================================================================
// HIERARCHICAL SAMPLER
// ============================================================================

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface SamplingResult {
  pearlLevel: PearlLevel;
  answerType: string; // YES/NO/AMBIGUOUS for L1/L2, VALID/INVALID/CONDITIONAL for L3
  difficulty: DifficultyLevel; // Easy/Medium/Hard with 1:2:1 distribution
  trapType?: TrapDefinition; // For NO cases
  sheepType?: SheepDefinition; // For YES cases at L1
  l3Family?: L3FamilyDefinition; // For L3 cases
  ambiguityType?: AmbiguityDefinition; // For AMBIGUOUS cases
}

export interface DistributionNeeds {
  L1: { needed: number; current: number };
  L2: { needed: number; current: number };
  L3: { needed: number; current: number };
  answerDistribution?: {
    YES: number;
    NO: number;
    AMBIGUOUS: number;
    VALID?: number;
    INVALID?: number;
    CONDITIONAL?: number;
  };
}

/**
 * Sample a Pearl level based on distribution needs
 */
export function samplePearlLevel(needs: DistributionNeeds): PearlLevel {
  const weights = {
    L1: Math.max(0, needs.L1.needed - needs.L1.current),
    L2: Math.max(0, needs.L2.needed - needs.L2.current),
    L3: Math.max(0, needs.L3.needed - needs.L3.current),
  };

  const total = weights.L1 + weights.L2 + weights.L3;
  if (total === 0) {
    // All needs met, random uniform
    const levels: PearlLevel[] = ['L1', 'L2', 'L3'];
    return levels[Math.floor(Math.random() * 3)];
  }

  const r = Math.random() * total;
  if (r < weights.L1) return 'L1';
  if (r < weights.L1 + weights.L2) return 'L2';
  return 'L3';
}

/**
 * Sample answer type for a given Pearl level
 * L1: YES (50%) / NO (40%) / AMBIGUOUS (10%)
 * L2: Always NO (per Assignment 2 spec - all L2 cases are traps)
 * L3: VALID (35%) / INVALID (25%) / CONDITIONAL (40%)
 */
export function sampleAnswerType(level: PearlLevel): string {
  const r = Math.random();

  if (level === 'L1') {
    if (r < 0.5) return 'YES';
    if (r < 0.9) return 'NO';
    return 'AMBIGUOUS';
  } else if (level === 'L2') {
    // Per Assignment 2 spec: All L2 cases are traps (NO)
    return 'NO';
  } else {
    // L3
    if (r < 0.35) return 'VALID';
    if (r < 0.6) return 'INVALID';
    return 'CONDITIONAL';
  }
}

/**
 * Sample a specific trap type for L1 NO cases (WOLF types)
 */
export function sampleL1WolfType(): TrapDefinition {
  const idx = Math.floor(Math.random() * L1_WOLF_TYPES.length);
  return L1_WOLF_TYPES[idx];
}

/**
 * Sample a specific SHEEP type for L1 YES cases
 */
export function sampleL1SheepType(): SheepDefinition {
  const idx = Math.floor(Math.random() * L1_SHEEP_TYPES.length);
  return L1_SHEEP_TYPES[idx];
}

/**
 * Sample a specific trap type for L2 NO cases
 */
export function sampleL2TrapType(): TrapDefinition {
  const idx = Math.floor(Math.random() * L2_TRAP_TYPES.length);
  return L2_TRAP_TYPES[idx];
}

/**
 * Sample a family for L3 cases
 */
export function sampleL3Family(answerType: string): L3FamilyDefinition {
  // Filter families that support this answer type
  const validFamilies = L3_FAMILIES.filter((f) =>
    f.validAnswers.includes(answerType as L3AnswerType)
  );
  const idx = Math.floor(Math.random() * validFamilies.length);
  return validFamilies[idx];
}

/**
 * Sample an ambiguity type for AMBIGUOUS/CONDITIONAL cases
 */
export function sampleAmbiguityType(): AmbiguityDefinition {
  const idx = Math.floor(Math.random() * AMBIGUITY_TYPES.length);
  return AMBIGUITY_TYPES[idx];
}

/**
 * Sample difficulty level with 1:2:1 (Easy:Medium:Hard) distribution
 * Per CS372 Assignment 2 Guidelines: 25% Easy, 50% Medium, 25% Hard
 */
export function sampleDifficulty(): DifficultyLevel {
  const r = Math.random();
  if (r < 0.25) return 'Easy';
  if (r < 0.75) return 'Medium';  // 0.25 to 0.75 = 50%
  return 'Hard';  // 0.75 to 1.0 = 25%
}

/**
 * Perform full hierarchical sampling
 * @param needs - Current distribution needs
 * @param forcedLevel - Optional: Force a specific Pearl level instead of sampling
 * @param forcedAnswerType - Optional: Force a specific answer type instead of sampling
 * @param forcedDifficulty - Optional: Force a specific difficulty level instead of sampling
 */
export function hierarchicalSample(
  needs: DistributionNeeds, 
  forcedLevel?: 'L1' | 'L2' | 'L3',
  forcedAnswerType?: string,
  forcedDifficulty?: DifficultyLevel
): SamplingResult {
  // Level 1: Sample Pearl level (or use forced level)
  const pearlLevel = forcedLevel || samplePearlLevel(needs);

  // Level 2: Sample answer type (or use forced answer type)
  const answerType = forcedAnswerType || sampleAnswerType(pearlLevel);

  // Level 3: Sample difficulty (or use forced difficulty)
  // Per CS372 Assignment 2: 1:2:1 (Easy:Medium:Hard) = 25%:50%:25%
  const difficulty = forcedDifficulty || sampleDifficulty();

  // Level 4: Sample specific type based on level and answer
  const result: SamplingResult = { pearlLevel, answerType, difficulty };

  if (pearlLevel === 'L1') {
    if (answerType === 'NO') {
      result.trapType = sampleL1WolfType();
    } else if (answerType === 'YES') {
      result.sheepType = sampleL1SheepType();
    } else {
      result.ambiguityType = sampleAmbiguityType();
    }
  } else if (pearlLevel === 'L2') {
    if (answerType === 'NO') {
      result.trapType = sampleL2TrapType();
    } else if (answerType === 'AMBIGUOUS') {
      result.ambiguityType = sampleAmbiguityType();
    }
    // YES cases don't need trap type - they're valid intervention claims
  } else {
    // L3
    result.l3Family = sampleL3Family(answerType);
    if (answerType === 'CONDITIONAL') {
      result.ambiguityType = sampleAmbiguityType();
    }
  }

  return result;
}

/**
 * Get trap definition by ID (T1-T17 for L2, W1-W10 for L1)
 */
export function getTrapById(id: string): TrapDefinition | undefined {
  if (id.startsWith('W')) {
    return L1_WOLF_TYPES.find((t) => t.id === id);
  } else if (id.startsWith('T')) {
    return L2_TRAP_TYPES.find((t) => t.id === id);
  }
  return undefined;
}

/**
 * Get L3 family by ID (F1-F8)
 */
export function getL3FamilyById(id: string): L3FamilyDefinition | undefined {
  return L3_FAMILIES.find((f) => f.id === id);
}

