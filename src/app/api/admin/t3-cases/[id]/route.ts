import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const t3Case = await prisma.t3Case.findUnique({
      where: { id },
    });

    if (!t3Case) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Return case in snake_case format (as stored in database)
    return NextResponse.json({ case: t3Case });
  } catch (error) {
    console.error('Get T3 case error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    // Check if T3Case exists
    const existing = await prisma.t3Case.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Update unified T3Case with all fields from Table 9 schema (snake_case)
    const updateData: any = {
      scenario: body.scenario,
      claim: body.claim ?? null,
      counterfactual_claim: body.counterfactual_claim ?? null,
      label: body.label,
      is_ambiguous: body.is_ambiguous ?? false,
      domain: body.domain ?? null,
      subdomain: body.subdomain ?? null,
      difficulty: body.difficulty,
      causal_structure: body.causal_structure ?? null,
      key_insight: body.key_insight ?? null,
      wise_refusal: body.wise_refusal ?? null,
      gold_rationale: body.gold_rationale ?? null,
      author: body.author ?? null,
      is_verified: body.is_verified ?? false,
    };

    // Handle variables (ensure Z is array)
    if (body.variables) {
      const vars = typeof body.variables === 'string' ? JSON.parse(body.variables) : body.variables;
      if (vars && !Array.isArray(vars.Z)) {
        vars.Z = vars.Z ? [String(vars.Z)] : [];
      }
      updateData.variables = JSON.stringify(vars);
    }

    // Handle trap structure
    if (body.trap) {
      updateData.trap_type = body.trap.type || body.trap_type;
      updateData.trap_type_name = body.trap.type_name ?? null;
      updateData.trap_subtype = body.trap.subtype ?? null;
      updateData.trap_subtype_name = body.trap.subtype_name ?? null;
    } else if (body.trap_type) {
      updateData.trap_type = body.trap_type;
    }

    // Handle hidden_timestamp
    if (body.hidden_timestamp !== undefined) {
      updateData.hidden_timestamp = typeof body.hidden_timestamp === 'string'
        ? body.hidden_timestamp
        : JSON.stringify(body.hidden_timestamp);
    }

    // Handle conditional_answers
    if (body.conditional_answers !== undefined) {
      updateData.conditional_answers = typeof body.conditional_answers === 'string'
        ? body.conditional_answers
        : JSON.stringify(body.conditional_answers);
    }

    // Handle invariants (L3 only)
    if (body.invariants !== undefined) {
      updateData.invariants = typeof body.invariants === 'string'
        ? body.invariants
        : Array.isArray(body.invariants)
        ? JSON.stringify(body.invariants)
        : null;
    }

    // Assignment 2 fields
    if (body.initial_author !== undefined) updateData.initial_author = body.initial_author;
    if (body.validator !== undefined) updateData.validator = body.validator;
    if (body.final_score !== undefined) updateData.final_score = body.final_score;

    const updatedCase = await prisma.t3Case.update({
      where: { id },
      data: updateData,
    });

    // Return response in snake_case format
    return NextResponse.json({ 
      success: true, 
      case: updatedCase 
    });
  } catch (error) {
    console.error('Update T3 case error:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete from unified T3Case table
    try {
      await prisma.t3Case.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Case not found' },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Delete T3 case error:', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}
