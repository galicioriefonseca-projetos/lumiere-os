import { doc, getDoc, setDoc, collection, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { XP_LEVELS, XP_EVENTS, GamificationProfile, Badge } from '../types';

/**
 * Calcula o nível e o progresso associado a uma quantidade total de XP.
 */
export function calculateLevel(xp: number): { level: number; currentXP: number; levelXP: number; requiredXP: number; progress: number } {
  let level = 1;
  let baseXP = 0;
  let nextLevelXP = XP_LEVELS[1] || 100;

  for (let l = 1; l <= 10; l++) {
    const target = XP_LEVELS[l] || (l * l * 500);
    if (xp >= target) {
      level = l + 1;
      baseXP = target;
      nextLevelXP = XP_LEVELS[l + 1] || ((l + 1) * (l + 1) * 500);
    } else {
      break;
    }
  }

  const levelXP = xp - baseXP;
  const requiredXP = nextLevelXP - baseXP;
  const progress = requiredXP > 0 ? Math.min(Math.round((levelXP / requiredXP) * 100), 100) : 100;

  return {
    level,
    currentXP: xp,
    levelXP,
    requiredXP,
    progress
  };
}

/**
 * Calcula o Score Composto: (progressoMeta% * 0.6) + (mediaAvaliacoes% * 0.4)
 */
export function calculateCompositeScore(goalProgressPct: number, averageEvaluationPct: number): number {
  const score = (goalProgressPct * 0.6) + (averageEvaluationPct * 0.4);
  return Math.min(Math.round(score), 100);
}

/**
 * Avalia critérios e adiciona novos badges caso ainda não conquistados.
 */
export function evaluateNewBadges(
  currentBadges: Badge[],
  criteria: {
    goalProgress?: number;
    checklistScore?: number;
    maxChecklistScore?: number;
    streakDays?: number;
  }
): Badge[] {
  const updatedBadges = [...currentBadges];
  const earnedIds = new Set(currentBadges.map(b => b.id));

  const checkAndAdd = (id: string, name: string, icon: string, description: string, category: Badge['category']) => {
    if (!earnedIds.has(id)) {
      updatedBadges.push({
        id,
        name,
        icon,
        description,
        earnedAt: Date.now(),
        category
      });
    }
  };

  if (criteria.goalProgress !== undefined) {
    if (criteria.goalProgress >= 100) {
      checkAndAdd('prod_bronze', 'Produtor Bronze', '🥉', 'Bateu 100% da primeira meta mensal', 'production');
    }
    if (criteria.goalProgress >= 150) {
      checkAndAdd('prod_star', 'Estrela de Produção', '⭐', 'Bateu 150% ou mais da meta mensal', 'production');
    }
  }

  if (criteria.checklistScore !== undefined && criteria.maxChecklistScore !== undefined) {
    if (criteria.checklistScore >= criteria.maxChecklistScore) {
      checkAndAdd('eval_excl', 'Profissional de Excelência', '💎', 'Tirou nota máxima no checklist diário', 'evaluation');
    }
  }

  if (criteria.streakDays !== undefined) {
    if (criteria.streakDays >= 7) {
      checkAndAdd('streak_fire', 'No Fogo do Hábito', '🔥', 'Alcançou 7 dias seguidos de streak', 'streak');
    }
    if (criteria.streakDays >= 15) {
      checkAndAdd('streak_master', 'Inabalável', '🧬', 'Alcançou 15 dias seguidos de streak', 'streak');
    }
  }

  return updatedBadges;
}

/**
 * Aplica ganho de XP a um colaborador usando uma transação do Firestore.
 * Trata também a transição do mês atual, o cálculo de nível e os badges conquistados.
 */
export async function applyXPGain(
  salonId: string,
  professionalId: string,
  eventKey: keyof typeof XP_EVENTS | 'CUSTOM',
  customValue?: number,
  metadata?: any
): Promise<{ levelUp: boolean; oldLevel: number; newLevel: number; xpEarned: number }> {
  if (!salonId || !professionalId) {
    throw new Error('Salon ID e Professional ID são obrigatórios.');
  }

  const xpEarned = eventKey === 'CUSTOM' ? (customValue || 0) : (XP_EVENTS[eventKey] || 0);
  if (xpEarned <= 0) {
    return { levelUp: false, oldLevel: 1, newLevel: 1, xpEarned: 0 };
  }

  const profileRef = doc(db, `salons/${salonId}/gamification`, professionalId);
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = todayStr.substring(0, 7);

  let levelUp = false;
  let oldLevel = 1;
  let newLevel = 1;

  await runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    
    let profileData: Partial<GamificationProfile> = {};
    if (profileSnap.exists()) {
      profileData = profileSnap.data() as GamificationProfile;
    }

    // Se mudou o mês, o XP mensal é reiniciado
    const lastActiveDate = profileData.lastActiveDate || todayStr;
    const lastActiveMonth = lastActiveDate.substring(0, 7);
    const isNewMonth = lastActiveMonth !== currentMonthStr;

    const oldXP = profileData.totalXP || 0;
    const newXP = oldXP + xpEarned;
    const oldMonthlyXP = isNewMonth ? 0 : (profileData.monthlyXP || 0);
    const newMonthlyXP = oldMonthlyXP + xpEarned;

    const oldLevelCalc = calculateLevel(oldXP);
    const newLevelCalc = calculateLevel(newXP);

    oldLevel = oldLevelCalc.level;
    newLevel = newLevelCalc.level;
    if (newLevel > oldLevel) {
      levelUp = true;
    }

    // Preparar dados do perfil atualizados
    const updatedProfile: Partial<GamificationProfile> = {
      id: professionalId,
      fullName: profileData.fullName || metadata?.fullName || 'Colaborador',
      role: profileData.role || metadata?.role || 'professional',
      totalXP: newXP,
      monthlyXP: newMonthlyXP,
      level: newLevel,
      currentStreakDays: profileData.currentStreakDays ?? 0,
      maxStreakDays: profileData.maxStreakDays ?? 0,
      lastActiveDate: todayStr,
      badges: profileData.badges || [],
      recentScores: profileData.recentScores || [],
      updatedAt: Date.now()
    };

    // Salvar no perfil
    transaction.set(profileRef, updatedProfile, { merge: true });

    // Adicionar log na subcoleção gamification_history
    const historyRef = doc(collection(profileRef, 'gamification_history'));
    transaction.set(historyRef, {
      id: historyRef.id,
      eventKey,
      xpAmount: xpEarned,
      previousXP: oldXP,
      newXP: newXP,
      previousLevel: oldLevel,
      newLevel: newLevel,
      date: todayStr,
      createdAt: Date.now(),
      metadata: metadata || null
    });
  });

  return {
    levelUp,
    oldLevel,
    newLevel,
    xpEarned
  };
}

