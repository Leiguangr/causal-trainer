/**
 * Curated examples for each trap type from the seed data.
 * These are used to guide LLM generation with high-quality examples.
 */

export interface TrapExample {
  trapType: string;
  trapSubtype?: string;
  scenario: string;
  claim: string;
  variables: Record<string, string>;
  causalStructure: string;
  groundTruth: string;
  keyInsight: string;
  wiseRefusal: string;
}

// Hand-picked examples from questions.json, one or two per trap type
export const TRAP_EXAMPLES: TrapExample[] = [
  {
    trapType: 'REVERSE',
    trapSubtype: 'Sentiment_Indicator',
    scenario: 'Historical data suggests that when small "odd lot" retail investors buy heavily, the market tops out and crashes. A trader sees retail buying and sells immediately.',
    claim: 'Retail buying causes the market to crash.',
    variables: { X: 'Retail Buying (Indicator)', Y: 'Market Crash (Outcome)', Z: 'Late-Cycle Euphoria (Latent Cause)' },
    causalStructure: 'Euphoria (Z) causes both retail buying (X) and eventual crash (Y)',
    groundTruth: 'NO',
    keyInsight: 'Retail buying is a sign of euphoria, not the cause of the crash',
    wiseRefusal: 'NO - the claim is invalid. Retail buying (X) does not mechanically cause a crash. Instead, heavy retail participation is an indicator of late-stage market euphoria (Z). The market crashes because valuations are unsustainable, not because small investors are buying.',
  },
  {
    trapType: 'REGRESSION',
    trapSubtype: 'Regression_to_Mean',
    scenario: 'When a CEO appears on the cover of Time Magazine, the company stock falls within 12 months. A trader decides to short the stock immediately upon publication.',
    claim: 'The magazine cover causes the stock to fall.',
    variables: { X: 'Magazine Cover (Event)', Y: 'Stock Fall (Outcome)', Z: 'Peak Popularity / Hype (Context)' },
    causalStructure: 'Cover marks peak hype (Z); subsequent decline is regression to mean',
    groundTruth: 'NO',
    keyInsight: 'Magazine covers capture the peak of a trend; subsequent performance regresses to the mean',
    wiseRefusal: 'NO - the claim is invalid. The magazine cover does not jinx the company. It marks the peak of public hype (Z). The subsequent stock drop is simply regression to the mean from an unsustainable extreme.',
  },
  {
    trapType: 'COLLIDER',
    trapSubtype: 'Conditioning_on_Participation',
    scenario: 'Among hedge funds that survived for 10+ years, those using Strategy A show higher average returns than those using Strategy B.',
    claim: 'Strategy A is superior to Strategy B for hedge fund returns.',
    variables: { X: 'Strategy A vs. Strategy B (Exposure)', Y: 'Returns (Outcome)', Z: 'Survived 10+ Years (Collider)' },
    causalStructure: 'Survival is a collider; conditioning on it induces spurious correlation between strategy and returns',
    groundTruth: 'NO',
    keyInsight: 'Survivorship bias hides failed funds from the analysis',
    wiseRefusal: 'NO - the claim is invalid. This analysis conditions on survival (a collider). Failed funds are excluded. Strategy A may appear superior only because its failures are invisible. We need data on all funds, including those that closed.',
  },
  {
    trapType: 'CONFOUNDING',
    trapSubtype: 'Common_Cause',
    scenario: 'The world\'s tallest buildings are often completed just before major economic crashes. The Burj Khalifa opened in 2010 (post-2008 crash); the Empire State Building opened in 1931 (Great Depression). You short the market because a new record-breaking tower is opening.',
    claim: 'Building tall skyscrapers causes economic crashes.',
    variables: { X: 'Skyscraper Completion (Event)', Y: 'Market Crash (Outcome)', Z: 'Easy Credit / Asset Bubble (Common Cause)' },
    causalStructure: 'Credit bubble (Z) causes both skyscraper construction (X) and eventual crash (Y)',
    groundTruth: 'NO',
    keyInsight: 'Construction lags financing; both are symptoms of peak credit bubbles',
    wiseRefusal: 'NO - the claim is invalid. Skyscrapers do not cause crashes. Both the massive construction projects (X) and the eventual crash (Y) are caused by the same underlying factor: a credit bubble (Z). The building completion is a lagging indicator.',
  },
  {
    trapType: 'SELECTION',
    trapSubtype: 'Base_Rate_Neglect',
    scenario: 'A technical chart pattern called the "Hindenburg Omen" appears. Historically, major crashes are preceded by this signal, though the signal only leads to a crash 25% of the time. You panic sell everything.',
    claim: 'The Hindenburg Omen signal indicates an imminent crash.',
    variables: { X: 'Chart Signal (Predictor)', Y: 'Crash (Outcome)', Z: 'Market Internal Divergence (Condition)' },
    causalStructure: 'Signal has 75% false positive rate; crashes preceded by signal ≠ signal causes crash',
    groundTruth: 'NO',
    keyInsight: 'A signal with high false positive rate is not a valid causal trigger',
    wiseRefusal: 'NO - the claim is invalid. This signal has a 75% false positive rate. While crashes are often preceded by the Omen, the Omen is frequently followed by nothing. The predictive power is too low to justify action.',
  },
  {
    trapType: 'COUNTERFACTUAL',
    trapSubtype: 'Valuation_Mechanics',
    scenario: 'The Federal Reserve raised interest rates. Tech stocks fell 30%. An analyst claims: "If the Fed had held rates steady, tech stocks would have rallied."',
    claim: 'Holding rates steady would have caused tech stocks to rally.',
    variables: { X: 'Rate Hike (Intervention)', Y: 'Tech Sector Fall (Outcome)', Z: 'Discounted Cash Flow (Mechanism)' },
    causalStructure: 'Interest rate (X) is the discount rate in DCF models (Z); higher rates = lower valuations (Y)',
    groundTruth: 'YES',
    keyInsight: 'Higher rates = higher discount rate = lower present value',
    wiseRefusal: 'YES - the claim is valid. In DCF models, the interest rate is the denominator (Z). Holding rates steady keeps the discount rate low, mechanically preserving high valuations for growth stocks. The causal link is direct and structural.',
  },
  {
    trapType: 'SIMPSONS',
    trapSubtype: 'Aggregation_Bias',
    scenario: 'Hospital A has a higher overall mortality rate than Hospital B. However, Hospital A specializes in treating severe cases, and when comparing patients with similar severity, Hospital A has lower mortality.',
    claim: 'Hospital B provides better care than Hospital A.',
    variables: { X: 'Hospital (A vs B)', Y: 'Mortality Rate', Z: 'Case Severity (Confounder)' },
    causalStructure: 'Severity (Z) affects both hospital selection (X) and mortality (Y)',
    groundTruth: 'NO',
    keyInsight: 'Aggregate statistics mask within-group relationships when groups have different compositions',
    wiseRefusal: 'NO - the claim is invalid. This is Simpson\'s Paradox. Hospital A appears worse in aggregate only because it treats more severe cases. Within each severity level, Hospital A outperforms. The aggregate comparison is confounded by case mix.',
  },
  {
    trapType: 'GOODHART',
    trapSubtype: 'Metric_Gaming',
    scenario: 'A call center implemented a policy rewarding agents for short call times. Average call duration dropped 40%, but customer satisfaction scores fell and repeat calls increased 60%.',
    claim: 'Incentivizing shorter calls improves call center efficiency.',
    variables: { X: 'Short Call Incentive (Policy)', Y: 'Efficiency (Intended Outcome)', Z: 'Call Duration Metric (Proxy)' },
    causalStructure: 'Policy (X) optimizes proxy (Z) but degrades true outcome (Y)',
    groundTruth: 'NO',
    keyInsight: 'When a measure becomes a target, it ceases to be a good measure',
    wiseRefusal: 'NO - the claim is invalid. This is Goodhart\'s Law. The metric (call duration) was optimized at the expense of the actual goal (efficiency/quality). Agents rushed calls, causing repeat contacts and lower satisfaction. The proxy was gamed.',
  },
];

/**
 * Get examples for a specific trap type
 */
export function getExamplesForTrap(trapType: string): TrapExample[] {
  return TRAP_EXAMPLES.filter(e => e.trapType === trapType);
}

/**
 * Format examples for inclusion in a prompt
 */
export function formatExamplesForPrompt(trapType: string): string {
  const examples = getExamplesForTrap(trapType);
  if (examples.length === 0) return '';

  return examples.map((ex, i) => `
EXAMPLE ${i + 1} (${ex.trapType}, ${ex.groundTruth}):
Scenario: "${ex.scenario}"
Claim: "${ex.claim}"
Variables: X = ${ex.variables.X}, Y = ${ex.variables.Y}, Z = ${ex.variables.Z}
Causal Structure: ${ex.causalStructure}
Key Insight: ${ex.keyInsight}
Wise Refusal: "${ex.wiseRefusal}"
`).join('\n');
}

