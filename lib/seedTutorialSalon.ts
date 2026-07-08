import { collection, doc, writeBatch, setDoc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function ensureTutorialSalonForLeandro(uid: string): Promise<{ success: boolean; message: string }> {
  try {
    const salonId = 'tutorial_lumiere_studio';
    const now = Date.now();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate tomorrow and next days
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    // 1. Set/Update users/{uid} for Leandro
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    const userPayload = {
      id: uid,
      email: 'leandropfonseca20@gmail.com',
      fullName: 'Leandro Fonseca',
      role: 'owner',
      salonId: salonId,
      isActive: true,
      isDemoUser: true,
      updatedAt: now,
    };

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...userPayload,
        createdAt: now,
      });
    } else {
      await updateDoc(userRef, userPayload);
    }

    // 2. Set/Update Salons/tutorial_lumiere_studio
    const salonRef = doc(db, 'salons', salonId);
    await setDoc(salonRef, {
      id: salonId,
      name: "Lumiere Beauty Studio — Demo",
      businessName: "Lumiere Beauty Studio — Demo",
      slug: "lumiere-beauty-studio-demo",
      city: "Fernandópolis",
      state: "SP",
      phone: "17999999999",
      plan: "founder",
      subscriptionStatus: "active",
      activationStatus: "active",
      isActive: true,
      isDemo: true,
      isTutorial: true,
      ownerId: uid,
      ownerEmail: "leandropfonseca20@gmail.com",
      ownerName: "Leandro Fonseca",
      professionalsLimit: 22,
      professionalLimit: 22,
      maxProfessionals: 22,
      createdAt: now,
      updatedAt: now
    });

    const batch = writeBatch(db);

    // 3. Categories Check & Creation
    const categoriesData = [
      'Cabelo', 'Coloração', 'Manicure e Nail Design', 'Estética Facial', 
      'Maquiagem', 'Sobrancelhas', 'Cílios', 'Depilação', 'Atendimento e Recepção', 'Penteado e Carga'
    ];
    for (const c of categoriesData) {
      const cSlug = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
      const cRef = doc(db, `salons/${salonId}/categories`, `cat_${cSlug}`);
      batch.set(cRef, {
        id: `cat_${cSlug}`,
        name: c,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
    }

    // 4. Professionals
    const professionalsData = [
      {
        id: 'tutorial_maria',
        name: 'Maria Madalena',
        email: 'maria@demo.lumiereos.com',
        phone: '17998812201',
        role: 'professional',
        primaryFunction: 'Cabeleireira',
        additionalFunctions: ['Colorista', 'Penteadista'],
        specialties: ['Cabeleireira', 'Colorista', 'Penteadista']
      },
      {
        id: 'tutorial_ester',
        name: 'Ester',
        email: 'ester@demo.lumiereos.com',
        phone: '17998812202',
        role: 'professional',
        primaryFunction: 'Manicure',
        additionalFunctions: ['Pedicure', 'Nail designer'],
        specialties: ['Manicure', 'Pedicure', 'Nail designer']
      },
      {
        id: 'tutorial_debora',
        name: 'Débora',
        email: 'debora@demo.lumiereos.com',
        phone: '17998812203',
        role: 'manager',
        primaryFunction: 'Gerente',
        additionalFunctions: ['Recepcionista'],
        specialties: ['Gerente', 'Recepcionista']
      },
      {
        id: 'tutorial_rute',
        name: 'Rute',
        email: 'rute@demo.lumiereos.com',
        phone: '17998812204',
        role: 'receptionist',
        primaryFunction: 'Recepcionista',
        additionalFunctions: [],
        specialties: ['Recepcionista']
      },
      {
        id: 'tutorial_sara',
        name: 'Sara',
        email: 'sara@demo.lumiereos.com',
        phone: '17998812205',
        role: 'attendant',
        primaryFunction: 'Atendente',
        additionalFunctions: ['Auxiliar de salão'],
        specialties: ['Atendente', 'Auxiliar de salão']
      },
      {
        id: 'tutorial_abigail',
        name: 'Abigail',
        email: 'abigail@demo.lumiereos.com',
        phone: '17998812206',
        role: 'professional',
        primaryFunction: 'Maquiadora',
        additionalFunctions: ['Designer de sobrancelhas'],
        specialties: ['Maquiadora', 'Designer de sobrancelhas']
      },
      {
        id: 'tutorial_rebeca',
        name: 'Rebeca',
        email: 'rebeca@demo.lumiereos.com',
        phone: '17998812207',
        role: 'professional',
        primaryFunction: 'Lash designer',
        additionalFunctions: ['Extensionista de cílios', 'Brow lamination'],
        specialties: ['Lash designer', 'Extensionista de cílios', 'Brow lamination']
      },
      {
        id: 'tutorial_raquel',
        name: 'Raquel',
        email: 'raquel@demo.lumiereos.com',
        phone: '17998812208',
        role: 'professional',
        primaryFunction: 'Esteticista',
        additionalFunctions: ['Depiladora'],
        specialties: ['Esteticista', 'Depiladora']
      },
      {
        id: 'tutorial_ana',
        name: 'Ana',
        email: 'ana@demo.lumiereos.com',
        phone: '17998812209',
        role: 'professional',
        primaryFunction: 'Micropigmentadora',
        additionalFunctions: ['Designer de sobrancelhas'],
        specialties: ['Micropigmentadora', 'Designer de sobrancelhas']
      },
      {
        id: 'tutorial_noemi',
        name: 'Noemi',
        email: 'noemi@demo.lumiereos.com',
        phone: '17998812210',
        role: 'professional',
        primaryFunction: 'Cabeleireira',
        additionalFunctions: ['Especialista em loiro', 'Especialista em mechas'],
        specialties: ['Cabeleireira', 'Especialista em loiro', 'Especialista em mechas']
      }
    ];

    for (const p of professionalsData) {
      const pRef = doc(db, `salons/${salonId}/professionals`, p.id);
      batch.set(pRef, {
        id: p.id,
        userId: null,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        primaryFunction: p.primaryFunction,
        professionalFunction: p.primaryFunction,
        professionalCategory: p.primaryFunction,
        category: p.primaryFunction,
        specialty: p.primaryFunction,
        specialties: p.specialties,
        additionalFunctions: p.additionalFunctions,
        isActive: true,
        status: "active",
        source: "tutorial_seed",
        commissionRate: ['professional', 'manager'].includes(p.role) ? 40 : 0,
        createdAt: now,
        updatedAt: now
      });
    }

    // 5. Services
    const servicesData = [
      { id: 'tutorial_srv_corte', name: 'Corte Feminino', category: 'Cabelo', price: 130, durationMinutes: 60 },
      { id: 'tutorial_srv_escova', name: 'Escova', category: 'Cabelo', price: 90, durationMinutes: 45 },
      { id: 'tutorial_srv_mechas', name: 'Mechas', category: 'Coloração', price: 480, durationMinutes: 180 },
      { id: 'tutorial_srv_manicure', name: 'Manicure', category: 'Manicure e Nail Design', price: 50, durationMinutes: 45 },
      { id: 'tutorial_srv_pedicure', name: 'Pedicure', category: 'Manicure e Nail Design', price: 60, durationMinutes: 50 },
      { id: 'tutorial_srv_maquiagem', name: 'Maquiagem Social', category: 'Maquiagem', price: 200, durationMinutes: 90 },
      { id: 'tutorial_srv_sobrancelha', name: 'Design de Sobrancelha', category: 'Sobrancelhas', price: 70, durationMinutes: 40 },
      { id: 'tutorial_srv_lash', name: 'Lash Lifting', category: 'Cílios', price: 150, durationMinutes: 75 },
      { id: 'tutorial_srv_pele', name: 'Limpeza de Pele', category: 'Estética Facial', price: 230, durationMinutes: 90 },
      { id: 'tutorial_srv_penteado', name: 'Penteado Social', category: 'Penteado e Carga', price: 180, durationMinutes: 75 }
    ];

    for (const s of servicesData) {
      const sRef = doc(db, `salons/${salonId}/services`, s.id);
      batch.set(sRef, {
        id: s.id,
        name: s.name,
        category: s.category,
        price: s.price,
        priceType: 'fixed',
        durationMinutes: s.durationMinutes,
        isActive: true,
        source: "tutorial_seed",
        createdAt: now,
        updatedAt: now
      });
    }

    // 6. Clients
    const clientsData = [
      { id: 'tutorial_cli_helena', name: 'Helena', phone: '17991112201', email: 'helena@demo.com', notes: 'Prefere atendimento silencioso.' },
      { id: 'tutorial_cli_priscila', name: 'Priscila', phone: '17991112202', email: 'priscila@demo.com', notes: 'Cliente VIP' },
      { id: 'tutorial_cli_lidia', name: 'Lídia', phone: '17991112203', email: 'lidia@demo.com', notes: 'Gosta de produtos veganos.' },
      { id: 'tutorial_cli_miria', name: 'Miriã', phone: '17991112204', email: 'miria@demo.com', notes: '' },
      { id: 'tutorial_cli_hadassa', name: 'Hadassa', phone: '17991112205', email: 'hadassa@demo.com', notes: 'Alérgica a amônia' },
      { id: 'tutorial_cli_talita', name: 'Talita', phone: '17991112206', email: 'talita@demo.com', notes: '' },
      { id: 'tutorial_cli_betania', name: 'Betânia', phone: '17991112207', email: 'betania@demo.com', notes: 'Vem quinzenalmente.' },
      { id: 'tutorial_cli_isabel', name: 'Isabel', phone: '17991112208', email: 'isabel@demo.com', notes: 'Muito assídua.' }
    ];

    for (const cl of clientsData) {
      const clRef = doc(db, `salons/${salonId}/clients`, cl.id);
      batch.set(clRef, {
        id: cl.id,
        name: cl.name,
        phone: cl.phone,
        email: cl.email,
        notes: cl.notes,
        createdAt: now,
        updatedAt: now
      });
    }

    // 7. Appointments
    const appointmentsData = [
      { id: 'tut_appt_1', date: todayStr, time: '09:00', status: 'completed', cli: clientsData[0], srv: servicesData[0], prof: professionalsData[0] },
      { id: 'tut_appt_2', date: todayStr, time: '10:30', status: 'completed', cli: clientsData[1], srv: servicesData[1], prof: professionalsData[9] },
      { id: 'tut_appt_3', date: todayStr, time: '13:00', status: 'scheduled', cli: clientsData[2], srv: servicesData[3], prof: professionalsData[1] },
      { id: 'tut_appt_4', date: todayStr, time: '14:30', status: 'scheduled', cli: clientsData[3], srv: servicesData[6], prof: professionalsData[5] },
      { id: 'tut_appt_5', date: todayStr, time: '16:00', status: 'scheduled', cli: clientsData[4], srv: servicesData[7], prof: professionalsData[6] },
      { id: 'tut_appt_6', date: todayStr, time: '17:30', status: 'canceled', cli: clientsData[5], srv: servicesData[8], prof: professionalsData[7] },
      
      { id: 'tut_appt_7', date: tomorrowStr, time: '09:00', status: 'scheduled', cli: clientsData[6], srv: servicesData[0], prof: professionalsData[0] },
      { id: 'tut_appt_8', date: tomorrowStr, time: '10:30', status: 'scheduled', cli: clientsData[7], srv: servicesData[2], prof: professionalsData[0] },
      { id: 'tut_appt_9', date: tomorrowStr, time: '13:30', status: 'scheduled', cli: clientsData[0], srv: servicesData[4], prof: professionalsData[1] },
      { id: 'tut_appt_10', date: tomorrowStr, time: '15:00', status: 'scheduled', cli: clientsData[1], srv: servicesData[5], prof: professionalsData[5] },
      
      { id: 'tut_appt_11', date: dayAfterStr, time: '10:00', status: 'scheduled', cli: clientsData[2], srv: servicesData[1], prof: professionalsData[9] },
      { id: 'tut_appt_12', date: dayAfterStr, time: '14:00', status: 'scheduled', cli: clientsData[3], srv: servicesData[8], prof: professionalsData[7] },
    ];

    for (const a of appointmentsData) {
      const aRef = doc(db, `salons/${salonId}/appointments`, a.id);
      batch.set(aRef, {
        id: a.id,
        clientId: a.cli.id,
        clientName: a.cli.name,
        professionalId: a.prof.id,
        professionalName: a.prof.name,
        serviceId: a.srv.id,
        serviceName: a.srv.name,
        date: a.date,
        time: a.time,
        status: a.status,
        price: a.srv.price,
        createdAt: now,
        updatedAt: now
      });
    }

    // 8. Goals (Metas)
    const currentMonthStr = todayStr.substring(0, 7);
    const gRef = doc(db, `salons/${salonId}/goals`, 'tutorial_goal_current');
    batch.set(gRef, {
      id: 'tutorial_goal_current',
      month: currentMonthStr,
      targetAmount: 90000,
      currentAmount: 41200,
      type: 'monthly_revenue',
      createdAt: now,
      updatedAt: now
    });

    // 9. Checklist Base Title (Operacional)
    const chkRef = doc(db, `salons/${salonId}/checklists`, 'tutorial_checklist_operacional');
    const checklistCategories = [
      'Apresentação Pessoal', 'Pontualidade e Organização', 'Atendimento à Cliente',
      'Qualidade do Serviço', 'Organização do Ambiente', 'Colaboração com a Equipe',
      'Responsabilidades do Dia', 'Desempenho Comercial'
    ];
    const checklistItems = checklistCategories.map((c, idx) => ({
      id: `tut_it_${idx}`,
      label: c,
      required: true,
      category: c,
      points: 5
    }));

    batch.set(chkRef, {
      id: 'tutorial_checklist_operacional',
      title: 'Avaliação Diária do Profissional — Operacional',
      type: 'professional_daily_evaluation',
      scoringMode: 'rating_1_5',
      items: checklistItems,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    // 10. Checklist Runs (Avaliações dos profissionais no dia de hoje)
    // 8 present, 2 absent
    for (let i = 0; i < professionalsData.length; i++) {
      const p = professionalsData[i];
      const runRef = doc(db, `salons/${salonId}/checklistRuns`, `tutorial_run_${p.id}`);
      
      const isPresent = i < 8; // First 8 present, last 2 absent
      let totalScore = 0;
      const categoryScores: Record<string, number> = {};
      
      if (isPresent) {
        for (const c of checklistCategories) {
          const score = i % 2 === 0 ? 5 : 4; // Give nice realistic score distribution
          categoryScores[c] = score;
          totalScore += score;
        }
      }

      batch.set(runRef, {
        id: `tutorial_run_${p.id}`,
        checklistId: 'tutorial_checklist_operacional',
        checklistTitle: 'Avaliação Diária do Profissional — Operacional',
        checklistType: 'professional_daily_evaluation',
        scoringMode: 'rating_1_5',
        evaluationDate: todayStr,
        date: todayStr,
        evaluatedProfessionalId: p.id,
        evaluatedProfessionalName: p.name,
        evaluatorName: 'Débora',
        attendanceStatus: isPresent ? 'present' : 'absent',
        categoryScores: isPresent ? categoryScores : {},
        totalScore: isPresent ? totalScore : 0,
        maxScore: 40,
        completionPercentage: isPresent ? (totalScore / 40) * 100 : 0,
        classification: isPresent ? (i % 2 === 0 ? 'Excelente' : 'Muito bom') : 'Falta Registrada',
        observations: isPresent ? 'Excelente desempenho e cuidado com os clientes.' : 'Faltou com justificativa médica registrada.',
        absenceReason: !isPresent ? 'Atestado médico' : '',
        createdAt: now,
        updatedAt: now
      });
    }

    // 11. Custom Notification for the dashboard
    const notifRef = doc(db, `salons/${salonId}/notifications`, 'tutorial_notification_daily');
    batch.set(notifRef, {
      id: 'tutorial_notification_daily',
      type: 'daily_checklist_pending',
      title: 'Checklist diário finalizado',
      message: 'Todos os profissionais foram avaliados no dia de hoje com sucesso.',
      date: todayStr,
      targetRoles: ['owner', 'manager'],
      readBy: [],
      createdAt: now,
      metadata: {
        totalProfessionals: professionalsData.length,
        evaluatedProfessionals: professionalsData.length,
        pendingProfessionals: 0,
        checklistId: 'tutorial_checklist_operacional'
      }
    });

    await batch.commit();
    console.log("[ensureTutorialSalonForLeandro] Seeding of tutorial salão completed successfully!");
    return { success: true, message: 'Salão tutorial/demo garantido com sucesso!' };
  } catch (error: any) {
    console.error('[ensureTutorialSalonForLeandro] Error:', error);
    return { success: false, message: error.message || 'Erro ao sintonizar salão tutorial.' };
  }
}
