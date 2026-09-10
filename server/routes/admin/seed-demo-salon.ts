import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../firebaseAdmin.js';
import { resolvePlatformAdmin, verifyIdToken } from '../../shared/auth.js';

const DEMO_PREFIX = 'demo_lumiere_beauty_';

const names = [
  'Camila Rocha','Bruna Almeida','Marina Costa','Juliana Prado','Aline Ferreira',
  'Patrícia Lima','Vanessa Nunes','Daniela Martins','Fernanda Reis','Bianca Moreira',
  'Larissa Campos','Tatiane Barbosa','Priscila Gomes','Michele Araújo','Simone Teixeira',
  'Gabriela Mendes','Roberta Faria','Natália Martins','Carolina Alves','Isabela Freitas'
];
const clientNames = [
  'Helena Martins','Priscila Andrade','Lívia Carvalho','Mariana Souza','Beatriz Lima',
  'Camila Oliveira','Renata Ribeiro','Isabela Santos','Juliana Mendes','Fernanda Costa',
  'Larissa Almeida','Amanda Rocha','Carolina Dias','Natália Ferreira','Bruna Martins',
  'Patrícia Gomes','Débora Alves','Aline Barbosa','Marina Teixeira','Gabriela Duarte',
  'Sofia Nunes','Valentina Castro','Manuela Reis','Clara Moreira','Luiza Campos',
  'Rafaela Prado','Melissa Araújo','Isadora Faria','Alice Mendes','Vitória Martins'
];
const services = [
  ['Corte Feminino','Cabelo',130,60],['Escova Premium','Cabelo',90,45],['Hidratação Reconstrutora','Cabelo',160,60],
  ['Coloração Global','Coloração',290,120],['Mechas Iluminadas','Coloração',490,180],['Morena Iluminada','Coloração',520,210],
  ['Manicure','Unhas',55,45],['Pedicure','Unhas',65,50],['Alongamento em Gel','Unhas',180,120],
  ['Design de Sobrancelhas','Sobrancelhas',70,40],['Brow Lamination','Sobrancelhas',150,60],['Lash Lifting','Cílios',160,75],
  ['Extensão de Cílios','Cílios',220,120],['Maquiagem Social','Maquiagem',220,90],['Limpeza de Pele','Estética',240,90],
  ['Peeling Facial','Estética',280,75],['Depilação Facial','Depilação',75,40],['Penteado Social','Penteado',210,90]
];

function tsDate(daysAgo: number) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0,10);
}
function futureDate(daysAhead: number) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead); return d.toISOString().slice(0,10);
}

