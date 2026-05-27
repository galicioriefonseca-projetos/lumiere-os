import { collection, doc, writeBatch, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function createDemoSalon(adminEmail: string | undefined): Promise<{ success: boolean; message: string; salonId?: string }> {
  try {
    // 1. Check if demo salon already exists
    const salonsRef = collection(db, 'salons');
    const q = query(salonsRef, where('isDemo', '==', true), where('name', '==', 'Lumière Demo Studio'));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { success: false, message: 'Salão demo já existe. Atualize ou exclua o existente primeiro.', salonId: querySnapshot.docs[0].id };
    }

    const batch = writeBatch(db);

    // Create salon
    const salonRef = doc(salonsRef);
    const salonId = salonRef.id;
    const now = Date.now();

    // Query Leandro user to find their actual UID and batch update it
    const usersRef = collection(db, 'users');
    const userQ = query(usersRef, where('email', '==', 'leandropfonseca20@gmail.com'));
    const userSnap = await getDocs(userQ);
    let targetOwnerId = 'demo-admin-id';
    
    if (!userSnap.empty) {
      targetOwnerId = userSnap.docs[0].id;
      userSnap.forEach(uDoc => {
        batch.update(uDoc.ref, {
          salonId: salonId,
          role: 'owner',
          updatedAt: now
        });
      });
    }

    batch.set(salonRef, {
      name: 'Lumière Demo Studio',
      ownerName: 'Leandro Fonseca',
      ownerEmail: 'leandropfonseca20@gmail.com',
      ownerId: targetOwnerId,
      phone: '17996140963',
      businessType: 'salon',
      city: 'Fernandópolis',
      state: 'SP',
      plan: 'performance',
      subscriptionStatus: 'active',
      activationStatus: 'active',
      isActive: true,
      professionalsLimit: 20,
      isDemo: true, // Marker for demo
      createdAt: now,
      updatedAt: now
    });

    // 2. Professionals
    const professionalsData = [
      { name: 'Camila Rocha', role: 'manager' },
      { name: 'Bruna Almeida', role: 'receptionist' },
      { name: 'Rafaela Santos', role: 'attendant' },
      { name: 'Marina Costa', role: 'hair_stylist' },
      { name: 'Juliana Prado', role: 'colorist' },
      { name: 'Aline Ferreira', role: 'hair_stylist' },
      { name: 'Patrícia Lima', role: 'nail_designer' },
      { name: 'Vanessa Nunes', role: 'nail_designer' },
      { name: 'Daniela Martins', role: 'brow_designer' },
      { name: 'Fernanda Reis', role: 'esthetician' },
      { name: 'Bianca Moreira', role: 'makeup_artist' },
      { name: 'Larissa Campos', role: 'lash_designer' },
      { name: 'Renata Alves', role: 'assistant' },
      { name: 'Tatiane Barbosa', role: 'hair_stylist' },
      { name: 'Priscila Gomes', role: 'colorist' },
      { name: 'Michele Araújo', role: 'nail_designer' },
      { name: 'Simone Teixeira', role: 'waxing_specialist' },
      { name: 'Gabriela Mendes', role: 'sales_consultant' },
      { name: 'Elaine Duarte', role: 'cleaning' },
      { name: 'Roberta Faria', role: 'coordinator' }
    ];

    const professionalIds: string[] = [];
    
    for (const p of professionalsData) {
      const pRef = doc(collection(db, `salons/${salonId}/professionals`));
      professionalIds.push(pRef.id);
      batch.set(pRef, {
        id: pRef.id,
        name: p.name,
        role: p.role,
        phone: '11999999999',
        email: `${p.name.split(' ')[0].toLowerCase()}@lumiere.demo`,
        status: 'active',
        isActive: true,
        commissionRate: ['hair_stylist', 'nail_designer', 'colorist'].includes(p.role) ? 40 : 0,
        createdAt: now,
        updatedAt: now
      });
    }

    // 3. Categories
    const categoriesData = [
      'Cabelo', 'Coloração', 'Manicure e Nail Design', 'Estética Facial', 
      'Maquiagem', 'Sobrancelhas', 'Cílios', 'Depilação', 'Atendimento e Recepção'
    ];
    for (const c of categoriesData) {
      const cRef = doc(collection(db, `salons/${salonId}/categories`));
      batch.set(cRef, {
        id: cRef.id,
        name: c,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
    }

    // 4. Services
    const servicesData = [
      { name: 'Corte Feminino', category: 'Cabelo', price: 120, durationMinutes: 60 },
      { name: 'Escova', category: 'Cabelo', price: 80, durationMinutes: 45 },
      { name: 'Hidratação Premium', category: 'Cabelo', price: 150, durationMinutes: 60 },
      { name: 'Coloração Global', category: 'Coloração', price: 280, durationMinutes: 120 },
      { name: 'Mechas Iluminadas', category: 'Coloração', price: 450, durationMinutes: 180 },
      { name: 'Manicure', category: 'Manicure e Nail Design', price: 45, durationMinutes: 45 },
      { name: 'Pedicure', category: 'Manicure e Nail Design', price: 55, durationMinutes: 50 },
      { name: 'Alongamento em Gel', category: 'Manicure e Nail Design', price: 160, durationMinutes: 120 },
      { name: 'Design de Sobrancelhas', category: 'Sobrancelhas', price: 60, durationMinutes: 40 },
      { name: 'Lash Lifting', category: 'Cílios', price: 140, durationMinutes: 75 },
      { name: 'Maquiagem Social', category: 'Maquiagem', price: 180, durationMinutes: 90 },
      { name: 'Limpeza de Pele', category: 'Estética Facial', price: 220, durationMinutes: 90 },
      { name: 'Depilação Facial', category: 'Depilação', price: 70, durationMinutes: 40 }
    ];

    const serviceIds: string[] = [];
    for (const s of servicesData) {
      const sRef = doc(collection(db, `salons/${salonId}/services`));
      serviceIds.push(sRef.id);
      batch.set(sRef, {
        id: sRef.id,
        name: s.name,
        category: s.category,
        price: s.price,
        durationMinutes: s.durationMinutes,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
    }

    // 5. Clients
    const clientIds: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const cRef = doc(collection(db, `salons/${salonId}/clients`));
      clientIds.push(cRef.id);
      batch.set(cRef, {
        id: cRef.id,
        name: `Cliente Demo ${i}`,
        phone: `119888800${i.toString().padStart(2, '0')}`,
        email: `cliente${i}@demo.com`,
        notes: i % 3 === 0 ? 'Cliente VIP' : '',
        createdAt: now,
        updatedAt: now
      });
    }

    // 6. Appointments
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const appointmentsData = [
      { date: todayStr, time: '09:00', status: 'completed' },
      { date: todayStr, time: '10:00', status: 'completed' },
      { date: todayStr, time: '11:00', status: 'scheduled' },
      { date: todayStr, time: '13:00', status: 'scheduled' },
      { date: todayStr, time: '14:00', status: 'scheduled' },
      { date: todayStr, time: '15:30', status: 'canceled' },
      { date: tomorrowStr, time: '09:30', status: 'scheduled' },
      { date: tomorrowStr, time: '10:30', status: 'scheduled' },
      { date: tomorrowStr, time: '11:30', status: 'scheduled' },
      { date: tomorrowStr, time: '14:00', status: 'scheduled' },
      { date: tomorrowStr, time: '15:00', status: 'scheduled' },
      { date: tomorrowStr, time: '16:00', status: 'scheduled' },
    ];

    for (let i = 0; i < appointmentsData.length; i++) {
      const a = appointmentsData[i];
      const aRef = doc(collection(db, `salons/${salonId}/appointments`));
      const s = servicesData[i % servicesData.length];
      const serviceId = serviceIds[i % serviceIds.length];
      const p = professionalsData[i % professionalsData.length];
      const professionalId = professionalIds[i % professionalIds.length];
      const clientId = clientIds[i % clientIds.length];

      batch.set(aRef, {
        id: aRef.id,
        clientId: clientId,
        clientName: `Cliente Demo ${(i % 20) + 1}`,
        professionalId: professionalId,
        professionalName: p.name,
        serviceId: serviceId,
        serviceName: s.name,
        date: a.date,
        time: a.time,
        status: a.status,
        price: s.price,
        createdAt: now,
        updatedAt: now
      });
    }

    // 7. Goals
    const month = todayStr.substring(0, 7);
    const gRef = doc(collection(db, `salons/${salonId}/goals`));
    batch.set(gRef, {
      id: gRef.id,
      month: month,
      targetAmount: 85000,
      currentAmount: 32750,
      type: 'monthly_revenue',
      createdAt: now,
      updatedAt: now
    });

    // 8. Checklist Active
    const chkRef = doc(collection(db, `salons/${salonId}/checklists`));
    const categories = [
      'Apresentação Pessoal', 'Pontualidade e Organização', 'Atendimento à Cliente',
      'Qualidade do Serviço', 'Organização do Ambiente', 'Colaboração com a Equipe',
      'Responsabilidades do Dia', 'Desempenho Comercial'
    ];
    const items = categories.map((c, idx) => ({
      id: `item-${idx}`,
      label: c,
      required: true,
      category: c,
      points: 5
    }));

    batch.set(chkRef, {
      id: chkRef.id,
      title: 'Avaliação Diária do Profissional — Essenza',
      type: 'professional_daily_evaluation',
      scoringMode: 'rating_1_5',
      items: items,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    // 9. Checklist Runs
    // 8 present, 2 absent
    for (let i = 0; i < 10; i++) {
        const runRef = doc(collection(db, `salons/${salonId}/checklistRuns`));
        const p = professionalsData[i];
        const pId = professionalIds[i];
        
        const isPresent = i < 8;
        let totalScore = 0;
        const categoryScores: Record<string, number> = {};
        
        if (isPresent) {
            for (const c of categories) {
                const score = 4; // average score for demo
                categoryScores[c] = score;
                totalScore += score;
            }
        }

        batch.set(runRef, {
            id: runRef.id,
            checklistId: chkRef.id,
            checklistTitle: 'Avaliação Diária do Profissional — Essenza',
            checklistType: 'professional_daily_evaluation',
            scoringMode: 'rating_1_5',
            evaluationDate: todayStr, // Ensure we use the proper field as it may be queried
            date: todayStr, // standard in some apps
            evaluatedProfessionalId: pId,
            evaluatedProfessionalName: p.name,
            evaluatorName: 'Camila Rocha',
            attendanceStatus: isPresent ? 'present' : 'absent',
            categoryScores: isPresent ? categoryScores : {},
            totalScore: isPresent ? totalScore : 0,
            maxScore: 40,
            completionPercentage: isPresent ? (totalScore / 40) * 100 : 0,
            classification: isPresent ? 'Muito bom' : 'Falta Registrada',
            observations: isPresent ? 'Bom desempenho geral no dia.' : 'Faltou sem avisar.',
            absenceReason: !isPresent ? 'Faltou sem avisar.' : '',
            createdAt: now,
            updatedAt: now
        });
    }

    // 10. Notification
    const notifRef = doc(collection(db, `salons/${salonId}/notifications`));
    batch.set(notifRef, {
        id: notifRef.id,
        type: 'daily_checklist_pending',
        title: 'Checklist diário pendente',
        message: 'Ainda existem profissionais sem avaliação registrada hoje.',
        date: todayStr,
        targetRoles: ['owner', 'manager'],
        readBy: [],
        createdAt: now,
        metadata: {
            totalProfessionals: 20,
            evaluatedProfessionals: 10,
            pendingProfessionals: 10,
            checklistId: chkRef.id
        }
    });

    await batch.commit();
    return { success: true, message: 'Salão demo criado com sucesso!', salonId };
  } catch (error: any) {
    console.error('Error creating demo salon:', error);
    return { success: false, message: error.message || 'Erro ao criar salão demo.' };
  }
}

export async function deleteDemoSalon(salonId: string): Promise<{ success: boolean; message: string }> {
  try {
    const salonDoc = await getDocs(query(collection(db, 'salons'), where('id', '==', salonId)));
    if(salonDoc.empty) return { success: false, message: 'Salão não existe' };
    
    const salonData = salonDoc.docs[0].data();
    if (salonData.name !== 'Lumière Demo Studio' && !salonData.isDemo) {
        return { success: false, message: 'Este não é o salão Demo!' };
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, 'salons', salonId));

    // Deleting subcollections requires multiple queries, doing a "soft delete" or 
    // manually querying the most common ones is best. In Firestore Web SDK, 
    // batch deletes are limited to 500, we'll try to just delete the salon doc 
    // and let rules or admin do the rest, but to be clean, let's delete
    // the main subcollections.
    const subs = ['professionals', 'categories', 'services', 'clients', 'appointments', 'goals', 'checklists', 'checklistRuns', 'notifications'];
    for(const sub of subs) {
        const subDocs = await getDocs(collection(db, `salons/${salonId}/${sub}`));
        subDocs.forEach(d => {
            batch.delete(d.ref);
        });
    }

    await batch.commit();
    return { success: true, message: 'Salão demo apagado com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro ao apagar: ${err.message}` };
  }
}
