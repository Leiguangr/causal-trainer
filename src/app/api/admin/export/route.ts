import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pearlLevels = searchParams.get('pearlLevels')?.split(',') || [];
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const format = searchParams.get('format') || 'json';

    // Build where clause
    const where: any = {};
    if (pearlLevels.length > 0 && !pearlLevels.includes('all')) {
      where.pearlLevel = { in: pearlLevels };
    }
    if (verifiedOnly) {
      where.isVerified = true;
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      orderBy: [
        { pearlLevel: 'asc' },
        { sourceCase: 'asc' },
      ],
    });

    // Count by level
    const distribution = {
      L1: questions.filter(q => q.pearlLevel === 'L1').length,
      L2: questions.filter(q => q.pearlLevel === 'L2').length,
      L3: questions.filter(q => q.pearlLevel === 'L3').length,
    };

    // Format export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalQuestions: questions.length,
        distribution,
        version: '1.0',
        filters: {
          pearlLevels: pearlLevels.length > 0 ? pearlLevels : ['L1', 'L2', 'L3'],
          verifiedOnly,
        },
      },
      questions: questions.map(q => {
        // Parse variables if it's a JSON string
        let variables;
        try {
          variables = q.variables ? JSON.parse(q.variables) : null;
        } catch {
          variables = q.variables;
        }

        return {
          caseId: q.sourceCase || q.id,
          scenario: q.scenario,
          claim: q.claim,
          variables,
          annotations: {
            pearlLevel: q.pearlLevel,
            domain: q.domain,
            subdomain: q.subdomain,
            trapType: q.trapType,
            trapSubtype: q.trapSubtype,
            difficulty: q.difficulty,
            causalStructure: q.causalStructure,
            keyInsight: q.keyInsight,
          },
          groundTruth: q.groundTruth,
          explanation: q.explanation,
          wiseRefusal: q.wiseRefusal,
        };
      }),
    };

    if (format === 'json') {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="causal-questions-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export questions' },
      { status: 500 }
    );
  }
}