async function seedExistingSalon(salonId: string) {
  const db = getAdminDb();
  const salonRef = db.collection('salons').doc(salonId);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) throw new Error('Salão não encontrado.');
  const salon = salonSnap.data() || {};
  if (!/lumiere beauty/i.test(String(salon.name || salon.businessName || ''))) {
    throw new Error('A proteção de segurança impede preencher um salão que não seja Lumiere Beauty.');
  }

  const now = Date.now();
  const batch = db.batch();
  let writes = 0;
  const set = (path: string, data: any) => { batch.set(db.doc(path), { ...data, demoData: true, demoSeedVersion: 1, updatedAt: now }, { merge: true }); writes++; };

  set(`salons/${salonId}`, {
    businessName: salon.businessName || 'Lumiere Beauty Studio',
    name: salon.name || 'Lumiere Beauty Studio',
    businessType: 'salon', city: 'Fernandópolis', state: 'SP', country: 'Brasil',
    description: 'Studio de beleza completo para cabelos, unhas, estética e produção.',
    phone: salon.phone || '(17) 99700-0000',
    email: salon.email || 'contato@lumierebeauty.demo',
    website: 'https://lumiere-os.vercel.app',
    plan: salon.plan || 'performance', subscriptionStatus: 'active', activationStatus: 'active', isActive: true,
    isDemo: true, demoData: true, demoLabel: 'Conta de demonstração — dados fictícios', professionalsLimit: 30
  });

  const roles = ['manager','receptionist','attendant','hair_stylist','colorist','hair_stylist','nail_designer','nail_designer','brow_designer','esthetician','makeup_artist','lash_designer','assistant','hair_stylist','colorist','nail_designer','waxing_specialist','sales_consultant','coordinator','professional'];
  const professionalIds: string[] = [];
  for (let i=0;i<names.length;i++) {
    const id = `${DEMO_PREFIX}professional_${i+1}`; professionalIds.push(id);
    set(`salons/${salonId}/professionals/${id}`, {
      id, name: names[i], role: roles[i], primaryFunction: roles[i], professionalFunction: roles[i],
      phone: `(17) 99${String(700000+i).slice(-6)}`, email: `${names[i].toLowerCase().replace(/[^a-z]+/g,'_')}@lumierebeauty.demo`,
      status:'active', isActive:true, commissionRate:['hair_stylist','colorist','nail_designer','esthetician','makeup_artist','lash_designer'].includes(roles[i]) ? 40 : 0,
      specialties:[roles[i]], hireDate:tsDate(1200-i*20)
    });
  }

  const categoryNames = ['Cabelo','Coloração','Unhas','Sobrancelhas','Cílios','Estética','Maquiagem','Depilação','Penteado','Atendimento'];
  for (let i=0;i<categoryNames.length;i++) set(`salons/${salonId}/categories/${DEMO_PREFIX}category_${i+1}`, { id:`${DEMO_PREFIX}category_${i+1}`, name:categoryNames[i], isActive:true });

  const serviceIds: string[] = [];
  for (let i=0;i<services.length;i++) {
    const [name, category, price, durationMinutes] = services[i]; const id=`${DEMO_PREFIX}service_${i+1}`; serviceIds.push(id);
    set(`salons/${salonId}/services/${id}`, { id,name,category,price,durationMinutes,priceType:'fixed',isActive:true });
  }

  const clientIds: string[] = [];
  for (let i=0;i<clientNames.length;i++) {
    const id=`${DEMO_PREFIX}client_${i+1}`; clientIds.push(id);
    set(`salons/${salonId}/clients/${id}`, {
      id,name:clientNames[i],phone:`(17) 99${String(800000+i).slice(-6)}`,email:`cliente${i+1}@lumierebeauty.demo`,
      notes:i%5===0?'Cliente VIP — atendimento prioritário.':i%3===0?'Prefere horários no período da tarde.':'',
      status:'active', isActive:true, tags:i%5===0?['VIP','Frequente']:['Ativa'], totalVisits:8+i%12,totalSpent:900+(i*137),lastVisit:tsDate(i%18)
    });
    for (let h=0;h<3;h++) set(`salons/${salonId}/clients/${id}/history/${DEMO_PREFIX}history_${i+1}_${h+1}`, {
      id:`${DEMO_PREFIX}history_${i+1}_${h+1}`,type:'appointment',description:`Atendimento de demonstração — ${services[(i+h)%services.length][0]}`,
      date:tsDate((i+h)*7),serviceName:services[(i+h)%services.length][0],professionalName:names[(i+h)%names.length],amount:Number(services[(i+h)%services.length][2])
    });
  }

  const statuses=['completed','completed','completed','scheduled','scheduled','canceled','no_show'];
  for (let i=0;i<70;i++) {
    const id=`${DEMO_PREFIX}appointment_${i+1}`; const serviceIndex=i%services.length; const clientIndex=i%clientNames.length; const profIndex=(i*3)%names.length;
    const status=i<35 ? statuses[i%3] : statuses[3+i%4];
    const date=i<35?tsDate(i%30):futureDate(i%21+1); const price=Number(services[serviceIndex][2]);
    set(`salons/${salonId}/appointments/${id}`, {
      id,clientId:clientIds[clientIndex],clientName:clientNames[clientIndex],professionalId:professionalIds[profIndex],professionalName:names[profIndex],
      serviceId:serviceIds[serviceIndex],serviceName:services[serviceIndex][0],date,time:`${String(9+(i%9)).padStart(2,'0')}:${i%2?'30':'00'}`,
      status,price,notes:i%10===0?'Cliente solicitou atenção especial.',createdAt:now,updatedAt:now
    });
  }

  const revenueCats=['Serviços','Serviços','Revenda de Produtos','Clube de Assinatura','Outros'];
  const expenseCats=['Materiais e Produtos','Comissões','Aluguel & Contas','Marketing','Salários'];
  for(let i=0;i<80;i++){
    const revenue=i%3!==0; const amount=revenue?(180+(i%9)*73):(95+(i%7)*121);
    set(`salons/${salonId}/financialTransactions/${DEMO_PREFIX}transaction_${i+1}`,{
      id:`${DEMO_PREFIX}transaction_${i+1}`,description:revenue?`Atendimento ${services[i%services.length][0]}`:`Despesa operacional ${i+1}`,
      amount,type:revenue?'revenue':'expense',category:revenue?revenueCats[i%revenueCats.length]:expenseCats[i%expenseCats.length],date:tsDate(i%45),
      paymentMethod:['Pix','Cartão de Crédito','Cartão de Débito','Dinheiro'][i%4],createdAt:now
    });
  }

  for(let i=0;i<18;i++) set(`salons/${salonId}/inventory/${DEMO_PREFIX}inventory_${i+1}`,{
    id:`${DEMO_PREFIX}inventory_${i+1}`,name:['Shampoo Premium','Máscara Reconstrutora','Protetor Térmico','Tintura 6.0','Oxidante 20 Vol','Pó Descolorante','Esmalte Nude','Gel Construtor','Removedor','Sérum Facial','Protetor Solar','Hidratante Facial','Algodão','Luvas','Toucas','Cera Depilatória','Fita Micropore','Lâminas'][i],
    brand:['Lumière Professional','Bella Care','Studio Pro'][i%3],sku:`LUM-DEMO-${String(i+1).padStart(3,'0')}`,category:i<6?'Cabelo':i<9?'Unhas':'Estética',quantity:4+(i%15),minQuantity:3,costPrice:25+(i*4),sellingPrice:45+(i*7),supplier:'Fornecedor Demo Beauty'
  });

  const month=new Date().toISOString().slice(0,7);
  set(`salons/${salonId}/goals/${DEMO_PREFIX}monthly_goal`,{id:`${DEMO_PREFIX}monthly_goal`,month,targetAmount:85000,currentAmount:53780,type:'monthly_revenue',progress:63.27});
  for(let i=0;i<12;i++) set(`salons/${salonId}/professionalGoals/${DEMO_PREFIX}goal_${i+1}`,{
    id:`${DEMO_PREFIX}goal_${i+1}`,professionalId:professionalIds[i],professionalName:names[i],month,targetAmount:5000+(i%4)*1000,currentValue:3200+(i%7)*700,goalXPAwardedAt:now-100000
  });

  const checklistId=`${DEMO_PREFIX}checklist_daily`;
  set(`salons/${salonId}/checklists/${checklistId}`,{id:checklistId,title:'Avaliação Diária do Profissional — Demonstração',type:'professional_daily_evaluation',scoringMode:'rating_1_5',isActive:true,items:['Apresentação Pessoal','Pontualidade e Organização','Atendimento à Cliente','Qualidade do Serviço','Organização do Ambiente','Colaboração com a Equipe','Desempenho Comercial'].map((label,i)=>({id:`item-${i}`,label,required:true,points:5}))});
  for(let i=0;i<20;i++) set(`salons/${salonId}/checklistRuns/${DEMO_PREFIX}run_${i+1}`,{
    id:`${DEMO_PREFIX}run_${i+1}`,checklistId,checklistTitle:'Avaliação Diária do Profissional — Demonstração',evaluationDate:tsDate(i%10),date:tsDate(i%10),evaluatedProfessionalId:professionalIds[i],evaluatedProfessionalName:names[i],evaluatorName:'Camila Rocha',attendanceStatus:i%9===0?'absent':'present',totalScore:i%9===0?0:30+(i%5)*2,maxScore:35,completionPercentage:i%9===0?0:86,classification:i%9===0?'Falta Registrada':'Muito bom',observations:'Registro fictício para demonstração.'
  });

  for(let i=0;i<20;i++) set(`salons/${salonId}/gamification/${professionalIds[i]}`,{
    professionalId:professionalIds[i],professionalName:names[i],totalXP:850+(i*137)%1600,monthlyXP:220+(i*71)%700,level:3+(i%5),currentStreak:2+(i%9),bestStreak:7+(i%12),lastActiveDate:tsDate(i%4),badges:i%4===0?[{id:'prod_bronze',name:'Produtor Bronze',icon:'🏅',description:'Meta atingida',earnedAt:now-100000,category:'production'}]:[]
  });

  for(let i=0;i<8;i++) set(`salons/${salonId}/notifications/${DEMO_PREFIX}notification_${i+1}`,{
    id:`${DEMO_PREFIX}notification_${i+1}`,type:['daily_checklist_pending','goal_progress','inventory_low','appointment_reminder'][i%4],title:['Checklist diário pendente','Meta mensal em andamento','Estoque próximo do mínimo','Agenda com próximos atendimentos'][i%4],message:'Notificação fictícia criada para demonstração.',date:tsDate(i),targetRoles:['owner','manager'],readBy:[],metadata:{demo:true}
  });

  for(let i=0;i<10;i++) set(`salons/${salonId}/auditLogs/${DEMO_PREFIX}audit_${i+1}`,{
    id:`${DEMO_PREFIX}audit_${i+1}`,salonId,userId:'demo-system',userName:'Sistema Demo',userEmail:'sistema@lumierebeauty.demo',userRole:'owner',action:'demo_seed',targetEntity:'demo',targetId:`${DEMO_PREFIX}audit_${i+1}`,description:'Registro fictício de atividade para demonstração.',details:{source:'demo-seed'}
  });

  if (writes > 0) await batch.commit();
  return { writes };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });
  try {
    const user = await verifyIdToken(req);
    const db = getAdminDb();
    if (!(await resolvePlatformAdmin(user, db))) return res.status(403).json({ success:false, error:'Apenas Platform Admin pode executar o preenchimento demo.' });
    const salonId = String(req.body?.salonId || '').trim();
    if (!salonId) return res.status(400).json({ success:false, error:'salonId é obrigatório.' });
    const result = await seedExistingSalon(salonId);
    return res.status(200).json({ success:true, salonId, ...result, message:`Dados fictícios preenchidos com sucesso (${result.writes} registros).` });
  } catch (error:any) {
    console.error('[DEMO SEED]', error);
    return res.status(500).json({ success:false, error:error?.message || 'Erro ao preencher a conta demo.' });
  }
}
