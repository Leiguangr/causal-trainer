/**
 * L3 Counterfactual Family Taxonomy (F1-F8)
 *
 * L3 cases focus on counterfactual reasoning patterns organized into 8 families.
 * Each family represents a different type of counterfactual scenario with specific
 * characteristics for generating VALID, INVALID, or CONDITIONAL cases.
 *
 * This file is generator-oriented: each family includes required elements,
 * canonical structure, label differentiation logic, and generator heuristics.
 */

export type L3Family = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';

export interface L3FamilyDefinition {
  code: L3Family;
  name: string;
  guidingQuestion: string;
  definition: string;
  requiredElements: string[];
  canonicalCaseStructure: string[];
  labelDifferentiation: {
    valid: string;
    invalid: string;
    conditional: string;
  };
  generatorHeuristic: string;
  typicalMajorityLabel: 'VALID' | 'INVALID' | 'CONDITIONAL';
}

export const L3_FAMILIES: L3Family[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

export const L3_FAMILY_TAXONOMY: L3FamilyDefinition[] = [
  // F1 — Deterministic Counterfactuals
  {
    code: 'F1',
    name: 'Deterministic Counterfactuals',
    guidingQuestion: 'Would the mechanism still operate?',
    definition:
      'Counterfactuals governed by necessity: physical, logical, or rule-based mechanisms that deterministically map X → Y.',
    requiredElements: [
      'Explicit mechanism (rule, law, protocol)',
      'Clear necessity claim (X is required for Y)',
      'Invariants that fix the mechanism across worlds',
    ],
    canonicalCaseStructure: [
      'Scenario: A rule/mechanism guarantees Y if and only if X occurs.',
      'Claim: If X had not occurred, Y would not have occurred.',
      'Invariants: Mechanism and rules unchanged.',
    ],
    labelDifferentiation: {
      valid: 'X is a necessary condition under fixed rules. Removing X breaks Y deterministically.',
      invalid: 'X is irrelevant or causally disconnected (spurious linkage). Mechanism does not depend on X.',
      conditional:
        'Rare for F1; only when the mechanism itself is underspecified.',
    },
    generatorHeuristic:
      'Use F1 when: You can write a short "if–then" rule. The counterfactual reduces to checking rule satisfaction.',
    typicalMajorityLabel: 'VALID',
  },

  // F2 — Probabilistic Counterfactuals
  {
    code: 'F2',
    name: 'Probabilistic Counterfactuals',
    guidingQuestion: 'How does uncertainty change what can be concluded?',
    definition: 'X influences the probability of Y, but does not deterministically fix it.',
    requiredElements: [
      'Explicit stochastic mechanism or background risk',
      'Clear distinction between deterministic phrasing ("would") and probabilistic phrasing ("more likely", "reduces risk")',
    ],
    canonicalCaseStructure: [
      'Scenario: X changes risk distribution for Y.',
      'Claim: If X had not occurred, Y would / would not have occurred.',
      'Invariants: Background risk, population, randomness model.',
    ],
    labelDifferentiation: {
      valid: 'Claim is probabilistic. Scenario implies a material probability shift.',
      invalid:
        'Claim is deterministic, but Y occurs frequently without X. Or probability change is negligible under invariants.',
      conditional:
        'Deterministic wording + stochastic mechanism. Or probability magnitude is underspecified.',
    },
    generatorHeuristic:
      'Use F2 when: "Could have happened anyway" is central. You want to test probability vs necessity confusion.',
    typicalMajorityLabel: 'CONDITIONAL',
  },

  // F3 — Overdetermination
  {
    code: 'F3',
    name: 'Overdetermination',
    guidingQuestion: 'Would another cause have sufficed?',
    definition: 'Multiple independent causes are each sufficient for Y.',
    requiredElements: [
      '≥2 sufficient causes explicitly stated',
      'Clear timing or simultaneity (preemption vs symmetry)',
    ],
    canonicalCaseStructure: [
      'Scenario: X1 and X2 both occur and each can cause Y.',
      'Claim: If X1 had not occurred, Y would not have occurred.',
      'Invariants: Other causes remain active.',
    ],
    labelDifferentiation: {
      invalid:
        'Symmetric overdetermination: removing X leaves Y via backup.',
      valid: 'Preemption: X blocks backup cause. Or threshold not reached without X.',
      conditional: 'Whether backup would fire is unspecified.',
    },
    generatorHeuristic:
      'Use F3 when: "But-for" intuition fails. The trap is confusing sufficiency with necessity.',
    typicalMajorityLabel: 'INVALID',
  },

  // F4 — Structural vs. Contingent Causes
  {
    code: 'F4',
    name: 'Structural vs. Contingent Causes',
    guidingQuestion: 'Was this the trigger or the root cause?',
    definition: 'Distinguishes proximate triggers from background structural conditions.',
    requiredElements: [
      'A salient trigger event',
      'A slower, enabling structural cause',
    ],
    canonicalCaseStructure: [
      'Scenario: Long-term structure makes Y likely; X triggers timing.',
      'Claim: If X had not occurred, Y would not have occurred.',
      'Invariants: Structural conditions fixed.',
    ],
    labelDifferentiation: {
      invalid: 'Structure alone would still produce Y.',
      valid: 'Trigger is necessary given the structure.',
      conditional: 'Whether structure alone suffices is unclear.',
    },
    generatorHeuristic:
      'Use F4 when: Salience bias is the main difficulty. "Spark vs fuel" distinction applies.',
    typicalMajorityLabel: 'CONDITIONAL',
  },

  // F5 — Temporal / Path-Dependent
  {
    code: 'F5',
    name: 'Temporal / Path-Dependent',
    guidingQuestion: 'Does timing or path matter?',
    definition: 'Earlier events constrain later possibilities; world is not memoryless.',
    requiredElements: [
      'Explicit timeline',
      'Dependency of later states on earlier ones',
    ],
    canonicalCaseStructure: [
      'Scenario: Early decision X alters available future paths.',
      'Claim: If X had not occurred, Y would not have occurred.',
      'Invariants: Later conditions held fixed only if coherent.',
    ],
    labelDifferentiation: {
      valid: 'Removing X blocks path to Y.',
      invalid: 'Alternative path still leads to Y.',
      conditional: 'Whether later conditions can be "held fixed" is unclear.',
    },
    generatorHeuristic:
      'Use F5 when: The counterfactual implicitly rewrites history. Timing windows or lock-in effects dominate.',
    typicalMajorityLabel: 'CONDITIONAL',
  },

  // F6 — Epistemic Limits
  {
    code: 'F6',
    name: 'Epistemic Limits',
    guidingQuestion: 'Is the counterfactual resolvable from what is stated?',
    definition: 'The scenario cannot determine the counterfactual even in principle.',
    requiredElements: [
      'Explicitly missing mechanism, identity, or invariant',
      'Multiple reasonable completions',
    ],
    canonicalCaseStructure: [
      'Scenario: Outcome depends on unstated mediator or unknowable fact.',
      'Claim: If X had not occurred, Y would not have occurred.',
      'Invariants: Missing or explicitly unknown.',
    ],
    labelDifferentiation: {
      conditional:
        'Two plausible invariant completions yield different answers.',
      valid: 'Only if scenario surprisingly pins down mechanism.',
      invalid: 'Only if scenario surprisingly pins down mechanism.',
    },
    generatorHeuristic:
      'Use F6 to: Intentionally generate CONDITIONAL-heavy cases. Test epistemic humility.',
    typicalMajorityLabel: 'CONDITIONAL',
  },

  // F7 — Causal Attribution
  {
    code: 'F7',
    name: 'Causal Attribution',
    guidingQuestion: 'How much credit does X deserve?',
    definition: 'Focuses on degree of contribution, not mere necessity.',
    requiredElements: [
      'Outcome Y occurred',
      'Multiple contributing factors',
      'Attribution standard (individual, population, path-specific)',
    ],
    canonicalCaseStructure: [
      'Scenario: X contributes alongside others to Y.',
      'Claim: If X had not occurred, Y would not have occurred / X caused Y.',
      'Invariants: Attribution standard fixed.',
    ],
    labelDifferentiation: {
      valid: 'Under stated attribution metric, X materially contributes.',
      invalid: "X's contribution is negligible or non-additional.",
      conditional: 'Attribution metric or population is unspecified.',
    },
    generatorHeuristic:
      'Use F7 when: Quantification or comparison is central. The trap is collapsing attribution into necessity.',
    typicalMajorityLabel: 'CONDITIONAL',
  },

  // F8 — Moral / Legal Causation
  {
    code: 'F8',
    name: 'Moral / Legal Causation',
    guidingQuestion: 'Who is responsible under a standard?',
    definition: 'Counterfactuals evaluated relative to a normative rule, not raw causation.',
    requiredElements: [
      'Explicit standard (legal, moral, institutional)',
      'Distinction between action, omission, intent',
    ],
    canonicalCaseStructure: [
      'Scenario: Agent acts or omits under a rule.',
      'Claim: If X had not occurred, Y (harm/liability) would not have occurred.',
      'Invariants: Legal or moral standard fixed.',
    ],
    labelDifferentiation: {
      valid: 'Counterfactual satisfies the stated standard (e.g., but-for liability).',
      invalid: 'Standard rejects attribution despite causal link.',
      conditional: 'Standard or burden of proof is underspecified.',
    },
    generatorHeuristic:
      'Use F8 when: Correctness depends on which rule, not common sense.',
    typicalMajorityLabel: 'CONDITIONAL',
  },
];

/**
 * Get family definition by code
 */
export function getL3FamilyByCode(code: L3Family): L3FamilyDefinition | undefined {
  return L3_FAMILY_TAXONOMY.find(f => f.code === code);
}

/**
 * Get all families (for selection/diversity)
 */
export function getAllL3Families(): L3Family[] {
  return L3_FAMILIES;
}

/**
 * Get family name by code
 */
export function getL3FamilyName(code: L3Family): string {
  const family = getL3FamilyByCode(code);
  return family?.name || code;
}
