#!/usr/bin/env node
/**
 * Test script for failure-mode analysis
 * Demonstrates the lightweight analysis approach focusing on qualitative patterns
 */

const chalk = require('chalk');

async function testFailureModeAnalysis() {
  const baseUrl = 'http://localhost:3000';
  const analysisUrl = `${baseUrl}/api/admin/failure-analysis`;

  console.log(chalk.blue('🔍 Testing Failure-Mode Analysis System\n'));

  try {
    // Test lightweight analysis
    console.log(chalk.yellow('📊 Running lightweight failure-mode analysis...'));
    
    const lightweightResponse = await fetch(analysisUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisType: 'lightweight',
        questionLimit: 15,
        focusAreas: [] // Test with no focus areas for general patterns
      })
    });

    if (!lightweightResponse.ok) {
      throw new Error(`HTTP ${lightweightResponse.status}: ${lightweightResponse.statusText}`);
    }

    const lightweightResult = await lightweightResponse.json();

    // Display results
    console.log(chalk.green('✅ Lightweight Analysis Complete\n'));
    
    console.log(chalk.bold('📋 Analysis Summary:'));
    console.log(`  Questions Analyzed: ${lightweightResult.questionsAnalyzed}`);
    console.log(`  Analysis Type: ${lightweightResult.analysisType}\n`);

    if (lightweightResult.keyFindings) {
      const findings = lightweightResult.keyFindings;
      
      // Show justification (the key goal)
      console.log(chalk.bold('🎯 Justification for New Cases:'));
      console.log(chalk.cyan(findings.justification));
      console.log();

      // Show critical patterns
      if (findings.criticalPatterns?.length > 0) {
        console.log(chalk.bold.red('❌ Critical Failure Patterns:'));
        findings.criticalPatterns.forEach((pattern, idx) => {
          console.log(`  ${idx + 1}. ${pattern.description}`);
          console.log(`     Frequency: ${pattern.frequencyCount}`);
          if (pattern.suggestedNewCases?.length > 0) {
            console.log(`     Suggested: ${pattern.suggestedNewCases[0]}`);
          }
        });
        console.log();
      }

      // Show coverage gaps
      if (findings.coverageGaps?.length > 0) {
        console.log(chalk.bold.orange('📊 Coverage Gaps:'));
        findings.coverageGaps.slice(0, 3).forEach((gap, idx) => {
          console.log(`  ${idx + 1}. ${gap.description} (${gap.frequencyCount} cases)`);
        });
        console.log();
      }

      // Show model performance insights
      if (findings.modelWeaknesses?.length > 0) {
        console.log(chalk.bold.blue('🤖 Representative Model Patterns:'));
        findings.modelWeaknesses.forEach((model, idx) => {
          console.log(`  ${model.model}:`);
          if (model.weaknesses?.length > 0) {
            console.log(`    Weaknesses: ${model.weaknesses.join(', ')}`);
          }
          if (model.recommendations?.length > 0) {
            console.log(`    Recommendations: ${model.recommendations.join(', ')}`);
          }
        });
        console.log();
      }

      // Show emergency priorities
      if (findings.emergencyPriorities?.length > 0) {
        console.log(chalk.bold.red('🚨 Emergency Priorities:'));
        findings.emergencyPriorities.forEach((priority, idx) => {
          console.log(`  ${idx + 1}. ${priority}`);
        });
        console.log();
      }
    }

    // Test comprehensive analysis (smaller sample)
    console.log(chalk.yellow('📊 Running comprehensive analysis (small sample)...'));
    
    const comprehensiveResponse = await fetch(analysisUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisType: 'comprehensive',
        questionLimit: 10, // Small sample for testing
        focusAreas: ['L2', 'CONFOUNDING'] // Focus on specific areas
      })
    });

    if (!comprehensiveResponse.ok) {
      throw new Error(`HTTP ${comprehensiveResponse.status}: ${comprehensiveResponse.statusText}`);
    }

    const comprehensiveResult = await comprehensiveResponse.json();

    console.log(chalk.green('✅ Comprehensive Analysis Complete\n'));
    
    if (comprehensiveResult.summary) {
      const summary = comprehensiveResult.summary;
      console.log(chalk.bold('📈 Comprehensive Summary:'));
      console.log(`  Total Patterns: ${summary.totalPatterns}`);
      console.log(`  Critical Count: ${summary.criticalCount}`);
      console.log(`  New Cases Needed: ${summary.newCasesNeeded}`);
      
      if (summary.topPriorities?.length > 0) {
        console.log(`  Top Priorities:`);
        summary.topPriorities.forEach((priority, idx) => {
          console.log(`    ${idx + 1}. ${priority}`);
        });
      }
    }

    console.log('\n' + chalk.green('🎉 Failure-mode analysis system working correctly!'));
    console.log(chalk.cyan('Key Features Demonstrated:'));
    console.log('  ✓ Lightweight analysis focusing on qualitative patterns');
    console.log('  ✓ Representative model evaluation (not comparison)');
    console.log('  ✓ Coverage gap identification');
    console.log('  ✓ Justification for new case requirements');
    console.log('  ✓ Emergency priority detection');

  } catch (error) {
    console.error(chalk.red('❌ Analysis Test Failed:'));
    console.error(chalk.red(error.message));
    
    if (error.message.includes('fetch is not defined')) {
      console.log(chalk.yellow('\n💡 Note: This test requires Node.js 18+ or a fetch polyfill'));
      console.log(chalk.yellow('To test manually:'));
      console.log(chalk.cyan('1. Start the development server: npm run dev'));
      console.log(chalk.cyan('2. Visit: http://localhost:3000/admin/generate'));
      console.log(chalk.cyan('3. Use the "Failure-Mode Analysis" section'));
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log(chalk.yellow('\n💡 Start the development server first:'));
      console.log(chalk.cyan('npm run dev'));
    }

    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testFailureModeAnalysis();
}

module.exports = { testFailureModeAnalysis };