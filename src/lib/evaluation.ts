export function getEvaluableFunctions(professional: any): string[] {
  if (!professional) return ["Função não definida"];
  
  const mainFunctions: string[] = [];
  
  const pFunc = professional.primaryFunction || professional.professionalFunction || professional.specialty;
  if (pFunc && typeof pFunc === 'string' && pFunc.trim()) {
    mainFunctions.push(pFunc.trim());
  }
  
  const additional: string[] = [];
  if (Array.isArray(professional.additionalFunctions)) {
    professional.additionalFunctions.forEach((f: any) => {
      if (f && typeof f === 'string' && f.trim()) {
        additional.push(f.trim());
      }
    });
  }
  if (Array.isArray(professional.specialties)) {
    professional.specialties.forEach((f: any) => {
      if (f && typeof f === 'string' && f.trim()) {
        additional.push(f.trim());
      }
    });
  }
  
  const combined = [...mainFunctions, ...additional];
  const unique = combined.filter((val, index) => combined.indexOf(val) === index);
  const nonVacant = unique.filter(v => v.length > 0);
  
  if (nonVacant.length === 0) {
    return ["Função não definida"];
  }
  return nonVacant;
}

export function sanitizeFunctionSlug(func: string): string {
  if (!func) return "";
  return func
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "-") // replace non-alphanumeric with -
    .replace(/-+/g, "-") // replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // trim leading/trailing dashes
}
