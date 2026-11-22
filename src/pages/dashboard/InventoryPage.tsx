import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canManageSalonOperations } from '@/lib/permissions';
import {
  InventoryItem,
  Professional,
  PurchaseOrder,
  StockInventorySession,
  StockRequisition,
  Supplier,
} from '@/types';
import {
  subscribeInventoryItems,
  subscribePurchaseOrders,
  subscribeSalonProfessionals,
  subscribeStockInventories,
  subscribeStockRequisitions,
  subscribeSuppliers,
} from '@/services/inventoryService';
import { getExpirationHealth, getStockHealth } from '@/components/inventory/inventoryConstants';
import { InventoryProductsTab } from '@/components/inventory/InventoryProductsTab';
import { InventorySuppliersTab } from '@/components/inventory/InventorySuppliersTab';
import { InventoryPurchaseOrdersTab } from '@/components/inventory/InventoryPurchaseOrdersTab';
import { InventoryAuditTab } from '@/components/inventory/InventoryAuditTab';
import { InventoryRequisitionsTab } from '@/components/inventory/InventoryRequisitionsTab';
import { ProductFormModal } from '@/components/inventory/ProductFormModal';
import { StockMovementModal } from '@/components/inventory/StockMovementModal';
import { ProductHistoryModal } from '@/components/inventory/ProductHistoryModal';
import { SupplierFormModal } from '@/components/inventory/SupplierFormModal';
import { NfeImportModal } from '@/components/inventory/NfeImportModal';
import { cn, formatBRL } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  FileCode2,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type InventoryTabId =
  | 'products'
  | 'suppliers'
  | 'purchase_orders'
  | 'audit'
  | 'requisitions';