/**
 * Atualiza o streak e a nota composto do colaborador para o dia.
 */
export async function updateDailyScoreAndStreak(
  salonId: string,
  professionalId: string,
  compositeScore: number,
  productionScore: number,
  evaluationScore: number,
  metadata?: any
): Promise<void> {
  const profileRef = doc(db, `salons/${salonId}/gamification`, professionalId);
  const todayStr = new Date().toISOString().substring(0, 10);

  await runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    
    let profileData: Partial<GamificationProfile> = {
      id: professionalId,
      fullName: metadata?.fullName || 'Colaborador',
      role: metadata?.role || 'professional',
      totalXP: 0,
      monthlyXP: 0,
      level: 1,
      currentStreakDays: 0,
      maxStreakDays: 0,
      badges: [],
      recentScores: []
    };

    if (profileSnap.exists()) {
      profileData = profileSnap.data() as GamificationProfile;
    }

    // 1. Atualizar histórico recente (recentScores)
    const recentScores = [...(profileData.recentScores || [])];
    const existingIndex = recentScores.findIndex(s => s.date === todayStr);

    if (existingIndex > -1) {
      recentScores[existingIndex] = {
        date: todayStr,
        score: compositeScore,
        productionScore,
        evaluationScore
      };
    } else {
      recentScores.push({
        date: todayStr,
        score: compositeScore,
        productionScore,
        evaluationScore
      });
    }

    // Manter apenas os últimos 30 registros
    if (recentScores.length > 30) {
      recentScores.shift();
    }

    // 2. Cálculo do streak de excelência (scoreComposto >= 80%)
    let currentStreak = profileData.currentStreakDays || 0;
    let maxStreak = profileData.maxStreakDays || 0;
    const lastActiveDate = profileData.lastActiveDate;

    if (compositeScore >= 80) {
      if (lastActiveDate) {
        const lastDate = new Date(lastActiveDate);
        const todayDate = new Date(todayStr);
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          // Consecutivo ou mesmo dia
          if (diffDays === 1) {
            currentStreak += 1;
          }
        } else {
          // Quebrou o streak
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
    } else {
      // Nota menor que 85% quebra o streak do dia
      currentStreak = 0;
    }

    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }

    // Avaliar novos de badges conquistados
    const oldBadges = profileData.badges || [];
    const newBadges = evaluateNewBadges(oldBadges, {
       goalProgress: metadata?.goalProgress,
       checklistScore: metadata?.checklistScore,
       maxChecklistScore: metadata?.maxChecklistScore,
       streakDays: currentStreak
    });

    profileData.recentScores = recentScores;
    profileData.currentStreakDays = currentStreak;
    profileData.maxStreakDays = maxStreak;
    profileData.badges = newBadges;
    profileData.lastActiveDate = todayStr;
    profileData.updatedAt = Date.now();

    transaction.set(profileRef, profileData, { merge: true });
  });
}
