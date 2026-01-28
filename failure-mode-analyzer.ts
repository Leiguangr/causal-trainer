import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Core failure pattern types we're looking for
export interface FailurePattern {
  patternId: string;
  patternType: 'CONCEPTUAL' | 'STRUCTURAL' | 'AMBIGUITY' | 'COVERAGE_GAP' | 'INSTABILITY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  examples: string[];
  affectedQuestionIds: string[];
  pearlLevelsAffected: string[];
  trapTypesAffected: string[];
  domainSpecific: boolean;
  frequencyCount: number;
  suggestedNewCases: string[];
}

export interface FailureModeAnalysis {
  analysisId: string;
  timestamp: string;
  questionsAnalyzed: number;
  totalFailurePatterns: number;
  criticalPatterns: number;
  
  // Pattern categorization
  conceptualFailures: FailurePattern[];
  structuralFailures: FailurePattern[];
  ambiguityFailures: FailurePattern[];
  coverageGaps: FailurePattern[];
  instabilityPatterns: FailurePattern[];
  
  // Coverage analysis
  pearlLevelCoverage: {
    level: string;
    totalQuestions: number;
    stableQuestions: number;
    instabilityRate: number;
    gapAreas: string[];
  }[];
  
  trapTypeCoverage: {
    trapType: string;
    totalQuestions: number;
    stableQuestions: number;
    instabilityRate: number;
    gapAreas: string[];
  }[];
  
  // Model performance patterns
  modelFailurePatterns: {
    modelType: string;
    systematicWeaknesses: string[];
    inconsistentAreas: string[];
    recommendedTargetCases: string[];
  }[];
  
  // Summary recommendations
  emergencyPriorities: string[];
  newCaseRecommendations: string[];
  systemicFixesNeeded: string[];
}

// Representative model evaluation framework
const REPRESENTATIVE_MODELS = [
  {
    id: 'causal-reasoning-expert',
    description: 'Expert-level causal reasoning evaluator',
    systemPrompt: `You are an expert in Pearl's Causal Hierarchy and causal inference. Evaluate whether each causal reasoning claim is valid.

Your task: For each scenario and claim, determine if the causal reasoning is sound.
- Consider confounding, selection bias, temporal ordering, and mechanism clarity
- Apply rigorous causal inference standards
- Flag any logical inconsistencies or missing information

Respond with: VALID, INVALID, or UNCLEAR (with brief reasoning)`
  },
  {
    id: 'domain-aware-evaluator', 
    description: 'Domain-aware evaluator with real-world knowledge',
    systemPrompt: `You are a domain expert evaluator. Consider both causal validity AND domain realism.

Your task: Evaluate if the scenario is realistic and the causal claim is sound within the domain context.
- Check for domain-specific knowledge accuracy
- Assess realistic variable relationships  
- Consider practical constraints and mechanisms

Respond with: SOUND, FLAWED, or AMBIGUOUS (with domain-specific reasoning)`
  }
];

// Core failure detection patterns
const FAILURE_DETECTION_PROMPTS = {
  conceptual: `Analyze this causal reasoning question for fundamental conceptual errors:

**SCENARIO**: {scenario}
**CLAIM**: {claim}
**LABELS**: Pearl Level: {pearlLevel}, Trap: {trapType}, Ground Truth: {groundTruth}

Look for:
1. Pearl level misclassification (L1/L2/L3 confusion)
2. Causal mechanism confusion (correlation vs causation)
3. Counterfactual logic errors
4. Temporal ordering issues

Identify any conceptual failures and their severity.`,

  structural: `Examine this question for structural problems:

**SCENARIO**: {scenario}
**CLAIM**: {claim}
**EXPLANATION**: {explanation}

Look for:
1. Scenario-claim mismatch
2. Internal logical contradictions
3. Missing critical information
4. Explanation inconsistencies

Flag structural issues that would confuse learners.`,

  ambiguity: `Assess this question for problematic ambiguity:

**SCENARIO**: {scenario}
**CLAIM**: {claim}

Look for:
1. Unclear variable definitions
2. Vague temporal relationships
3. Multiple valid interpretations
4. Insufficient context for evaluation

Distinguish between productive ambiguity (learning opportunity) and problematic ambiguity (confusing/misleading).`,

  coverage: `Analyze coverage gaps in this question set for {pearlLevel} {trapType}:

{questionSample}

Assess:
1. What edge cases are missing?
2. What variations would strengthen coverage?
3. Where are the weak spots in the current examples?
4. What new scenarios would expose different failure modes?

Recommend specific new cases needed.`,

  instability: `Evaluate response stability for this question:

**SCENARIO**: {scenario}
**CLAIM**: {claim}

Assess if small variations in:
1. Wording changes
2. Context emphasis  
3. Variable names
4. Domain details

Would lead to inconsistent evaluations. Flag questions where minor changes could flip the answer.`
};