export default function InventoryPage() {
  const { userData, currentUser } = useAuth();
  const salonId = userData?.salonId || '';
  const operatorName = userData?.fullName || currentUser?.email || 'Gestor';
  const currentUserId = currentUser?.uid || 'system';
  const canManage = canManageSalonOperations(userData?.role);

  const [activeTab, setActiveTab] = useState<InventoryTabId>('products');
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [auditSessions, setAuditSessions] = useState<StockInventorySession[]>([]);
  const [requisitions, setRequisitions] = useState<StockRequisition[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementDirection, setMovementDirection] = useState<'in' | 'out'>('in');
  const [movementProduct, setMovementProduct] = useState<InventoryItem | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<InventoryItem | null>(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [nfeModalOpen, setNfeModalOpen] = useState(false);
  const [prefilledCriticalItems, setPrefilledCriticalItems] = useState<InventoryItem[] | null>(
    null
  );

  useEffect(() => {
    if (!salonId || !currentUser?.uid) {
      setItems([]);
      setSuppliers([]);
      setOrders([]);
      setAuditSessions([]);
      setRequisitions([]);
      setProfessionals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let initialLoaded = false;

    const unsubItems = subscribeInventoryItems(
      salonId,
      (list) => {
        setItems(list);
        if (!initialLoaded) {
          initialLoaded = true;
          setLoading(false);
        }
      },
      () => setLoading(false)
    );
    const unsubSuppliers = subscribeSuppliers(salonId, setSuppliers, () => setSuppliers([]));
    const unsubOrders = subscribePurchaseOrders(salonId, setOrders, () => setOrders([]));
    const unsubAudits = subscribeStockInventories(salonId, setAuditSessions, () =>
      setAuditSessions([])
    );
    const unsubRequisitions = subscribeStockRequisitions(salonId, setRequisitions, () =>
      setRequisitions([])
    );
    const unsubProfs = subscribeSalonProfessionals(salonId, setProfessionals, () =>
      setProfessionals([])
    );

    return () => {
      unsubItems();
      unsubSuppliers();
      unsubOrders();
      unsubAudits();
      unsubRequisitions();
      unsubProfs();
    };
  }, [salonId, currentUser?.uid]);

  // Real-time KPI Metrics
  const kpis = useMemo(() => {
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalResalePotential = 0;
    let criticalCount = 0;
    let expiringCount = 0;

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      totalUnits += qty;
      totalCostValue += qty * Number(item.costPrice || 0);
      if ((item.stockLocation || 'resale') === 'resale' || item.stockLocation === 'mixed') {
        totalResalePotential += qty * Number(item.sellingPrice || 0);
      }
      const stockHealth = getStockHealth(item);
      if (stockHealth.status === 'out' || stockHealth.status === 'critical') {
        criticalCount += 1;
      }
      const exp = getExpirationHealth(item.nextExpirationDate);
      if (exp.status === 'expired' || exp.status === 'expiring_soon') {
        expiringCount += 1;
      }
    }

    const grossMarginPotential = Math.max(0, totalResalePotential - totalCostValue);

    return {
      skuCount: items.length,
      totalUnits: Number(totalUnits.toFixed(1)),
      criticalCount,
      expiringCount,
      totalCostValue,
      totalResalePotential,
      grossMarginPotential,
    };
  }, [items]);

  const pendingRequisitionsCount = useMemo(
    () => requisitions.filter((r) => r.status === 'pending').length,
    [requisitions]
  );

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  };

  const openEditProduct = (item: InventoryItem) => {
    setEditingProduct(item);
    setProductModalOpen(true);
  };

  const openMovement = (direction: 'in' | 'out', item?: InventoryItem) => {
    setMovementDirection(direction);
    setMovementProduct(item || null);
    setMovementModalOpen(true);
  };

  const openHistory = (item: InventoryItem) => {
    setHistoryProduct(item);
    setHistoryModalOpen(true);
  };

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierModalOpen(true);
  };

  const handleGenerateRestockOrder = (criticalItems: InventoryItem[]) => {
    setPrefilledCriticalItems(criticalItems);
    setActiveTab('purchase_orders');
  };

  const tabs: Array<{
    id: InventoryTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'products', label: `Produtos (${items.length})`, icon: Package },
    { id: 'suppliers', label: `Fornecedores (${suppliers.length})`, icon: Building2 },
    { id: 'purchase_orders', label: `Pedidos & NF-e (${orders.length})`, icon: ShoppingCart },
    { id: 'audit', label: `Inventário EAN (${auditSessions.length})`, icon: ClipboardCheck },
    {
      id: 'requisitions',
      label:
        pendingRequisitionsCount > 0
          ? `Solicitações de Saída (${pendingRequisitionsCount})`
          : 'Solicitações de Saída',
      icon: ClipboardList,
    },
  ];

  return (
    <div id="inventory-management-module" className="space-y-5 pb-12">
      {/* Editorial Warm-Light Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-[#171717] tracking-tight">
            Estoque & Suprimentos
          </h1>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Gestão de produtos por local, validade, NF-e XML, auditoria EAN, fornecedores e
            requisições da equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setNfeModalOpen(true)}
            className="h-9 px-3.5 text-xs bg-white border-[#E5E2DC] text-[#171717] hover:bg-[#FAF9F7] rounded-lg font-semibold whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5 mr-1.5 text-[#8A6D36]" />
            Importar NF-e (XML)
          </Button>
          <Button
            type="button"
            onClick={openNewProduct}
            className="h-9 px-4 text-xs bg-[#171717] hover:bg-[#2B2B2B] text-white rounded-lg font-semibold whitespace-nowrap shrink-0"
          >
            + Novo Produto
          </Button>
        </div>
      </div>

      {/* 4-Column Flat KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
              SKUs & Unidades
            </span>
            <span className="text-xl font-heading font-bold text-[#171717] tabular-nums block">
              {kpis.skuCount} itens
            </span>
            <span className="text-[11px] text-[#8A6D36] font-medium block tabular-nums">
              {kpis.totalUnits} unidades armazenadas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center text-[#171717] shrink-0">
            <Package className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
              Alertas Críticos & Validade
            </span>
            <span
              className={cn(
                'text-xl font-heading font-bold tabular-nums block',
                kpis.criticalCount > 0 ? 'text-rose-600' : 'text-emerald-700'
              )}
            >
              {kpis.criticalCount} críticos
            </span>
            <span className="text-[11px] text-[#6B6B6B] block tabular-nums">
              {kpis.expiringCount} vencidos ou vencendo em 30d
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center text-[#8A6D36] shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
              Capital em Estoque (Custo)
            </span>
            <span className="text-xl font-heading font-bold text-[#171717] font-mono tabular-nums block">
              {formatBRL(kpis.totalCostValue)}
            </span>
            <span className="text-[11px] text-[#6B6B6B] block">Valor imobilizado em custo</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center text-[#171717] shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
              Potencial de Revenda
            </span>
            <span className="text-xl font-heading font-bold text-emerald-700 font-mono tabular-nums block">
              {formatBRL(kpis.totalResalePotential)}
            </span>
            <span className="text-[11px] text-[#6B6B6B] block tabular-nums">
              Margem proj.: {formatBRL(kpis.grossMarginPotential)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center text-emerald-700 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* 5-Tab Bar */}
      <div className="bg-white border border-[#E5E2DC] rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                isActive
                  ? 'bg-[#171717] text-white'
                  : 'text-[#6B6B6B] hover:text-[#171717] hover:bg-[#FAF9F7]'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-[#D4AF37]' : 'text-[#6B6B6B]')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Sub-module */}
      {activeTab === 'products' && (
        <InventoryProductsTab
          salonId={salonId}
          items={items}
          loading={loading}
          onOpenNewProduct={openNewProduct}
          onEditProduct={openEditProduct}
          onOpenMovement={openMovement}
          onOpenHistory={openHistory}
          onGenerateRestockOrder={handleGenerateRestockOrder}
        />
      )}

      {activeTab === 'suppliers' && (
        <InventorySuppliersTab
          salonId={salonId}
          suppliers={suppliers}
          inventoryItems={items}
          onNewSupplier={openNewSupplier}
          onEditSupplier={openEditSupplier}
        />
      )}

      {activeTab === 'purchase_orders' && (
        <InventoryPurchaseOrdersTab
          salonId={salonId}
          orders={orders}
          inventoryItems={items}
          suppliers={suppliers}
          operatorName={operatorName}
          onOpenNfeImport={() => setNfeModalOpen(true)}
          prefilledCriticalItems={prefilledCriticalItems}
          onClearPrefilledCritical={() => setPrefilledCriticalItems(null)}
        />
      )}

      {activeTab === 'audit' && (
        <InventoryAuditTab
          salonId={salonId}
          items={items}
          sessions={auditSessions}
          responsibleName={operatorName}
          canManage={canManage}
        />
      )}

      {activeTab === 'requisitions' && (
        <InventoryRequisitionsTab
          salonId={salonId}
          items={items}
          requisitions={requisitions}
          professionals={professionals}
          currentUserId={currentUserId}
          currentUserName={operatorName}
          canManage={canManage}
        />
      )}

      {/* Modals */}
      <ProductFormModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        salonId={salonId}
        editingProduct={editingProduct}
        suppliers={suppliers}
      />

      <StockMovementModal
        open={movementModalOpen}
        onOpenChange={setMovementModalOpen}
        salonId={salonId}
        direction={movementDirection}
        items={items}
        preselectedProduct={movementProduct}
        suppliers={suppliers}
        professionals={professionals}
        operatorName={operatorName}
      />

      <ProductHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        salonId={salonId}
        product={historyProduct}
      />

      <SupplierFormModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        salonId={salonId}
        editingSupplier={editingSupplier}
      />

      <NfeImportModal
        open={nfeModalOpen}
        onOpenChange={setNfeModalOpen}
        salonId={salonId}
        inventoryItems={items}
        suppliers={suppliers}
        operatorName={operatorName}
      />
    </div>
  );
}
