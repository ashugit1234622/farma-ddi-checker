export function findSharedCypSignal(drug1: any, drug2: any) {
  const signals = [];
  
  if (drug1?.cypEnzymes && drug2?.cypEnzymes) {
    const d1Inhibits = drug1.cypEnzymes.inhibitorOf || [];
    const d2Substrate = drug2.cypEnzymes.substrateOf || [];
    
    for (const enzyme of d1Inhibits) {
      if (d2Substrate.includes(enzyme)) {
        signals.push(`${drug1.name} inhibits ${enzyme}, which metabolizes ${drug2.name}`);
      }
    }

    const d2Inhibits = drug2.cypEnzymes.inhibitorOf || [];
    const d1Substrate = drug1.cypEnzymes.substrateOf || [];

    for (const enzyme of d2Inhibits) {
      if (d1Substrate.includes(enzyme)) {
        signals.push(`${drug2.name} inhibits ${enzyme}, which metabolizes ${drug1.name}`);
      }
    }
  }

  return signals.length > 0 ? signals.join('; ') : "No shared CYP signals found deterministically.";
}
