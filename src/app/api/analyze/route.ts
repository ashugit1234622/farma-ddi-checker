import { NextResponse } from 'next/server';
import { runDDIAnalysis } from '@/lib/ai/analysis';
import { buildEvidenceBundle } from '@/lib/engine/ddi-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { drug1Id, drug2Id } = body;

    if (!drug1Id || !drug2Id) {
      return NextResponse.json({ error: 'Missing drug IDs' }, { status: 400 });
    }

    // Build evidence bundle using deterministic rule engine
    const bundle = buildEvidenceBundle(drug1Id, drug2Id);

    // Run AI analysis
    const result = await runDDIAnalysis(drug1Id, drug2Id, bundle);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error running DDI analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze interaction' }, { status: 500 });
  }
}
