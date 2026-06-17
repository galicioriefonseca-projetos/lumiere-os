import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "../../lib/audit";
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  ArrowUpDown, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Minus,
  Edit
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface InventoryItem {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: string;
  quantity: number;
  minQuantity: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
}

export default function InventoryPage() {
  const { salonData, userData, currentUser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form Addition States
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Vaporizador/Uso Geral");
  const [quantity, setQuantity] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [supplier, setSupplier] = useState("");

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const fetchInventory = async () => {
    if (!salonData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/salons/${salonData.id}/inventory`);
      if (!res.ok) throw new Error("Erro na rede do servidor");
      const dbItems: InventoryItem[] = await res.json();
      dbItems.sort((a, b) => a.name.localeCompare(b.name));
      setItems(dbItems);
    } catch (error) {
      console.error("Erro ao carregar estoque via proxy:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [salonData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    const qtyVal = parseInt(quantity) || 0;
    const minQtyVal = parseInt(minQuantity) || 0;
    const costVal = parseFloat(costPrice.replace(",", ".")) || 0;
    const sellVal = parseFloat(sellingPrice.replace(",", ".")) || 0;

    if (!name || isNaN(qtyVal)) {
      toast.error("Preencha ao menos o nome do produto e a quantidade correta.");
      return;
    }

    try {
      const payload = {
        name,
        brand,
        sku: sku || "SKU-" + Math.floor(Math.random() * 100000),
        category,
        quantity: qtyVal,
        minQuantity: minQtyVal,
        costPrice: costVal,
        sellingPrice: sellVal,
        supplier,
        updatedAt: Date.now()
      };

      const res = await fetch(`/api/proxy/salons/${salonData.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Erro ao criar produto no proxy");
      
      await logAuditEvent(
        salonData.id,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "create",
          targetEntity: "inventory",
          targetId: "inventory",
          description: `Cadastrou o produto "${name}" marca ${brand} no estoque (${qtyVal} unidades)`,
          details: payload
        }
      );

      // Clear Form
      setName("");
      setBrand("");
      setSku("");
      setQuantity("");
      setMinQuantity("");
      setCostPrice("");
      setSellingPrice("");
      setSupplier("");
      toast.success(`Item "${name}" colocado no estoque com sucesso!`);
      await fetchInventory();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gravar produto.");
    }
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !editingItem) return;

    const newQty = parseInt(editQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.error("Insira uma quantidade inteira válida.");
      return;
    }

    try {
      const res = await fetch(`/api/proxy/salons/${salonData.id}/inventory/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty, updatedAt: Date.now() })
      });
      if (!res.ok) throw new Error("Erro ao atualizar produto no proxy");

      await logAuditEvent(
        salonData.id,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "update",
          targetEntity: "inventory",
          targetId: editingItem.id,
          description: `Atualizou estoque do produto "${editingItem.name}" de ${editingItem.quantity} para ${newQty}`,
          details: { previous: editingItem.quantity, next: newQty }
        }
      );

      toast.success("Estoque de " + editingItem.name + " sincronizado!");
      setEditingItem(null);
      setEditQuantity("");
      await fetchInventory();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar atualização do estoque.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!salonData) return;
    if (!confirm(`Remover permanentemente do estoque o item: "${name}"?`)) return;

    try {
      const res = await fetch(`/api/proxy/salons/${salonData.id}/inventory/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Erro ao excluir do estoque no proxy");

      await logAuditEvent(
        salonData.id,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "delete",
          targetEntity: "inventory",
          targetId: id,
          description: `Excluiu o produto "${name}" do inventário`
        }
      );

      toast.success("Produto excluído do estoque!");
      await fetchInventory();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao deletar.");
    }
  };

  // Stats calculators
  const lowStockItems = items.filter(item => item.quantity <= item.minQuantity);
  const totalItemsCount = items.reduce((acc, current) => acc + current.quantity, 0);
  const totalAssetValueList = items.reduce((acc, current) => acc + (current.quantity * current.costPrice), 0);
  const projectedRevenue = items.reduce((acc, current) => acc + (current.quantity * current.sellingPrice), 0);

  const filteredItems = items.filter(item => {
    const term = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(term) || item.brand.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);
  });

  return (
    <div id="inventory-management-module" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-light text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-[#D4AF37]" />
            Inventário & Gestão de Estoque (Estoque)
          </h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Mapeamento de produtos de revenda, insumos de uso interno técnico e previsibilidade de reposição automatizada.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 font-bold uppercase block tracking-wider">Produtos Totais</span>
              <span className="text-xl font-heading font-bold text-white">{items.length} itens</span>
              <span className="text-[9px] text-[#D4AF37] font-semibold block">{totalItemsCount} unidades no almoxarifado</span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-zinc-400">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 font-bold uppercase block tracking-wider">Estoques Críticos / Baixos</span>
              <span className={`text-xl font-heading font-bold ${lowStockItems.length > 0 ? "text-amber-450 animate-pulse" : "text-emerald-450"}`}>
                {lowStockItems.length} Alertas
              </span>
              <span className="text-[9px] text-neutral-500 block">Exigem reposição faturamento</span>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 font-bold uppercase block tracking-wider">Preço de Custo Ativo</span>
              <span className="text-xl font-heading font-bold text-cyan-405">{formatBRL(totalAssetValueList)}</span>
              <span className="text-[9px] text-neutral-500 block">Investimento físico em produtos</span>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-450">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 font-bold uppercase block tracking-wider">Receita Potencial Revenda</span>
              <span className="text-xl font-heading font-bold text-emerald-400">{formatBRL(projectedRevenue)}</span>
              <span className="text-[9px] text-[#D4AF37] block">Lucro bruto pós-venda garantido</span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adicionar Produto */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-1">
          <CardHeader className="border-b border-neutral-900/50 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-[#D4AF37]" /> Novo Item no Estoque
            </CardTitle>
            <CardDescription className="text-[11px] text-neutral-500">
              Registre novos suprimentos para a clínica ou ponto de venda física.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleCreate} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium block">Nome do Produto *</label>
                <Input
                  placeholder="Ex: Refil Kerastase Chronologiste 500ml"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Marca</label>
                  <Input
                    placeholder="Ex: Kérastase, L'Oréal"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Código SKU / Barras</label>
                  <Input
                    placeholder="Codificar opcional"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Qtd em Estoque *</label>
                  <Input
                    placeholder="0"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Estoque Crítico (Min) *</label>
                  <Input
                    placeholder="Alerta de reposição"
                    type="number"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Preço de Custo (R$)</label>
                  <Input
                    placeholder="0,00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Preço de Revenda (R$)</label>
                  <Input
                    placeholder="0,00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Classificação</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-905 text-white border border-neutral-800 rounded-xl p-2.5 text-xs outline-none"
                  >
                    <option value="Uso Técnico Clínico">Uso Técnico Clínico</option>
                    <option value="Home Care / Revenda">Home Care / Revenda</option>
                    <option value="Equipamentos e Acessórios">Equipamentos e Acessórios</option>
                    <option value="Descartáveis">Descartáveis</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Distribuidor / Fornecedor</label>
                  <Input
                    placeholder="Distribuidora Beleza"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#c49f27] text-black font-semibold h-10 rounded-xl tracking-wider transition-all pt-1">
                Adicionar ao Estoque
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listagem de Estoque */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-2">
          <CardHeader className="border-b border-neutral-900/50 pb-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-[#D4AF37]" /> Itens e Recursos Ativos
                </CardTitle>
                <CardDescription className="text-[11px] text-neutral-500">
                  Gerenciamento de reposições e auditorias de produtos físicas.
                </CardDescription>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64 max-w-xs">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  placeholder="Pesquisar produto, marca, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#09090b] text-neutral-350 text-xs pl-10 h-9 rounded-xl border-neutral-800"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {editingItem && (
              <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs space-y-3">
                <p className="font-semibold text-[#D4AF37]">⚙️ Ajuste Rápido de Estoque (Físico): {editingItem.name}</p>
                <form onSubmit={handleUpdateQuantity} className="flex items-center gap-2">
                  <div className="max-w-[120px]">
                    <Input
                      type="number"
                      placeholder="Qtd atual"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="bg-neutral-950 text-white border-neutral-800 text-xs h-9 rounded-xl"
                    />
                  </div>
                  <Button type="submit" size="sm" className="bg-[#D4AF37] hover:bg-amber-600 text-black font-bold h-9.5 rounded-xl px-4">Sincronizar</Button>
                  <Button type="button" size="sm" variant="ghost" className="h-9 rounded-xl text-neutral-400" onClick={() => setEditingItem(null)}>Cancelar</Button>
                </form>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-xs font-mono text-neutral-500">
                <Plus className="w-4 h-4 animate-spin inline-block mr-2" /> Carregando prateleiras do estoque...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-xs text-neutral-450 font-light flex flex-col items-center justify-center space-y-2">
                <Package className="w-8 h-8 text-neutral-600" />
                <p>Nenhum produto cadastrado no estoque ou encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300 font-sans">
                  <thead className="bg-[#09090b]/85 border-b border-[#D4AF37]/10 text-neutral-400 font-semibold lowercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">SKU</th>
                      <th className="p-4">Produto</th>
                      <th className="p-4">Classificação / Marca</th>
                      <th className="p-4 text-center">Nível / Mínimo</th>
                      <th className="p-4 text-right">Custo / Revenda</th>
                      <th className="p-4 pr-6 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {filteredItems.map((item) => {
                      const isLow = item.quantity <= item.minQuantity;
                      return (
                        <tr key={item.id} className="hover:bg-neutral-900/10 transition-all font-light">
                          <td className="p-4 pl-6 font-mono text-[10px] text-[#D4AF37]">{item.sku}</td>
                          <td className="p-4 font-semibold text-white">
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-[10px] text-zinc-500 uppercase">{item.brand || "Sem marca"} • Fornecedor: {item.supplier || "Geral"}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="p-1 px-2 bg-neutral-900/90 border border-neutral-800 rounded-lg text-[9px] text-[#a1a1aa] font-medium block w-max uppercase tracking-wider">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs leading-none ${
                                isLow ? "bg-rose-500/15 text-rose-455 border border-rose-500/20" : "bg-neutral-900/80 text-white border border-neutral-800"
                              }`}>
                                {item.quantity}
                              </span>
                              <span className="text-zinc-500">/</span>
                              <span className="text-zinc-500 font-mono text-[10px]">{item.minQuantity}</span>
                              {isLow && (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-450 animate-bounce" />
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex flex-col font-mono text-[11px]">
                              <span className="text-neutral-400">Custo: {formatBRL(item.costPrice)}</span>
                              <span className="text-[#D4AF37] font-semibold">Preço: {formatBRL(item.sellingPrice)}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditQuantity(String(item.quantity));
                                }}
                                className="p-1.5 text-neutral-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/15 rounded-lg transition-all"
                                title="Editar Qtd de Estoque"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-1.5 text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Remover Produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
