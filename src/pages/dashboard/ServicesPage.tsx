import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Service, Category } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Scissors,
  Trash2,
  Download,
  Search,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";
import { SERVICE_TEMPLATES, INITIAL_CATEGORIES } from "../../data/serviceTemplates";

export default function ServicesPage() {
  const { salonData, userData } = useAuth();
  
  // App state
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Todos");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    priceType: "fixed" as "fixed" | "from" | "variable",
    durationMinutes: "60",
    description: "",
  });

  // Custom category toggle in form
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Import wizard state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [selectedImportKeys, setSelectedImportKeys] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  // Role permissions
  const isOwnerOrManager =
    userData?.role === "owner" ||
    userData?.role === "manager" ||
    userData?.role === "admin" ||
    userData?.role === "platform_admin";

  useEffect(() => {
    if (!salonData) return;

    // Load Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    const unsubS = onSnapshot(qs, (snapshot) => {
      const svcs: Service[] = [];
      snapshot.forEach((doc) =>
        svcs.push({ id: doc.id, ...doc.data() } as Service),
      );
      setServices(svcs.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar serviços:", error);
      setLoading(false);
    });

    // Load Categories (just in case they have old categories stored in Firestore)
    const qc = query(collection(db, `salons/${salonData.id}/categories`));
    const unsubC = onSnapshot(qc, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) =>
        cats.push({ id: doc.id, ...doc.data() } as Category),
      );
      setCategories(cats);
    }, (error) => {
      console.error("Erro ao carregar categorias:", error);
    });

    return () => {
      unsubS();
      unsubC();
    };
  }, [salonData]);

  // Aggregate all unique categories available
  const allAvailableCategories = React.useMemo(() => {
    const listSet = new Set<string>();
    
    // 1. Initial pre-defined templates list
    INITIAL_CATEGORIES.forEach(c => listSet.add(c));
    
    // 2. Old categories from firestore
    categories.forEach(c => {
      if (c.name && c.isActive) {
        listSet.add(c.name);
      }
    });

    // 3. Categories found dynamically in services list
    services.forEach(s => {
      if (s.category) {
        listSet.add(s.category);
      }
    });

    return Array.from(listSet).sort((a, b) => a.localeCompare(b));
  }, [categories, services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const priceVal = formData.priceType === 'variable' ? 0 : parseFloat(formData.price.replace(",", "."));
      const durationVal = parseInt(formData.durationMinutes, 10);
      
      const categoryToSave = isCustomCategory 
        ? customCategoryName.trim() 
        : formData.category;

      if (!categoryToSave) {
        toast.error("Por favor, selecione ou digite uma categoria.");
        return;
      }

      if (editingService) {
        const ref = doc(
          db,
          `salons/${salonData.id}/services`,
          editingService.id,
        );
        await updateDoc(ref, {
          name: formData.name.trim(),
          category: categoryToSave,
          price: priceVal,
          priceType: formData.priceType,
          durationMinutes: durationVal,
          description: formData.description.trim(),
          updatedAt: Date.now(),
        });
        toast.success("Serviço atualizado!");
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: formData.name.trim(),
          category: categoryToSave,
          price: priceVal,
          priceType: formData.priceType,
          durationMinutes: durationVal,
          description: formData.description.trim(),
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success("Serviço cadastrado com sucesso!");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar serviço.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      price: "",
      priceType: "fixed",
      durationMinutes: "60",
      description: "",
    });
    setIsCustomCategory(false);
    setCustomCategoryName("");
    setEditingService(null);
  };

  const toggleStatus = async (item: Service) => {
    if (!salonData || !isOwnerOrManager) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/services`, item.id);
      await updateDoc(ref, {
        isActive: !item.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Serviço ${!item.isActive ? "ativado" : "inativado"} com sucesso.`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao alterar status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!salonData || !isOwnerOrManager) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/services`, id);
      await deleteDoc(ref);
      toast.success("Serviço excluído com sucesso.");
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir serviço.");
    }
  };

  const openEdit = (item: Service) => {
    setEditingService(item);
    
    // Check if category is from predefined template list to determine mode
    const isPredefined = INITIAL_CATEGORIES.includes(item.category);
    setFormData({
      name: item.name,
      category: isPredefined ? item.category : "",
      price: item.price.toString(),
      priceType: item.priceType || "fixed",
      durationMinutes: item.durationMinutes.toString(),
      description: item.description || "",
    });

    if (!isPredefined) {
      setIsCustomCategory(true);
      customCategoryName || setCustomCategoryName(item.category);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryName("");
    }

    setIsDialogOpen(true);
  };

  // Filter service items based on query and selected category
  const filteredServices = React.useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory =
        selectedCategoryFilter === "Todos" || s.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchQuery, selectedCategoryFilter]);

  // Import management: get list of predefined template services filtered by search
  const filteredTemplates = React.useMemo(() => {
    if (!importSearch) return SERVICE_TEMPLATES;
    const q = importSearch.toLowerCase();
    return SERVICE_TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [importSearch]);

  // Group templates by category
  const templatesByCategory = React.useMemo(() => {
    const groups: Record<string, typeof SERVICE_TEMPLATES> = {};
    filteredTemplates.forEach((t) => {
      if (!groups[t.category]) {
        groups[t.category] = [];
      }
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTemplates]);

  // Import logic helpers
  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      filteredTemplates.forEach((t) => {
        updated[`${t.category}::${t.name}`] = true;
      });
    }
    setSelectedImportKeys(updated);
  };

  const handleToggleCategoryAll = (catName: string, checked: boolean) => {
    const updated = { ...selectedImportKeys };
    const categoryTemplates = SERVICE_TEMPLATES.filter((t) => t.category === catName);
    categoryTemplates.forEach((t) => {
      const key = `${t.category}::${t.name}`;
      if (checked) {
        updated[key] = true;
      } else {
        delete updated[key];
      }
    });
    setSelectedImportKeys(updated);
  };

  const handleToggleService = (catName: string, serviceName: string, checked: boolean) => {
    const key = `${catName}::${serviceName}`;
    const updated = { ...selectedImportKeys };
    if (checked) {
      updated[key] = true;
    } else {
      delete updated[key];
    }
    setSelectedImportKeys(updated);
  };

  const isAllSelected = React.useMemo(() => {
    if (filteredTemplates.length === 0) return false;
    return filteredTemplates.every((t) => selectedImportKeys[`${t.category}::${t.name}`]);
  }, [filteredTemplates, selectedImportKeys]);

  const countSelected = Object.keys(selectedImportKeys).length;

  const executeImport = async () => {
    if (!salonData || countSelected === 0) return;
    setImporting(true);

    try {
      // Find what templates are checked
      const selectedTemplates = SERVICE_TEMPLATES.filter(
        (t) => selectedImportKeys[`${t.category}::${t.name}`]
      );

      // Avoid duplicating service with the exact same name AND category already registered in the salon
      const existingMap = new Map<string, boolean>();
      services.forEach((s) => {
        existingMap.set(`${s.category.toLowerCase()}::${s.name.toLowerCase()}`, true);
      });

      const templatesToCreate = selectedTemplates.filter(
        (t) => !existingMap.has(`${t.category.toLowerCase()}::${t.name.toLowerCase()}`)
      );

      if (templatesToCreate.length === 0) {
        toast.info("Todos os serviços selecionados já estão cadastrados!");
        setImporting(false);
        setIsImportOpen(false);
        setSelectedImportKeys({});
        return;
      }

      let importCount = 0;
      await Promise.all(
        templatesToCreate.map(async (t) => {
          const ref = doc(collection(db, `salons/${salonData.id}/services`));
          await setDoc(ref, {
            id: ref.id,
            name: t.name,
            category: t.category,
            price: t.price,
            priceType: t.priceType,
            durationMinutes: t.durationMinutes,
            description: t.description || "",
            isActive: true,
            source: "template",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          importCount++;
        })
      );

      toast.success(`${importCount} serviços importados com sucesso para o catálogo!`);
      setIsImportOpen(false);
      setSelectedImportKeys({});
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar serviços selecionados.");
    } finally {
      setImporting(false);
    }
  };

  const formatPriceDescription = (price: number, priceType?: "fixed" | "from" | "variable") => {
    if (priceType === "variable") return "Sob avaliação";
    if (priceType === "from") return `A partir de ${formatBRL(price)}`;
    return formatBRL(price);
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans pb-12 animate-fade-in relative">
      
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 -translate-y-24 translate-x-24 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header section with brand feel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#0d0d11] to-[#050505] p-6 rounded-3xl border border-[#D4AF37]/15">
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1 leading-none shadow-[0_2px_8px_rgba(212,175,55,0.05)]">
            <Scissors className="w-3.5 h-3.5" /> Serviços & Catálogo
          </span>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white font-heading">
            Gestão de <span className="font-semibold text-[#D4AF37]">Serviços</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Cadastre os serviços oferecidos no salão, defina faixas de preço (fixo, a partir de ou sob avaliação) e tempos de duração. Importe o catálogo de luxo Essenza com apenas um clique.
          </p>
        </div>

        {isOwnerOrManager && (
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <Button
              onClick={() => {
                // Pre-expand some categories in templates library
                const defaultExpanded: Record<string, boolean> = {};
                INITIAL_CATEGORIES.slice(0, 3).forEach((cat) => {
                  defaultExpanded[cat] = true;
                });
                setExpandedCategories(defaultExpanded);
                setIsImportOpen(true);
              }}
              variant="outline"
              className="flex-1 md:flex-none h-10 border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 text-[#D4AF37] font-medium text-xs rounded-xl px-5 select-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Importar Prontos
            </Button>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="flex-1 md:flex-none h-10 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold text-xs rounded-xl px-5 select-none shadow-[0_4px_15px_rgba(212,175,55,0.15)]">
                  <Plus className="w-4 h-4 mr-2" /> Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] bg-[#09090b] border border-white/10 text-white rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="font-heading text-lg font-medium text-white">
                    {editingService ? "Editar Serviço" : "Cadastrar Novo Serviço"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-light">
                    {editingService ? "Altere as informações do serviço." : "Preencha os campos para cadastrar um serviço manual."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  {/* Service Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-slate-300 font-medium">Nome do Serviço *</Label>
                    <Input
                      id="name"
                      required
                      placeholder="Ex: Escova Orgânica Alisadora"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm"
                    />
                  </div>

                  {/* Category Selection / Custom Input */}
                  {isCustomCategory ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="customCategory" className="text-xs text-slate-300 font-medium">Nome da Nova Categoria *</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setCustomCategoryName("");
                          }}
                          className="text-[11px] text-[#D4AF37] hover:underline flex items-center leading-none"
                        >
                          Usar existente
                        </button>
                      </div>
                      <Input
                        id="customCategory"
                        required
                        placeholder="Ex: Massagens Corporais"
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs text-slate-300 font-medium">Categoria do Serviço *</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(true);
                            setFormData((p) => ({ ...p, category: "" }));
                          }}
                          className="text-[11px] text-[#D4AF37] hover:underline flex items-center leading-none"
                        >
                          + Criar Nova Categoria
                        </button>
                      </div>
                      <Select
                        required
                        value={formData.category}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, category: v }))
                        }
                      >
                        <SelectTrigger className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm">
                          <SelectValue placeholder="Selecione uma categoria..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#09090b] border border-white/15 text-white rounded-xl">
                          {allAvailableCategories.map((catStr) => (
                            <SelectItem key={catStr} value={catStr}>
                              {catStr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Price type row */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">Tipo de Cobrança</Label>
                    <Select
                      value={formData.priceType}
                      onValueChange={(v: "fixed" | "from" | "variable") => {
                        setFormData((p) => ({
                          ...p,
                          priceType: v,
                          price: v === "variable" ? "0" : p.price === "0" ? "" : p.price,
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm">
                        <SelectValue placeholder="Tipo de Faturamento" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#09090b] border border-white/15 text-white rounded-xl">
                        <SelectItem value="fixed">Preço Fixo (Ex: R$ 200)</SelectItem>
                        <SelectItem value="from">A partir de (Ex: R$ 200...)</SelectItem>
                        <SelectItem value="variable">Sob avaliação / Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Price Value */}
                    <div className="space-y-1.5">
                      <Label htmlFor="price" className="text-xs text-slate-300 font-medium">Valor (R$)</Label>
                      <Input
                        id="price"
                        required={formData.priceType !== "variable"}
                        disabled={formData.priceType === "variable"}
                        type="text"
                        placeholder={formData.priceType === "variable" ? "Variável" : "150,00"}
                        value={formData.priceType === "variable" ? "" : formData.price}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, price: e.target.value }))
                        }
                        className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm disabled:opacity-40"
                      />
                    </div>
                    {/* Duration */}
                    <div className="space-y-1.5">
                      <Label htmlFor="duration" className="text-xs text-slate-300 font-medium">Duração (minutos)</Label>
                      <Input
                        id="duration"
                        required
                        type="number"
                        min="1"
                        placeholder="60"
                        value={formData.durationMinutes}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            durationMinutes: e.target.value,
                          }))
                        }
                        className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs text-slate-300 font-medium">Descrição Opcional</Label>
                    <textarea
                      id="description"
                      placeholder="Breve resumo do serviço, técnica ou produtos utilizados."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, description: e.target.value }))
                      }
                      className="w-full bg-black/40 border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-3 resize-none focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                      rows={3}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl text-xs h-10 mt-6 shadow-md"
                  >
                    {editingService ? "Salvar Alterações" : "Cadastrar Serviço"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Advanced filters and search board */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3.5">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Pesquisar serviço por nome ou detalhes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-[#0c0c0f] border border-white/5 rounded-xl text-sm focus:border-[#D4AF37]/30"
            />
          </div>

          {/* Categories tag ribbon */}
          <div className="flex items-center gap-1.5 bg-[#0c0c0f]/80 p-1 border border-white/5 rounded-xl md:max-w-md overflow-x-auto shrink-0 select-none">
            <span className="text-[10px] text-zinc-500 font-mono pl-2 pr-1 uppercase hidden sm:inline leading-none">Filtro:</span>
            <Select value={selectedCategoryFilter} onValueChange={(v) => setSelectedCategoryFilter(v)}>
              <SelectTrigger className="border-0 bg-transparent h-8 shadow-none focus:ring-0 text-xs w-[180px] font-medium text-slate-200">
                <SelectValue placeholder="Escolher categoria" />
              </SelectTrigger>
              <SelectContent className="bg-[#09090b] border border-white/15 text-white rounded-xl max-h-[300px]">
                <SelectItem value="Todos">Todas as Categorias</SelectItem>
                {allAvailableCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick horizontal categories slider for easy clicking */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <Button
            onClick={() => setSelectedCategoryFilter("Todos")}
            variant={selectedCategoryFilter === "Todos" ? "default" : "outline"}
            className={cn(
              "h-8 px-4 rounded-xl text-xs shrink-0 select-none",
              selectedCategoryFilter === "Todos"
                ? "bg-[#D4AF37] text-black font-semibold hover:bg-[#D4AF37]/80"
                : "border-white/5 text-slate-300 hover:text-white hover:bg-white/[0.03]"
            )}
          >
            Todos
          </Button>
          {allAvailableCategories.map((catStr) => {
            const isActive = selectedCategoryFilter === catStr;
            return (
              <Button
                key={catStr}
                onClick={() => setSelectedCategoryFilter(catStr)}
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "h-8 px-3.5 rounded-xl text-xs shrink-0 select-none",
                  isActive
                    ? "bg-[#D4AF37] text-black font-semibold hover:bg-[#D4AF37]/80"
                    : "border-white/5 text-slate-300 hover:text-white hover:bg-white/[0.03]"
                )}
              >
                {catStr}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main catalog layout */}
      {filteredServices.length === 0 ? (
        <Card className="border-white/5 bg-[#0c0c0f] rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-[#D4AF37]">
            <Scissors className="w-6 h-6 opacity-40 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">Nenhum serviço encontrado</h3>
            <p className="text-xs text-slate-400 font-light max-w-xs mx-auto">
              Nenhum serviço correspondente aos critérios de filtro ou busca foi localizado no seu catálogo atual.
            </p>
          </div>
          {isOwnerOrManager && (
            <div className="flex justify-center gap-2 pt-2">
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
                className="bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs px-3.5"
              >
                Novo Manual
              </Button>
              <Button
                onClick={() => setIsImportOpen(true)}
                size="sm"
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl text-xs px-3.5"
              >
                Importar Essenza
              </Button>
            </div>
          )}
        </Card>
      ) : (
        /* Responsive list/cards */
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((item) => {
            return (
              <div
                key={item.id}
                className={cn(
                  "bg-[#0e0e11] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden",
                  item.isActive 
                    ? "border-white/5 hover:border-[#D4AF37]/25 hover:bg-[#121216] shadow-lg" 
                    : "border-white/5 opacity-50 grayscale"
                )}
              >
                {/* Visual side accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#D4AF37]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 max-w-[80%]">
                      {/* Tag Category */}
                      <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#D4AF37] bg-[#D4AF37]/5 border border-[#D4AF37]/15 px-2 py-0.5 rounded-md inline-block leading-none">
                        {item.category}
                      </span>
                      <h4 className="font-heading text-sm font-semibold text-white tracking-tight truncate leading-tight group-hover:text-[#D4AF37] transition-colors">
                        {item.name}
                      </h4>
                    </div>

                    {/* Action buttons (only for authorized management users) */}
                    {isOwnerOrManager && (
                      <div className="flex gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(item)}
                          className="h-7 w-7 text-slate-400 hover:text-[#D4AF37] hover:bg-white/5 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatus(item)}
                          className={cn(
                            "h-7 w-7 rounded-lg",
                            item.isActive 
                              ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" 
                              : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          )}
                          title={item.isActive ? "Desativar serviço" : "Ativar serviço"}
                        >
                          {item.isActive ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-white/5 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-zinc-400 font-light leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Foot indicators */}
                <div className="flex justify-between items-center border-t border-white/[0.04] pt-3.5 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#8e8e93] uppercase font-mono tracking-wider font-semibold">Valor</span>
                    <span className="text-base font-semibold font-mono text-white leading-none mt-1">
                      {formatPriceDescription(item.price, item.priceType)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-[#8e8e93] uppercase font-mono tracking-wider font-semibold">Duração</span>
                    <span className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-1 leading-none">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" /> {item.durationMinutes} min
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation of deletion Modal */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px] bg-[#09090b] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-semibold text-red-500 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Excluir Serviço?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2.5">
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              Tem certeza que deseja excluir permanentemente o serviço de seu catálogo? Essa conduta é irrevogável e removerá o serviço de todas as referências.
            </p>
          </div>
          <div className="flex justify-end gap-2.5 mt-4">
            <Button
              variant="outline"
              className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-9 px-4 font-normal"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs h-9 px-4 shadow-[0_2px_10px_rgba(220,38,38,0.2)]"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Big Premium Import Catalog Dialog (Responsive and beautiful) */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl bg-[#08080a] border border-[#D4AF37]/20 text-white rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col h-[85vh] max-h-[700px]">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-white/5">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-heading font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Biblioteca de Serviços Essenza
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-light">
                  Selecione os serviços que deseja importar para seu salão. Evitamos duplicações de serviços já existentes.
                </DialogDescription>
              </div>
              <span className="text-xs font-mono font-bold bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] px-2.5 py-1 rounded-lg shrink-0 shadow-sm">
                Catálogo Premium
              </span>
            </div>
          </DialogHeader>

          {/* Quick filter block in modal */}
          <div className="py-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
              <Input
                placeholder="Filtrar por nome ou categoria na biblioteca..."
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                className="pl-9 h-9 bg-black/40 border border-white/5 rounded-xl text-xs focus:border-[#D4AF37]/30"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleSelectAll(!isAllSelected)}
              className="h-9 border-white/10 hover:bg-white/5 text-xs text-slate-200 select-none rounded-xl"
            >
              {isAllSelected ? "Deselecionar Todos" : "Selecionar Todos"}
            </Button>
          </div>

          {/* Main selection container with scroll and max height */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 my-2 scrollbar-thin scrollbar-thumb-white/10 animate-fade-in">
            {Object.keys(templatesByCategory).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                Nenhum serviço correspondente encontrado para sua pesquisa.
              </div>
            ) : (
              (Object.keys(templatesByCategory) as string[]).map((catName) => {
                const templates = templatesByCategory[catName];
                const categoryKeys = templates.map((t) => `${t.category}::${t.name}`);
                const isCatAllSelected = categoryKeys.every((k) => selectedImportKeys[k]);
                const countSelectedInCat = categoryKeys.filter((k) => selectedImportKeys[k]).length;
                const isExpanded = expandedCategories[catName];

                return (
                  <div key={catName} className="border border-white/5 bg-black/20 rounded-2xl overflow-hidden">
                    {/* Category Header Bar */}
                    <div className="bg-white/[0.01] px-4 py-3.5 flex justify-between items-center border-b border-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isCatAllSelected}
                          onChange={(e) => handleToggleCategoryAll(catName, e.target.checked)}
                          className="rounded border-white/20 bg-black/50 text-[#D4AF37] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span 
                          onClick={() => {
                            setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
                          }}
                          className="text-xs font-semibold text-slate-200 font-heading tracking-tight cursor-pointer hover:text-white"
                        >
                          {catName}
                          <span className="text-[10px] text-zinc-500 font-normal font-mono ml-2 font-sans">
                            ({templates.length} {templates.length === 1 ? 'item' : 'itens'} {countSelectedInCat > 0 && `• ${countSelectedInCat} sel.`})
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
                        }}
                        className="text-[10px] text-[#D4AF37] hover:underline"
                      >
                        {isExpanded ? "Ocultar" : "Expandir"}
                      </button>
                    </div>

                    {/* Group services list list (expandable) */}
                    {isExpanded && (
                      <div className="divide-y divide-white/[0.03] bg-black/40 px-4 py-1.5">
                        {templates.map((t) => {
                          const key = `${t.category}::${t.name}`;
                          const isSSelected = !!selectedImportKeys[key];
                          // Check if already in the services of the salon
                          const alreadyUploaded = services.some(
                            (s) => s.name.toLowerCase() === t.name.toLowerCase() && s.category.toLowerCase() === t.category.toLowerCase()
                          );

                          return (
                            <div key={t.name} className={cn(
                              "py-2.5 flex justify-between items-center text-xs gap-4",
                              alreadyUploaded && "opacity-45"
                            )}>
                              <div className="flex items-center gap-2.5 max-w-[70%]">
                                <input
                                  type="checkbox"
                                  disabled={alreadyUploaded}
                                  checked={alreadyUploaded || isSSelected}
                                  onChange={(e) => handleToggleService(t.category, t.name, e.target.checked)}
                                  className="rounded border-white/20 bg-black/50 text-[#D4AF37] focus:ring-0 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                                />
                                <div className="space-y-0.5">
                                  <p className="font-medium text-slate-200">{t.name}</p>
                                  {t.description && (
                                    <p className="text-[10px] text-zinc-500 line-clamp-1">{t.description}</p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[10px] font-semibold text-zinc-400 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded">
                                  {formatPriceDescription(t.price, t.priceType)}
                                </span>
                                {alreadyUploaded ? (
                                  <span className="text-[9px] text-[#D4AF37] bg-[#D4AF37]/10 font-mono font-medium border border-[#D4AF37]/20 px-1.5 py-0.5 rounded leading-none">Salvo</span>
                                ) : (
                                  <span className="text-[9px] text-[#8e8e93] font-mono leading-none">{t.durationMinutes}m</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Footer Bar */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4 shrink-0 mt-2">
            <div className="text-xs text-zinc-400 leading-none">
              Selecionados: <span className="font-bold text-[#D4AF37] font-mono">{countSelected}</span>
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => setIsImportOpen(false)}
                className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-9.5 px-4 font-normal"
              >
                Voltar
              </Button>
              <Button
                disabled={importing || countSelected === 0}
                onClick={executeImport}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl text-xs h-9.5 px-5 shadow-lg select-none disabled:opacity-40"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    Importar Selecionados ({countSelected})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
