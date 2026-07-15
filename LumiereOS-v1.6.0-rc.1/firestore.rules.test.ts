import { initializeTestEnvironment, RulesTestEnvironment, TokenOptions } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';

describe('LumièreOS Firestore Rules Tests', () => {
  let testEnv: RulesTestEnvironment;
  const salonId = 'test_salon_123';
  const receptionistUid = 'user_receptionist_456';
  const professionalUid = 'user_professional_789';

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: 'lumiereos-11a95',
        firestore: {
          rules: readFileSync('firestore.rules', 'utf8'),
          // Support either local host/port or fallback configuration
          host: '127.0.0.1',
          port: 8080,
        }
      });
    } catch (error: any) {
      console.error('\n❌ ERRO: Não foi possível inicializar o ambiente de testes do Firestore Emulator.');
      console.error('Causa provável: O Firestore Emulator não está ativo ou o Java Runtime Environment (JRE) não está instalado no ambiente de execução.');
      console.error('Para rodar os testes localmente com o emulator:');
      console.error('1. Garanta que o Java (JRE 8+) esteja instalado.');
      console.error('2. Execute: npm run test:rules\n');
      throw new Error(`[Emulator Offline / JRE Missing] ${error?.message || error}`);
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('permite que recepcionista (receptionist) leia e grave checklistRuns', async () => {
    // 1. Setup mock user database profile
    const setupEnv = testEnv.unauthenticatedContext();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Setup the receptionist user profile in root users
      await setDoc(doc(db, 'users', receptionistUid), {
        fullName: 'Amanda Recepcionista',
        email: 'amanda@salao.com',
        role: 'receptionist',
        salonId: salonId,
        isActive: true,
        createdAt: Date.now()
      });
    });

    // 2. Perform actions as receptionist
    const receptionistContext = testEnv.authenticatedContext(receptionistUid, {
      uid: receptionistUid,
      email: 'amanda@salao.com',
      email_verified: true
    } as any);
    
    const db = receptionistContext.firestore();
    const runRef = doc(db, `salons/${salonId}/checklistRuns/run_today`);

    // Receptionist creates a checklistRun
    await expect(
      setDoc(runRef, {
        checklistId: 'standard_checklist_1',
        date: '2026-06-18',
        completedItems: ['item_1', 'item_2'],
        completionPercentage: 100,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    ).resolves.not.toThrow();

    // Receptionist reads a checklistRun
    await expect(getDoc(runRef)).resolves.toBeDefined();
  });

  it('NÃO permite que recepcionista (receptionist) edite taxa de comissão de profissionais', async () => {
    // 1. Setup mock user profiles
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Receptionist profile
      await setDoc(doc(db, 'users', receptionistUid), {
        fullName: 'Amanda Recepcionista',
        email: 'amanda@salao.com',
        role: 'receptionist',
        salonId: salonId,
        isActive: true
      });
      // Professional profile
      await setDoc(doc(db, `salons/${salonId}/professionals/${professionalUid}`), {
        id: professionalUid,
        name: 'Carlos Cabelos',
        role: 'professional',
        isActive: true,
        commissionRate: 30
      });
    });

    // 2. Try to edit as receptionist
    const receptionistContext = testEnv.authenticatedContext(receptionistUid, {
      uid: receptionistUid,
      email: 'amanda@salao.com',
      email_verified: true
    } as any);

    const db = receptionistContext.firestore();
    const profRef = doc(db, `salons/${salonId}/professionals/${professionalUid}`);

    // Receptionist tries to edit professional's commission rate -> MUST be blocked
    await expect(
      updateDoc(profRef, {
        commissionRate: 50
      })
    ).rejects.toThrow();
  });

  it('NÃO permite que um profissional edite a sua própria taxa de comissão', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Professional user doc in root users
      await setDoc(doc(db, 'users', professionalUid), {
        fullName: 'Carlos Cabelos',
        email: 'carlos@salao.com',
        role: 'professional',
        salonId: salonId,
        isActive: true
      });
      // Professional doc in subcollection
      await setDoc(doc(db, `salons/${salonId}/professionals/${professionalUid}`), {
        id: professionalUid,
        name: 'Carlos Cabelos',
        role: 'professional',
        isActive: true,
        commissionRate: 30,
        userId: professionalUid,
        professionalId: professionalUid
      });
    });

    const professionalContext = testEnv.authenticatedContext(professionalUid, {
      uid: professionalUid,
      email: 'carlos@salao.com',
      email_verified: true
    } as any);

    const db = professionalContext.firestore();
    const profRef = doc(db, `salons/${salonId}/professionals/${professionalUid}`);

    // Professional tries to edit their own commission rate -> MUST be blocked
    await expect(
      updateDoc(profRef, {
        commissionRate: 50
      })
    ).rejects.toThrow();
  });

  it('garante que apenas Platform Admins conseguem ler ou listar a coleção authAuditLogs', async () => {
    // Grava um log com privilégios desativados para o teste de leitura
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'authAuditLogs', 'test_log_1'), {
        id: 'test_log_1',
        userIdentifier: 'user_comum',
        action: 'login',
        createdAt: Date.now()
      });
    });

    // 1. Usuário comum tenta ler -> Bloqueado
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();
    await expect(getDoc(doc(dbUser, 'authAuditLogs', 'test_log_1'))).rejects.toThrow();

    // 2. Platform Admin tenta ler -> Permitido
    const adminContext = testEnv.authenticatedContext('admin_uid', {
      uid: 'admin_uid',
      email: 'admin@salao.com',
      role: 'platform_admin'
    } as any);
    const dbAdmin = adminContext.firestore();
    await expect(getDoc(doc(dbAdmin, 'authAuditLogs', 'test_log_1'))).resolves.toBeDefined();
  });

  it('permite que usuário comum grave seu próprio log com userIdentifier correspondente e sem campos restritos', async () => {
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    // Gravação válida com UID
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_uid_valid'), {
        userIdentifier: 'user_comum',
        action: 'login',
        createdAt: Date.now()
      })
    ).resolves.not.toThrow();

    // Gravação válida com Email
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_email_valid'), {
        userIdentifier: 'user@salao.com',
        action: 'login',
        createdAt: Date.now()
      })
    ).resolves.not.toThrow();

    // Gravação inválida com userIdentifier divergente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_invalid_id'), {
        userIdentifier: 'outro_usuario',
        action: 'login',
        createdAt: Date.now()
      })
    ).rejects.toThrow();
  });

  it('NÃO permite que usuário comum grave log contendo campos restritos (role, salonId, privileges, admin, platform_admin)', async () => {
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    // Campo 'role' presente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_with_role'), {
        userIdentifier: 'user_comum',
        action: 'login',
        role: 'platform_admin',
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // Campo 'salonId' presente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_with_salonId'), {
        userIdentifier: 'user_comum',
        action: 'login',
        salonId: 'some_salon',
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // Campo 'privileges' presente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_with_privileges'), {
        userIdentifier: 'user_comum',
        action: 'login',
        privileges: 'all',
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // Campo 'admin' presente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_with_admin'), {
        userIdentifier: 'user_comum',
        action: 'login',
        admin: true,
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // Campo 'platform_admin' presente -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_with_plat'), {
        userIdentifier: 'user_comum',
        action: 'login',
        platform_admin: true,
        createdAt: Date.now()
      })
    ).rejects.toThrow();
  });

  it('NÃO permite atualizar um log existente após sua criação (imutabilidade)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'authAuditLogs', 'immutable_log_99'), {
        userIdentifier: 'user_comum',
        action: 'login',
        createdAt: Date.now()
      });
    });

    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    await expect(
      updateDoc(doc(dbUser, 'authAuditLogs', 'immutable_log_99'), {
        action: 'malicious_update'
      })
    ).rejects.toThrow();
  });

  it('valida os tipos de dados estritamente em authAuditLogs (createdAt como int, userIdentifier e action como string)', async () => {
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    // createdAt como string -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_invalid_createdAt_type'), {
        userIdentifier: 'user_comum',
        action: 'login',
        createdAt: '2026-06-18'
      })
    ).rejects.toThrow();

    // action como boolean -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_invalid_action_type'), {
        userIdentifier: 'user_comum',
        action: true,
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // userIdentifier como array -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_invalid_user_type'), {
        userIdentifier: ['user_comum'],
        action: 'login',
        createdAt: Date.now()
      })
    ).rejects.toThrow();
  });

  it('reconhece Platform Admin globalmente via custom claims, users/uid.role ou platformAdmins/uid', async () => {
    // 1. Setup platformAdmins/admin_doc e users/admin_user_role
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'platformAdmins', 'admin_by_doc'), { active: true });
      await setDoc(doc(db, 'users', 'admin_by_user_role'), { role: 'platform_admin' });
    });

    // A. Platform Admin via Custom Claim -> Pode ler qualquer coisa (ex: salons/qualquer)
    const contextClaim = testEnv.authenticatedContext('claim_admin', {
      uid: 'claim_admin',
      role: 'platform_admin'
    } as any);
    await expect(getDoc(doc(contextClaim.firestore(), 'salons/qualquer'))).resolves.toBeDefined();

    // B. Platform Admin via platformAdmins/{uid} -> Pode ler qualquer coisa
    const contextDoc = testEnv.authenticatedContext('admin_by_doc', {
      uid: 'admin_by_doc'
    } as any);
    await expect(getDoc(doc(contextDoc.firestore(), 'salons/qualquer'))).resolves.toBeDefined();

    // C. Platform Admin via users/{uid}.role === 'platform_admin' -> Pode ler qualquer coisa
    const contextUserRole = testEnv.authenticatedContext('admin_by_user_role', {
      uid: 'admin_by_user_role'
    } as any);
    await expect(getDoc(doc(contextUserRole.firestore(), 'salons/qualquer'))).resolves.toBeDefined();
  });

  it('garante que a claim admin=true NÃO concede Platform Admin', async () => {
    const contextAdminClaim = testEnv.authenticatedContext('admin_claim_user', {
      uid: 'admin_claim_user',
      admin: true
    } as any);
    await expect(getDoc(doc(contextAdminClaim.firestore(), 'salons/qualquer'))).rejects.toThrow();
  });

  it('garante que role=platform_admin continua concedendo Platform Admin', async () => {
    const contextRoleClaim = testEnv.authenticatedContext('role_claim_user', {
      uid: 'role_claim_user',
      role: 'platform_admin'
    } as any);
    await expect(getDoc(doc(contextRoleClaim.firestore(), 'salons/qualquer'))).resolves.toBeDefined();
  });

  it('garante que platform_admin=true continua concedendo Platform Admin', async () => {
    const contextPlatClaim = testEnv.authenticatedContext('plat_claim_user', {
      uid: 'plat_claim_user',
      platform_admin: true
    } as any);
    await expect(getDoc(doc(contextPlatClaim.firestore(), 'salons/qualquer'))).resolves.toBeDefined();
  });

  it('valida os detalhes (details) em authAuditLogs e bloqueia usuários anônimos', async () => {
    // A. Usuário anônimo/não autenticado -> Bloqueado de gravar log
    const anonContext = testEnv.unauthenticatedContext();
    const dbAnon = anonContext.firestore();
    await expect(
      setDoc(doc(dbAnon, 'authAuditLogs', 'log_anon'), {
        userIdentifier: 'some_uid',
        action: 'login',
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // Usuário comum autenticado
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    // B. Details ausente -> Permitido
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_no_details'), {
        userIdentifier: 'user_comum',
        action: 'login',
        createdAt: Date.now()
      })
    ).resolves.toBeDefined();

    // C. Details como string -> Permitido
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_string_details'), {
        userIdentifier: 'user_comum',
        action: 'login',
        details: 'Algum detalhe em string',
        createdAt: Date.now()
      })
    ).resolves.toBeDefined();

    // D. Details como null -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_null_details'), {
        userIdentifier: 'user_comum',
        action: 'login',
        details: null,
        createdAt: Date.now()
      })
    ).rejects.toThrow();

    // E. Details como objeto -> Bloqueado
    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'log_obj_details'), {
        userIdentifier: 'user_comum',
        action: 'login',
        details: { chave: 'valor' },
        createdAt: Date.now()
      })
    ).rejects.toThrow();
  });

  it('garante que o payload gerado para logAuthAuditEvent é totalmente compatível com as regras', async () => {
    const userContext = testEnv.authenticatedContext('user_comum', {
      uid: 'user_comum',
      email: 'user@salao.com'
    } as any);
    const dbUser = userContext.firestore();

    // Payload idêntico ao gerado por logAuthAuditEvent
    const simulatedPayload = {
      id: 'mock_log_id_123',
      userIdentifier: 'user@salao.com',
      action: 'Primeiro Login',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 ...',
      origin: 'https://lumiere.com',
      createdAt: Date.now()
    };

    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'mock_log_id_123'), simulatedPayload)
    ).resolves.toBeDefined();

    // Com details stringificado e cortado
    const simulatedPayloadWithDetails = {
      id: 'mock_log_id_456',
      userIdentifier: 'user@salao.com',
      action: 'Senha alterada',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 ...',
      origin: 'https://lumiere.com',
      details: JSON.stringify({ device: 'mobile', success: true }).slice(0, 2000),
      createdAt: Date.now()
    };

    await expect(
      setDoc(doc(dbUser, 'authAuditLogs', 'mock_log_id_456'), simulatedPayloadWithDetails)
    ).resolves.toBeDefined();
  });
});
