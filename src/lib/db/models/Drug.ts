import fs from 'fs';
import path from 'path';

let drugsCache: any[] | null = null;

function loadDrugs(): any[] {
  if (drugsCache) return drugsCache;
  const filePath = path.join(process.cwd(), 'data', 'seed.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    drugsCache = JSON.parse(data);
  } else {
    drugsCache = [];
  }
  return drugsCache || [];
}

export const Drug = {
  find: (query: any) => {
    return {
      limit: (n: number) => {
        return {
          lean: async () => {
            const allDrugs = loadDrugs();
            let results = allDrugs;

            if (query && query.$or) {
              const regexes = query.$or.map((cond: any) => {
                const key = Object.keys(cond)[0];
                return { key, regex: cond[key] };
              });
              
              results = allDrugs.filter(drug => {
                return regexes.some(({ key, regex }: any) => {
                  const val = drug[key];
                  if (Array.isArray(val)) {
                    return val.some(v => regex.test(v));
                  }
                  return val && regex.test(val);
                });
              });
            }

            return results.slice(0, n);
          }
        };
      }
    };
  }
};