export async function runFailureModeAnalysis(
  questionLimit?: number,
  focusAreas?: string[]
): Promise<FailureModeAnalysis> {
  console.log('🔍 Starting comprehensive failure-mode analysis...');
  
  const analysisId = `failure-analysis-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  // Debug: Check total questions in database
  const totalQuestions = await prisma.question.count();
  console.log(`🔍 Total questions in database: ${totalQuestions}`);
  
  // Get sample of questions for analysis
  const questions = await prisma.question.findMany({
    take: questionLimit || 45,
    where: focusAreas && focusAreas.length > 0 ? {
      OR: [
        { pearlLevel: { in: focusAreas } },
        { trapType: { in: focusAreas } },
        { domain: { in: focusAreas } }
      ]
    } : {}
  });
  
  console.log(`📊 Analyzing ${questions.length} questions for failure patterns...`);
  console.log(`🔍 Query params: limit=${questionLimit}, focusAreas=${JSON.stringify(focusAreas)}`);
  
  if (questions.length === 0) {
    console.log(`⚠️ No questions found! Total in DB: ${totalQuestions}`);
    // Try a simple query without any filters
    const simpleQuery = await prisma.question.findMany({ take: 5 });
    console.log(`🔍 Simple query found: ${simpleQuery.length} questions`);
    if (simpleQuery.length > 0) {
      console.log(`🔍 Sample question: ${simpleQuery[0].pearlLevel}, ${simpleQuery[0].trapType}, ${simpleQuery[0].scenario.substring(0, 50)}`);
    }
  }
  
  console.log(`📊 Analyzing ${questions.length} questions for failure patterns...`);
  
  // Initialize analysis structure
  const analysis: FailureModeAnalysis = {
    analysisId,
    timestamp,
    questionsAnalyzed: questions.length,
    totalFailurePatterns: 0,
    criticalPatterns: 0,
    conceptualFailures: [],
    structuralFailures: [],
    ambiguityFailures: [],
    coverageGaps: [],
    instabilityPatterns: [],
    pearlLevelCoverage: [],
    trapTypeCoverage: [],
    modelFailurePatterns: [],
    emergencyPriorities: [],
    newCaseRecommendations: [],
    systemicFixesNeeded: []
  };
  
  // Run parallel analysis streams
  const [
    conceptualPatterns,
    structuralPatterns, 
    ambiguityPatterns,
    coverageAnalysis,
    modelPerformance
  ] = await Promise.all([
    detectConceptualFailures(questions),
    detectStructuralFailures(questions),
    detectAmbiguityFailures(questions),
    analyzeCoverageGaps(questions),
    evaluateModelPerformance(questions)
  ]);
  
  // Consolidate results
  analysis.conceptualFailures = conceptualPatterns;
  analysis.structuralFailures = structuralPatterns;
  analysis.ambiguityFailures = ambiguityPatterns;
  analysis.coverageGaps = coverageAnalysis.gaps;
  analysis.pearlLevelCoverage = coverageAnalysis.pearlCoverage;
  analysis.trapTypeCoverage = coverageAnalysis.trapCoverage;
  analysis.modelFailurePatterns = modelPerformance;
  
  // Calculate totals and priorities
  analysis.totalFailurePatterns = 
    conceptualPatterns.length + 
    structuralPatterns.length + 
    ambiguityPatterns.length + 
    coverageAnalysis.gaps.length;
    
  analysis.criticalPatterns = [
    ...conceptualPatterns,
    ...structuralPatterns,
    ...ambiguityPatterns
  ].filter(p => p.severity === 'CRITICAL').length;
  
  // Generate recommendations
  analysis.emergencyPriorities = generateEmergencyPriorities(analysis);
  analysis.newCaseRecommendations = generateNewCaseRecommendations(analysis);
  analysis.systemicFixesNeeded = generateSystemicFixes(analysis);
  
  console.log(`✅ Analysis complete: ${analysis.totalFailurePatterns} patterns found (${analysis.criticalPatterns} critical)`);
  
  return analysis;
}

async function detectConceptualFailures(questions: any[]): Promise<FailurePattern[]> {
  console.log('🧠 Detecting conceptual failure patterns...');
  
  const patterns: FailurePattern[] = [];
  
  // Group by Pearl level for systematic analysis
  const pearlGroups = groupBy(questions, 'pearlLevel');
  
  for (const [level, levelQuestions] of Object.entries(pearlGroups)) {
    // Sample questions for analysis
    const sample = (levelQuestions as any[]).slice(0, 5);
    
    for (const question of sample) {
      try {
        const prompt = FAILURE_DETECTION_PROMPTS.conceptual
          .replace('{scenario}', question.scenario)
          .replace('{claim}', question.claim)
          .replace('{pearlLevel}', question.pearlLevel)
          .replace('{trapType}', question.trapType)
          .replace('{groundTruth}', question.groundTruth);
          
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are analyzing causal reasoning questions for conceptual errors. Respond with specific failure patterns found." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500
        });
        
        const analysis = response.choices[0].message.content || '';
        
        // Extract patterns (simplified - real implementation would parse structured output)
        if (analysis.toLowerCase().includes('pearl level') && analysis.toLowerCase().includes('incorrect')) {
          patterns.push({
            patternId: `conceptual-pearl-${level}-${Date.now()}`,
            patternType: 'CONCEPTUAL',
            severity: 'HIGH',
            description: `Pearl level misclassification in ${level} questions`,
            examples: [question.scenario.substring(0, 100) + '...'],
            affectedQuestionIds: [question.id],
            pearlLevelsAffected: [level],
            trapTypesAffected: [question.trapType],
            domainSpecific: false,
            frequencyCount: 1,
            suggestedNewCases: [`Need clearer ${level} examples with unambiguous ${question.trapType} patterns`]
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
        
      } catch (error) {
        console.error(`Error analyzing question ${question.id}:`, error);
      }
    }
  }
  
  return consolidatePatterns(patterns);
}

async function detectStructuralFailures(questions: any[]): Promise<FailurePattern[]> {
  console.log('🏗️ Detecting structural failure patterns...');
  
  const patterns: FailurePattern[] = [];
  
  // Look for common structural issues
  const structuralIssues = [
    {
      name: 'scenario-claim-mismatch',
      test: (q: any) => {
        // Simple heuristic: if claim mentions variables not in scenario
        const scenarioWords = new Set(q.scenario.toLowerCase().split(/\W+/));
        const claimWords = q.claim.toLowerCase().split(/\W+/);
        const unmatchedTerms = claimWords.filter((word: string) => 
          word.length > 3 && !scenarioWords.has(word)
        );
        return unmatchedTerms.length > 2;
      },
      severity: 'HIGH' as const,
      description: 'Claim references concepts not established in scenario'
    },
    {
      name: 'explanation-contradiction',
      test: (q: any) => {
        // Check if explanation contradicts ground truth
        const explanation = q.explanation?.toLowerCase() || '';
        const groundTruth = q.groundTruth?.toLowerCase() || '';
        
        if (groundTruth === 'yes' && explanation.includes('cannot') ||
            groundTruth === 'no' && explanation.includes('does cause')) {
          return true;
        }
        return false;
      },
      severity: 'CRITICAL' as const,
      description: 'Explanation contradicts assigned ground truth'
    }
  ];
  
  for (const issue of structuralIssues) {
    const affectedQuestions = questions.filter(issue.test);
    
    if (affectedQuestions.length > 0) {
      patterns.push({
        patternId: `structural-${issue.name}`,
        patternType: 'STRUCTURAL',
        severity: issue.severity,
        description: issue.description,
        examples: affectedQuestions.slice(0, 3).map(q => q.scenario.substring(0, 100) + '...'),
        affectedQuestionIds: affectedQuestions.map(q => q.id),
        pearlLevelsAffected: Array.from(new Set(affectedQuestions.map(q => q.pearlLevel))),
        trapTypesAffected: Array.from(new Set(affectedQuestions.map(q => q.trapType))),
        domainSpecific: false,
        frequencyCount: affectedQuestions.length,
        suggestedNewCases: [`Need ${affectedQuestions.length} replacement cases with proper ${issue.name.replace('-', ' ')}`]
      });
    }
  }
  
  return patterns;
}

async function detectAmbiguityFailures(questions: any[]): Promise<FailurePattern[]> {
  console.log('❓ Detecting problematic ambiguity patterns...');
  
  const patterns: FailurePattern[] = [];
  
  // Sample questions for ambiguity analysis
  const sample = questions.slice(0, 10);
  
  for (const question of sample) {
    try {
      const prompt = FAILURE_DETECTION_PROMPTS.ambiguity
        .replace('{scenario}', question.scenario)
        .replace('{claim}', question.claim);
        
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Identify problematic ambiguity that would confuse learners (not productive ambiguity for learning)." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 400
      });
      
      const analysis = response.choices[0].message.content || '';
      
      // Extract ambiguity patterns
      if (analysis.toLowerCase().includes('unclear') || analysis.toLowerCase().includes('ambiguous')) {
        patterns.push({
          patternId: `ambiguity-${question.id}`,
          patternType: 'AMBIGUITY',
          severity: 'MEDIUM',
          description: 'Problematic ambiguity in variable definitions or relationships',
          examples: [question.scenario.substring(0, 100) + '...'],
          affectedQuestionIds: [question.id],
          pearlLevelsAffected: [question.pearlLevel],
          trapTypesAffected: [question.trapType],
          domainSpecific: question.domain ? true : false,
          frequencyCount: 1,
          suggestedNewCases: ['Need clearer variable definitions and unambiguous temporal relationships']
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error analyzing ambiguity in question ${question.id}:`, error);
    }
  }
  
  return consolidatePatterns(patterns);
}

