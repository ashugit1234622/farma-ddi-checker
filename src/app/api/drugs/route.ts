import { NextResponse } from 'next/server';
import { searchDrugs } from '../../../lib/engine/ddi-engine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  try {
    const results = searchDrugs(q);
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Error searching drugs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
