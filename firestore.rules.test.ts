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
    testEnv = await initializeTestEnvironment({
      projectId: 'lumiereos-11a95',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        // Support either local host/port or fallback configuration
        host: '127.0.0.1',
        port: 8080,
      }
    });
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
});