async function analyzeCoverageGaps(questions: any[]) {
  console.log('📊 Analyzing coverage gaps and instability...');
  
  // Group by Pearl level and trap type
  const pearlGroups = groupBy(questions, 'pearlLevel');
  const trapGroups = groupBy(questions, 'trapType');
  
  const pearlCoverage = Object.entries(pearlGroups).map(([level, levelQuestions]) => ({
    level,
    totalQuestions: (levelQuestions as any[]).length,
    stableQuestions: (levelQuestions as any[]).filter((q: any) => q.evaluations?.length > 0).length,
    instabilityRate: calculateInstabilityRate(levelQuestions as any[]),
    gapAreas: identifyGapAreas(levelQuestions as any[], level)
  }));
  
  const trapCoverage = Object.entries(trapGroups).map(([trapType, trapQuestions]) => ({
    trapType,
    totalQuestions: (trapQuestions as any[]).length,
    stableQuestions: (trapQuestions as any[]).filter((q: any) => q.evaluations?.length > 0).length, 
    instabilityRate: calculateInstabilityRate(trapQuestions as any[]),
    gapAreas: identifyGapAreas(trapQuestions as any[], trapType)
  }));
  
  // Identify coverage gaps
  const gaps: FailurePattern[] = [];
  
  // Find underrepresented combinations
  const combinations = new Map();
  questions.forEach(q => {
    const key = `${q.pearlLevel}-${q.trapType}`;
    combinations.set(key, (combinations.get(key) || 0) + 1);
  });
  
  for (const [combo, count] of Array.from(combinations.entries())) {
    if (count < 3) { // Threshold for sparse coverage
      const [pearl, trap] = combo.split('-');
      gaps.push({
        patternId: `coverage-gap-${combo}`,
        patternType: 'COVERAGE_GAP',
        severity: count === 1 ? 'HIGH' : 'MEDIUM',
        description: `Sparse coverage for ${pearl} + ${trap} combination`,
        examples: questions.filter(q => q.pearlLevel === pearl && q.trapType === trap)
          .map(q => q.scenario.substring(0, 80) + '...'),
        affectedQuestionIds: questions.filter(q => q.pearlLevel === pearl && q.trapType === trap)
          .map(q => q.id),
        pearlLevelsAffected: [pearl],
        trapTypesAffected: [trap],
        domainSpecific: false,
        frequencyCount: count,
        suggestedNewCases: [`Need ${3 - count} more diverse ${pearl} + ${trap} scenarios`]
      });
    }
  }
  
  return { gaps, pearlCoverage, trapCoverage };
}

