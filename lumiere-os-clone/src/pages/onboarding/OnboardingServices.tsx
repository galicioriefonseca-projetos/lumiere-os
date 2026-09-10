import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Service } from '../../types';
import { SERVICE_TEMPLATES, INITIAL_CATEGORIES } from '../../data/serviceTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  Scissors, 
  Plus, 
  Trash2, 
  Sparkles, 
  Search, 
  Check, 
  Clock, 
  ArrowRight, 
  DollarSign, 
  ListPlus 
} from 'lucide-react';
import { formatBRL } from '@/lib/utils';

export default function OnboardingServices() {
  const { salonData } = useAuth();
  const navigate = useNavigate();

  // Firestore sync state
  const [salonsServices, setSalonsServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // General state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [importingAll, setImportingAll] = useState(false);

  // Custom Service Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Cortes');
  const [formPrice, setFormPrice] = useState('');
  const [formPriceType, setFormPriceType] = useState<'fixed' | 'from' | 'variable'>('fixed');
  const [formDuration, setFormDuration] = useState('60');
  const [formDescription, setFormDescription] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  // Custom Category states
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Fetch registered services from Firebase
  useEffect(() => {
    if (!salonData?.id) return;

    const q = query(collection(db, `salons/${salonData.id}/services`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Service[];
        setSalonsServices(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro de sincronização de serviços:', err);
        toast.error('Erro de conexão ao carregar serviços.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [salonData?.id]);

  // Handle standard template toggle
  const handleToggleTemplate = async (template: typeof SERVICE_TEMPLATES[0]) => {
    if (!salonData?.id) return;

    // Check if already contains it
    const isAdded = salonsServices.some(
      (s) => s.name.toLowerCase() === template.name.toLowerCase() && s.category === template.category
    );

    if (isAdded) {
      // Remove it
      const targetService = salonsServices.find(
        (s) => s.name.toLowerCase() === template.name.toLowerCase() && s.category === template.category
      );
      if (targetService) {
        try {
          const sRef = doc(db, `salons/${salonData.id}/services`, targetService.id);
          await deleteDoc(sRef);
          toast.success(`"${template.name}" removido.`);
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível remover o serviço.');
        }
      }
    } else {
      // Add it
      try {
        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: template.name,
          category: template.category,
          price: template.price,
          priceType: template.priceType,
          durationMinutes: template.durationMinutes,
          description: template.description || '',
          isActive: true,
          source: 'template',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success(`"${template.name}" adicionado com sucesso!`);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao adicionar serviço.');
      }
    }
  };

  // Add all popular essentials templates with 1 click
  const handleImportEssentials = async () => {
    if (!salonData?.id) return;
    setImportingAll(true);

    // Filter to popular core salon essentials
    const essentials = SERVICE_TEMPLATES.filter((t) => 
      ['Corte feminino', 'Corte masculino', 'Escova M', 'Coloração até 1 tubo', 'Design de sobrancelha', 'Manicure + pedicure', 'Protocolo Kérastase'].includes(t.name)
    );

    try {
      let importedCount = 0;
      for (const t of essentials) {
        const isAlreadyAdded = salonsServices.some(
          (s) => s.name.toLowerCase() === t.name.toLowerCase() && s.category === t.category
        );

        if (!isAlreadyAdded) {
          const ref = doc(collection(db, `salons/${salonData.id}/services`));
          await setDoc(ref, {
            id: ref.id,
            name: t.name,
            category: t.category,
            price: t.price,
            priceType: t.priceType,
            durationMinutes: t.durationMinutes,
            description: t.description || '',
            isActive: true,
            source: 'template',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          importedCount++;
        }
      }

      if (importedCount > 0) {
        toast.success(`Importados ${importedCount} serviços essenciais de luxo com sucesso!`);
      } else {
        toast.info('Os serviços essenciais já estão cadastrados em seu catálogo.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha ao importar pacote essencial.');
    } finally {
      setImportingAll(false);
    }
  };

  // Save custom service logic
  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData?.id) return;
    if (!formName.trim()) {
      toast.error('O nome do serviço é obrigatório.');
      return;
    }

    const categoryToSave = isCustomCategory ? customCategoryName.trim() : formCategory;
    if (!categoryToSave) {
      toast.error('Selecione ou crie uma categoria.');
      return;
    }

    setSavingCustom(true);
    try {
      const priceVal = formPriceType === 'variable' ? 0 : parseFloat(formPrice.replace(',', '.')) || 0;
      const durationVal = parseInt(formDuration, 10) || 60;

      const ref = doc(collection(db, `salons/${salonData.id}/services`));
      await setDoc(ref, {
        id: ref.id,
        name: formName.trim(),
        category: categoryToSave,
        price: priceVal,
        priceType: formPriceType,
        durationMinutes: durationVal,
        description: formDescription.trim(),
        isActive: true,
        source: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      toast.success('Serviço personalizado criado com sucesso!');
      setIsCustomDialogOpen(false);
      resetCustomForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar serviço personalizado.');
    } finally {
      setSavingCustom(false);
    }
  };

  const resetCustomForm = () => {
    setFormName('');
    setFormCategory('Cortes');
    setFormPrice('');
    setFormPriceType('fixed');
    setFormDuration('60');
    setFormDescription('');
    setIsCustomCategory(false);
    setCustomCategoryName('');
  };

  // Remove directly from listing
  const removeService = async (serviceId: string) => {
    if (!salonData?.id) return;
    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/services`, serviceId));
      toast.success('Serviço removido com sucesso.');
    } catch (err) {
      console.error(err);
      toast.error('Falha de exclusão.');
    }
  };

  // Filtering templates representation
  const filteredTemplates = SERVICE_TEMPLATES.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Step description */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-[#D4AF37]/10 rounded-full border border-[#D4AF37]/20 flex items-center justify-center mb-1">
          <Scissors className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <h2 className="text-2xl font-heading text-white">Nossos Serviços</h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Monte o menu de procedimentos do seu espaço. Você pode usar nossos templates ou cadastrar seus próprios valores e tratamentos exclusivos.
        </p>
      </div>

      {/* Action shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
        <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-primary font-mono uppercase tracking-wider">Lançamento Turbo</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              Adicione instantaneamente os 7 serviços mais agendados em salões premium de alta performance (Cortes, Escova, Coloração, Manicure e Sobrancelha).
            </p>
          </div>
          <Button
            id="import-essentials-btn"
            type="button"
            disabled={importingAll}
            onClick={handleImportEssentials}
            className="bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs h-9 font-semibold rounded-xl flex items-center justify-center gap-1.5"
          >
            {importingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Importar 7 Mais Populares
          </Button>
        </div>

        <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">Procedimento Único</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              Gostaria de criar um combo exclusivo ou um tratamento que possui duração e valores altamente personalizados? Cadastre manualmente aqui.
            </p>
          </div>
          <Button
            id="create-custom-svc-btn"
            type="button"
            onClick={() => {
              resetCustomForm();
              setIsCustomDialogOpen(true);
            }}
            className="bg-primary hover:bg-gold-400 text-black text-xs h-9 font-semibold rounded-xl flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Sob Medida
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-2">
        {/* Template Catalog Panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-white tracking-wide">Templates Lumière</h3>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5 h-4 w-4" />
                <Input
                  id="template-search"
                  placeholder="Pesquisar corte, unha, escova..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/40 border-white/5 rounded-xl text-xs h-9 pl-9 focus:border-primary"
                />
              </div>

              <select
                id="template-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-black/60 border border-white/5 rounded-xl text-xs text-slate-300 px-3 h-9 outline-none focus:border-primary max-w-[150px]"
              >
                <option value="Todos">Todas Categorias</option>
                {INITIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto rounded-2xl border border-white/5 bg-[#070709] p-2 space-y-1.5 custom-scrollbar">
            {filteredTemplates.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10 font-light">
                Nenhum template encontrado para a busca.
              </p>
            ) : (
              filteredTemplates.map((t) => {
                const isSelected = salonsServices.some(
                  (s) => s.name.toLowerCase() === t.name.toLowerCase() && s.category === t.category
                );

                return (
                  <div
                    key={`${t.category}::${t.name}`}
                    onClick={() => handleToggleTemplate(t)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#D4AF37]/5 border-[#D4AF37]/35 shadow-[0_0_10px_rgba(212,175,55,0.05)]'
                        : 'bg-black/30 border-white/[0.03] hover:border-white/10 hover:bg-white/[0.01]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-white">{t.name}</span>
                        <span className="text-[9px] bg-white/5 text-slate-400 border border-white/5 px-2 py-0.2 rounded-full font-light">
                          {t.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-light leading-normal max-w-xs truncate">
                        {t.description || 'Nenhuma descrição detalhada fornecida.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-primary">
                          {t.priceType === 'variable' ? 'Variável' : formatBRL(t.price)}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-light flex items-center justify-end gap-1">
                          <Clock className="w-2.5 h-2.5" /> {t.durationMinutes} min
                        </p>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isSelected 
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_8px_rgba(212,175,55,0.35)]' 
                          : 'border-white/20 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Current Catalog panel */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-wide">Seu Menu Ativo</h3>

          <div className="rounded-2xl border border-white/5 bg-[#09090c] p-4 min-h-[400px] max-h-[400px] flex flex-col justify-between">
            <div className="space-y-3 overflow-y-auto max-h-[330px] pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                  <p className="text-[10px] text-muted-foreground font-mono">Carregando menu...</p>
                </div>
              ) : salonsServices.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <ListPlus className="w-7 h-7 mx-auto text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-[170px] mx-auto">
                    Seu catálogo está vazio. Clique nos templates à esquerda para incluir ou crie customizados para iniciar.
                  </p>
                </div>
              ) : (
                salonsServices.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl border border-white/5 bg-black/45 flex items-center justify-between hover:border-[#D4AF37]/15 transition duration-150 animate-fade-in"
                  >
                    <div className="min-w-0 pr-2">
                      <h4 className="text-xs font-semibold text-slate-100 truncate leading-snug">{s.name}</h4>
                      <p className="text-[9px] text-primary/75 font-mono uppercase tracking-wider">{s.category}</p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-mono text-white">
                          {s.priceType === 'variable' ? 'Sob av.' : formatBRL(s.price)}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-light">{s.durationMinutes} min</p>
                      </div>

                      <Button
                        id={`remove-svc-${s.id}`}
                        onClick={() => removeService(s.id)}
                        variant="ghost"
                        className="w-7 h-7 rounded-md p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Total no catálogo:</span>
              <span className="font-mono font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded-md leading-none">
                {salonsServices.length} {salonsServices.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Nav */}
      <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
        <Button
          id="onboarding-btn-back"
          onClick={() => navigate('/onboarding/equipe')}
          variant="ghost"
          className="hover:bg-white/[0.04] text-slate-300 text-xs h-10 px-5 rounded-xl"
        >
          Voltar para equipe
        </Button>
        <p className="text-[11px] text-muted-foreground font-light hidden md:flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Passo 2 de 4 • Próximo passo: Metas Planejadas
        </p>
        <Button
          id="onboarding-btn-continue"
          onClick={() => {
            if (salonsServices.length === 0) {
              toast.error('Cadastre ou selecione pelo menos 1 serviço antes de prosseguir.');
              return;
            }
            navigate('/onboarding/metas');
          }}
          className="bg-primary hover:bg-gold-400 text-black font-semibold h-10 px-6 rounded-xl text-xs flex items-center gap-1.5"
        >
          Salvar e Continuar
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Custom Service dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="bg-[#0b0b0d] border border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading text-white">Criar Serviço Customizado</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure as propriedades únicas do seu procedimento ou combo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCustom} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-350" htmlFor="svc-name">Nome do Serviço</Label>
              <Input
                id="svc-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex. Mechas Criativas Premium"
                className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-slate-350" htmlFor="svc-category">Categoria</Label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[10px] text-primary hover:underline font-semibold leading-none"
                >
                  {isCustomCategory ? 'Escolher existente' : '+ Criar Nova'}
                </button>
              </div>

              {isCustomCategory ? (
                <Input
                  id="svc-custom-category"
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  placeholder="Ex. SPA e Massagem"
                  className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary outline-none"
                  required
                />
              ) : (
                <select
                  id="svc-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl h-10 text-xs text-slate-200 px-3 py-2 outline-none focus:border-primary"
                >
                  {INITIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0b0b0d]">
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs text-slate-350" htmlFor="svc-price-type">Tipo de Preço</Label>
                <select
                  id="svc-price-type"
                  value={formPriceType}
                  onChange={(e) => setFormPriceType(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl h-10 text-xs text-slate-200 px-3 py-2 outline-none focus:border-primary shrink-0"
                >
                  <option value="fixed" className="bg-[#0b0b0d]">Fixo</option>
                  <option value="from" className="bg-[#0b0b0d]">A partir de</option>
                  <option value="variable" className="bg-[#0b0b0d]">Sob avaliação</option>
                </select>
              </div>

              {formPriceType !== 'variable' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-350" htmlFor="svc-price">Preço Base (R$)</Label>
                  <div className="relative">
                    <span className="text-xs text-muted-foreground absolute left-3 top-3 select-none leading-none">R$</span>
                    <Input
                      id="svc-price"
                      type="text"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="180,00"
                      className="bg-black/60 border-white/10 rounded-xl h-10 text-xs pl-8 focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-350" htmlFor="svc-duration">Duração Planejada (Minutos)</Label>
              <div className="relative">
                <Input
                  id="svc-duration"
                  type="number"
                  min="5"
                  max="480"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="60"
                  className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary pr-12"
                  required
                />
                <span className="text-[10px] text-muted-foreground absolute right-3 top-3.5 font-sans select-none leading-none">minutos</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-350" htmlFor="svc-description">Descrição (opcional)</Label>
              <textarea
                id="svc-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex. Lavagem luxo inclusa, com finalização à escova..."
                className="w-full bg-black/60 border border-white/10 rounded-xl h-16 text-xs text-slate-200 p-3 outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCustomDialogOpen(false)}
                className="border-white/10 hover:border-slate-800 text-slate-300 text-xs h-9 px-4 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                id="svc-save-btn"
                type="submit"
                disabled={savingCustom}
                className="bg-primary hover:bg-gold-400 text-black font-semibold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                {savingCustom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Cadastrar Item
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
