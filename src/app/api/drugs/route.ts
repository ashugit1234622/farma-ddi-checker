import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let drugsCache: any[] | null = null;

function loadDrugs(): any[] {
  if (drugsCache) return drugsCache;
  const filePath = path.join(process.cwd(), 'data', 'seed.json');
  drugsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return drugsCache || [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  const drugs = loadDrugs();
  const query = q.toLowerCase();

  // Score each drug for relevance
  const scored = drugs.map(drug => {
    let score = 0;
    const name = (drug.name || '').toLowerCase();
    const genericName = (drug.genericName || '').toLowerCase();
    const synonyms: string[] = (drug.synonyms || []).map((s: string) => s.toLowerCase());
    const classes: string[] = (drug.drugClass || []).map((c: string) => c.toLowerCase());
    const indications: string[] = (drug.indications || []).map((i: string) => i.toLowerCase());

    // Exact match on name
    if (name === query) score += 100;
    else if (name.startsWith(query)) score += 80;
    else if (name.includes(query)) score += 60;

    // Generic name
    if (genericName === query) score += 90;
    else if (genericName.startsWith(query)) score += 70;
    else if (genericName.includes(query)) score += 50;

    // Synonyms
    for (const syn of synonyms) {
      if (syn === query) { score += 85; break; }
      else if (syn.startsWith(query)) { score += 65; break; }
      else if (syn.includes(query)) { score += 40; break; }
    }

    // Drug class
    for (const cls of classes) {
      if (cls.includes(query)) { score += 30; break; }
    }

    // Indications
    for (const ind of indications) {
      if (ind.includes(query)) { score += 20; break; }
    }

    return { drug, score };
  });

  const results = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(s => ({
      id: s.drug._id,
      name: s.drug.name,
      genericName: s.drug.genericName,
      drugClass: s.drug.drugClass,
      synonyms: s.drug.synonyms,
      indications: s.drug.indications,
    }));

  return NextResponse.json({ data: results });
}