async function evaluateModelPerformance(questions: any[]) {
  console.log('🤖 Evaluating representative model performance patterns...');
  
  const modelPatterns = [];
  
  // Sample questions for model evaluation
  const sample = questions.slice(0, 8);
  
  for (const model of REPRESENTATIVE_MODELS) {
    const systematicWeaknesses: string[] = [];
    const inconsistentAreas: string[] = [];
    const recommendedTargetCases: string[] = [];
    
    for (const question of sample) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: model.systemPrompt },
            { role: "user", content: `Scenario: ${question.scenario}\n\nClaim: ${question.claim}\n\nEvaluate this causal reasoning.` }
          ],
          temperature: 0.1,
          max_tokens: 200
        });
        
        const evaluation = response.choices[0].message.content || '';
        
        // Analyze for patterns (simplified)
        if (evaluation.toLowerCase().includes('invalid') && question.groundTruth === 'YES') {
          systematicWeaknesses.push(`Incorrectly rejects valid ${question.trapType} scenarios`);
        }
        
        if (evaluation.toLowerCase().includes('unclear') && question.groundTruth !== 'AMBIGUOUS') {
          inconsistentAreas.push(`Over-caution in ${question.pearlLevel} ${question.trapType} cases`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150)); // Rate limiting
        
      } catch (error) {
        console.error(`Error evaluating with ${model.id}:`, error);
      }
    }
    
    // Generate targeted case recommendations
    if (systematicWeaknesses.length > 0) {
      recommendedTargetCases.push(`Need clearer ${sample[0].trapType} positive cases to train against over-rejection`);
    }
    if (inconsistentAreas.length > 0) {
      recommendedTargetCases.push(`Need confidence-building cases for ${sample[0].pearlLevel} scenarios`);
    }
    
    modelPatterns.push({
      modelType: model.id,
      systematicWeaknesses: Array.from(new Set(systematicWeaknesses)),
      inconsistentAreas: Array.from(new Set(inconsistentAreas)),
      recommendedTargetCases: Array.from(new Set(recommendedTargetCases))
    });
  }
  
  return modelPatterns;
}

