export const BEAUTY_SPECIALTIES = [
  "Cabeleireira",
  "Cabeleireiro",
  "Colorista",
  "Especialista em mechas",
  "Especialista em loiro",
  "Especialista em corte",
  "Escovista",
  "Penteadista",
  "Manicure",
  "Pedicure",
  "Nail designer",
  "Designer de unhas",
  "Alongamento de unhas",
  "Designer de sobrancelhas",
  "Brow lamination",
  "Micropigmentadora",
  "Maquiadora",
  "Lash designer",
  "Extensionista de cílios",
  "Depiladora",
  "Esteticista",
  "Massoterapeuta",
  "Terapeuta capilar",
  "Barbeiro",
  "Auxiliar de salão"
];

export const AGENCY_SPECIALTIES = [
  "Gestor de Tráfego Pago (Meta & Google)",
  "Social Media / Gestor de Conteúdo",
  "Designer Gráfico / Web Designer",
  "Desenvolvedor de Landing Pages & Sites",
  "Especialista em Google Meu Negócio / SEO Local",
  "Especialista em WhatsApp Business & Automações",
  "Consultor de Gestão Empresarial",
  "Copywriter / Redator Publicitário",
  "Videomaker / Editor de Vídeo",
  "Gerente de Contas / Customer Success",
  "Executivo de Vendas / Comercial"
];

export const CONSULTING_SPECIALTIES = [
  "Consultor Empresarial & Estratégico",
  "Consultor Financeiro & Precificação",
  "Mentor Executivo / Coach de Liderança",
  "Auditor de Processos & Qualidade",
  "Assessor de Negócios"
];

export const HEALTH_SPECIALTIES = [
  "Médico(a) / Clínico",
  "Nutricionista",
  "Psicólogo(a) / Terapeuta",
  "Fisioterapeuta",
  "Dentista / Odontologista",
  "Fonoaudiólogo(a)",
  "Biomédico(a) Esteta"
];

export const SERVICES_SPECIALTIES = [
  "Arquiteto(a) / Designer de Interiores",
  "Fotógrafo(a) / Filmmaker",
  "Tatuador(a) / Body Piercer",
  "Técnico Especialista / Assistência",
  "Consultor Especialista",
  "Profissional Liberal"
];

export const professionalSpecialties = [
  ...AGENCY_SPECIALTIES,
  ...CONSULTING_SPECIALTIES,
  ...BEAUTY_SPECIALTIES,
  ...HEALTH_SPECIALTIES,
  ...SERVICES_SPECIALTIES,
  "Outro"
];

export const PROFESSIONAL_SPECIALTIES = professionalSpecialties;

export const SPECIALTIES_BY_SEGMENT: Record<string, string[]> = {
  beauty: [...BEAUTY_SPECIALTIES, "Outro"],
  agency: [...AGENCY_SPECIALTIES, "Outro"],
  consulting: [...CONSULTING_SPECIALTIES, "Outro"],
  health: [...HEALTH_SPECIALTIES, "Outro"],
  services: [...SERVICES_SPECIALTIES, "Outro"]
};

export function getSpecialtiesForSegment(segment?: string): string[] {
  if (!segment || !SPECIALTIES_BY_SEGMENT[segment]) {
    return PROFESSIONAL_SPECIALTIES;
  }
  return SPECIALTIES_BY_SEGMENT[segment];
}
