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

// ── Levenshtein distance (for fuzzy matching) ─────────────────────────────────
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
  }
  return dp[a.length][b.length];
}

// Fuzzy similarity: 1.0 = perfect, 0 = completely different
function fuzzyScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  const drugs = loadDrugs();
  const query = q.toLowerCase();

  const scored = drugs.map(drug => {
    let score = 0;
    const name = (drug.name || '').toLowerCase();
    const genericName = (drug.genericName || '').toLowerCase();
    const synonyms: string[] = (drug.synonyms || []).map((s: string) => s.toLowerCase());
    const classes: string[] = (drug.drugClass || []).map((c: string) => c.toLowerCase());
    const indications: string[] = (drug.indications || []).map((i: string) => i.toLowerCase());

    // ── Exact / prefix / substring matches (high weight) ──
    if (name === query) score += 200;
    else if (name.startsWith(query)) score += 150;
    else if (name.includes(query)) score += 100;

    if (genericName === query) score += 180;
    else if (genericName.startsWith(query)) score += 130;
    else if (genericName.includes(query)) score += 80;

    for (const syn of synonyms) {
      if (syn === query) { score += 160; break; }
      else if (syn.startsWith(query)) { score += 110; break; }
      else if (syn.includes(query)) { score += 60; break; }
    }

    // ── Fuzzy matching (catches typos and misspellings) ──
    if (score === 0 || query.length >= 4) {
      const nameFuzz = fuzzyScore(query, name);
      const genFuzz  = fuzzyScore(query, genericName);
      const bestFuzz = Math.max(nameFuzz, genFuzz, ...synonyms.map(s => fuzzyScore(query, s)));

      if (bestFuzz >= 0.85) score += Math.round(bestFuzz * 90);       // very close
      else if (bestFuzz >= 0.70) score += Math.round(bestFuzz * 50);  // close
      else if (bestFuzz >= 0.60) score += Math.round(bestFuzz * 20);  // possible
    }

    // ── Drug class / indication (lower weight) ──
    for (const cls of classes) {
      if (cls.includes(query)) { score += 30; break; }
    }
    for (const ind of indications) {
      if (ind.includes(query)) { score += 20; break; }
    }

    return { drug, score };
  });

  const results = scored
    .filter(s => s.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
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
