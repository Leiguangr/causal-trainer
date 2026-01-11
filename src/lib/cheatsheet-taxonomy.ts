/**
 * CS372 Cheatsheet Taxonomy - Complete definitions for problem generation
 * Source: CS372_Win2026_assignment1_cheatsheet.pdf
 */

import { PearlLevel } from '@/types';

export interface TrapTypeDefinition {
  type: string;
  label: string;
  description: string;
  pearlLevels: PearlLevel[];
  subtypes: SubtypeDefinition[];
}

export interface SubtypeDefinition {
  name: string;
  pearlLevel: PearlLevel;
  description: string;
  example?: string;
}

export const CHEATSHEET_TAXONOMY: TrapTypeDefinition[] = [
  {
    type: 'CONFOUNDING',
    label: 'Confounding',
    description: 'A hidden variable Z causes both X and Y, making X and Y appear related when they are not causally linked.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      { name: 'Confounding_by_Indication', pearlLevel: 'L1', description: 'Treatment is assigned based on disease severity, confounding treatment-outcome relationship.' },
      { name: 'Omitted_Variable', pearlLevel: 'L1', description: 'A relevant variable is left out of the analysis, creating spurious correlation.' },
      { name: 'Socioeconomic', pearlLevel: 'L1', description: 'Socioeconomic factors confound the relationship between exposure and outcome.' },
      { name: 'Unblocked_Backdoor', pearlLevel: 'L2', description: 'A backdoor path remains open after intervention, biasing causal estimates.' },
      { name: 'Time-varying_Confounding', pearlLevel: 'L2', description: 'Confounders change over time and are affected by prior treatment.' },
      { name: 'Cross-world_Confounder', pearlLevel: 'L3', description: 'A variable affects both factual and counterfactual worlds differently.' },
    ],
  },
  {
    type: 'REVERSE',
    label: 'Reverse Causation',
    description: 'The assumed direction of causation is backwards: Y causes X, not X causes Y.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      { name: 'Outcome-driven_Selection', pearlLevel: 'L1', description: 'Subjects are selected based on the outcome, reversing apparent causation.' },
      { name: 'Policy_Endogeneity', pearlLevel: 'L1', description: 'Policy is adopted in response to the outcome it is meant to affect.' },
      { name: 'Reactive_Intervention', pearlLevel: 'L2', description: 'Intervention is triggered by early signs of the outcome.' },
      { name: 'Outcome-dependent_Worlds', pearlLevel: 'L3', description: 'Counterfactual worlds are defined by outcome rather than treatment.' },
    ],
  },
  {
    type: 'SELECTION',
    label: 'Selection Bias',
    description: 'The sample is not representative of the population due to selection on outcome or exposure.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      { name: 'Sampling-on-the-Outcome', pearlLevel: 'L1', description: 'Sample includes only cases with a specific outcome.' },
      { name: 'Attrition_Bias', pearlLevel: 'L1', description: 'Differential dropout creates non-representative sample.' },
      { name: 'Conditioning_on_Participation', pearlLevel: 'L1', description: 'Analysis conditions on study participation, which is affected by exposure or outcome.' },
      { name: 'Post-intervention_Selection', pearlLevel: 'L2', description: 'Selection occurs after intervention, affected by treatment assignment.' },
      { name: 'Counterfactual_Conditioning', pearlLevel: 'L3', description: 'Knowing the outcome constrains the counterfactual.' },
    ],
  },
  {
    type: 'COLLIDER',
    label: 'Collider Bias',
    description: 'Conditioning on a common effect of X and Y induces spurious association between them.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      { name: 'Case-Control_Sampling', pearlLevel: 'L1', description: 'Sampling based on disease status (a collider) creates spurious associations.' },
      { name: 'Conditioning_on_Compliance', pearlLevel: 'L2', description: 'Analyzing only compliers conditions on a post-treatment collider.' },
    ],
  },
  {
    type: 'SIMPSONS',
    label: "Simpson's Paradox",
    description: 'A trend appears in aggregated data but reverses when data is stratified by a confounding variable.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      { name: 'Aggregation_Bias', pearlLevel: 'L1', description: 'Aggregate statistics mask within-group relationships.' },
      { name: 'Imbalanced_Group_Composition', pearlLevel: 'L1', description: 'Groups have different compositions leading to paradoxical aggregates.' },
      { name: 'Stratified_Intervention_Reversal', pearlLevel: 'L2', description: 'Intervention effect reverses when stratified by a post-treatment variable.' },
    ],
  },
  {
    type: 'REGRESSION',
    label: 'Regression to the Mean',
    description: 'Extreme observations tend to be followed by less extreme ones due to random variation.',
    pearlLevels: ['L1'],
    subtypes: [
      { name: 'Extreme-Group_Selection', pearlLevel: 'L1', description: 'Selecting extreme performers leads to apparent improvement due to regression.' },
      { name: 'Noise-Induced_Extremes', pearlLevel: 'L1', description: 'Random noise creates extreme values that regress in subsequent measures.' },
    ],
  },
  {
    type: 'SURVIVORSHIP',
    label: 'Survivorship Bias',
    description: 'Only surviving or successful cases are observed, hiding failures from analysis.',
    pearlLevels: ['L1'],
    subtypes: [
      { name: 'Selective_Observation', pearlLevel: 'L1', description: 'Only survivors/successes are available for observation.' },
      { name: 'Historical_Filtering', pearlLevel: 'L1', description: 'Historical records only preserve successful cases.' },
    ],
  },
  {
    type: 'BASE_RATE',
    label: 'Base-rate Neglect',
    description: 'Ignoring the prior probability of an event when interpreting conditional probabilities.',
    pearlLevels: ['L1'],
    subtypes: [
      { name: 'Prior_Ignorance', pearlLevel: 'L1', description: 'Failing to account for how rare the condition is.' },
      { name: 'Conditional_Fallacy', pearlLevel: 'L1', description: 'Confusing P(A|B) with P(B|A).' },
    ],
  },
  {
    type: 'GOODHART',
    label: "Goodhart's Law",
    description: 'When a measure becomes a target, it ceases to be a good measure.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      { name: 'Static_Metric_Gaming', pearlLevel: 'L1', description: 'Agents optimize the metric rather than the underlying goal.' },
      { name: 'Proxy_Drift', pearlLevel: 'L1', description: 'Proxy measure diverges from true target over time.' },
      { name: 'Policy_Target_Gaming', pearlLevel: 'L2', description: 'Policy targets are gamed, undermining the intervention.' },
    ],
  },
  {
    type: 'FEEDBACK',
    label: 'Feedback Loops',
    description: 'Bidirectional causation where X affects Y and Y affects X, creating dynamic cycles.',
    pearlLevels: ['L2', 'L3'],
    subtypes: [
      { name: 'Policy-Response_Loop', pearlLevel: 'L2', description: 'Policy changes behavior which changes the policy effectiveness.' },
      { name: 'Dynamic_World_Divergence', pearlLevel: 'L3', description: 'Counterfactual world evolves differently due to feedback dynamics.' },
    ],
  },
  {
    type: 'PREEMPTION',
    label: 'Preemption',
    description: 'One cause preempts another from having its effect, complicating counterfactual analysis.',
    pearlLevels: ['L3'],
    subtypes: [
      { name: 'Early_Preemption', pearlLevel: 'L3', description: 'Preempting cause acts before the preempted cause can operate.' },
      { name: 'Late_Preemption', pearlLevel: 'L3', description: 'Preempting cause acts after the preempted cause has begun operating.' },
    ],
  },
  {
    type: 'CONFOUNDER_MEDIATOR',
    label: 'Confounder-Mediator Error',
    description: 'Incorrectly treating a mediator as a confounder or vice versa.',
    pearlLevels: ['L2', 'L3'],
    subtypes: [
      { name: 'Mediator_Adjustment_Error', pearlLevel: 'L2', description: 'Adjusting for a mediator blocks the causal effect of interest.' },
      { name: 'Mediator_Fixing_Error', pearlLevel: 'L3', description: 'Fixing the mediator in counterfactual analysis gives wrong causal conclusions.' },
    ],
  },
];

// Helper to get trap types for a given Pearl level
export function getTrapTypesForLevel(level: PearlLevel): TrapTypeDefinition[] {
  return CHEATSHEET_TAXONOMY.filter(t => t.pearlLevels.includes(level));
}

// Helper to get subtypes for a given trap type and level
export function getSubtypesForTypeAndLevel(type: string, level: PearlLevel): SubtypeDefinition[] {
  const trapType = CHEATSHEET_TAXONOMY.find(t => t.type === type);
  return trapType?.subtypes.filter(s => s.pearlLevel === level) ?? [];
}

