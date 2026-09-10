export interface ServiceTemplate {
  name: string;
  category: string;
  price: number;
  priceType: 'fixed' | 'from' | 'variable';
  durationMinutes: number;
  description?: string;
}

export const INITIAL_CATEGORIES = [
  'Cortes',
  'Escovas e Finalizações',
  'Coloração',
  'Maquiagem',
  'Sobrancelhas e Depilação',
  'Manicure e Pedicure',
  'Tratamentos',
  'Higienização Especial',
  'Progressivas e Botox',
  'Penteado',
  'Mega Hair',
  'Bebidas e Drinks'
];

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  // Cortes
  { name: 'Corte feminino', category: 'Cortes', price: 200, priceType: 'fixed', durationMinutes: 60, description: 'Corte de cabelo feminino premium' },
  { name: 'Corte masculino', category: 'Cortes', price: 80, priceType: 'fixed', durationMinutes: 45, description: 'Corte de cabelo masculino premium com lavagem' },
  { name: 'Corte infantil', category: 'Cortes', price: 80, priceType: 'fixed', durationMinutes: 45, description: 'Corte de cabelo infantil' },
  { name: 'Corte de franja', category: 'Cortes', price: 40, priceType: 'fixed', durationMinutes: 30, description: 'Aparo de franja específico' },

  // Escovas e Finalizações
  { name: 'Escova P', category: 'Escovas e Finalizações', price: 70, priceType: 'from', durationMinutes: 45, description: 'Cabelos curtos' },
  { name: 'Escova premium P', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 60, description: 'Escova com tratamento de hidratação rápido em cabelos curtos' },
  { name: 'Escova M', category: 'Escovas e Finalizações', price: 80, priceType: 'from', durationMinutes: 45, description: 'Cabelos médios' },
  { name: 'Escova premium M', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 60, description: 'Escova com tratamento de hidratação rápido em cabelos médios' },
  { name: 'Escova G', category: 'Escovas e Finalizações', price: 90, priceType: 'from', durationMinutes: 65, description: 'Cabelos longos' },
  { name: 'Escova premium G', category: 'Escovas e Finalizações', price: 120, priceType: 'from', durationMinutes: 80, description: 'Escova com tratamento de hidratação rápido em cabelos longos' },
  { name: 'Escova Extralongo', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 80, description: 'Cabelos extralongos' },
  { name: 'Escova Premium Extralongo', category: 'Escovas e Finalizações', price: 140, priceType: 'from', durationMinutes: 90, description: 'Tratamento premium para cabelos extralongos' },
  { name: 'Escova com Mega Hair', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 90, description: 'Escova profissional adaptada para mega hair' },
  { name: 'Escova Premium com Mega Hair', category: 'Escovas e Finalizações', price: 170, priceType: 'from', durationMinutes: 100 },
  { name: 'Combo P', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 60 },
  { name: 'Combo M', category: 'Escovas e Finalizações', price: 140, priceType: 'from', durationMinutes: 75 },
  { name: 'Combo G', category: 'Escovas e Finalizações', price: 160, priceType: 'from', durationMinutes: 90 },
  { name: 'Combo Extralongo', category: 'Escovas e Finalizações', price: 180, priceType: 'from', durationMinutes: 100 },
  { name: 'Combo Mega Hair', category: 'Escovas e Finalizações', price: 180, priceType: 'from', durationMinutes: 100 },
  { name: 'Babyliss ou Piastra P', category: 'Escovas e Finalizações', price: 60, priceType: 'from', durationMinutes: 30 },
  { name: 'Babyliss ou Piastra M', category: 'Escovas e Finalizações', price: 80, priceType: 'from', durationMinutes: 40 },
  { name: 'Babyliss ou Piastra G', category: 'Escovas e Finalizações', price: 90, priceType: 'from', durationMinutes: 45 },
  { name: 'Babyliss ou Piastra Extralongo', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 50 },
  { name: 'Babyliss ou Piastra Mega Hair', category: 'Escovas e Finalizações', price: 120, priceType: 'from', durationMinutes: 60 },

  // Coloração
  { name: 'Coloração até 1/2 tubo', category: 'Coloração', price: 180, priceType: 'fixed', durationMinutes: 90 },
  { name: 'Coloração até 1 tubo', category: 'Coloração', price: 255, priceType: 'fixed', durationMinutes: 90 },
  { name: 'Coloração até 1 tubo e meio', category: 'Coloração', price: 370, priceType: 'fixed', durationMinutes: 105 },
  { name: 'Coloração até 2 tubos', category: 'Coloração', price: 520, priceType: 'fixed', durationMinutes: 120 },
  { name: 'Coloração Gloss até 1/2 tubo', category: 'Coloração', price: 360, priceType: 'fixed', durationMinutes: 90 },
  { name: 'Coloração Gloss até 1 tubo', category: 'Coloração', price: 500, priceType: 'fixed', durationMinutes: 100 },
  { name: 'Coloração Gloss até 1 tubo e meio', category: 'Coloração', price: 650, priceType: 'fixed', durationMinutes: 120 },
  { name: 'Matização até 1/2 tubo', category: 'Coloração', price: 160, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Matização até 1 tubo', category: 'Coloração', price: 224, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Mechas ou Iluminado', category: 'Coloração', price: 900, priceType: 'from', durationMinutes: 240, description: 'Mechas premium com plex protetor' },
  { name: 'Descoloração Masculino', category: 'Coloração', price: 350, priceType: 'from', durationMinutes: 120 },

  // Maquiagem
  { name: 'Make social', category: 'Maquiagem', price: 200, priceType: 'fixed', durationMinutes: 60, description: 'Maquiagem social de alta fixação' },
  { name: 'Make express', category: 'Maquiagem', price: 150, priceType: 'fixed', durationMinutes: 40, description: 'Maquiagem rápida e pontual' },
  { name: 'Make noiva', category: 'Maquiagem', price: 750, priceType: 'fixed', durationMinutes: 150, description: 'Produção completa de noiva com assessoria exclusiva' },

  // Sobrancelhas e Depilação
  { name: 'Brow lamination', category: 'Sobrancelhas e Depilação', price: 180, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Design de sobrancelha', category: 'Sobrancelhas e Depilação', price: 50, priceType: 'fixed', durationMinutes: 30 },
  { name: 'Design com tintura ou henna', category: 'Sobrancelhas e Depilação', price: 70, priceType: 'fixed', durationMinutes: 45 },
  { name: 'Design nutritivo', category: 'Sobrancelhas e Depilação', price: 60, priceType: 'fixed', durationMinutes: 40 },
  { name: 'Buço', category: 'Sobrancelhas e Depilação', price: 25, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Nariz', category: 'Sobrancelhas e Depilação', price: 25, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Meia face', category: 'Sobrancelhas e Depilação', price: 50, priceType: 'fixed', durationMinutes: 30 },
  { name: 'Face inteira', category: 'Sobrancelhas e Depilação', price: 70, priceType: 'fixed', durationMinutes: 45 },

  // Manicure e Pedicure
  { name: 'Manicure', category: 'Manicure e Pedicure', price: 45, priceType: 'fixed', durationMinutes: 40 },
  { name: 'Pedicure', category: 'Manicure e Pedicure', price: 45, priceType: 'fixed', durationMinutes: 45 },
  { name: 'Manicure + pedicure', category: 'Manicure e Pedicure', price: 80, priceType: 'fixed', durationMinutes: 80 },
  { name: 'Esmaltação comum', category: 'Manicure e Pedicure', price: 35, priceType: 'fixed', durationMinutes: 30 },
  { name: 'Esmaltação em gel com cutilagem', category: 'Manicure e Pedicure', price: 120, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Esmaltação em gel sem cutilagem', category: 'Manicure e Pedicure', price: 80, priceType: 'fixed', durationMinutes: 45 },
  { name: 'Retirada de esmaltação', category: 'Manicure e Pedicure', price: 50, priceType: 'fixed', durationMinutes: 30 },
  { name: 'SPA dos pés com pedicure', category: 'Manicure e Pedicure', price: 90, priceType: 'fixed', durationMinutes: 65 },
  { name: 'Detox dos pés', category: 'Manicure e Pedicure', price: 50, priceType: 'fixed', durationMinutes: 40 },
  { name: 'Unha de fibra unidade', category: 'Manicure e Pedicure', price: 20, priceType: 'fixed', durationMinutes: 30 },

  // Tratamentos
  { name: 'Protocolo Kérastase', category: 'Tratamentos', price: 350, priceType: 'fixed', durationMinutes: 60, description: 'Rituais Kérastase com fusiodose e massagem' },
  { name: 'Mask Kérastase', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Fusio Dose Kérastase', category: 'Tratamentos', price: 320, priceType: 'fixed', durationMinutes: 45 },
  { name: 'Joico K-Pak', category: 'Tratamentos', price: 350, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Joico Blonde Life', category: 'Tratamentos', price: 240, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Joico Recovery', category: 'Tratamentos', price: 240, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Wella Nutri Enrich ou Elements', category: 'Tratamentos', price: 200, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Wella Ultimate Repair', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Wella Lux Oil', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Wella Fusion', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Oil Reflection', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Sebastian Dark Oil', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 50 },
  { name: 'Sebastian Penetraitt', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Keune', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 60 },
  { name: 'R-Two', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Hidrocicatrização', category: 'Tratamentos', price: 370, priceType: 'fixed', durationMinutes: 70 },
  { name: 'Detox Mirra', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Maison Luxury', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Tratamento Express EXO ampola', category: 'Tratamentos', price: 180, priceType: 'fixed', durationMinutes: 45 },
  { name: 'Acidificação', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30 },
  { name: 'Metal Detox', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30 },
  { name: 'Liquid Hair', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30 },

  // Higienização Especial
  { name: 'Kérastase', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Joico', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Keune', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Wella', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Sebastian', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15 },
  { name: 'Higienização comum', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 10 },

  // Progressivas e Botox
  { name: 'Progressiva raiz com formol', category: 'Progressivas e Botox', price: 300, priceType: 'from', durationMinutes: 120 },
  { name: 'Progressiva cabelo inteiro com formol', category: 'Progressivas e Botox', price: 400, priceType: 'from', durationMinutes: 180 },
  { name: 'Progressiva raiz sem formol', category: 'Progressivas e Botox', price: 350, priceType: 'from', durationMinutes: 125 },
  { name: 'Progressiva cabelo inteiro sem formol', category: 'Progressivas e Botox', price: 450, priceType: 'from', durationMinutes: 180 },
  { name: 'Botox', category: 'Progressivas e Botox', price: 250, priceType: 'from', durationMinutes: 90 },
  { name: 'Progressiva ou botox masculino com formol', category: 'Progressivas e Botox', price: 100, priceType: 'from', durationMinutes: 60 },
  { name: 'Progressiva ou botox masculino sem formol', category: 'Progressivas e Botox', price: 150, priceType: 'from', durationMinutes: 90 },

  // Penteado
  { name: 'Penteado Social', category: 'Penteado', price: 220, priceType: 'fixed', durationMinutes: 60 },
  { name: 'Penteado Noiva', category: 'Penteado', price: 750, priceType: 'fixed', durationMinutes: 150 },

  // Mega Hair
  { name: 'Mega hair em faixa colocação', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 120 },
  { name: 'Mega hair adesivo colocação', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 90 },
  { name: 'Mega hair fio a fio colocação', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 180 },
  { name: 'Mega hair em faixa manutenção', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 150 },
  { name: 'Mega hair adesivo manutenção', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 120 },
  { name: 'Mega hair fio a fio manutenção', category: 'Mega Hair', price: 600, priceType: 'from', durationMinutes: 240 },
  { name: 'Retirada de mega hair', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 60 },

  // Bebidas e Drinks
  { name: 'Água com gás', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Coca-Cola', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Coca-Cola Zero', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Guaraná Antarctica', category: 'Bebidas e Drinks', price: 6, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Guaraná Antarctica Zero', category: 'Bebidas e Drinks', price: 6, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Imperio Ultra', category: 'Bebidas e Drinks', price: 12, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Budweiser', category: 'Bebidas e Drinks', price: 12, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Heineken', category: 'Bebidas e Drinks', price: 15, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Mini Chandon', category: 'Bebidas e Drinks', price: 54, priceType: 'fixed', durationMinutes: 10 },
  { name: 'Suco Del Valle Sabores', category: 'Bebidas e Drinks', price: 5, priceType: 'fixed', durationMinutes: 5 },
  { name: 'Smirnoff Ice', category: 'Bebidas e Drinks', price: 15, priceType: 'fixed', durationMinutes: 5 }
];
