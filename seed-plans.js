import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// This script expects a service account or uses the default application credentials
// which is usually available in this environment.

const app = initializeApp();
const db = getFirestore();

const plans = [
  {
    id: 'start',
    name: 'Start',
    description: 'Para salões que estão começando e precisam de gestão básica.',
    price: 197,
    billingCycle: 'MONTHLY',
    trialDays: 7,
    features: ['Até 5 profissionais', 'Agenda Integrada', 'Comandas', 'Cadastro de Clientes'],
    active: true,
    displayOrder: 1,
    color: '#3b82f6',
    maxProfessionals: 5
  },
  {
    id: 'founder',
    name: 'Founder',
    description: 'Ideal para salões em crescimento.',
    price: 297,
    billingCycle: 'MONTHLY',
    trialDays: 7,
    features: ['Até 22 profissionais', 'Todos os recursos do Start', 'Relatórios Avançados'],
    active: true,
    displayOrder: 2,
    color: '#d4af37',
    badge: 'Mais Popular',
    maxProfessionals: 22
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Para salões de alto desempenho.',
    price: 397,
    billingCycle: 'MONTHLY',
    trialDays: 7,
    features: ['Até 40 profissionais', 'Dashboard Financeiro', 'Lumi (I.A)'],
    active: true,
    displayOrder: 3,
    color: '#8b5cf6',
    maxProfessionals: 40
  },
  {
    id: 'network',
    name: 'Network',
    description: 'Para redes com múltiplas unidades.',
    price: 797,
    billingCycle: 'MONTHLY',
    trialDays: 7,
    features: ['Até 100 profissionais', 'Gestão Multi-unidade'],
    active: true,
    displayOrder: 4,
    color: '#ec4899',
    maxProfessionals: 100
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Operações em grande escala.',
    price: 1997,
    billingCycle: 'MONTHLY',
    trialDays: 0,
    features: ['Ilimitado', 'Suporte Dedicado'],
    active: true,
    displayOrder: 5,
    color: '#ef4444',
    maxProfessionals: 99999
  }
];

async function seed() {
  const batch = db.batch();
  for (const plan of plans) {
    const ref = db.collection('plans').doc(plan.id);
    batch.set(ref, {
        ...plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
  }
  await batch.commit();
  console.log('Plans seeded successfully!');
}

seed().catch(console.error);
