import React, { useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Checklist, ChecklistItemTemplate } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ListTodo,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit,
  Copy,
  Calendar,
  Clock,
  User,
  CheckCircle,
  HelpCircle,
  X,
  Sparkles,
} from "lucide-react";

interface ManageRotinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allChecklists: Checklist[];
  salonId: string;
}

export default function ManageRotinasDialog({
  open,
  onOpenChange,
  allChecklists,
  salonId,
}: ManageRotinasDialogProps) {
  // Navigation states: 'list' | 'create' | 'edit'
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  
  // Create / Edit form states
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [frequency, setFrequency] = useState<"diaria" | "semanal" | "personalizada">("diaria");
  const [period, setPeriod] = useState<
    "abertura" | "meio_dia" | "fechamento" | "limpeza" | "estoque" | "atendimento" | "outro"
  >("abertura");
  const [responsible, setResponsible] = useState("");
  const [required, setRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<Omit<ChecklistItemTemplate, "id">[]>([]);

  // Filter operational checklists
  const operationalChecklists = allChecklists.filter(
    (c) =>
      c.type !== "professional_daily_evaluation" &&
      c.checklistGroup !== "professional_evaluation"
  );

  const resetForm = () => {
    setSelectedChecklist(null);
    setTitle("");
    setDescription("");
    setCategory("Geral");
    setFrequency("diaria");
    setPeriod("abertura");
    setResponsible("");
    setRequired(true);
    setIsActive(true);
    setItems([{ label: "", required: true, category: "Geral" }]);
  };

  const handleOpenCreateView = () => {
    resetForm();
    setView("create");
  };

  const handleOpenEditView = (chk: Checklist) => {
    setSelectedChecklist(chk);
    setTitle(chk.title || "");
    setDescription(chk.description || "");
    setCategory((chk as any).category || "Geral");
    setFrequency((chk as any).frequency || "diaria");
    setPeriod((chk as any).period || "abertura");
    setResponsible((chk as any).responsible || "");
    setRequired(chk.items?.[0]?.required ?? true);
    setIsActive(chk.isActive !== false);
    setItems(
      chk.items?.map((item) => ({
        label: item.label || "",
        required: item.required ?? true,
        category: item.category || (chk as any).category || "Geral",
      })) || [{ label: "", required: true, category: "Geral" }]
    );
    setView("edit");
  };

  const addItemField = () => {
    setItems([...items, { label: "", required: true, category }]);
  };

  const removeItemField = (index: number) => {
    if (items.length <= 1) {
      toast.warning("A rotina precisa ter pelo menos 1 item.");
      return;
    }
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const updateItemLabel = (index: number, val: string) => {
    const updated = [...items];
    updated[index].label = val;
    setItems(updated);
  };

  const moveItemUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    const prev = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = prev;
    setItems(updated);
  };

  const moveItemDown = (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    const next = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = next;
    setItems(updated);
  };

  const handleToggleActive = async (chk: Checklist) => {
    try {
      const docRef = doc(db, `salons/${salonId}/checklists`, chk.id);
      await updateDoc(docRef, {
        isActive: !chk.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        chk.isActive ? "Rotina inativada com sucesso!" : "Rotina ativada com sucesso!"
      );
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao alterar status da rotina.");
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir permanentemente esta rotina operacional?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, `salons/${salonId}/checklists`, id));
      toast.success("Rotina excluída com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao excluir rotina.");
    }
  };

  const handleDuplicateChecklist = async (chk: Checklist) => {
    try {
      const docRef = doc(collection(db, `salons/${salonId}/checklists`));
      const payload = {
        title: `${chk.title} (Cópia)`,
        description: chk.description || "",
        type: "standard",
        checklistGroup: "operational",
        scoringMode: "checkbox",
        category: (chk as any).category || "Geral",
        frequency: (chk as any).frequency || "diaria",
        period: (chk as any).period || "abertura",
        responsible: (chk as any).responsible || "",
        isActive: true,
        items: chk.items.map((item, index) => ({
          id: `item-${index}`,
          label: item.label,
          required: item.required ?? true,
          category: item.category || (chk as any).category || "Geral",
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, payload);
      toast.success(`Rotina duplicada com sucesso!`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao duplicar rotina.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    const filteredItems = items.filter((item) => item.label.trim() !== "");
    if (filteredItems.length === 0) {
      toast.error("Adicione pelo menos um item com texto.");
      return;
    }

    const formattedItems = filteredItems.map((item, i) => ({
      id: `item-${i}-${Date.now()}`,
      label: item.label.trim(),
      required: required,
      category: category,
    }));

    const payload: any = {
      title: title.trim(),
      description: description.trim(),
      type: "standard",
      checklistGroup: "operational",
      scoringMode: "checkbox",
      category,
      frequency,
      period,
      responsible: responsible.trim(),
      isActive,
      items: formattedItems,
      updatedAt: serverTimestamp(),
    };

    try {
      if (view === "create") {
        const docRef = doc(collection(db, `salons/${salonId}/checklists`));
        payload.createdAt = serverTimestamp();
        await setDoc(docRef, payload);
        toast.success("Nova rotina operacional criada com sucesso!");
      } else if (view === "edit" && selectedChecklist) {
        const docRef = doc(db, `salons/${salonId}/checklists`, selectedChecklist.id);
        await updateDoc(docRef, payload);
        toast.success("Rotina operacional atualizada com sucesso!");
      }
      setView("list");
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar rotina.");
    }
  };

  const frequencyLabels = {
    diaria: "Diária",
    semanal: "Semanal",
    personalizada: "Personalizada",
  };

  const periodLabels = {
    abertura: "Abertura",
    meio_dia: "Meio do Dia",
    fechamento: "Fechamento",
    limpeza: "Limpeza",
    estoque: "Estoque",
    atendimento: "Atendimento",
    outro: "Outro",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#09090b]/98 border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto w-[94vw] p-0 font-sans">
        <DialogHeader className="border-b border-white/5 p-6 pb-4 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg md:text-xl font-light tracking-tight text-white flex items-center gap-2">
              <ListTodo className="w-5.5 h-5.5 text-primary" /> Gerenciar Rotinas Operacionais
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Personalize o fluxo de atividades operacionais do seu estabelecimento.
            </p>
          </div>
          {view !== "list" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs h-8 px-2.5 cursor-pointer"
            >
              Voltar à lista
            </Button>
          )}
        </DialogHeader>

        {view === "list" ? (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl p-4 gap-4">
              <div className="text-xs text-zinc-400 font-light">
                Configure rotinas de abertura, fechamento, limpeza, estoques, checklists específicos e distribua tarefas com recorrência.
              </div>
              <Button
                onClick={handleOpenCreateView}
                className="bg-primary hover:bg-gold-500 text-black font-semibold text-xs rounded-xl h-9 px-4 flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nova Rotina
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> checklists operacionais ativos
              </h4>

              {operationalChecklists.length === 0 ? (
                <div className="p-8 bg-white/[0.02] border border-white/5 rounded-xl text-center text-xs text-muted-foreground font-light">
                  Nenhuma rotina cadastrada de forma personalizada. Comece criando uma nova!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {operationalChecklists.map((chk) => (
                    <div
                      key={chk.id}
                      className="bg-[#121214]/50 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-all"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-semibold text-xs text-white max-w-md truncate">
                            {chk.title}
                          </span>
                          {!chk.isActive && (
                            <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              Inativo
                            </span>
                          )}
                          <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                            {periodLabels[(chk as any).period as keyof typeof periodLabels] || "Abertura"}
                          </span>
                          <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                            {frequencyLabels[(chk as any).frequency as keyof typeof frequencyLabels] || "Diário"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 font-light">
                          {chk.description || "Sem descrição definida."}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
                          <span>{chk.items?.length || 0} Tarefas</span>
                          <span>{((chk as any).category) || "Sem Categ"}</span>
                          {((chk as any).responsible) && (
                            <span className="flex items-center gap-1 text-[#D4AF37]">
                              <User className="w-3 h-3 text-[#D4AF37]" /> Responsável: {((chk as any).responsible)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(chk)}
                          className={`h-8 rounded-lg text-[10px] font-semibold px-2.5 transition-all text-zinc-300 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:text-white cursor-pointer`}
                        >
                          {chk.isActive ? "Desativar" : "Ativar"}
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEditView(chk)}
                          className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-white/5 rounded-lg cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDuplicateChecklist(chk)}
                          className="h-8 w-8 text-zinc-400 hover:text-blue-400 hover:bg-white/5 rounded-lg cursor-pointer"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteChecklist(chk.id)}
                          className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-zinc-300 text-xs font-semibold">
                  Título da Rotina <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: Checklist de Limpeza Noturna"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-black/40 border-white/10 text-white rounded-xl text-xs placeholder:text-zinc-600 focus:border-primary focus:ring-primary/20 h-9.5"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-zinc-300 text-xs font-semibold">
                    Categoria
                  </Label>
                  <Input
                    id="category"
                    placeholder="Geral, Limpeza, etc."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-black/40 border-white/10 text-white rounded-xl text-xs placeholder:text-zinc-600 h-9.5"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="responsible" className="text-zinc-300 text-xs font-semibold">
                    Responsável (Opcional)
                  </Label>
                  <Input
                    id="responsible"
                    placeholder="Equipe / Cargo / Nome"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    className="bg-black/40 border-white/10 text-white rounded-xl text-xs placeholder:text-zinc-600 h-9.5"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 font-sans">
              <Label htmlFor="description" className="text-zinc-300 text-xs font-semibold">
                Descrição ou Instruções
              </Label>
              <Input
                id="description"
                placeholder="Instruções gerais sobre como e quando realizar esta rotina."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-black/40 border-white/10 text-white rounded-xl text-xs placeholder:text-zinc-600 h-9.5"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Frequência de Exibição
                </Label>
                <select
                  value={frequency}
                  onChange={(e: any) => setFrequency(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-primary/20 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="personalizada">Personalizada</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" /> Período / Momento as Atividades
                </Label>
                <select
                  value={period}
                  onChange={(e: any) => setPeriod(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-primary/20 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="abertura">Abertura</option>
                  <option value="meio_dia">Meio do Dia</option>
                  <option value="fechamento">Fechamento</option>
                  <option value="limpeza">Foco Limpeza</option>
                  <option value="estoque">Estoque</option>
                  <option value="atendimento">Atendimento</option>
                  <option value="outro">Outro Período</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Obrigatoriedade e Estado</Label>
                <div className="flex gap-2.5 h-9.5 items-center">
                  <button
                    type="button"
                    onClick={() => setRequired(!required)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                      required
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-white/5 border-white/10 text-zinc-400"
                    }`}
                  >
                    {required ? "Obrigatório" : "Opcional"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/10 text-zinc-400"
                    }`}
                  >
                    {isActive ? "Ativo no Painel" : "Inativo"}
                  </button>
                </div>
              </div>
            </div>

            {/* SEÇÃO DE ITENS */}
            <div className="space-y-3.5 pt-4 border-t border-white/5 font-sans">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> itens / atividades da rotina
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemField}
                  className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl text-xs h-8 px-3 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" /> Adicionar Item
                </Button>
              </div>

              <p className="text-[10px] text-zinc-400 font-light leading-snug">
                Defina as ações detalhadas que devem ser verificadas. Ordene os itens com as setas para ditar o passo a passo lógico do colaborador.
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-2.5 hover:border-white/10 transition-all font-sans"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 w-5 text-right font-semibold">
                      #{index + 1}
                    </span>

                    <Input
                      placeholder="Descrição clara do item, ex: Conferir se cafeteira foi desligada"
                      value={item.label}
                      onChange={(e) => updateItemLabel(index, e.target.value)}
                      className="bg-black/20 border-white/5 text-white rounded-lg text-xs placeholder:text-zinc-600 h-8 flex-1"
                      required
                    />

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveItemUp(index)}
                        disabled={index === 0}
                        className="h-7 w-7 text-zinc-500 hover:text-white rounded-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Subir"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveItemDown(index)}
                        disabled={index === items.length - 1}
                        className="h-7 w-7 text-zinc-500 hover:text-white rounded-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Descer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItemField(index)}
                        disabled={items.length <= 1}
                        className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/5 font-sans">
              <Button
                type="button"
                variant="outline"
                onClick={() => setView("list")}
                className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl text-xs h-9.5 px-4 cursor-pointer"
              >
                Voltar à lista
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-gold-500 text-black font-semibold text-xs rounded-xl h-9.5 px-6 shrink-0 cursor-pointer"
              >
                Salvar Rotina
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
