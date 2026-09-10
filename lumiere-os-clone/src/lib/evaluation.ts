export function getEvaluableFunctions(professional: any): string[] {
  if (!professional) return ["Função não definida"];
  
  const mainFunctions: string[] = [];
  
  const pFunc = professional.primaryFunction || professional.professionalFunction || professional.specialty;
  if (pFunc && typeof pFunc === 'string' && pFunc.trim()) {
    mainFunctions.push(pFunc.trim());
  } else if (professional.role && ["manager", "receptionist", "attendant"].includes(professional.role)) {
    const roleCapitalized = professional.role === 'manager' ? 'Gerente' : professional.role === 'receptionist' ? 'Recepcionista' : 'Atendente';
    mainFunctions.push(roleCapitalized);
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
  
  // Clean, trim, and deduplicate case-insensitively / accent-insensitively
  const uniqueList: string[] = [];
  const seenKeys = new Set<string>();
  
  combined.forEach((val) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const key = sanitizeFunctionSlug(trimmed);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueList.push(trimmed);
    }
  });
  
  if (uniqueList.length === 0) {
    return ["Função não definida"];
  }
  return uniqueList;
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
