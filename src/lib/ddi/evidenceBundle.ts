import fs from 'fs';
import path from 'path';

export class DrugNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrugNotFoundError';
  }
}

export async function buildEvidenceBundle(drug1Id: string, drug2Id: string) {
  const filePath = path.join(process.cwd(), 'data', 'seed.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const drug1 = data.find((d: any) => d._id === drug1Id);
  const drug2 = data.find((d: any) => d._id === drug2Id);

  if (!drug1) throw new DrugNotFoundError(`Drug not found: ${drug1Id}`);
  if (!drug2) throw new DrugNotFoundError(`Drug not found: ${drug2Id}`);

  return { drug1, drug2 };
}
