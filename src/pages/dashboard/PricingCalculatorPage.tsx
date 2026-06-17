import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { 
  Calculator, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Plus, 
  Trash, 
  Check, 
  Info, 
  Percent, 
  Package, 
  Scissors, 
  User, 
  ChevronRight, 
  Calendar,
  Save,
  Search,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CustomProductRow {
  name: string;
  cost: number;
}

interface SavedPricing {
  id?: string;
  serviceName: string;
  durationHours: number;
  durationMinutes: number;
  hourlyChairCost: number;
  monthlyCosts: number;
  productsCost: number;
  suggestedPrice: number;
  selectedProfitMargin: number;
  businessProfit: number;
  partnerProfit: number;
  partnerCommissionPercent: number;
  createdAt: number;
}

export default function PricingCalculatorPage() {
  const { userData, salonData } = useAuth();
  const [activeTab, setActiveTab] = useState<'calculator' | 'saved'>('calculator');
  const [isLoading, setIsLoading] = useState(false);
  const [savedCalculations, setSavedCalculations] = useState<SavedPricing[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- STEP 1: VALUE OF THE HOUR ON THE CHAIR ---
  // Fixed Monthly Costs
  const [rent, setRent] = useState<number>(3500);
  const [electricity, setElectricity] = useState<number>(650);
  const [waterInternet, setWaterInternet] = useState<number>(450);
  const [accountant, setAccountant] = useState<number>(400);
  const [ownerSalary, setOwnerSalary] = useState<number>(5000);
  const [staffSalaries, setStaffSalaries] = useState<number>(4200);

  // Variable Monthly Costs
  const [generalStock, setGeneralStock] = useState<number>(2000);
  const [marketingAds, setMarketingAds] = useState<number>(800);
  const [adminFees, setAdminFees] = useState<number>(350);
  const [saasPlatforms, setSaasPlatforms] = useState<number>(299);
  const [otherCosts, setOtherCosts] = useState<number>(500);

  // Work Capacity Details
  const [daysWorkedMonth, setDaysWorkedMonth] = useState<number>(24);
  const [hoursWorkedDay, setHoursWorkedDay] = useState<number>(8);
  const [activeChairs, setActiveChairs] = useState<number>(3);

  // --- STEP 2: TAXES, FEES & PROFITABILITY ---
  const [taxPercent, setTaxPercent] = useState<number>(6); // Impostos
  const [cardFeePercent, setCardFeePercent] = useState<number>(2.5); // Taxa do Cartão
  const [clientDiscountPercent, setClientDiscountPercent] = useState<number>(0); // Desconto Cliente
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(25); // Margem de Lucro Desejada
  const [partnerCommissionPercent, setPartnerCommissionPercent] = useState<number>(40); // Comissão Profissional

  // --- STEP 3: PRODUCTS & INSUMOS (CONSUMIBLES LIST FOR THE SPECIFIC SERVICE) ---
  const [colorCost, setColorCost] = useState<number>(18.5); // Tinta / Coloração
  const [shampooCost, setShampooCost] = useState<number>(3.2); // Shampoo / Condicionador
  const [hairMaskCost, setHairMaskCost] = useState<number>(5.5); // Máscara Capilar
  const [treatmentCost, setTreatmentCost] = useState<number>(0); // Progressiva / Botox
  const [keratinCost, setKeratinCost] = useState<number>(0); // Queratina
  const [hydrogenPeroxideCost, setHydrogenPeroxideCost] = useState<number>(4.8); // Água Oxigenada
  const [glovesCost, setGlovesCost] = useState<number>(1.5); // Luvas / Descartáveis
  const [teamMaintenanceCost, setTeamMaintenanceCost] = useState<number>(0.5); // Manutenção de equipe
  const [otherProductsCost, setOtherProductsCost] = useState<number>(1.2); // Outros produtos

  const [customProducts, setCustomProducts] = useState<CustomProductRow[]>([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCost, setNewCustomCost] = useState<string>('');

  // --- STEP 4: SERVICE DETAILS ---
  const [serviceName, setServiceName] = useState('Coloração Essenza Excellence');
  const [durationHours, setDurationHours] = useState<number>(1);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);

  // --- CALCULATIONS ENGINE ---
  // Step 1 totals
  const totalFixedCosts = useMemo(() => {
    return rent + electricity + waterInternet + accountant + ownerSalary + staffSalaries;
  }, [rent, electricity, waterInternet, accountant, ownerSalary, staffSalaries]);

  const totalVariableCosts = useMemo(() => {
    return generalStock + marketingAds + adminFees + saasPlatforms + otherCosts;
  }, [generalStock, marketingAds, adminFees, saasPlatforms, otherCosts]);

  const totalMonthlyCosts = useMemo(() => {
    return totalFixedCosts + totalVariableCosts;
  }, [totalFixedCosts, totalVariableCosts]);

  const totalCapacityHours = useMemo(() => {
    return daysWorkedMonth * hoursWorkedDay * activeChairs;
  }, [daysWorkedMonth, hoursWorkedDay, activeChairs]);

  const hourlyChairCost = useMemo(() => {
    if (totalCapacityHours <= 0) return 0;
    return totalMonthlyCosts / totalCapacityHours;
  }, [totalMonthlyCosts, totalCapacityHours]);

  // Step 3 totals (Insumos)
  const baseProductsCost = useMemo(() => {
    return colorCost + shampooCost + hairMaskCost + treatmentCost + keratinCost + hydrogenPeroxideCost + glovesCost + teamMaintenanceCost + otherProductsCost;
  }, [colorCost, shampooCost, hairMaskCost, treatmentCost, keratinCost, hydrogenPeroxideCost, glovesCost, teamMaintenanceCost, otherProductsCost]);

  const customProductsTotal = useMemo(() => {
    return customProducts.reduce((sum, item) => sum + item.cost, 0);
  }, [customProducts]);

  const totalProductsCost = useMemo(() => {
    return baseProductsCost + customProductsTotal;
  }, [baseProductsCost, customProductsTotal]);

  // Step 4 final calculation
  const totalServiceDurationInHours = useMemo(() => {
    return durationHours + (durationMinutes / 60);
  }, [durationHours, durationMinutes]);

  const serviceChairCapacityCost = useMemo(() => {
    return totalServiceDurationInHours * hourlyChairCost;
  }, [totalServiceDurationInHours, hourlyChairCost]);

  // Financial Pricing Engine (Service Cost vs Pricing Percentages)
  const baseCostOfService = useMemo(() => {
    return totalProductsCost + serviceChairCapacityCost;
  }, [totalProductsCost, serviceChairCapacityCost]);

  const totalDeductionsPercent = useMemo(() => {
    return taxPercent + cardFeePercent + clientDiscountPercent + profitMarginPercent + partnerCommissionPercent;
  }, [taxPercent, cardFeePercent, clientDiscountPercent, profitMarginPercent, partnerCommissionPercent]);

  // Suggest pricing output
  const pricingResults = useMemo(() => {
    const deductionsMultiplier = totalDeductionsPercent / 100;
    let suggestedPrice = 0;
    
    if (deductionsMultiplier < 1) {
      // Traditional Profit Margin / Markup Markup Formula: Cost / (1 - deductions)
      suggestedPrice = baseCostOfService / (1 - deductionsMultiplier);
    } else {
      // Avoid division by zero/negative with multiplier backup
      suggestedPrice = baseCostOfService * (1 + deductionsMultiplier);
    }

    const businessProfit = suggestedPrice * (profitMarginPercent / 100);
    const partnerProfit = suggestedPrice * (partnerCommissionPercent / 100);

    return {
      suggestedPrice,
      businessProfit,
      partnerProfit,
    };
  }, [baseCostOfService, totalDeductionsPercent, profitMarginPercent, partnerCommissionPercent]);

  // Load Saved Calculations from Firebase
  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedCalculations();
    }
  }, [activeTab]);

  const fetchSavedCalculations = async () => {
    if (!salonData?.id) return;
    setIsLoading(true);
    try {
      const qPricing = query(
        collection(db, `salons/${salonData.id}/pricing_calculations`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(qPricing);
      const list: SavedPricing[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SavedPricing);
      });
      setSavedCalculations(list);
    } catch (err: any) {
      console.error("Erro ao carregar precificações salvas:", err);
      toast.error("Erro ao buscar histórico de precificação.");
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomProduct = () => {
    if (!newCustomName.trim()) {
      toast.error("Insira o nome do insumo.");
      return;
    }
    const parsedCost = parseFloat(newCustomCost.replace(',', '.'));
    if (isNaN(parsedCost) || parsedCost < 0) {
      toast.error("Valor inválido.");
      return;
    }

    setCustomProducts([...customProducts, { name: newCustomName.trim(), cost: parsedCost }]);
    setNewCustomName('');
    setNewCustomCost('');
    toast.success("Insumo adicional adicionado!");
  };

  const removeCustomProduct = (index: number) => {
    const updated = customProducts.filter((_, idx) => idx !== index);
    setCustomProducts(updated);
    toast.success("Insumo removido.");
  };

  const handleSaveCalculation = async () => {
    if (!salonData?.id) {
      toast.error("Salão inválido para o usuário atual.");
      return;
    }
    if (!serviceName.trim()) {
      toast.error("Forneça o nome do serviço para salvar.");
      return;
    }

    const calculationData: SavedPricing = {
      serviceName: serviceName.trim(),
      durationHours,
      durationMinutes,
      hourlyChairCost,
      monthlyCosts: totalMonthlyCosts,
      productsCost: totalProductsCost,
      suggestedPrice: pricingResults.suggestedPrice,
      selectedProfitMargin: profitMarginPercent,
      businessProfit: pricingResults.businessProfit,
      partnerProfit: pricingResults.partnerProfit,
      partnerCommissionPercent,
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, `salons/${salonData.id}/pricing_calculations`), calculationData);
      toast.success(`Fórmula de precificação do serviço "${serviceName}" salva com sucesso!`);
      // Reset custom inputs just in case or keep them to make quick edits.
    } catch (err: any) {
      console.error("Erro ao salvar cálculo:", err);
      toast.error("Erro ao gravar dados no Firebase.");
    }
  };

  const handleDeleteSaved = async (id: string, name: string) => {
    if (!salonData?.id || !id) return;
    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/pricing_calculations`, id));
      toast.success(`Cálculo de "${name}" removido com sucesso.`);
      setSavedCalculations(savedCalculations.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Erro ao excluir:", err);
      toast.error("Ocorreu um erro ao excluir o registro.");
    }
  };

  // Load a saved calculation values back into active variables to allow revisions
  const handleLoadSavedToCalculator = (saved: SavedPricing) => {
    setServiceName(saved.serviceName);
    setDurationHours(saved.durationHours || 1);
    setDurationMinutes(saved.durationMinutes || 0);
    setPartnerCommissionPercent(saved.partnerCommissionPercent || 40);
    setProfitMarginPercent(saved.selectedProfitMargin || 25);
    // Restore or simulate matching inputs to let users experiment
    toast.success(`Modelagem de "${saved.serviceName}" carregada de volta para edição!`);
    setActiveTab('calculator');
  };

  // Pre-fill / restore original values from standard defaults easily
  const handleResetDefaults = () => {
    setRent(3500);
    setElectricity(650);
    setWaterInternet(450);
    setAccountant(400);
    setOwnerSalary(5000);
    setStaffSalaries(4200);

    setGeneralStock(2000);
    setMarketingAds(800);
    setAdminFees(350);
    setSaasPlatforms(299);
    setOtherCosts(500);

    setDaysWorkedMonth(24);
    setHoursWorkedDay(8);
    setActiveChairs(3);

    setTaxPercent(6);
    setCardFeePercent(2.5);
    setClientDiscountPercent(0);
    setProfitMarginPercent(25);
    setPartnerCommissionPercent(40);

    setColorCost(18.5);
    setShampooCost(3.2);
    setHairMaskCost(5.5);
    setTreatmentCost(0);
    setKeratinCost(0);
    setHydrogenPeroxideCost(4.8);
    setGlovesCost(1.5);
    setTeamMaintenanceCost(0.5);
    setOtherProductsCost(1.2);
    setCustomProducts([]);

    toast.info("Valores padrão restaurados.");
  };

  const filteredSavedCalculations = savedCalculations.filter((calc) => 
    calc.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white font-sans selection:bg-[#D4AF37]/30">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light text-white tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#D4AF37]" />
            Calculadora de Precificação de Serviços
          </h2>
          <p className="text-zinc-400 text-xs mt-1 font-light">
            Defina o preço de venda científico ideal dos seus serviços de alta costura com base nos custos reais do salão.
          </p>
        </div>
        <div className="flex bg-zinc-950 p-1 border border-white/5 rounded-xl self-stretch sm:self-auto shrink-0 shadow-lg">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'calculator' 
                ? 'bg-[#D4AF37] text-black shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Calculadora
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'saved' 
                ? 'bg-[#D4AF37] text-black shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Serviços Salvos
          </button>
        </div>
      </div>

      {activeTab === 'calculator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Left Columns: Form Steps (8 columns on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* ETAPA 1: VALOR DA HORA NA CADEIRA */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#D4AF37]/50" />
              <div className="flex items-center gap-3 mb-4 pl-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-[#D4AF37] border border-white/5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-white uppercase">ETAPA 1: Valor da Hora na Cadeira</h3>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5">Custos fixos, variáveis e capacidade de atendimento mensal do estabelecimento</p>
                </div>
              </div>

              {/* Collapsed view status for Hour Cost calculation info */}
              <div className="mb-4 bg-zinc-950/70 border border-[#D4AF37]/10 rounded-xl p-3 text-xs leading-relaxed flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
                <div className="space-y-1">
                  <span className="text-zinc-400">Total Mensal de Custos: <b className="text-white">R$ {totalMonthlyCosts.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                  <div className="text-[10px] text-zinc-500 font-light">
                    ({daysWorkedMonth} dias * {hoursWorkedDay} horas * {activeChairs} cadeiras = {totalCapacityHours} horas produtivas totais/mês)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-zinc-400 text-[10px] block font-light uppercase tracking-widest">Custo por Hora p/ Cadeira</span>
                  <span className="text-[#D4AF37] font-semibold font-mono text-base">R$ {hourlyChairCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / h</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                {/* Custos Fixos Column */}
                <div className="space-y-3.5 bg-zinc-950/25 p-3.5 rounded-xl border border-white/[0.02]">
                  <span className="text-[11px] font-bold tracking-widest text-[#D4AF37]/80 uppercase block">Custos Fixos Mensais (R$)</span>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Aluguel do Salão</label>
                      <Input 
                        type="number" 
                        value={rent === 0 ? '' : rent}
                        onChange={(e) => setRent(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Energia Elétrica</label>
                      <Input 
                        type="number" 
                        value={electricity === 0 ? '' : electricity}
                        onChange={(e) => setElectricity(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Água, Tel e Internet</label>
                      <Input 
                        type="number" 
                        value={waterInternet === 0 ? '' : waterInternet}
                        onChange={(e) => setWaterInternet(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Escritor / Contador</label>
                      <Input 
                        type="number" 
                        value={accountant === 0 ? '' : accountant}
                        onChange={(e) => setAccountant(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Pró-labore Sócios</label>
                      <Input 
                        type="number" 
                        value={ownerSalary === 0 ? '' : ownerSalary}
                        onChange={(e) => setOwnerSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] text-zinc-300 font-light">Salários & Encargos</label>
                      <Input 
                        type="number" 
                        value={staffSalaries === 0 ? '' : staffSalaries}
                        onChange={(e) => setStaffSalaries(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Custos Variaveis e Capacidade column */}
                <div className="space-y-5">
                  <div className="space-y-3 bg-zinc-950/25 p-3.5 rounded-xl border border-white/[0.02]">
                    <span className="text-[11px] font-bold tracking-widest text-[#D4AF37]/80 uppercase block">Custos Variáveis Mensais (R$)</span>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Estoque / Insumos Gerais</label>
                        <Input 
                          type="number" 
                          value={generalStock === 0 ? '' : generalStock}
                          onChange={(e) => setGeneralStock(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Marketing / Anúncios</label>
                        <Input 
                          type="number" 
                          value={marketingAds === 0 ? '' : marketingAds}
                          onChange={(e) => setMarketingAds(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Taxas / Comissão Adm</label>
                        <Input 
                          type="number" 
                          value={adminFees === 0 ? '' : adminFees}
                          onChange={(e) => setAdminFees(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Plataforma / LumièreOS</label>
                        <Input 
                          type="number" 
                          value={saasPlatforms === 0 ? '' : saasPlatforms}
                          onChange={(e) => setSaasPlatforms(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Outros Gastos Variáveis</label>
                        <Input 
                          type="number" 
                          value={otherCosts === 0 ? '' : otherCosts}
                          onChange={(e) => setOtherCosts(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-28 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-zinc-950/25 p-3.5 rounded-xl border border-[#D4AF37]/5">
                    <span className="text-[11px] font-bold tracking-widest text-[#D4AF37] uppercase block">Capacidade Operativa</span>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Dias de Aula / Mês</label>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            value={daysWorkedMonth}
                            onChange={(e) => setDaysWorkedMonth(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                          />
                          <span className="text-[10px] text-zinc-500 w-8">dias</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Horas Operacionais / Dia</label>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            value={hoursWorkedDay}
                            onChange={(e) => setHoursWorkedDay(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                          />
                          <span className="text-[10px] text-zinc-500 w-8">horas</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] text-zinc-300 font-light">Cadeiras Ativas / Staff</label>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            value={activeChairs}
                            onChange={(e) => setActiveChairs(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 text-center font-mono text-xs bg-zinc-950 border-white/5 h-8 focus:border-[#D4AF37]/30"
                          />
                          <span className="text-[10px] text-zinc-500 w-8">pros</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ETAPA 2: IMPOSTOS, TAXAS & LUCRATIVIDADE */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#D4AF37]/50" />
              <div className="flex items-center gap-3 mb-4 pl-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-[#D4AF37] border border-white/5">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-white uppercase">ETAPA 2: Impostos, taxas & Lucratividade</h3>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5">Parâmetros percentuais deduzidos sobre o preço bruto final de venda do serviço</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.03] space-y-2">
                  <label className="text-[10px] text-zinc-300 uppercase tracking-wider block font-semibold">Impostos (%)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={taxPercent === 0 ? '' : taxPercent}
                      onChange={(e) => setTaxPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="text-center font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 focus:border-[#D4AF37]/30"
                    />
                    <Percent className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-light block leading-tight">E.g. DAS do Simples Nacional ou MEI</span>
                </div>

                <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.03] space-y-2">
                  <label className="text-[10px] text-zinc-300 uppercase tracking-wider block font-semibold">Taxa Cartão (%)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={cardFeePercent === 0 ? '' : cardFeePercent}
                      onChange={(e) => setCardFeePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="text-center font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 focus:border-[#D4AF37]/30"
                    />
                    <Percent className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-light block leading-tight">Média de débito, crédito ou parcelas</span>
                </div>

                <div className="bg-zinc-950/40 p-3 rounded-xl border border-white/[0.03] space-y-2">
                  <label className="text-[10px] text-zinc-300 uppercase tracking-wider block font-semibold">Desc. Cliente (%)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={clientDiscountPercent}
                      onChange={(e) => setClientDiscountPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="text-center font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 focus:border-[#D4AF37]/30"
                    />
                    <Percent className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-light block leading-tight">Previsão para mimos ou cashbacks</span>
                </div>

                <div className="bg-zinc-[#D4AF37]/5 p-3 rounded-xl border border-[#D4AF37]/20 space-y-2">
                  <label className="text-[10px] text-[#D4AF37] uppercase tracking-wider block font-bold">Margem Lucro (%)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={profitMarginPercent === 0 ? '' : profitMarginPercent}
                      onChange={(e) => setProfitMarginPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="text-center font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 font-semibold text-[#D4AF37] focus:border-[#D4AF37]/55"
                    />
                    <Percent className="w-3.5 h-3.5 text-[#D4AF37]/70 absolute right-2 top-2.5" />
                  </div>
                  <span className="text-[9px] text-zinc-400 font-light block leading-tight">Retorno limpo reservado p/ a loja</span>
                </div>

                <div className="bg-zinc-900 p-3 rounded-xl border border-amber-500/10 space-y-2">
                  <label className="text-[10px] text-amber-400 uppercase tracking-wider block font-semibold">Comissão Pro (%)</label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1"
                      value={partnerCommissionPercent === 0 ? '' : partnerCommissionPercent}
                      onChange={(e) => setPartnerCommissionPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="text-center font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 focus:border-[#D4AF37]/30"
                    />
                    <Percent className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-light block leading-tight">Valor repassado ao cabeleireiro</span>
                </div>
              </div>
            </div>

            {/* ETAPA 3: PRODUTOS & INSUMOS NO SERVIÇO */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#D4AF37]/50" />
              <div className="flex items-center justify-between gap-3 mb-4 pl-2">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-zinc-800 text-[#D4AF37] border border-white/5">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-wider text-white uppercase">ETAPA 3: Produtos & Insumos no Serviço</h3>
                    <p className="text-[10px] text-zinc-400 font-light mt-0.5">Custos diretos proporcionais dos produtos aplicados durante este procedimento específico</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">Custo de Produtos</span>
                  <span className="text-sm font-semibold font-mono text-pink-400">R$ {totalProductsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3.5 bg-zinc-950/25 p-4 rounded-xl border border-white/[0.02]">
                
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Tinta / Coloração</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={colorCost === 0 ? '' : colorCost}
                      onChange={(e) => setColorCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Shampoo / Condicionado</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={shampooCost === 0 ? '' : shampooCost}
                      onChange={(e) => setShampooCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Máscara Capilar</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={hairMaskCost === 0 ? '' : hairMaskCost}
                      onChange={(e) => setHairMaskCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Progressiva / Botox / Alisamento</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={treatmentCost === 0 ? '' : treatmentCost}
                      onChange={(e) => setTreatmentCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Queratina / Reconstrução</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={keratinCost === 0 ? '' : keratinCost}
                      onChange={(e) => setKeratinCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Água Oxigenada / Pó</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={hydrogenPeroxideCost === 0 ? '' : hydrogenPeroxideCost}
                      onChange={(e) => setHydrogenPeroxideCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Luvas / Descartáveis</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={glovesCost === 0 ? '' : glovesCost}
                      onChange={(e) => setGlovesCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Manutenção de Equipe / Toalhas</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={teamMaintenanceCost === 0 ? '' : teamMaintenanceCost}
                      onChange={(e) => setTeamMaintenanceCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[11px] text-zinc-300 font-light">Outros insumos pequenos</span>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.01"
                      value={otherProductsCost === 0 ? '' : otherProductsCost}
                      onChange={(e) => setOtherProductsCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 text-right font-mono text-xs bg-zinc-950 border-white/5 h-8 pr-5 focus:border-[#D4AF37]/30"
                    />
                    <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2">R$</span>
                  </div>
                </div>

              </div>

              {/* Dynamic list of custom chemical products */}
              <div className="mt-4 pt-3.5 border-t border-white/5 space-y-3">
                <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block">Adicionar Insumo Personalizado</span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input 
                    type="text"
                    placeholder="Nome do produto especial"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    className="flex-1 bg-zinc-950 border-white/5 text-xs h-9 focus:border-[#D4AF37]/35"
                  />
                  <div className="flex gap-2">
                    <div className="relative w-32">
                      <Input 
                        type="text"
                        placeholder="Custo (R$)"
                        value={newCustomCost}
                        onChange={(e) => setNewCustomCost(e.target.value)}
                        className="text-right font-mono text-xs bg-zinc-950 border-white/5 h-9 pr-6 focus:border-[#D4AF37]/35"
                      />
                      <span className="text-[9px] text-zinc-500 absolute right-1.5 top-2.5">R$</span>
                    </div>
                    <Button 
                      onClick={addCustomProduct}
                      size="sm" 
                      className="bg-zinc-800 text-white border border-white/10 hover:bg-zinc-700 h-9 shrink-0 gap-1"
                    >
                      <Plus className="w-4 h-4 text-[#D4AF37]" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {customProducts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {customProducts.map((p, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-[#D4AF37]/15 text-xs font-light"
                      >
                        <span className="truncate max-w-[150px]">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#D4AF37] font-semibold">R$ {p.cost.toFixed(2)}</span>
                          <button 
                            onClick={() => removeCustomProduct(idx)}
                            className="text-zinc-500 hover:text-red-400 p-1"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ETAPA 4: DADOS DO SERVIÇO */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#D4AF37]/50" />
              <div className="flex items-center gap-3 mb-4 pl-2">
                <div className="p-1.5 rounded-lg bg-zinc-800 text-[#D4AF37] border border-white/5">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-white uppercase">ETAPA 4: Dados do Serviço & Tempo</h3>
                  <p className="text-[10px] text-zinc-400 font-light mt-0.5">Informe o nome do procedimento e a quantidade de tempo em que a cadeira ficará ocupada</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-300 font-semibold uppercase tracking-wider block">Nome do Serviço</label>
                  <Input 
                    type="text" 
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="bg-zinc-950 border-white/5 text-xs h-9"
                    placeholder="Ex: Escova modeladora, Corte curto, Mechas Ombré"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-300 font-semibold uppercase tracking-wider block">Duração Estimada do Serviço</label>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center gap-1.5 bg-zinc-950 border border-white/5 rounded-xl px-2 h-9">
                      <Input 
                        type="number"
                        min="0"
                        max="24"
                        value={durationHours}
                        onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-transparent border-0 text-right w-12 focus-visible:ring-0 text-xs p-1"
                      />
                      <span className="text-[10px] text-zinc-500">horas</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 bg-zinc-950 border border-white/5 rounded-xl px-2 h-9">
                      <Input 
                        type="number"
                        min="0"
                        max="59"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="bg-transparent border-0 text-right w-12 focus-visible:ring-0 text-xs p-1"
                      />
                      <span className="text-[10px] text-zinc-500">minutos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Sticky calculation suggestions (4 columns of 12) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            
            {/* SUGGESTED PRICE GIAN BANNER */}
            <div className="bg-gradient-to-b from-[#18181b] to-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute top-0 inset-x-0 h-1 bg-[#D4AF37]" />
              
              <span className="text-[11px] text-zinc-400 font-light tracking-widest uppercase mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" /> PREÇO DE VENDA SUGERIDO
              </span>
              
              <h2 className="text-4xl font-heading font-extrabold text-[#D4AF37] font-mono tracking-tight my-2">
                R$ {pricingResults.suggestedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>

              <p className="text-[10px] text-zinc-500 font-light leading-relaxed max-w-[240px] mb-6">
                Preço final sugerido para repasse ao consumidor cobrindo todos os custos e as suas margens desejadas.
              </p>

              {/* Business & Partner Profit Breakdown */}
              <div className="w-full space-y-3 bg-zinc-950/60 border border-white/5 p-4 rounded-xl text-left shadow-inner">
                <div className="flex items-center justify-between text-xs pb-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                    <span className="text-zinc-400 font-light">Lucro Próprio (Salão):</span>
                  </div>
                  <span className="font-semibold text-white font-mono">R$ {pricingResults.businessProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-zinc-400 font-light">Repasse ao Profissional:</span>
                  </div>
                  <span className="font-semibold text-zinc-300 font-mono">R$ {pricingResults.partnerProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Quick cost summary */}
              <div className="w-full mt-5 space-y-2 border-t border-white/5 pt-4 text-xs font-light text-zinc-400 text-left">
                <div className="flex justify-between items-center text-[11px]">
                  <span>Custo Fixo por hora:</span>
                  <span className="font-mono text-white">R$ {hourlyChairCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Vaga de Hora no Serviço:</span>
                  <span className="font-mono text-white">R$ {serviceChairCapacityCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Total em Produtos Usados:</span>
                  <span className="font-mono text-white">R$ {totalProductsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-1 mt-1 border-t border-white/[0.03] text-sm font-semibold text-white">
                  <span>Custo Base do Procedimento:</span>
                  <span className="font-mono text-zinc-300">R$ {baseCostOfService.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="w-full mt-6 space-y-2.5">
                <Button 
                  onClick={handleSaveCalculation}
                  className="w-full bg-[#D4AF37] text-black font-bold h-11 hover:bg-[#D4AF37]/90 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-4.5 h-4.5" />
                  Salvar Fórmula de Precificação
                </Button>
                <Button
                  onClick={handleResetDefaults}
                  variant="outline"
                  className="w-full border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white h-9 rounded-xl transition-all flex items-center justify-center gap-1 bg-transparent"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                  Restaurar Valores Padrão
                </Button>
              </div>
            </div>

            {/* Educational Info box */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 text-[11px] leading-relaxed text-zinc-400 hover:border-[#D4AF37]/15 transition-all">
              <h4 className="font-semibold text-white mb-1.5 flex items-center gap-1.5 text-xs text-[#D4AF37]">
                <Info className="w-4 h-4 text-[#D4AF37]" />
                Como funciona a Precificação de Luxo?
              </h4>
              <p className="font-light">
                Salões premium tomam prejuízo quando cobram apenas multiplicando o custo dos produtos químicos ( markup simplista ). 
                A verdadeira fórmula considera o custo operacional de manter a cadeira funcionando por hora de forma individual (<b>Hora na Cadeira</b>) somado às metas percentuais de lucratividade e despesas fiscais do salão.
              </p>
            </div>

          </div>

        </div>
      ) : (
        /* SAVED CALCULATIONS LIST TAB */
        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          {/* Filters and search utilities */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <Input
                type="text"
                placeholder="Pesquisar por serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/5 text-xs h-10 w-full focus:border-[#D4AF37]/35"
              />
            </div>
            <Button
              onClick={fetchSavedCalculations}
              variant="outline"
              size="sm"
              className="border-white/10 text-zinc-400 hover:text-white shrink-0 h-10 px-4 rounded-xl gap-2 hover:bg-white/5 bg-transparent"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
              Atualizar Lista
            </Button>
          </div>

          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin mb-4" />
              <span className="text-sm font-light text-zinc-500">Buscando do Firestore...</span>
            </div>
          ) : filteredSavedCalculations.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl">
              <Package className="w-10 h-10 text-zinc-600 mx-auto mb-3.5" />
              <span className="text-sm font-semibold text-zinc-300 block">Nenhum cálculo registrado ainda</span>
              <p className="text-xs text-zinc-500 font-light mt-1 max-w-sm mx-auto">
                {searchTerm 
                  ? "Nenhum resultado corresponde à palavra-chave buscada."
                  : "Utilize a calculadora ao lado para simular precificações e salvar os resultados para consulta futura."}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => setActiveTab('calculator')}
                  size="sm"
                  className="bg-[#D4AF37] text-black font-semibold h-9 rounded-xl px-4 mt-4 hover:bg-[#D4AF37]/90"
                >
                  Começar a Calcular
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavedCalculations.map((calc) => (
                <div 
                  key={calc.id} 
                  className="bg-zinc-950/80 border border-white/5 hover:border-[#D4AF37]/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all duration-300 relative group"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="truncate pr-4">
                        <h4 className="text-sm font-heading font-semibold text-white truncate">{calc.serviceName}</h4>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#D4AF37]" /> Duração: {calc.durationHours}h {calc.durationMinutes}m
                        </span>
                      </div>
                      <div className="bg-[#D4AF37]/5 px-2 py-1 rounded-lg border border-[#D4AF37]/10 shrink-0 text-right">
                        <span className="text-[9px] text-[#D4AF37] uppercase tracking-wider block font-bold leading-none">Venda</span>
                        <span className="text-xs font-semibold text-white font-mono mt-0.5 block">R$ {calc.suggestedPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 bg-zinc-900/40 p-3 rounded-xl text-[11px] font-light text-zinc-400">
                      <div>
                        <span>Lucro Loja ({calc.selectedProfitMargin}%):</span>
                        <span className="font-semibold text-[#D4AF37] block font-mono text-xs mt-0.5">R$ {calc.businessProfit.toFixed(2)}</span>
                      </div>
                      <div>
                        <span>Comissão Pro ({calc.partnerCommissionPercent}%):</span>
                        <span className="font-semibold text-zinc-300 block font-mono text-xs mt-0.5">R$ {calc.partnerProfit.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-white/[0.03] flex justify-between">
                        <span>Custo Produtos: <b className="text-zinc-300 font-mono">R$ {calc.productsCost.toFixed(2)}</b></span>
                        <span>Hora/Cadeira: <b className="text-zinc-300 font-mono">R$ {calc.hourlyChairCost.toFixed(1)}/h</b></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-5 pt-3.5 border-t border-white/5 shrink-0">
                    <Button
                      onClick={() => handleLoadSavedToCalculator(calc)}
                      variant="ghost"
                      size="xs"
                      className="text-[#D4AF37] hover:text-black hover:bg-[#D4AF37] text-[10px] h-7 px-3.5 rounded-lg border border-[#D4AF37]/10"
                    >
                      Editar Fórmula
                    </Button>
                    <button
                      onClick={() => calc.id && handleDeleteSaved(calc.id, calc.serviceName)}
                      className="text-zinc-500 hover:text-red-400 p-1 bg-white/5 rounded-lg hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/10"
                      title="Excluir"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
