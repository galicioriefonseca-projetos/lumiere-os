import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Trophy, Star, Target, Flame, Award, ShieldAlert, Sparkles, Plus, Check,
  TrendingUp, Users, ShoppingBag, Zap, Crown, ArrowRight, CheckCircle2, ChevronRight,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBRL } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GamificationCampaign {
  id: string;
  title: string;
  description: string;
  xpValue: number;
  type: 'service_focus' | 'product_vendas' | 'faturamento_elite' | 'checklist_perito';
  targetValue: number;
  currentValue?: number;
  status: 'active' | 'completed' | 'expired';
  createdAt: number;
}

export default function GamificationPage() {
  const { salonData, userData } = useAuth();
  const userRole = userData?.role || 'professional';
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager' || userRole === 'platform_admin';

  const [campaigns, setCampaigns] = useState<GamificationCampaign[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);
  const [salonGoals, setSalonGoals] = useState<any[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<any[]>([]);

  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedProfForReport, setSelectedProfForReport] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'quests' | 'rewards'>('leaderboard');

  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));

  // Opções para o seletor de mês (Junho/2026, Julho/2026 e mês atual dinamicamente)
  const monthOptions = useMemo(() => {
    const current = new Date().toISOString().substring(0, 7);
    const formatLabel = (ym: string) => {
      const [year, month] = ym.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    };

    const options = [
      { value: current, label: `Mês Atual (${formatLabel(current)})` },
      { value: '2026-06', label: 'Junho de 2026' },
      { value: '2026-07', label: 'Julho de 2026' }
    ];

    // Remover duplicados
    const seen = new Set();
    return options.filter(opt => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, []);

  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    xpValue: '300',
    type: 'service_focus' as GamificationCampaign['type'],
    targetValue: '5'
  });

  // Carregar dados estruturados
  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // Campanhas de Gamificação
    const qCam = query(collection(db, `salons/${salonData.id}/gamification_campaigns`));
    unsubs.push(onSnapshot(qCam, (snapshot) => {
      const arr: GamificationCampaign[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() } as GamificationCampaign));
      setCampaigns(arr.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.warn("Aviso ao carregar campanhas:", error.message);
    }));

    // Agendamentos/Lançamentos (Todos para calcular desempenho dinamicativo)
    const qAp = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qAp, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setAppointments(arr);
    }));

    // Colaboradores
    const qPro = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qPro, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          arr.push({ id: doc.id, ...data });
        }
      });
      setProfessionals(arr);
    }));

    // ChecklistRuns para computar notas altas
    const qCk = query(collection(db, `salons/${salonData.id}/checklistRuns`));
    unsubs.push(onSnapshot(qCk, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setChecklistRuns(arr);
    }));

    // Metas do Salão (salons/{salonId}/goals)
    const qG = query(collection(db, `salons/${salonData.id}/goals`));
    unsubs.push(onSnapshot(qG, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setSalonGoals(arr);
    }, (error) => {
      console.warn("Aviso ao carregar metas do salão:", error.message);
    }));

    // Metas dos Profissionais (salons/{salonId}/professionalGoals)
    const qPg = query(collection(db, `salons/${salonData.id}/professionalGoals`));
    unsubs.push(onSnapshot(qPg, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setProfessionalGoals(arr);
    }, (error) => {
      console.warn("Aviso ao carregar metas profissionais:", error.message);
    }));

    return () => unsubs.forEach(fn => fn());
  }, [salonData]);

  // Cálculos dinâmicos de XP, Nível, Faturamento e Badge para cada profissional
  const professionalsPerformance = useMemo(() => {
    const mapped = professionals.map(prof => {
      // 1. Filtrar agendamentos concluídos deste profissional e deste mês selecionado
      const completedSrvs = appointments.filter(ap => {
        const isCompleted = ap.status === 'completed';
        if (!isCompleted) return false;
        
        const isSameProf = ap.professionalId === prof.id;
        if (!isSameProf) return false;

        const apDate = ap.date || (ap.createdAt && typeof ap.createdAt === 'string' && ap.createdAt) || '';
        if (apDate.startsWith(selectedMonth)) return true;
        
        if (typeof ap.createdAt === 'number') {
          return new Date(ap.createdAt).toISOString().substring(0, 7) === selectedMonth;
        }
        return false;
      });

      // Faturamento total
      const totalRevenue = completedSrvs.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

      // Quantidade de serviços e produtos vendidos
      const totalServices = completedSrvs.filter(ap => ap.type !== 'product').length;
      const totalProducts = completedSrvs.filter(ap => ap.type === 'product').length;

      // 2. Nota média em checklists avaliados (0 a 100) no mês selecionado
      const runsInMonth = checklistRuns.filter(r => 
        r.evaluatedProfessionalId === prof.id && 
        (r.date?.startsWith(selectedMonth) || r.evaluationDate?.startsWith(selectedMonth))
      );
      // Filtrar apenas runs válidas (onde a nota ou percentual foi registrado e não é uma falta)
      const validRuns = runsInMonth.filter(r => {
        if (r.attendanceStatus && r.attendanceStatus !== 'present') return false;
        return r.percentage !== undefined || r.completionPercentage !== undefined;
      });
      const totalChecklists = validRuns.length;
      const avgScore = totalChecklists > 0 
        ? validRuns.reduce((sum, r) => {
            const score = r.percentage !== undefined ? r.percentage : (r.completionPercentage ?? 0);
            return sum + score;
          }, 0) / totalChecklists
        : 0;

      // 3. Unificar metas atribuídas para o mês selecionado
      const pGoalsPg = professionalGoals.filter(g => g.professionalId === prof.id && g.month === selectedMonth);
      const pGoalsG = salonGoals.filter(g => g.professionalId === prof.id && g.month === selectedMonth);
      
      const uniqueGoalsMap = new Map<string, any>();
      pGoalsPg.forEach(g => uniqueGoalsMap.set(g.id, g));
      pGoalsG.forEach(g => uniqueGoalsMap.set(g.id, g));
      const assignedGoals = Array.from(uniqueGoalsMap.values());

      const totalGoals = assignedGoals.length;
      const goalsHit = assignedGoals.filter(g => {
        const target = g.targetAmount ?? g.targetValue ?? g.amount ?? 0;
        const current = g.currentValue ?? g.currentAmount ?? g.realizedValue ?? 0;
        return target > 0 && current >= target;
      }).length;

      const sumGoalProgress = assignedGoals.reduce((sum, g) => {
        const target = g.targetAmount ?? g.targetValue ?? g.amount ?? 0;
        const current = g.currentValue ?? g.currentAmount ?? g.realizedValue ?? 0;
        const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        return sum + progress;
      }, 0);

      const avgGoalProgress = totalGoals > 0 ? sumGoalProgress / totalGoals : 0;

      // 4. Nova fórmula inteligente (70% Metas, 30% Checklist)
      const hasGoals = totalGoals > 0;
      const hasChecklists = totalChecklists > 0;

      let performanceScore = 0;
      let dataStatus: 'completo' | 'parcial_metas' | 'parcial_checklist' | 'sem_dados' = 'completo';
      let dataStatusLabel = '';

      if (hasGoals && hasChecklists) {
        performanceScore = Math.round((avgGoalProgress * 0.70) + (avgScore * 0.30));
        dataStatus = 'completo';
        dataStatusLabel = 'Dados Completos';
      } else if (hasGoals && !hasChecklists) {
        performanceScore = Math.round(avgGoalProgress);
        dataStatus = 'parcial_metas';
        dataStatusLabel = 'Parcial (Sem Checklist)';
      } else if (!hasGoals && hasChecklists) {
        performanceScore = Math.round(avgScore);
        dataStatus = 'parcial_checklist';
        dataStatusLabel = 'Parcial (Sem Metas)';
      } else {
        performanceScore = 0;
        dataStatus = 'sem_dados';
        dataStatusLabel = 'Sem Dados Suficientes';
      }

      // Cálculo de XP Inteligente no mês selecionado:
      const baseXP = Math.floor(totalRevenue);
      const serviceBonus = totalServices * 50;
      const productBonus = totalProducts * 150;
      const perfBonus = runsInMonth.filter(r => r.completionPercentage === 100 || r.percentage === 100).length * 200;

      const totalXP = baseXP + serviceBonus + productBonus + perfBonus + (prof.extraXP || 0);

      // Sistema de Nível Simples e Linear:
      let level = 1;
      let nextLevelXP = 1000;
      let currentLevelXPStart = 0;

      if (totalXP >= 10000) {
        const extraXPs = totalXP - 10000;
        const extraLevels = Math.floor(extraXPs / 5000);
        level = 5 + extraLevels;
        currentLevelXPStart = 10000 + extraLevels * 5000;
        nextLevelXP = currentLevelXPStart + 5000;
      } else if (totalXP >= 6000) {
        level = 4;
        currentLevelXPStart = 6000;
        nextLevelXP = 10000;
      } else if (totalXP >= 3000) {
        level = 3;
        currentLevelXPStart = 3000;
        nextLevelXP = 6000;
      } else if (totalXP >= 1000) {
        level = 2;
        currentLevelXPStart = 1000;
        nextLevelXP = 3000;
      }

      const progressPercent = Math.min(
        100,
        Math.max(0, ((totalXP - currentLevelXPStart) / (nextLevelXP - currentLevelXPStart)) * 100)
      );

      // Conquistas / Badges Dinâmicas:
      const badges: Array<{ name: string; icon: string; description: string; color: string; unlocked: boolean }> = [
        {
          name: 'Mestre da Tesoura',
          icon: '✂️',
          description: 'Prestou mais de 10 serviços no salão.',
          color: 'from-amber-500 to-yellow-600',
          unlocked: totalServices >= 10
        },
        {
          name: 'Inabalável',
          icon: '⭐',
          description: 'Obteve 100% de conformidade em uma auditoria.',
          color: 'from-blue-500 to-indigo-600',
          unlocked: runsInMonth.some(r => r.completionPercentage === 100 || r.percentage === 100)
        },
        {
          name: 'Imperador de Vendas',
          icon: '🛍️',
          description: 'Vendeu mais de 3 produtos físicos para clientes.',
          color: 'from-emerald-500 to-teal-600',
          unlocked: totalProducts >= 3
        },
        {
          name: 'Luz de Lumière',
          icon: '👑',
          description: 'Faturou acima de R$ 2.000,00 no mês corrente.',
          color: 'from-purple-500 to-pink-600',
          unlocked: totalRevenue >= 2000
        },
        {
          name: 'Super Querido',
          icon: '🔥',
          description: 'Realizou mais de 20 atendimentos.',
          color: 'from-orange-500 to-red-600',
          unlocked: completedSrvs.length >= 20
        }
      ];

      // 5. Explicação "Por que está nesta posição?"
      const pointsOfStrength: string[] = [];
      const pointsOfAttention: string[] = [];

      if (hasGoals) {
        if (avgGoalProgress >= 80) {
          pointsOfStrength.push(`Excelente progresso nas metas manuais (${avgGoalProgress.toFixed(0)}%).`);
        } else if (avgGoalProgress < 50) {
          pointsOfAttention.push(`Baixo progresso na meta mensal (${avgGoalProgress.toFixed(0)}%). Necessário foco.`);
        }
      } else {
        pointsOfAttention.push('Sem meta manual cadastrada neste mês.');
      }

      if (hasChecklists) {
        if (avgScore >= 85) {
          pointsOfStrength.push(`Excelente conformidade no checklist diário (${avgScore.toFixed(1)}%).`);
        } else if (avgScore < 75) {
          pointsOfAttention.push(`Atenção aos padrões de conformidade do checklist (${avgScore.toFixed(1)}%).`);
        }
      } else {
        pointsOfAttention.push('Nenhuma rotina de checklist realizada no período.');
      }

      if (hasGoals && hasChecklists) {
        if (avgGoalProgress >= 80 && avgScore >= 85) {
          pointsOfStrength.push('Ótimo equilíbrio entre metas e conformidade.');
        }
      }

      const explanation = {
        reason: (hasGoals && hasChecklists)
          ? `Seu score de ${performanceScore}% pondera seu progresso de ${avgGoalProgress.toFixed(0)}% nas metas (peso 70%) e conformidade de ${avgScore.toFixed(1)}% nos checklists (peso 30%).`
          : hasGoals
            ? `Score de ${performanceScore}% calculado provisoriamente apenas pelo progresso de ${avgGoalProgress.toFixed(0)}% nas metas individuais (sem checklists no período).`
            : hasChecklists
              ? `Score de ${performanceScore}% calculado provisoriamente apenas pela nota média de ${avgScore.toFixed(1)}% nos checklists (sem metas no período).`
              : "Sem registros ativos de metas ou checklists para compor o ranking.",
        pointsOfStrength: pointsOfStrength.length > 0 ? pointsOfStrength : ['Operação diária em andamento.'],
        pointsOfAttention: pointsOfAttention.length > 0 ? pointsOfAttention : ['Continue mantendo o ritmo atual para pontuar!']
      };

      // 6. Bonificação Status
      let bonusStatus: 'elegivel' | 'evolucao' | 'atencao' | 'insuficiente' = 'insuficiente';
      let bonusLabel = '';
      let bonusColor = '';

      if (!hasGoals || !hasChecklists) {
        bonusStatus = 'insuficiente';
        bonusLabel = 'Dados insuficientes';
        bonusColor = 'text-zinc-500 bg-zinc-900 border-zinc-850';
      } else if (avgGoalProgress >= 80 && avgScore >= 85) {
        bonusStatus = 'elegivel';
        bonusLabel = 'Elegível para Bonificação';
        bonusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      } else if (avgGoalProgress >= 50 || avgScore >= 70) {
        bonusStatus = 'evolucao';
        bonusLabel = 'Em Evolução';
        bonusColor = 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      } else {
        bonusStatus = 'atencao';
        bonusLabel = 'Necessita Atenção';
        bonusColor = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      }

      return {
        ...prof,
        totalRevenue,
        totalServices,
        totalProducts,
        totalXP,
        level,
        nextLevelXP,
        currentLevelXPStart,
        progressPercent,
        badges,
        avgScore,
        totalChecklists,
        totalGoals,
        goalsHit,
        avgGoalProgress,
        performanceScore,
        dataStatus,
        dataStatusLabel,
        explanation,
        bonusStatus,
        bonusLabel,
        bonusColor,
        unlockedBadgesCount: badges.filter(b => b.unlocked).length
      };
    });

    // Ordenar ranking pelo SCORE FINAL (performanceScore) de forma decrescente, e por XP total em caso de empate
    return mapped.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return b.totalXP - a.totalXP;
    });
  }, [professionals, appointments, checklistRuns, salonGoals, professionalGoals, selectedMonth]);

  const handleDownloadPDF = () => {
    if (!salonData) {
      toast.error("Dados do salão não carregados.");
      return;
    }

    try {
      const docPdf = new jsPDF();
      const todayStr = new Date().toLocaleDateString('pt-BR');
      
      const formatMonthYear = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      };
      const currentMonthYear = formatMonthYear(selectedMonth);

      // 1. Cabeçalho Principal (Tema Premium)
      docPdf.setFillColor(15, 15, 15);
      docPdf.rect(0, 0, 210, 40, 'F');

      docPdf.setFontSize(22);
      docPdf.setTextColor(212, 175, 55); // Ouro
      docPdf.text(salonData.name ? salonData.name.toUpperCase() : "LUMIÈREOS", 14, 25);

      docPdf.setFontSize(10);
      docPdf.setTextColor(180, 180, 180);
      docPdf.text(`RELATÓRIO DE DESEMPENHO E RANKING INTELIGENTE - ${currentMonthYear.toUpperCase()}`, 14, 34);

      // Linha de divisão dourada
      docPdf.setDrawColor(212, 175, 55);
      docPdf.setLineWidth(1);
      docPdf.line(0, 40, 210, 40);

      // Meta Info
      docPdf.setFontSize(10);
      docPdf.setTextColor(80, 80, 80);
      docPdf.text(`Emitido em: ${todayStr}`, 14, 52);
      docPdf.text(`Software de Gestão: LumièreOS`, 150, 52);

      // 2. Seção Top 3 Destaques
      docPdf.setFontSize(14);
      docPdf.setTextColor(15, 15, 15);
      docPdf.text("TOP 3 - DESTAQUE DE PERFORMANCE", 14, 68);

      // Linha cinza sob o título
      docPdf.setDrawColor(220, 220, 220);
      docPdf.setLineWidth(0.5);
      docPdf.line(14, 71, 196, 71);

      const top3 = professionalsPerformance.slice(0, 3);
      let nextY = 80;

      top3.forEach((prof, idx) => {
        const medal = idx === 0 ? "🥇 CAMPEÃO" : idx === 1 ? "🥈 VICE-CAMPEÃO" : "🥉 TERCEIRO LUGAR";
        docPdf.setFontSize(11);
        docPdf.setTextColor(idx === 0 ? 180 : 50, idx === 0 ? 140 : 50, idx === 0 ? 20 : 50);
        docPdf.text(`${medal}: ${prof.name || prof.fullName}`, 20, nextY);
        
        docPdf.setFontSize(9.5);
        docPdf.setTextColor(100, 100, 100);
        docPdf.text(`Score: ${prof.performanceScore}%  |  Status: ${prof.bonusLabel}  |  Checklist: ${prof.totalChecklists > 0 ? prof.avgScore.toFixed(1) + '%' : 'N/A'}`, 30, nextY + 6);
        
        nextY += 15;
      });

      // 3. Tabela Completa do Ranking
      docPdf.setFontSize(14);
      docPdf.setTextColor(15, 15, 15);
      docPdf.text("CLASSIFICAÇÃO GERAL DA EQUIPE", 14, nextY + 10);

      docPdf.setDrawColor(220, 220, 220);
      docPdf.setLineWidth(0.5);
      docPdf.line(14, nextY + 13, 196, nextY + 13);

      const tableRows = professionalsPerformance.map((prof, idx) => {
        return [
          `${idx + 1}º`,
          prof.name || prof.fullName || "Colaborador",
          `${prof.performanceScore}%`,
          prof.totalChecklists > 0 ? `${prof.avgScore.toFixed(1)}% (${prof.totalChecklists} runs)` : "N/A",
          prof.totalGoals > 0 ? `${prof.goalsHit} / ${prof.totalGoals}` : "N/A",
          prof.totalGoals > 0 ? `${prof.avgGoalProgress.toFixed(1)}%` : "N/A",
          prof.bonusLabel,
          `Nível ${prof.level}`
        ];
      });

      autoTable(docPdf, {
        head: [["Pos", "Profissional", "Score Final", "Média Checklist", "Metas Batidas", "Prog. Metas", "Status Bonificação", "Nível"]],
        body: tableRows,
        startY: nextY + 17,
        theme: 'striped',
        headStyles: {
          fillColor: [212, 175, 55], // Ouro premium
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { fontStyle: 'bold' }
        }
      });

      // 4. Observação final
      const finalY = (docPdf as any).lastAutoTable.finalY + 15;
      docPdf.setFontSize(9);
      docPdf.setTextColor(120, 120, 120);
      
      const noteText = "Observação Final: Este relatório foi gerado automaticamente pelo motor de Gamificação do LumièreOS. " +
                       "O cálculo ponderado (70% Metas Manuais, 30% Checklist) promove uma competição justa focada em qualidade " +
                       "operacional e no atingimento de objetivos estratégicos.";
      
      const splitText = docPdf.splitTextToSize(noteText, 180);
      docPdf.text(splitText, 14, finalY);

      // Rodapé
      docPdf.text(
        "LumièreOS — Inteligência e Gestão de Alta Performance para Beleza",
        14,
        docPdf.internal.pageSize.getHeight() - 10
      );

      docPdf.save(`lumiere_ranking_performance_${todayStr.replace(/\//g, '-')}.pdf`);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.warn("Aviso ao gerar PDF:", error);
      toast.error("Falha ao exportar relatório em PDF.");
    }
  };

  const handleDownloadIndividualPDF = (prof: any) => {
    if (!salonData) return;

    try {
      const docPdf = new jsPDF();
      const todayStr = new Date().toLocaleDateString('pt-BR');
      
      const formatMonthYear = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      };
      const currentMonthYear = formatMonthYear(selectedMonth);

      // Header
      docPdf.setFillColor(15, 15, 15);
      docPdf.rect(0, 0, 210, 40, 'F');

      docPdf.setFontSize(20);
      docPdf.setTextColor(212, 175, 55);
      docPdf.text(`LUMIÈREOS — RELATÓRIO INDIVIDUAL`, 14, 25);

      docPdf.setFontSize(10);
      docPdf.setTextColor(180, 180, 180);
      docPdf.text(`PROFISSIONAL: ${prof.name?.toUpperCase() || prof.fullName?.toUpperCase()}  |  MÊS: ${currentMonthYear.toUpperCase()}`, 14, 34);

      docPdf.setDrawColor(212, 175, 55);
      docPdf.setLineWidth(1);
      docPdf.line(0, 40, 210, 40);

      // Meta Info
      docPdf.setFontSize(10);
      docPdf.setTextColor(80, 80, 80);
      docPdf.text(`Gerado em: ${todayStr}`, 14, 52);

      // Score Big Card
      docPdf.setFillColor(248, 248, 248);
      docPdf.rect(14, 60, 182, 35, 'F');
      docPdf.setDrawColor(230, 230, 230);
      docPdf.setLineWidth(0.5);
      docPdf.rect(14, 60, 182, 35, 'S');

      docPdf.setFontSize(11);
      docPdf.setTextColor(100, 100, 100);
      docPdf.text("SCORE GERAL DE PERFORMANCE", 20, 72);
      
      docPdf.setFontSize(28);
      docPdf.setTextColor(212, 175, 55);
      docPdf.text(`${prof.performanceScore}%`, 20, 85);

      // Diagnóstico Card
      let diag = prof.bonusLabel;
      let diagColor = [59, 130, 246]; // azul
      if (prof.bonusStatus === 'elegivel') {
        diagColor = [34, 197, 94]; // verde
      } else if (prof.bonusStatus === 'atencao') {
        diagColor = [249, 115, 22]; // laranja
      } else if (prof.bonusStatus === 'insuficiente') {
        diagColor = [120, 120, 120]; // cinza
      }

      docPdf.setFontSize(11);
      docPdf.setTextColor(100, 100, 100);
      docPdf.text("STATUS DE BONIFICAÇÃO", 110, 72);

      docPdf.setFontSize(15);
      docPdf.setTextColor(diagColor[0], diagColor[1], diagColor[2]);
      docPdf.text(diag.toUpperCase(), 110, 82);

      // Mapeamento de Métricas
      docPdf.setFontSize(13);
      docPdf.setTextColor(15, 15, 15);
      docPdf.text("MÉTRICAS DETALHADAS DO PERÍODO", 14, 112);

      docPdf.setDrawColor(220, 220, 220);
      docPdf.line(14, 115, 196, 115);

      const metricsRows = [
        ["Nota Média Checklist Qualidade", prof.totalChecklists > 0 ? `${prof.avgScore.toFixed(1)}% (${prof.totalChecklists} avaliações)` : "N/A (Sem checklists no período)"],
        ["Metas Atribuídas no Período", `${prof.totalGoals} metas`],
        ["Metas Batidas no Período", `${prof.goalsHit} metas`],
        ["Progresso Médio das Metas", prof.totalGoals > 0 ? `${prof.avgGoalProgress.toFixed(1)}%` : "N/A (Sem metas cadastradas)"],
        ["Faturamento Bruto Gerado (Auxiliar)", formatBRL(prof.totalRevenue)],
        ["Nível de Experiência Atual", `Nível ${prof.level} (${prof.totalXP.toLocaleString()} XP)`]
      ];

      autoTable(docPdf, {
        body: metricsRows,
        startY: 120,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 100 },
          1: { halign: 'right' }
        }
      });

      // Conquistas e Badges
      const badgesY = (docPdf as any).lastAutoTable.finalY + 15;
      docPdf.setFontSize(13);
      docPdf.setTextColor(15, 15, 15);
      docPdf.text("CONQUISTAS & BADGES DESTRAVADAS", 14, badgesY);
      docPdf.line(14, badgesY + 3, 196, badgesY + 3);

      const unlockedBadges = prof.badges.filter((b: any) => b.unlocked);
      let badgeY = badgesY + 12;

      if (unlockedBadges.length === 0) {
        docPdf.setFontSize(10);
        docPdf.setTextColor(120, 120, 120);
        docPdf.text("Nenhum emblema desbloqueado neste ciclo ainda.", 20, badgeY);
      } else {
        unlockedBadges.forEach((badge: any) => {
          docPdf.setFontSize(10);
          docPdf.setTextColor(15, 15, 15);
          docPdf.text(`${badge.icon}  ${badge.name}`, 20, badgeY);
          
          docPdf.setFontSize(8.5);
          docPdf.setTextColor(100, 100, 100);
          docPdf.text(badge.description, 45, badgeY);
          
          badgeY += 8;
        });
      }

      // Seção Diagnóstico e Explicação
      const explY = badgeY + 12;
      docPdf.setFontSize(13);
      docPdf.setTextColor(15, 15, 15);
      docPdf.text("DIAGNÓSTICO E JUSTIFICATIVA DO RANKING", 14, explY);
      docPdf.line(14, explY + 3, 196, explY + 3);

      docPdf.setFontSize(9.5);
      docPdf.setTextColor(50, 50, 50);
      const splitReason = docPdf.splitTextToSize(`Justificativa: ${prof.explanation.reason}`, 180);
      docPdf.text(splitReason, 14, explY + 10);

      const splitStrengths = docPdf.splitTextToSize(`Pontos Fortes: ${prof.explanation.pointsOfStrength.join('; ')}`, 180);
      docPdf.text(splitStrengths, 14, explY + 22);

      const splitAttentions = docPdf.splitTextToSize(`Pontos de Atenção: ${prof.explanation.pointsOfAttention.join('; ')}`, 180);
      docPdf.text(splitAttentions, 14, explY + 34);

      // Rodapé
      docPdf.setFontSize(9);
      docPdf.setTextColor(120, 120, 120);
      docPdf.text(
        "LumièreOS — Sistema Inteligente de Incentivo e Gestão",
        14,
        docPdf.internal.pageSize.getHeight() - 10
      );

      docPdf.save(`lumiere_report_${prof.name || prof.fullName}_${todayStr.replace(/\//g, '-')}.pdf`);
      toast.success("Relatório individual exportado com sucesso!");
    } catch (err) {
      console.warn("Aviso ao gerar PDF individual:", err);
      toast.error("Falha ao exportar PDF.");
    }
  };

  // Criar nova campanha
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    if (!newCampaign.title || !newCampaign.description) {
      toast.error('Preencha os campos obrigatórios!');
      return;
    }

    try {
      await addDoc(collection(db, `salons/${salonData.id}/gamification_campaigns`), {
        title: newCampaign.title,
        description: newCampaign.description,
        xpValue: parseInt(newCampaign.xpValue) || 100,
        type: newCampaign.type,
        targetValue: parseFloat(newCampaign.targetValue) || 1,
        status: 'active',
        createdAt: Date.now()
      });

      toast.success('Missão ativa lançada no salão para toda equipe!');
      setIsNewCampaignOpen(false);
      setNewCampaign({
        title: '',
        description: '',
        xpValue: '300',
        type: 'service_focus',
        targetValue: '5'
      });
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao criar a Missão.');
    }
  };

  // Obter o profissional de destaque
  const topProfessional = useMemo(() => {
    return professionalsPerformance[0] || null;
  }, [professionalsPerformance]);

  return (
    <div className="space-y-8 pb-10" id="gamification-page">
      {/* Header visual incrível */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-8 rounded-3xl border border-[#D4AF37]/15">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold font-sans uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 animate-pulse" /> Arena de Performance & Competitividade
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-heading text-white">
            Gamificação & <span className="text-[#D4AF37] filter drop-shadow-[0_0_8px_rgba(212,175,55,0.25)]">Engajamento de Equipe</span>
          </h1>
          <p className="text-zinc-400 text-sm max-w-xl">
            Acompanhe o ranking de liderança operacional por metas manuais de produtividade e controle de qualidade por checklists para qualificar sua equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 z-20">
          {/* Seletor de Período */}
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans font-bold">Filtrar Período</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Exportar PDF Geral */}
          <Button 
            onClick={handleDownloadPDF} 
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-850 text-[#D4AF37] border border-[#D4AF37]/30 font-bold px-4 py-5 h-11 rounded-xl flex items-center justify-center gap-2 text-xs select-none cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Ranking Geral
          </Button>

          {isOwnerOrManager && (
            <Dialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 font-bold px-4 py-5 h-11 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)] select-none text-xs cursor-pointer">
                  <Plus className="w-4 h-4 stroke-[2.5]" /> Nova Missão
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl text-[#D4AF37] flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#D4AF37]" /> Nova Missão para a Equipe
                </DialogTitle>
                <CardDescription className="text-zinc-400">
                  Defina um objetivo focado em gargalos de vendas para a equipe e recompense com XPs adicionais para turbinar o leaderboard.
                </CardDescription>
              </DialogHeader>

              <form onSubmit={handleCreateCampaign} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Título do Desafio</Label>
                  <Input 
                    required 
                    value={newCampaign.title} 
                    onChange={e => setNewCampaign(p => ({ ...p, title: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                    placeholder="Ex: Operação Hidratação Extra"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Explicação / Detalhes</Label>
                  <Input 
                    required 
                    value={newCampaign.description} 
                    onChange={e => setNewCampaign(p => ({ ...p, description: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                    placeholder="Ex: Realizar 5 hidratações de marcas importadas nesta semana"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Tipo de Alvo</Label>
                    <Select value={newCampaign.type} onValueChange={(v: any) => setNewCampaign(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectItem value="service_focus">Volume de Serviços</SelectItem>
                        <SelectItem value="product_vendas">Vendas de Produtos</SelectItem>
                        <SelectItem value="faturamento_elite">Alvo de Faturamento R$</SelectItem>
                        <SelectItem value="checklist_perito">Excelência em Checklist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-300">Meta Requerida</Label>
                    <Input 
                      required 
                      type="number"
                      value={newCampaign.targetValue} 
                      onChange={e => setNewCampaign(p => ({ ...p, targetValue: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">XP de Recompensa</Label>
                  <Input 
                    required 
                    type="number"
                    value={newCampaign.xpValue} 
                    onChange={e => setNewCampaign(p => ({ ...p, xpValue: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>

                <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl mt-2">
                  Destravar Desafio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>

      {/* Regra de Cálculo do Ranking - Card Informativo Premium */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20 text-[#D4AF37]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Regra de Cálculo de Performance do Ranking</h3>
            <p className="text-xs text-zinc-500">Transparência e critérios objetivos focados em qualidade e execução estratégica.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl space-y-2">
            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider block">🎯 Metas Manuais (Peso 70%)</span>
            <p className="text-xs text-zinc-400">
              Média do progresso percentual de todas as metas individuais cadastradas e atualizadas pelo gestor para o mês selecionado.
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl space-y-2">
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">📋 Checklist Diário (Peso 30%)</span>
            <p className="text-xs text-zinc-400">
              Nota média de conformidade operacional (%) das auditorias e checklists de qualidade realizados no período correspondente.
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl space-y-2">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">🏆 Elegibilidade a Bônus</span>
            <div className="text-[11px] space-y-1 text-zinc-400">
              <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-zinc-300 font-medium">Elegível:</span> Metas ≥ 80% + Checklist ≥ 85%</p>
              <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> <span className="text-zinc-300 font-medium">Em Evolução:</span> Metas ≥ 50% ou Checklist ≥ 70%</p>
              <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> <span className="text-zinc-300 font-medium">Atenção:</span> Abaixo destes patamares</p>
            </div>
          </div>
        </div>

        <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/15 p-3 rounded-xl flex items-center justify-between text-xs text-[#D4AF37]/90">
          <span className="font-semibold">Fórmula de Cálculo Inteligente:</span>
          <span className="font-mono font-bold bg-[#D4AF37]/10 px-2 py-0.5 rounded">Score = (Progresso de Metas * 0.7) + (Média de Checklist * 0.3)</span>
        </div>
      </div>

      {/* Destaque do Profissional do Mês / Campeão */}
      {topProfessional && (
        <div className="bg-[#0b0c10] border border-emerald-500/15 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex items-center gap-5 z-10 w-full md:w-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-yellow-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">
              👑
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" /> Profissional Líder de Performance
              </span>
              <h2 className="text-2xl font-bold font-sans text-white">{topProfessional.name}</h2>
              <p className="text-zinc-400 text-xs">
                Nível <span className="font-bold text-yellow-500 font-mono">{topProfessional.level}</span> • Total de <span className="text-white font-semibold font-mono">{topProfessional.totalXP.toLocaleString()} XP</span> acumulados neste ciclo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center w-full md:w-auto bg-zinc-950/40 p-4 rounded-2xl border border-zinc-900 z-10">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Faturamento</span>
              <span className="text-sm font-semibold text-white font-mono">{formatBRL(topProfessional.totalRevenue)}</span>
            </div>
            <div className="border-x border-zinc-900">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Produtos</span>
              <span className="text-sm font-semibold text-yellow-500 font-mono">{topProfessional.totalProducts} un</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Badges</span>
              <span className="text-sm font-semibold text-zinc-300 font-mono">{topProfessional.unlockedBadgesCount} / 5</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-900 pb-px flex items-center gap-6">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'leaderboard' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Quadro de Líderes (Equipe)
          </span>
          {activeTab === 'leaderboard' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('quests')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'quests' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Missões Ativas ({campaigns.length})
          </span>
          {activeTab === 'quests' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'rewards' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Award className="w-4 h-4" /> Sistema de Badges & Conquistas
          </span>
          {activeTab === 'rewards' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>
      </div>

      {/* Conteúdos das abas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'leaderboard' && (
            <div className="space-y-5">
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-heading text-white">Prêmio Top Performance Lumière</h3>
                    <p className="text-xs text-zinc-500 font-sans">Métricas de performance acumuladas para o período selecionado. O score final pondera 70% Metas Manuais e 30% Checklists.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handleDownloadPDF}
                      className="bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-[#e5bd3d] hover:to-amber-600 text-black font-semibold rounded-xl text-xs px-4 h-9 flex items-center gap-1.5 shadow-lg shadow-yellow-500/10 cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" /> Baixar PDF Geral
                    </Button>
                    <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900 px-3.5 py-1.5 rounded-full border border-zinc-800 font-sans">
                      <Flame className="w-4 h-4 text-orange-500" /> Atualiza em tempo real
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-zinc-900 overflow-x-auto">
                  {professionalsPerformance.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-sm font-sans">
                      Nenhum colaborador registrado no salão para entrar na disputa.
                    </div>
                  ) : (
                    professionalsPerformance.map((prof, idx) => {
                      const isTop3 = idx < 3;
                      const medalColor = idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-zinc-400' : 'bg-orange-600';
                      
                      return (
                        <div key={prof.id} className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-zinc-900/10 transition-colors">
                          <div className="flex items-center gap-4 min-w-[240px]">
                            {/* Posição do ranking */}
                            <div className="w-8 flex justify-center">
                              {isTop3 ? (
                                <span className={`w-6 h-6 rounded-lg ${medalColor} text-black font-extrabold text-[11px] flex items-center justify-center shadow-lg font-sans`}>
                                  {idx + 1}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600 font-bold font-mono">
                                  #{idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Foto/Ícone */}
                            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0 font-sans">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}
                            </div>

                            {/* Info */}
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                                {prof.name || prof.fullName}
                                {idx === 0 && <span className="text-[10px] bg-yellow-500/15 border border-yellow-500/20 text-yellow-500 font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase font-sans">Líder</span>}
                              </h4>
                              <p className="text-zinc-500 text-[11px] flex items-center gap-1.5 font-sans">
                                Nível <span className="text-white font-bold font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{prof.level}</span> • {prof.unlockedBadgesCount} Conquistas
                              </p>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 flex-1">
                            {/* Score Final */}
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Score Final</span>
                              <span className="text-sm font-bold text-[#D4AF37] font-mono">{prof.performanceScore}%</span>
                            </div>

                            {/* Média Checklist */}
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Checklist (30%)</span>
                              <span className="text-xs font-bold text-white font-mono">
                                {prof.totalChecklists > 0 ? `${prof.avgScore.toFixed(1)}%` : "N/A"}
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-sans">{prof.totalChecklists} rotinas</span>
                            </div>

                            {/* Metas Batidas */}
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Metas (70%)</span>
                              <span className="text-xs font-bold text-white font-mono">
                                {prof.totalGoals > 0 ? `${prof.goalsHit}/${prof.totalGoals}` : "N/A"}
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-sans">
                                {prof.totalGoals > 0 ? `${prof.avgGoalProgress.toFixed(0)}% progresso` : "Sem metas"}
                              </span>
                            </div>

                            {/* Faturamento */}
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Faturamento</span>
                              <span className="text-xs font-bold text-emerald-500 font-mono">{formatBRL(prof.totalRevenue)}</span>
                            </div>

                            {/* Elegibilidade Bônus */}
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans mb-1">Bonificação</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border font-sans ${prof.bonusColor}`}>
                                {prof.bonusLabel}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-3 justify-end shrink-0 pt-2 lg:pt-0">
                            <Button
                              onClick={() => {
                                setSelectedProfForReport(prof);
                                setIsReportOpen(true);
                              }}
                              size="sm"
                              className="bg-zinc-900 hover:bg-zinc-850 text-zinc-200 text-xs rounded-xl border border-zinc-800 h-9 px-4 flex items-center gap-1.5 cursor-pointer select-none font-sans"
                            >
                              Ver Relatório
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quests' && (
            <div className="space-y-6">
              {campaigns.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center mx-auto text-2xl">
                    🎯
                  </div>
                  <h3 className="text-lg font-bold text-white font-heading">Nenhuma Missão Ativa</h3>
                  <p className="text-xs text-zinc-500">
                    O salão não possui desafios temporários de venda ativos no momento. Proprietários ou gerentes podem criar missões no topo da tela para impulsionar serviços casados ou estoque parado!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.map((quest) => {
                    const icon = quest.type === 'product_vendas' ? '🛍️' : quest.type === 'faturamento_elite' ? '💰' : quest.type === 'checklist_perito' ? '✅' : '⚡';
                    const label = quest.type === 'product_vendas' ? 'Venda de Produtos' : quest.type === 'faturamento_elite' ? 'Atingir Faturamento' : quest.type === 'checklist_perito' ? 'Auditorias Limpas' : 'Serviços em Destaque';
                    
                    return (
                      <Card key={quest.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl hover:border-[#D4AF37]/20 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl group-hover:bg-[#D4AF37]/10 transition-colors pointer-events-none" />
                        
                        <CardHeader className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-[#D4AF37] px-2.5 py-1 rounded-full uppercase tracking-widest font-sans">
                                {icon} {label}
                              </span>
                              <CardTitle className="text-lg font-bold text-white pt-2 leading-tight">
                                {quest.title}
                              </CardTitle>
                            </div>

                            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] px-3 py-1.5 rounded-xl font-extrabold text-sm font-mono shrink-0">
                              +{quest.xpValue} XP
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-6 pt-0 space-y-4">
                          <p className="text-xs text-zinc-400">{quest.description}</p>
                          
                          <div className="border-t border-zinc-900/60 pt-4 flex items-center justify-between text-xs">
                            <span className="text-zinc-500 font-sans">Condição de Vitória</span>
                            <span className="text-white font-semibold font-mono">
                              {quest.type === 'faturamento_elite' ? formatBRL(quest.targetValue) : `${quest.targetValue} execuções`}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🏆</div>
                  <h3 className="text-base font-bold text-white mb-2">Mede sua Performance</h3>
                  <p className="text-xs text-zinc-500">
                    O sistema computará cada ação no LumièreOS gerando comanda ou resolvendo checklist. Badges representam faturamento e dedicação.
                  </p>
                </Card>

                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🎖️</div>
                  <h3 className="text-base font-bold text-white mb-2">Engaje sua Equipe</h3>
                  <p className="text-xs text-zinc-500">
                    Exponha os badges no painel dos profissionais para incentivar uma rivalidade saudável de metas batidas e satisfação ao cliente.
                  </p>
                </Card>

                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🎁</div>
                  <h3 className="text-base font-bold text-white mb-2">Premiações Reais</h3>
                  <p className="text-xs text-zinc-500">
                    Dono de salão: utilize os níveis de XP alcançados para presentear sua equipe com bonificações exclusivas ou folgas remuneradas.
                  </p>
                </Card>
              </div>

              {/* Lista Completa de Badges estruturadas */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Catálogo de Emblemas & Badges</h3>
                  <p className="text-xs text-zinc-500">Conquistas desbloqueadas dinamicamente com base nas métricas históricas de agendamento e checklist do profissional.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: 'Mestre da Tesoura', icon: '✂️', desc: 'Prestou mais de 10 serviços no salão.', req: '10 serviços' },
                    { name: 'Inabalável', icon: '⭐', desc: 'Obteve 100% de conformidade em checklist.', req: '1 checklist no topo' },
                    { name: 'Imperador de Vendas', icon: '🛍️', desc: 'Vendeu mais de 3 produtos físicos.', req: '3 produtos vendidos' },
                    { name: 'Luz de Lumière', icon: '👑', desc: 'Faturou acima de R$ 2.000,00 no mês.', req: 'R$ 2.000,00 faturados' },
                    { name: 'Super Querido', icon: '🔥', desc: 'Realizou mais de 20 atendimentos.', req: '20 atendimentos concluídos' },
                  ].map(b => (
                    <div key={b.name} className="p-4 bg-zinc-900/60 border border-zinc-900 rounded-2xl flex items-start gap-4">
                      <div className="w-12 h-12 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center text-2xl shrink-0 font-sans">
                        {b.icon}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">{b.name}</h4>
                        <p className="text-zinc-500 text-[11px] leading-relaxed">{b.desc}</p>
                        <span className="inline-block text-[10px] text-yellow-500/80 font-mono font-semibold pt-1">Requisito: {b.req}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal de Relatório do Profissional */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-900 text-white max-w-2xl rounded-3xl p-6 shadow-2xl">
          {selectedProfForReport && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl text-[#D4AF37] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" /> Relatório de Performance Individual
                  </span>
                  <Button
                    onClick={() => handleDownloadIndividualPDF(selectedProfForReport)}
                    size="sm"
                    className="bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 border border-zinc-800 rounded-xl h-8 px-3.5 flex items-center gap-1.5"
                  >
                    Baixar PDF
                  </Button>
                </DialogTitle>
                <CardDescription className="text-zinc-500">
                  Resumo operacional e comercial detalhado para acompanhamento de qualidade e comissionamento.
                </CardDescription>
              </DialogHeader>

              {/* Profile Card & Diagnóstico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/40 border border-zinc-900/80 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{selectedProfForReport.name || selectedProfForReport.fullName}</h4>
                    <p className="text-xs text-zinc-500">Nível {selectedProfForReport.level} • {selectedProfForReport.totalXP.toLocaleString()} XP</p>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-900/80 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1 font-sans">Status de Bonificação</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border font-sans ${selectedProfForReport.bonusColor}`}>
                      {selectedProfForReport.bonusLabel}
                    </span>
                    <span className="text-[#D4AF37] font-mono text-sm font-bold">({selectedProfForReport.performanceScore}%)</span>
                  </div>
                </div>
              </div>

              {/* Seção de Diagnóstico e Auditoria de Posição */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Diagnóstico e Justificativa</h4>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">{selectedProfForReport.explanation.reason}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block font-sans">💪 Pontos Fortes</span>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 font-sans">
                      {selectedProfForReport.explanation.pointsOfStrength.map((str: string, i: number) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] text-orange-400 font-bold uppercase tracking-wider block font-sans">⚠️ Pontos de Atenção</span>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 font-sans">
                      {selectedProfForReport.explanation.pointsOfAttention.map((att: string, i: number) => (
                        <li key={i}>{att}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Faturamento</span>
                  <span className="text-sm font-bold text-white font-mono block">{formatBRL(selectedProfForReport.totalRevenue)}</span>
                </div>
                <div className="p-4 bg-zinc-900/20 border border-[#D4AF37]/10 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Serviços Concluídos</span>
                  <span className="text-sm font-bold text-white font-mono block">{selectedProfForReport.totalServices}</span>
                </div>
                <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Produtos Vendidos</span>
                  <span className="text-sm font-bold text-white font-mono block">{selectedProfForReport.totalProducts}</span>
                </div>
                <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Nota Checklist</span>
                  <span className="text-sm font-bold text-white font-mono block">
                    {selectedProfForReport.totalChecklists > 0 ? `${selectedProfForReport.avgScore.toFixed(1)}%` : "N/A"}
                  </span>
                  <span className="text-[9px] text-zinc-500 block font-sans">Em {selectedProfForReport.totalChecklists} rotinas</span>
                </div>
                <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Metas Batidas</span>
                  <span className="text-sm font-bold text-white font-mono block">
                    {selectedProfForReport.totalGoals > 0 ? `${selectedProfForReport.goalsHit} / ${selectedProfForReport.totalGoals}` : "N/A"}
                  </span>
                  <span className="text-[9px] text-zinc-500 block font-sans">Metas individuais</span>
                </div>
                <div className="p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Progresso Médio</span>
                  <span className="text-sm font-bold text-white font-mono block">
                    {selectedProfForReport.totalGoals > 0 ? `${selectedProfForReport.avgGoalProgress.toFixed(1)}%` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="space-y-3">
                <span className="text-xs text-zinc-500 uppercase tracking-widest block font-sans">Conquistas Destravadas</span>
                <div className="flex flex-wrap gap-2">
                  {selectedProfForReport.badges.filter((b: any) => b.unlocked).length === 0 ? (
                    <span className="text-zinc-600 text-xs font-sans">Nenhum emblema destravado neste ciclo ainda.</span>
                  ) : (
                    selectedProfForReport.badges.filter((b: any) => b.unlocked).map((badge: any) => (
                      <span key={badge.name} className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-xl font-medium font-sans" title={badge.description}>
                        <span>{badge.icon}</span> {badge.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
