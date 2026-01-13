/**
 * CS372 Cheatsheet Taxonomy - Complete definitions for problem generation
 * Source: CS372_Win2026_assignment1_cheatsheet.pdf
 *
 * Each subtype includes:
 * - definition: Clear conceptual explanation
 * - minimalGraph: Causal structure (U=unobserved, S=selection, arrows show direction)
 * - mathSignature: What goes wrong formally
 * - howItHappens: Practical examples
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
  minimalGraph?: string;
  mathSignature?: string;
  howItHappens?: string;
  example?: string;
}

export const CHEATSHEET_TAXONOMY: TrapTypeDefinition[] = [
  {
    type: 'CONFOUNDING',
    label: 'Confounding',
    description: 'A hidden variable Z causes both X and Y, making X and Y appear related when they are not causally linked.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      {
        name: 'Confounding_by_Indication',
        pearlLevel: 'L1',
        description: 'Treatment/exposure is chosen because of underlying risk/severity that also affects the outcome.',
        minimalGraph: 'U → X, U → Y',
        mathSignature: 'E[Y|X=1] - E[Y|X=0] mixes causal effect with U; P(Y|do(X)) ≠ P(Y|X)',
        howItHappens: 'Doctors/policymakers/agents assign X based on prognosis; the "treated" group starts out systematically different.',
      },
      {
        name: 'Omitted_Variable',
        pearlLevel: 'L1',
        description: 'A missing/unmeasured variable drives both X and Y.',
        minimalGraph: 'U → X, U → Y (U unobserved)',
        mathSignature: 'Residual correlation remains after observed controls.',
        howItHappens: 'You don\'t measure temperature, baseline risk, location, seasonality; "control for everything you have" still leaves the real confounder out.',
      },
      {
        name: 'Socioeconomic',
        pearlLevel: 'L1',
        description: 'SES/resources jointly influence exposure (access/choice) and outcomes.',
        minimalGraph: 'SES → X, SES → Y',
        mathSignature: 'Same confounding violation; often strong because SES touches many mechanisms.',
        howItHappens: 'Wealth affects tutoring, neighborhood, healthcare access, time, nutrition, stress → outcomes; analyses that ignore SES over-credit X.',
      },
      {
        name: 'Unblocked_Backdoor',
        pearlLevel: 'L2',
        description: 'You claim an intervention effect but a backdoor path remains open.',
        minimalGraph: 'U → X → Y and U → Y (backdoor X ← U → Y)',
        mathSignature: 'P(Y|do(X)) ≠ naive P(Y|X) because U still drives both.',
        howItHappens: '"Policy caused Y" from observational before/after comparisons without blocking confounders.',
      },
      {
        name: 'Time-varying_Confounding',
        pearlLevel: 'L2',
        description: 'Past outcomes/covariates affect future treatment, and treatment affects those covariates.',
        minimalGraph: 'X_{t-1} → L_t → X_t and L_t → Y, plus X_{t-1} → Y',
        mathSignature: 'Standard adjustment can bias because L_t is both confounder and mediator of past treatment; need g-methods.',
        howItHappens: 'Adaptive treatment strategies; interventions adjusted based on evolving patient status or economic conditions.',
      },
      {
        name: 'Cross-world_Confounder',
        pearlLevel: 'L3',
        description: 'In counterfactual comparisons, a factor differs across "worlds" and confounds the cross-world statement.',
        minimalGraph: 'Cross-world independence assumptions violated',
        mathSignature: 'Many counterfactual/mediation claims rely on cross-world independences; a cross-world confounder breaks those assumptions.',
        howItHappens: '"Motivation" changes when imagining different choices; the imagined world isn\'t comparable to the actual world.',
      },
    ],
  },
  {
    type: 'REVERSE',
    label: 'Reverse Causation',
    description: 'The assumed direction of causation is backwards: Y causes X, not X causes Y.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      {
        name: 'Outcome-driven_Selection',
        pearlLevel: 'L1',
        description: 'The outcome (or early outcome trends) influences the exposure decision.',
        minimalGraph: 'Y → X (or Y_{t-1} → X_t)',
        mathSignature: 'P(Y|X) reflects "people choose X when Y is changing," not X → Y.',
        howItHappens: 'Firms invest when profits rise; people diet when weight rises; governments intervene when conditions change.',
      },
      {
        name: 'Policy_Endogeneity',
        pearlLevel: 'L1',
        description: 'Policies are adopted in response to economic/social conditions that also affect outcomes.',
        minimalGraph: 'U → X, U → Y where U is "state of the world," plus often Y → X through forecasting',
        mathSignature: 'Post-policy outcomes confound policy effect with pre-existing trends.',
        howItHappens: '"Good times" both enable policy passage and improve Y, so policy falsely looks beneficial.',
      },
      {
        name: 'Reactive_Intervention',
        pearlLevel: 'L2',
        description: 'Intervention is triggered because outcomes are worsening (or forecast to worsen).',
        minimalGraph: 'Y_{t-1} → X_t → Y_t',
        mathSignature: 'Naive effect looks harmful because X occurs when trend is already negative.',
        howItHappens: '"We introduced policy, then outcomes were bad" — but policy was a response to worsening.',
      },
      {
        name: 'Outcome-dependent_Worlds',
        pearlLevel: 'L3',
        description: 'The counterfactual world is implicitly constrained by knowing the realized outcome.',
        minimalGraph: 'Conditioning on realized Y while asserting statements about Y_x',
        mathSignature: 'Conditioning on realized Y while asserting statements about Y_x can bias reasoning (restricts feasible histories).',
        howItHappens: '"Given the project succeeded, if we hadn\'t done X it still would have succeeded" without allowing that success depended on contingencies.',
      },
    ],
  },
  {
    type: 'SELECTION',
    label: 'Selection Bias',
    description: 'Conditioning on a non-random subset distorts inference.',
    pearlLevels: ['L1', 'L2', 'L3'],
    subtypes: [
      {
        name: 'Sampling_on_the_Outcome',
        pearlLevel: 'L1',
        description: 'Your dataset is conditioned on success/failure (or a function of Y).',
        minimalGraph: 'Y → S (you only observe S=1)',
        mathSignature: 'You estimate P(Y|X, S=1), not P(Y|X); can induce spurious patterns.',
        howItHappens: '"Study only successful startups," "only published papers," "only admitted students."',
      },
      {
        name: 'Attrition_Bias',
        pearlLevel: 'L1',
        description: 'Dropout/missingness depends on performance/outcome (or its predictors).',
        minimalGraph: 'Y → R (response/retention), analyze only R=1',
        mathSignature: 'E[Y|X, R=1] biased if R depends on Y (MNAR) or on unobserved predictors.',
        howItHappens: 'Struggling participants stop responding; sicker patients leave the study; churn hides bad outcomes.',
      },
      {
        name: 'Post_intervention_Selection',
        pearlLevel: 'L2',
        description: 'Analyze only those who remain/comply after treatment assignment.',
        minimalGraph: 'X → S and also Y → S or U → S',
        mathSignature: 'You estimate P(Y|do(X), S=1) for a selected subset, not the whole population.',
        howItHappens: 'Per-protocol analyses; excluding dropouts; "only users who engaged with the feature."',
      },
      {
        name: 'Counterfactual_Conditioning',
        pearlLevel: 'L3',
        description: 'Condition on survival/selection in the actual world while asking about counterfactual outcomes.',
        minimalGraph: 'Want E[Y_x | S_x=1] but condition on S=1 (actual survival)',
        mathSignature: 'E[Y_x|S=1] ≠ E[Y_x|S_x=1]; treatment might change who survives.',
        howItHappens: '"Among those who survived, what would have happened if treated?"—treatment might change who survives.',
      },
    ],
  },
  {
    type: 'COLLIDER',
    label: 'Collider Bias',
    description: 'Conditioning on a common effect of X and Y induces spurious association between them.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      {
        name: 'Conditioning_on_Participation',
        pearlLevel: 'L1',
        description: 'Participation/admission is a common effect of two causes you then analyze.',
        minimalGraph: 'X → S ← Y (or U → S ← V)',
        mathSignature: 'Even if X ⊥ Y, conditioning creates dependence: X ⊥̸ Y | S=1.',
        howItHappens: 'You analyze only admitted, only surveyed, only "engaged users," only "approved loans."',
      },
      {
        name: 'Case_Control_Sampling',
        pearlLevel: 'L1',
        description: 'You sample conditional on outcome status (cases vs controls).',
        minimalGraph: 'Y → S; compare X within S=1 constructed by Y',
        mathSignature: 'The sample distorts base rates (prevalence). Many naive interpretations of P(Y|X) break because you observe P(X|Y) by design.',
        howItHappens: 'Medical case-control studies; incident reviews; "only flagged fraud cases."',
      },
      {
        name: 'Conditioning_on_Compliance',
        pearlLevel: 'L2',
        description: 'Compliance is a collider affected by treatment and by factors tied to outcome.',
        minimalGraph: 'X → C ← U → Y (often also X → Y)',
        mathSignature: 'Conditioning on C opens X ↔ U → Y association.',
        howItHappens: '"Among compliers, treatment works/doesn\'t" while complier status is itself post-treatment.',
      },
    ],
  },
  {
    type: 'SIMPSONS',
    label: "Simpson's Paradox",
    description: 'A trend appears in aggregated data but reverses when data is stratified by a confounding variable.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      {
        name: 'Aggregation_Bias',
        pearlLevel: 'L1',
        description: 'Overall association reverses relative to within-group associations.',
        minimalGraph: 'Z → X, Z → Y (stratifier changes mix); often confounding-like',
        mathSignature: 'E[Y|X] = Σ_z E[Y|X,z]·P(z|X), and differing P(z|X) can flip signs.',
        howItHappens: 'Groups have different baseline risk and are unevenly represented across X.',
      },
      {
        name: 'Imbalanced_Group_Composition',
        pearlLevel: 'L1',
        description: 'One group looks worse because it serves "harder cases," skewing aggregates.',
        minimalGraph: 'Severity Z affects both assignment to group/option X and outcome Y',
        mathSignature: 'Same weighted-average reversal mechanism.',
        howItHappens: 'Hospital A treats sicker patients; "Treatment A" used more on high-risk cases → aggregated stats mislead.',
      },
      {
        name: 'Stratified_Intervention_Reversal',
        pearlLevel: 'L2',
        description: 'The intervention looks helpful overall but harmful in every subgroup (or vice versa).',
        minimalGraph: 'Effect heterogeneity across Z plus changing subgroup weights',
        mathSignature: 'Overall effect is weighted average of subgroup effects; weight shifts can flip sign.',
        howItHappens: 'Policy changes composition (who participates, who is exposed), making aggregate effect misleading.',
      },
    ],
  },
  {
    type: 'REGRESSION',
    label: 'Regression to the Mean',
    description: 'Extreme observations tend to be followed by less extreme ones due to random variation.',
    pearlLevels: ['L1'],
    subtypes: [
      {
        name: 'Extreme-Group_Selection',
        pearlLevel: 'L1',
        description: 'Selecting extremes makes the next measurement drift toward average even with no real change.',
        minimalGraph: 'No causal X required; selection on Y_1 then observe Y_2',
        mathSignature: 'If Y_t = μ + ε_t, corr(Y_1,Y_2) = ρ < 1, then E[Y_2|Y_1=y] = μ + ρ(y-μ), so extreme y predicts less extreme Y_2.',
        howItHappens: '"Bottom performers improve after intervention" when they were chosen for being bottom.',
      },
      {
        name: 'Noise-Induced_Extremes',
        pearlLevel: 'L1',
        description: 'Extremeness comes from measurement noise; repeats look less extreme.',
        minimalGraph: 'Measured Ỹ = Y + η; selection on Ỹ picks high η',
        mathSignature: 'Conditional on being extreme, noise has nonzero expectation; next measurement has fresh noise → reversion.',
        howItHappens: 'A/B tests with small samples; one-time spikes; leaderboard "winners" regress next week.',
      },
    ],
  },
  {
    type: 'SURVIVORSHIP',
    label: 'Survivorship Bias',
    description: 'Only surviving or successful cases are observed, hiding failures from analysis.',
    pearlLevels: ['L1'],
    subtypes: [
      {
        name: 'Selective_Observation',
        pearlLevel: 'L1',
        description: 'Failures are missing because they "die" before being observed.',
        minimalGraph: 'S ← Y (or outcome-related processes), analyze only S=1',
        mathSignature: 'Conditioning on survival inflates estimates of success/effect sizes.',
        howItHappens: 'Study only companies that survived a recession; only funds still operating; only "active users."',
      },
      {
        name: 'Historical_Filtering',
        pearlLevel: 'L1',
        description: 'What exists today is a filtered set of what existed in the past.',
        minimalGraph: 'Survival S is influenced by latent fitness and environment; you only see survivors',
        mathSignature: 'Retrospective inference ignores the counterfactual "dead" paths.',
        howItHappens: '"Why were past products so high quality?" (you only see the ones remembered).',
      },
    ],
  },
  {
    type: 'BASE_RATE',
    label: 'Base-rate Neglect',
    description: 'Ignoring the prior probability of an event when interpreting conditional probabilities.',
    pearlLevels: ['L1'],
    subtypes: [
      {
        name: 'Prior_Ignorance',
        pearlLevel: 'L1',
        description: 'Ignore how rare/common the condition/event is.',
        minimalGraph: 'Not a DAG issue; probabilistic reasoning failure',
        mathSignature: 'P(D|+) = P(+|D)P(D) / [P(+|D)P(D) + P(+|¬D)P(¬D)]. Neglecting P(D) wildly overestimates P(D|+) when D is rare.',
        howItHappens: '"Test is 95% accurate ⇒ positive means you almost surely have it" (false when prevalence is low).',
      },
      {
        name: 'Conditional_Fallacy',
        pearlLevel: 'L1',
        description: 'Confuse P(D|+) with P(+|D).',
        minimalGraph: 'N/A - logical error',
        mathSignature: 'Swapping conditional directions (a common error) without Bayes correction.',
        howItHappens: 'People hear sensitivity and treat it as posterior probability.',
      },
    ],
  },
  {
    type: 'GOODHART',
    label: "Goodhart's Law",
    description: 'When a measure becomes a target, it ceases to be a good measure.',
    pearlLevels: ['L1', 'L2'],
    subtypes: [
      {
        name: 'Static_Metric_Gaming',
        pearlLevel: 'L1',
        description: 'Optimize the metric directly, breaking its link to the true goal.',
        minimalGraph: 'Metric M is a proxy for target T; decision A chosen to maximize M, not T',
        mathSignature: 'The relationship P(T|M) changes after optimization; conditional shifts (distribution shift).',
        howItHappens: 'Teaching to the test; employees optimize KPI; model overfits leaderboard.',
      },
      {
        name: 'Proxy_Drift',
        pearlLevel: 'L1',
        description: 'Proxy stops tracking target as environment/users/strategies change.',
        minimalGraph: 'Time/environment E affects both proxy validity and outcomes',
        mathSignature: 'P(T|M) nonstationary; drift makes old calibration invalid.',
        howItHappens: 'CTR initially correlates with satisfaction, later becomes clickbait / dark patterns.',
      },
      {
        name: 'Policy_Target_Gaming',
        pearlLevel: 'L2',
        description: 'The policy incentivizes optimizing the metric rather than the real goal.',
        minimalGraph: 'Policy → agent behavior → metric manipulation; target T not improved',
        mathSignature: 'Post-policy M increases while T flat/declines because mapping M→T is broken.',
        howItHappens: 'Hospitals reduce "wait time" by redefining waiting; schools inflate scores via test prep.',
      },
    ],
  },
  {
    type: 'FEEDBACK',
    label: 'Feedback Loops',
    description: 'Bidirectional causation where X affects Y and Y affects X, creating dynamic cycles.',
    pearlLevels: ['L2', 'L3'],
    subtypes: [
      {
        name: 'Policy-Response_Loop',
        pearlLevel: 'L2',
        description: 'Intervention changes behavior, which changes the environment, which changes outcomes (and often future interventions).',
        minimalGraph: 'X → Y → behavior/environment → Y (and sometimes → X again)',
        mathSignature: 'Effects are not one-shot; P(Y|do(X)) depends on equilibrium/adaptation path.',
        howItHappens: 'Congestion pricing → rerouting → new congestion patterns; moderation policy → user migration → new dynamics.',
      },
      {
        name: 'Dynamic_World_Divergence',
        pearlLevel: 'L3',
        description: 'Small counterfactual changes alter the long-run trajectory via compounding dynamics.',
        minimalGraph: 'In dynamical systems S_{t+1} = f(S_t, X_t), tiny perturbations can lead to large differences',
        mathSignature: 'Naive "everything else equal" counterfactuals fail; perturbations cascade.',
        howItHappens: 'Policy changes incentives → new equilibria; early small differences cascade.',
      },
    ],
  },
  {
    type: 'PREEMPTION',
    label: 'Preemption',
    description: 'One cause preempts another from having its effect, complicating counterfactual analysis.',
    pearlLevels: ['L3'],
    subtypes: [
      {
        name: 'Early_Preemption',
        pearlLevel: 'L3',
        description: 'Cause A brings about Y first, preventing backup cause B from operating.',
        minimalGraph: 'A → Y, B → Y, and A → ¬(B acts)',
        mathSignature: 'Simple "but-for" fails: Y_{A=0}=1 (because B would cause it), yet intuitively A caused Y in the actual world.',
        howItHappens: 'Sprinkler would have stopped fire, but extinguisher stops it earlier—counterfactual attribution is subtle.',
      },
      {
        name: 'Late_Preemption',
        pearlLevel: 'L3',
        description: 'Backup cause would occur later if primary cause didn\'t, so actual cause judgments require modeling timing/contingencies.',
        minimalGraph: 'Same but-for failure, with time ordering key',
        mathSignature: 'But-for test fails because backup would have produced same outcome.',
        howItHappens: 'Backup generator would have kicked in; because primary worked, backup never activates.',
      },
    ],
  },
  {
    type: 'CONFOUNDER_MEDIATOR',
    label: 'Confounder-Mediator Error',
    description: 'Incorrectly treating a mediator as a confounder or vice versa.',
    pearlLevels: ['L2', 'L3'],
    subtypes: [
      {
        name: 'Mediator_Adjustment_Error',
        pearlLevel: 'L2',
        description: 'You control for a mediator while trying to estimate the total effect.',
        minimalGraph: 'X → Z → Y',
        mathSignature: 'Adjusting for Z removes the indirect effect. Total effect = E[Y|do(X=1)] - E[Y|do(X=0)]; adjusted estimate targets something like direct effect instead.',
        howItHappens: '"Control for everything" habit; post-treatment covariates incorrectly treated as confounders.',
      },
      {
        name: 'Mediator_Fixing_Error',
        pearlLevel: 'L3',
        description: 'Hold a mediator "fixed" while changing treatment, in a way that\'s not well-defined/feasible.',
        minimalGraph: 'X → Z → Y; statements like Y_{x,z} (set X to x and force mediator Z to z)',
        mathSignature: 'Y_{x,z} can be ill-posed if z isn\'t achievable under x or if forcing z changes the system.',
        howItHappens: '"What if we changed treatment but kept recovery constant?"—recovery is downstream of treatment, so "keeping it constant" can be a logically inconsistent intervention.',
      },
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