// Helper functions
function groupBy(items: any[], key: string): Record<string, any[]> {
  return items.reduce((groups, item) => {
    const group = item[key] || 'unknown';
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, any[]>);
}

function calculateInstabilityRate(questions: any[]): number {
  // Simple heuristic: questions with evaluations that disagree with ground truth
  const unstable = questions.filter(q => 
    q.evaluations?.some((evaluation: any) => 
      evaluation.overallVerdict !== 'APPROVED' || evaluation.priorityLevel === 1
    )
  );
  return questions.length > 0 ? unstable.length / questions.length : 0;
}

function identifyGapAreas(questions: any[], category: string): string[] {
  const gaps = [];
  
  // Domain diversity check
  const domains = new Set(questions.map(q => q.domain));
  if (domains.size < 3) {
    gaps.push(`Limited domain diversity (only ${domains.size} domains)`);
  }
  
  // Complexity check
  const complexScenarios = questions.filter(q => q.scenario.length > 200);
  if (complexScenarios.length < questions.length * 0.3) {
    gaps.push('Insufficient complex scenarios');
  }
  
  return gaps;
}

function consolidatePatterns(patterns: FailurePattern[]): FailurePattern[] {
  // Group similar patterns and consolidate
  const consolidated = new Map();
  
  patterns.forEach(pattern => {
    const key = `${pattern.patternType}-${pattern.description}`;
    if (consolidated.has(key)) {
      const existing = consolidated.get(key);
      existing.affectedQuestionIds = [...existing.affectedQuestionIds, ...pattern.affectedQuestionIds];
      existing.frequencyCount += pattern.frequencyCount;
      existing.examples = [...existing.examples, ...pattern.examples].slice(0, 5);
    } else {
      consolidated.set(key, pattern);
    }
  });
  
  return Array.from(consolidated.values());
}

function generateEmergencyPriorities(analysis: FailureModeAnalysis): string[] {
  const priorities = [];
  
  if (analysis.criticalPatterns > 0) {
    priorities.push(`CRITICAL: ${analysis.criticalPatterns} critical failure patterns require immediate attention`);
  }
  
  const highInstability = analysis.pearlLevelCoverage.filter(p => p.instabilityRate > 0.3);
  if (highInstability.length > 0) {
    priorities.push(`HIGH: Instability in ${highInstability.map(p => p.level).join(', ')} requires stabilization`);
  }
  
  const sparseCoverage = analysis.trapTypeCoverage.filter(t => t.totalQuestions < 3);
  if (sparseCoverage.length > 0) {
    priorities.push(`MEDIUM: Sparse coverage in ${sparseCoverage.map(t => t.trapType).join(', ')} needs expansion`);
  }
  
  return priorities;
}

function generateNewCaseRecommendations(analysis: FailureModeAnalysis): string[] {
  const recommendations: string[] = [];
  
  // Extract from coverage gaps
  analysis.coverageGaps.forEach(gap => {
    recommendations.push(...gap.suggestedNewCases);
  });
  
  // Extract from model failure patterns
  analysis.modelFailurePatterns.forEach(model => {
    recommendations.push(...model.recommendedTargetCases);
  });
  
  return Array.from(new Set(recommendations));
}

function generateSystemicFixes(analysis: FailureModeAnalysis): string[] {
  const fixes = [];
  
  if (analysis.conceptualFailures.length > 3) {
    fixes.push('Template system needs conceptual validation layer');
  }
  
  if (analysis.structuralFailures.length > 2) {
    fixes.push('Quality gates needed for scenario-claim-explanation consistency');
  }
  
  if (analysis.coverageGaps.length > 5) {
    fixes.push('Coverage balancing algorithm needed for Pearl×Trap combinations');
  }
  
  return fixes;
}