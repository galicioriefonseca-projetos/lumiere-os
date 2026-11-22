import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { OperationType, reportFirestoreListenerError } from "@/lib/firestoreError";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { Service, Category, ServicePackage, SalonResource } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/ui/search-bar";
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
  Clock,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Upload,
  Settings2,
  ShoppingBag,
  Globe,
  Package,
  DoorOpen,
  Printer,
  Check,
} from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";
import { SERVICE_TEMPLATES, INITIAL_CATEGORIES, getCategoriesForSegment } from "../../data/serviceTemplates";
import { useLexicon } from "../../hooks/useLexicon";
import { PackagesTab } from "@/components/services/PackagesTab";
import { ResourcesTab } from "@/components/services/ResourcesTab";
import * as XLSX from "xlsx";

interface PdfParsedItem {
  name: string;
  category?: string;
  price?: number | string;
  priceType?: string;
  durationMinutes?: number | string;
  description?: string;
  type?: string;
}

type CatalogTab = "services" | "packages" | "resources";

export default function ServicesPage() {
  const { salonData, userData, currentUser } = useAuth();
  const { segment } = useLexicon();

  const [activeCatalogTab, setActiveCatalogTab] = useState<CatalogTab>("services");

  // App state
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search, filter & bulk selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Todos");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "service" | "product">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    costPrice: "",
    priceType: "fixed" as "fixed" | "from" | "variable",
    durationMinutes: "60",
    description: "",
    type: "service" as "service" | "product",
    onlineBookingEnabled: true,
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

  // Multi-source (CSV / PDF) Import States
  const [isMultipleImportOpen, setIsMultipleImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"csv" | "pdf">("csv");
  const [dragActive, setDragActive] = useState(false);
  const [multiImportFile, setMultiImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState({
    name: -1,
    category: -1,
    price: -1,
    priceType: -1,
    durationMinutes: -1,
    description: -1,
    type: -1,
  });

  const [pdfParsedItems, setPdfParsedItems] = useState<PdfParsedItem[]>([]);
  const [selectedPdfKeys, setSelectedPdfKeys] = useState<Record<number, boolean>>({});
  const [isImportingProgress, setIsImportingProgress] = useState(false);
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [totalImportedCount, setTotalImportedCount] = useState(0);

  // Role permissions
  const isOwnerOrManager =
    userData?.role === "owner" ||
    userData?.role === "manager" ||
    userData?.role === "platform_admin";

  useEffect(() => {
    if (!salonData?.id || !currentUser?.uid) {
      setServices([]);
      setCategories([]);
      setPackages([]);
      setResources([]);
      setLoading(false);
      return;
    }

    const qs = query(collection(db, `salons/${salonData.id}/services`));
    const unsubS = onSnapshot(
      qs,
      (snapshot) => {
        const svcs: Service[] = [];
        snapshot.forEach((d) => svcs.push({ id: d.id, ...d.data() } as Service));
        setServices(svcs.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      },
      (error) => {
        reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonData.id}/services`);
        setLoading(false);
      }
    );

    const qc = query(collection(db, `salons/${salonData.id}/categories`));
    const unsubC = onSnapshot(
      qc,
      (snapshot) => {
        const cats: Category[] = [];
        snapshot.forEach((d) => cats.push({ id: d.id, ...d.data() } as Category));
        setCategories(cats);
      },
      (error) => {
        reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonData.id}/categories`);
      }
    );

    const qp = query(collection(db, `salons/${salonData.id}/packages`));
    const unsubP = onSnapshot(
      qp,
      (snapshot) => {
        const pkgs: ServicePackage[] = [];
        snapshot.forEach((d) => pkgs.push({ id: d.id, ...d.data() } as ServicePackage));
        setPackages(pkgs);
      },
      (error) => {
        reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonData.id}/packages`);
      }
    );

    const qr = query(collection(db, `salons/${salonData.id}/resources`));
    const unsubR = onSnapshot(
      qr,
      (snapshot) => {
        const resList: SalonResource[] = [];
        snapshot.forEach((d) => resList.push({ id: d.id, ...d.data() } as SalonResource));
        setResources(resList);
      },
      (error) => {
        reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonData.id}/resources`);
      }
    );

    return () => {
      unsubS();
      unsubC();
      unsubP();
      unsubR();
    };
  }, [salonData?.id, currentUser?.uid]);

  const allAvailableCategories = useMemo(() => {
    const listSet = new Set<string>();
    getCategoriesForSegment(segment).forEach((c) => listSet.add(c));
    INITIAL_CATEGORIES.forEach((c) => listSet.add(c));
    categories.forEach((c) => {
      if (c.name && c.isActive) listSet.add(c.name);
    });
    services.forEach((s) => {
      if (s.category) listSet.add(s.category);
    });
    return Array.from(listSet).sort((a, b) => a.localeCompare(b));
  }, [segment, categories, services]);

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      price: "",
      costPrice: "",
      priceType: "fixed",
      durationMinutes: "60",
      description: "",
      type: "service",
      onlineBookingEnabled: true,
    });
    setIsCustomCategory(false);
    setCustomCategoryName("");
    setEditingService(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const priceVal =
        formData.priceType === "variable"
          ? 0
          : parseFloat(formData.price.replace(",", ".")) || 0;
      const costPriceVal = formData.costPrice
        ? parseFloat(formData.costPrice.replace(",", ".")) || 0
        : 0;
      const durationVal =
        formData.type === "product" ? 0 : parseInt(formData.durationMinutes, 10) || 60;

      const categoryToSave = isCustomCategory
        ? customCategoryName.trim()
        : formData.category;

      if (!categoryToSave) {
        toast.error("Por favor, selecione ou digite uma categoria.");
        return;
      }

      if (editingService) {
        await updateDoc(doc(db, `salons/${salonData.id}/services`, editingService.id), {
          name: formData.name.trim(),
          category: categoryToSave,
          price: priceVal,
          costPrice: costPriceVal,
          priceType: formData.priceType,
          durationMinutes: durationVal,
          description: formData.description.trim(),
          type: formData.type,
          onlineBookingEnabled: formData.onlineBookingEnabled,
          updatedAt: Date.now(),
        });
        toast.success(`${formData.type === "product" ? "Produto" : "Serviço"} atualizado!`);
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: formData.name.trim(),
          category: categoryToSave,
          price: priceVal,
          costPrice: costPriceVal,
          priceType: formData.priceType,
          durationMinutes: durationVal,
          description: formData.description.trim(),
          type: formData.type,
          onlineBookingEnabled: formData.onlineBookingEnabled,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success(
          `${formData.type === "product" ? "Produto" : "Serviço"} cadastrado com sucesso!`
        );
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar item.");
    }
  };

  const toggleStatus = async (item: Service) => {
    if (!salonData || !isOwnerOrManager) return;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/services`, item.id), {
        isActive: !item.isActive,
        updatedAt: Date.now(),
      });
      toast.success(
        `${item.type === "product" ? "Produto" : "Serviço"} ${!item.isActive ? "ativado" : "inativado"}.`
      );
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const toggleOnlineBooking = async (item: Service) => {
    if (!salonData || !isOwnerOrManager) return;
    const nextOnline = item.onlineBookingEnabled === false;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/services`, item.id), {
        onlineBookingEnabled: nextOnline,
        updatedAt: Date.now(),
      });
      toast.success(
        nextOnline
          ? "Agendamento online habilitado para este item."
          : "Ocultado do agendamento online."
      );
    } catch {
      toast.error("Erro ao atualizar disponibilidade online.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!salonData || !isOwnerOrManager) return;
    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/services`, id));
      toast.success("Item excluído com sucesso.");
      setDeleteConfirmId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast.error("Erro ao excluir item.");
    }
  };

  const openEdit = (item: Service) => {
    setEditingService(item);
    const isInDropdown = allAvailableCategories.includes(item.category);
    setFormData({
      name: item.name,
      category: isInDropdown ? item.category : "",
      price: item.price.toString(),
      costPrice: item.costPrice ? item.costPrice.toString() : "",
      priceType: item.priceType || "fixed",
      durationMinutes: item.durationMinutes.toString(),
      description: item.description || "",
      type: item.type || "service",
      onlineBookingEnabled: item.onlineBookingEnabled !== false,
    });

    if (!isInDropdown) {
      setIsCustomCategory(true);
      setCustomCategoryName(item.category);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryName("");
    }
    setIsDialogOpen(true);
  };

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q));
      const matchesCategory =
        selectedCategoryFilter === "Todos" || s.category === selectedCategoryFilter;
      const itemType = s.type || "service";
      const matchesType = selectedTypeFilter === "all" || itemType === selectedTypeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [services, searchQuery, selectedCategoryFilter, selectedTypeFilter]);

  const toggleSelectService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredServices.length > 0 && filteredServices.every((s) => selectedIds.has(s.id));
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredServices.map((s) => s.id)));
    }
  };

  const runBulkAction = async (
    action: "online_on" | "online_off" | "activate" | "deactivate" | "delete"
  ) => {
    if (!salonData || !isOwnerOrManager || selectedIds.size === 0) return;
    if (
      action === "delete" &&
      !window.confirm(`Deseja excluir ${selectedIds.size} item(ns) selecionados permanentemente?`)
    ) {
      return;
    }

    setBulkProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 400) {
        chunks.push(ids.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          const ref = doc(db, `salons/${salonData.id}/services`, id);
          if (action === "delete") {
            batch.delete(ref);
          } else if (action === "online_on") {
            batch.update(ref, { onlineBookingEnabled: true, updatedAt: Date.now() });
          } else if (action === "online_off") {
            batch.update(ref, { onlineBookingEnabled: false, updatedAt: Date.now() });
          } else if (action === "activate") {
            batch.update(ref, { isActive: true, updatedAt: Date.now() });
          } else if (action === "deactivate") {
            batch.update(ref, { isActive: false, updatedAt: Date.now() });
          }
        });
        await batch.commit();
      }

      toast.success(`Ação aplicada a ${ids.length} ${ids.length === 1 ? "item" : "itens"}!`);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar ação em lote.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredServices.map((s) => ({
        Nome: s.name,
        Tipo: s.type === "product" ? "Produto" : "Serviço",
        Categoria: s.category,
        "Valor Venda (R$)": s.price,
        "Preço Custo (R$)": s.costPrice || 0,
        "Duração (min)": s.durationMinutes,
        "Agendamento Online": s.onlineBookingEnabled !== false ? "Sim" : "Não",
        Status: s.isActive ? "Ativo" : "Inativo",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Catalogo");
      XLSX.writeFile(wb, `catalogo-lumiere-${new Date().toISOString().substring(0, 10)}.xlsx`);
      toast.success("Planilha Excel exportada com sucesso!");
    } catch {
      toast.error("Erro ao gerar arquivo Excel.");
    }
  };

  // Templates Import Helpers
  const filteredTemplates = useMemo(() => {
    if (!importSearch) return SERVICE_TEMPLATES;
    const q = importSearch.toLowerCase();
    return SERVICE_TEMPLATES.filter(
      (t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }, [importSearch]);

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, typeof SERVICE_TEMPLATES> = {};
    filteredTemplates.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTemplates]);

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
    SERVICE_TEMPLATES.filter((t) => t.category === catName).forEach((t) => {
      const key = `${t.category}::${t.name}`;
      if (checked) updated[key] = true;
      else delete updated[key];
    });
    setSelectedImportKeys(updated);
  };

  const handleToggleService = (catName: string, serviceName: string, checked: boolean) => {
    const key = `${catName}::${serviceName}`;
    const updated = { ...selectedImportKeys };
    if (checked) updated[key] = true;
    else delete updated[key];
    setSelectedImportKeys(updated);
  };

  const isAllSelected = useMemo(() => {
    if (filteredTemplates.length === 0) return false;
    return filteredTemplates.every((t) => selectedImportKeys[`${t.category}::${t.name}`]);
  }, [filteredTemplates, selectedImportKeys]);

  const countSelected = Object.keys(selectedImportKeys).length;

  const executeImport = async () => {
    if (!salonData || countSelected === 0) return;
    setImporting(true);
    try {
      const selectedTemplates = SERVICE_TEMPLATES.filter(
        (t) => selectedImportKeys[`${t.category}::${t.name}`]
      );
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

      const batch = writeBatch(db);
      templatesToCreate.forEach((t) => {
        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        batch.set(ref, {
          id: ref.id,
          name: t.name,
          category: t.category,
          price: t.price,
          priceType: t.priceType,
          durationMinutes: t.durationMinutes,
          description: t.description || "",
          onlineBookingEnabled: true,
          isActive: true,
          source: "template",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      await batch.commit();

      toast.success(`${templatesToCreate.length} serviços importados com sucesso!`);
      setIsImportOpen(false);
      setSelectedImportKeys({});
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar serviços selecionados.");
    } finally {
      setImporting(false);
    }
  };

  // Multi-source CSV/PDF Import Logic
  const resetMultipleImportState = () => {
    setMultiImportFile(null);
    setImportHeaders([]);
    setImportRows([]);
    setColumnMappings({
      name: -1,
      category: -1,
      price: -1,
      priceType: -1,
      durationMinutes: -1,
      description: -1,
      type: -1,
    });
    setPdfParsedItems([]);
    setSelectedPdfKeys({});
    setIsImportingProgress(false);
    setImportProgressPercent(0);
    setTotalImportedCount(0);
  };

  const handleMultiDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleMultiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleMultiFileLoad(e.dataTransfer.files[0]);
  };

  const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleMultiFileLoad(e.target.files[0]);
  };

  const parseFloatSafe = (val: string): number => {
    if (!val) return 0;
    const sanitized = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isProductKeyword = (name: string, cat: string): boolean => {
    const cleanedName = name.toLowerCase();
    const cleanedCategory = cat.toLowerCase();
    const prodWords = [
      "produto",
      "venda",
      "home care",
      "shampoo",
      "creme",
      "hidratante",
      "oleo",
      "gel",
      "mascara",
      "spray",
      "pote",
      "condicionador",
      "esmalt",
      "pomada",
      "cera",
      "finalizador",
      "cosmetico",
      "batom",
      "sabonete",
      "perfume",
      "ampola",
      "locao",
      "loção",
    ];
    return prodWords.some((w) => cleanedName.includes(w) || cleanedCategory.includes(w));
  };

  const handleMultiFileLoad = async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    setImportMode(isPdf ? "pdf" : "csv");
    setMultiImportFile(file);

    if (isPdf) {
      setIsImportingProgress(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        if (!result) {
          setIsImportingProgress(false);
          toast.error("Erro ao ler arquivo PDF.");
          return;
        }
        try {
          const res = await fetch("/api/parse-catalog-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pdfBase64: result,
              salonName: salonData?.name || "Lumiere Salon",
            }),
          });
          const data = (await res.json()) as { items?: PdfParsedItem[]; error?: string };
          if (!res.ok) throw new Error(data?.error || "Erro ao processar PDF.");

          if (data.items && Array.isArray(data.items)) {
            setPdfParsedItems(data.items);
            const selectedMap: Record<number, boolean> = {};
            data.items.forEach((_, idx) => {
              selectedMap[idx] = true;
            });
            setSelectedPdfKeys(selectedMap);
            toast.success(`Identificados ${data.items.length} itens do catálogo em PDF.`);
          } else {
            toast.error("Formato inválido de catálogo.");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Falha ao processar o PDF.";
          toast.error(msg);
          resetMultipleImportState();
        } finally {
          setIsImportingProgress(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        const parsedLines: string[][] = [];
        let row: string[] = [];
        let inQuotes = false;
        let currentValue = "";
        const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        for (let i = 0; i < normalizedText.length; i++) {
          const char = normalizedText[i];
          const nextChar = normalizedText[i + 1];
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentValue += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if ((char === "," || char === ";") && !inQuotes) {
            row.push(currentValue.trim());
            currentValue = "";
          } else if (char === "\n" && !inQuotes) {
            row.push(currentValue.trim());
            parsedLines.push(row);
            row = [];
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        if (currentValue !== "" || row.length > 0) {
          row.push(currentValue.trim());
          parsedLines.push(row);
        }

        const validLines = parsedLines.filter((r) => r.some((cell) => cell.length > 0));
        if (validLines.length === 0) {
          toast.error("Arquivo CSV vazio ou corrompido.");
          return;
        }

        const headers = validLines[0];
        setImportHeaders(headers);
        setImportRows(validLines.slice(1));

        const mapping = {
          name: -1,
          category: -1,
          price: -1,
          priceType: -1,
          durationMinutes: -1,
          description: -1,
          type: -1,
        };
        const cleanStr = (s: string) =>
          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        headers.forEach((hdr, idx) => {
          const c = cleanStr(hdr);
          if ((c.includes("nome") || c.includes("name") || c.includes("servi") || c.includes("produ") || c.includes("item")) && mapping.name === -1) mapping.name = idx;
          else if ((c.includes("categor") || c.includes("grupo")) && mapping.category === -1) mapping.category = idx;
          else if ((c.includes("preco") || c.includes("valor") || c.includes("price")) && mapping.price === -1) mapping.price = idx;
          else if ((c.includes("dura") || c.includes("tempo") || c.includes("min")) && mapping.durationMinutes === -1) mapping.durationMinutes = idx;
          else if ((c.includes("descri") || c.includes("detalhe")) && mapping.description === -1) mapping.description = idx;
          else if ((c.includes("tipo") || c.includes("type")) && mapping.type === -1) mapping.type = idx;
        });
        setColumnMappings(mapping);
      };
      reader.readAsText(file, "utf-8");
    }
  };

  const processCsvImport = async () => {
    if (!salonData || !importRows.length) return;
    if (columnMappings.name === -1) {
      toast.error("Por favor, selecione qual coluna contém o Nome do item.");
      return;
    }

    setIsImportingProgress(true);
    setImportProgressPercent(0);
    setTotalImportedCount(0);

    let count = 0;
    const total = importRows.length;

    try {
      const existingMapName = new Set<string>();
      services.forEach((s) =>
        existingMapName.add(`${s.name.toLowerCase()}::${(s.type || "service").toLowerCase()}`)
      );

      for (let i = 0; i < total; i += 50) {
        const chunk = importRows.slice(i, i + 50);
        const batch = writeBatch(db);
        let chunkCount = 0;

        chunk.forEach((row) => {
          const nameVal = row[columnMappings.name]?.trim();
          if (!nameVal) return;

          const categoryVal =
            columnMappings.category !== -1
              ? row[columnMappings.category]?.trim() || "Importados"
              : "Importados";
          const priceVal =
            columnMappings.price !== -1 ? parseFloatSafe(row[columnMappings.price]) : 0;
          const rawDur =
            columnMappings.durationMinutes !== -1
              ? parseInt(row[columnMappings.durationMinutes], 10)
              : 60;
          const durationMinutesVal = isNaN(rawDur) ? 60 : rawDur;
          const descriptionVal =
            columnMappings.description !== -1
              ? row[columnMappings.description]?.trim() || ""
              : "";

          let typeVal: "service" | "product" = "service";
          if (columnMappings.type !== -1) {
            const rawType = row[columnMappings.type]?.toLowerCase() || "";
            if (rawType.includes("prod") || rawType.includes("venda")) typeVal = "product";
          } else if (isProductKeyword(nameVal, categoryVal)) {
            typeVal = "product";
          }

          if (existingMapName.has(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`)) return;
          existingMapName.add(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`);

          const ref = doc(collection(db, `salons/${salonData.id}/services`));
          batch.set(ref, {
            id: ref.id,
            name: nameVal,
            category: categoryVal,
            price: priceVal,
            priceType: "fixed",
            durationMinutes: typeVal === "product" ? 0 : durationMinutesVal,
            description: descriptionVal,
            type: typeVal,
            onlineBookingEnabled: true,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          chunkCount++;
        });

        if (chunkCount > 0) {
          await batch.commit();
          count += chunkCount;
        }
        setTotalImportedCount(count);
        setImportProgressPercent(Math.round(((i + chunk.length) / total) * 100));
      }

      toast.success(`${count} itens importados com sucesso!`);
      setIsMultipleImportOpen(false);
      resetMultipleImportState();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar importação em massa.");
    } finally {
      setIsImportingProgress(false);
    }
  };

  const processPdfImport = async () => {
    if (!salonData || !pdfParsedItems.length) return;
    const selectedItems = pdfParsedItems.filter((_, idx) => selectedPdfKeys[idx]);
    if (selectedItems.length === 0) {
      toast.error("Selecione pelo menos um item para importar.");
      return;
    }

    setIsImportingProgress(true);
    setImportProgressPercent(0);
    setTotalImportedCount(0);

    try {
      const existingMapName = new Set<string>();
      services.forEach((s) =>
        existingMapName.add(`${s.name.toLowerCase()}::${(s.type || "service").toLowerCase()}`)
      );

      let count = 0;
      const batch = writeBatch(db);
      selectedItems.forEach((item) => {
        const nameVal = item.name?.trim();
        if (!nameVal) return;

        const categoryVal = item.category?.trim() || "Importados AI";
        const priceVal =
          typeof item.price === "number"
            ? item.price
            : parseFloatSafe(String(item.price || "0"));
        const durationMinutesVal =
          typeof item.durationMinutes === "number"
            ? item.durationMinutes
            : parseInt(String(item.durationMinutes || "60"), 10) || 60;
        const rawType = String(item.type || "").toLowerCase();
        const typeVal: "service" | "product" =
          rawType.includes("prod") || isProductKeyword(nameVal, categoryVal)
            ? "product"
            : "service";

        if (existingMapName.has(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`)) return;
        existingMapName.add(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`);

        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        batch.set(ref, {
          id: ref.id,
          name: nameVal,
          category: categoryVal,
          price: priceVal,
          priceType: "fixed",
          durationMinutes: typeVal === "product" ? 0 : durationMinutesVal,
          description: item.description?.trim() || "",
          type: typeVal,
          onlineBookingEnabled: true,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        count++;
      });

      await batch.commit();
      toast.success(`${count} itens adicionados ao catálogo!`);
      setIsMultipleImportOpen(false);
      resetMultipleImportState();
    } catch {
      toast.error("Falha ao salvar itens do PDF.");
    } finally {
      setIsImportingProgress(false);
    }
  };

  const formatPriceDescription = (
    price: number,
    priceType?: "fixed" | "from" | "variable"
  ) => {
    if (priceType === "variable") return "Sob avaliação";
    if (priceType === "from") return `A partir de ${formatBRL(price)}`;
    return formatBRL(price);
  };

  if (loading || !salonData?.id) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A6D36]" />
        <span className="text-xs text-[#6B6B6B] font-medium">
          Carregando Catálogo LumièreOS...
        </span>
      </div>
    );
  }

  const allFilteredSelected =
    filteredServices.length > 0 && filteredServices.every((s) => selectedIds.has(s.id));

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Warm-Light */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#171717] font-heading flex items-center gap-2">
              <Scissors className="w-5 h-5 text-[#8A6D36]" />
              Catálogo, Pacotes & Recursos
            </h1>
            <p className="text-xs text-[#6B6B6B] max-w-2xl">
              Gerencie serviços, produtos de revenda, assinatura de pacotes e salas ou equipamentos vinculados à agenda.
            </p>
          </div>

          {activeCatalogTab === "services" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportExcel}
                className="h-9 px-3.5 rounded-xl border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] text-xs font-semibold gap-1.5 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="h-9 px-3.5 rounded-xl border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] text-xs font-semibold gap-1.5 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-[#6B6B6B]" />
                Imprimir
              </Button>

              {isOwnerOrManager && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const defaultExpanded: Record<string, boolean> = {};
                      INITIAL_CATEGORIES.slice(0, 3).forEach((cat) => {
                        defaultExpanded[cat] = true;
                      });
                      setExpandedCategories(defaultExpanded);
                      setIsImportOpen(true);
                    }}
                    className="h-9 px-3.5 rounded-xl border-[#E5E2DC] bg-white text-[#8A6D36] hover:bg-[#FAF9F7] text-xs font-semibold gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Importar Prontos
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetMultipleImportState();
                      setIsMultipleImportOpen(true);
                    }}
                    className="h-9 px-3.5 rounded-xl border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] text-xs font-semibold gap-1.5 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#8A6D36]" />
                    Planilha / PDF
                  </Button>

                  <Dialog
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) resetForm();
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="h-9 px-4 bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold text-xs rounded-xl gap-1.5 whitespace-nowrap">
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Novo Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[460px] bg-white border border-[#E5E2DC] text-[#171717] rounded-2xl p-6 shadow-xl overflow-y-auto max-h-[90vh]">
                      <DialogHeader className="space-y-1">
                        <DialogTitle className="font-heading text-lg font-bold text-[#171717]">
                          {editingService ? "Editar Item do Catálogo" : "Cadastrar Novo Item"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[#6B6B6B]">
                          Defina preço de venda, custo operacional, duração e disponibilidade no agendamento online.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleSubmit} className="space-y-4 pt-3 text-xs">
                        <div className="space-y-1.5">
                          <Label className="text-[#171717] font-medium">Tipo de Cadastro</Label>
                          <div className="grid grid-cols-2 gap-2 bg-[#FAF9F7] p-1 border border-[#E5E2DC] rounded-xl">
                            <button
                              type="button"
                              onClick={() => setFormData((p) => ({ ...p, type: "service" }))}
                              className={cn(
                                "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all",
                                formData.type === "service"
                                  ? "bg-[#171717] text-white"
                                  : "text-[#6B6B6B] hover:text-[#171717]"
                              )}
                            >
                              <Scissors className="w-3.5 h-3.5" /> Serviço
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData((p) => ({ ...p, type: "product" }))}
                              className={cn(
                                "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all",
                                formData.type === "product"
                                  ? "bg-[#171717] text-white"
                                  : "text-[#6B6B6B] hover:text-[#171717]"
                              )}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" /> Produto
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="name" className="text-[#171717] font-medium">
                            Nome do {formData.type === "product" ? "Produto" : "Serviço"} *
                          </Label>
                          <Input
                            id="name"
                            required
                            placeholder={
                              formData.type === "product"
                                ? "Ex: Condicionador L'Oréal 250ml"
                                : "Ex: Escova Modelada"
                            }
                            value={formData.name}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, name: e.target.value }))
                            }
                            className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
                          />
                        </div>

                        {isCustomCategory ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <Label htmlFor="customCategory" className="text-[#171717] font-medium">
                                Nova Categoria *
                              </Label>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomCategory(false);
                                  setCustomCategoryName("");
                                }}
                                className="text-[11px] text-[#8A6D36] hover:underline font-medium"
                              >
                                Usar existente
                              </button>
                            </div>
                            <Input
                              id="customCategory"
                              required
                              placeholder="Ex: Tratamentos VIP"
                              value={customCategoryName}
                              onChange={(e) => setCustomCategoryName(e.target.value)}
                              className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <Label className="text-[#171717] font-medium">Categoria *</Label>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomCategory(true);
                                  setFormData((p) => ({ ...p, category: "" }));
                                }}
                                className="text-[11px] text-[#8A6D36] hover:underline font-medium"
                              >
                                + Criar Nova Categoria
                              </button>
                            </div>
                            <Select
                              required
                              value={formData.category}
                              onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                            >
                              <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9">
                                <SelectValue placeholder="Selecione uma categoria..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                                {allAvailableCategories.map((catStr) => (
                                  <SelectItem key={catStr} value={catStr}>
                                    {catStr}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-[#171717] font-medium">Tipo de Cobrança</Label>
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
                            <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                              <SelectItem value="fixed">Preço Fixo (Ex: R$ 200)</SelectItem>
                              <SelectItem value="from">A partir de (Ex: R$ 200...)</SelectItem>
                              <SelectItem value="variable">Sob avaliação / Variável</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="price" className="text-[#171717] font-medium">
                              Valor Venda (R$)
                            </Label>
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
                              className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="costPrice" className="text-[#171717] font-medium">
                              Custo (R$)
                            </Label>
                            <Input
                              id="costPrice"
                              type="text"
                              placeholder="0,00"
                              value={formData.costPrice}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, costPrice: e.target.value }))
                              }
                              className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="duration" className="text-[#171717] font-medium">
                              Duração (min)
                            </Label>
                            <Input
                              id="duration"
                              required={formData.type !== "product"}
                              disabled={formData.type === "product"}
                              type="number"
                              min="0"
                              value={formData.type === "product" ? "" : formData.durationMinutes}
                              onChange={(e) =>
                                setFormData((p) => ({
                                  ...p,
                                  durationMinutes: e.target.value,
                                }))
                              }
                              className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="description" className="text-[#171717] font-medium">
                            Descrição (Opcional)
                          </Label>
                          <textarea
                            id="description"
                            placeholder="Resumo técnico ou detalhes do item..."
                            value={formData.description}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, description: e.target.value }))
                            }
                            className="w-full bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl text-xs p-3 resize-none focus:outline-none focus:border-[#B89B5E]"
                            rows={2}
                          />
                        </div>

                        <label className="flex items-center gap-2 text-xs text-[#171717] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.onlineBookingEnabled}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                onlineBookingEnabled: e.target.checked,
                              }))
                            }
                            className="rounded border-[#D1CCC2]"
                          />
                          Exibir no agendamento / catálogo online
                        </label>

                        <Button
                          type="submit"
                          className="w-full bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs h-10"
                        >
                          {editingService
                            ? "Salvar Alterações"
                            : `Cadastrar ${formData.type === "product" ? "Produto" : "Serviço"}`}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          )}
        </div>

        {/* 3-Tab Catalog Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E5E2DC] pt-3">
          <button
            type="button"
            onClick={() => setActiveCatalogTab("services")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer",
              activeCatalogTab === "services"
                ? "bg-[#171717] text-white"
                : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
            )}
          >
            <Scissors className="w-3.5 h-3.5" />
            Serviços & Produtos ({services.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCatalogTab("packages")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer",
              activeCatalogTab === "packages"
                ? "bg-[#171717] text-white"
                : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
            )}
          >
            <Package className="w-3.5 h-3.5" />
            Pacotes ({packages.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCatalogTab("resources")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer",
              activeCatalogTab === "resources"
                ? "bg-[#171717] text-white"
                : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
            )}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            Salas e Equipamentos ({resources.length})
          </button>
        </div>
      </div>

      {/* TAB 2: PACOTES */}
      {activeCatalogTab === "packages" && (
        <PackagesTab
          salonId={salonData.id}
          packages={packages}
          services={services}
          canEdit={isOwnerOrManager}
        />
      )}

      {/* TAB 3: SALAS E EQUIPAMENTOS */}
      {activeCatalogTab === "resources" && (
        <ResourcesTab
          salonId={salonData.id}
          resources={resources}
          canEdit={isOwnerOrManager}
        />
      )}

      {/* TAB 1: SERVIÇOS & PRODUTOS */}
      {activeCatalogTab === "services" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Pesquisar serviço ou produto..."
                containerClassName="flex-1"
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] rounded-xl text-xs"
                showClearText={true}
              />

              <Select
                value={selectedCategoryFilter}
                onValueChange={(v) => setSelectedCategoryFilter(v)}
              >
                <SelectTrigger className="h-9 w-full md:w-56 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl">
                  <SelectValue placeholder="Todas as Categorias" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E5E2DC] text-[#171717] max-h-[300px]">
                  <SelectItem value="Todos">Todas as Categorias</SelectItem>
                  {allAvailableCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[#E5E2DC] pt-3">
              <div className="flex items-center gap-1 bg-[#FAF9F7] border border-[#E5E2DC] p-1 rounded-xl">
                {(
                  [
                    { key: "all", label: `Todos (${services.length})` },
                    {
                      key: "service",
                      label: `Serviços (${services.filter((s) => !s.type || s.type === "service").length})`,
                    },
                    {
                      key: "product",
                      label: `Produtos (${services.filter((s) => s.type === "product").length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedTypeFilter(tab.key)}
                    className={cn(
                      "py-1.5 px-3 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap",
                      selectedTypeFilter === tab.key
                        ? "bg-[#171717] text-white"
                        : "text-[#6B6B6B] hover:text-[#171717]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B6B6B] tabular-nums">
                {isOwnerOrManager && filteredServices.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="text-xs font-semibold text-[#8A6D36] hover:underline cursor-pointer"
                  >
                    {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}
                <span>
                  {filteredServices.length} de {services.length} itens
                </span>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {isOwnerOrManager && selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F7] border border-[#B89B5E]/40 rounded-xl p-3">
                <span className="text-xs font-semibold text-[#171717] tabular-nums">
                  {selectedIds.size} {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkProcessing}
                    onClick={() => runBulkAction("online_on")}
                    className="h-8 text-[11px] bg-white border-[#E5E2DC] rounded-lg whitespace-nowrap"
                  >
                    <Globe className="w-3 h-3 mr-1 text-emerald-700" /> Ativar Online
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkProcessing}
                    onClick={() => runBulkAction("online_off")}
                    className="h-8 text-[11px] bg-white border-[#E5E2DC] rounded-lg whitespace-nowrap"
                  >
                    Ocultar Online
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkProcessing}
                    onClick={() => runBulkAction("activate")}
                    className="h-8 text-[11px] bg-white border-[#E5E2DC] rounded-lg whitespace-nowrap"
                  >
                    Ativar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkProcessing}
                    onClick={() => runBulkAction("deactivate")}
                    className="h-8 text-[11px] bg-white border-[#E5E2DC] rounded-lg whitespace-nowrap"
                  >
                    Inativar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={bulkProcessing}
                    onClick={() => runBulkAction("delete")}
                    className="h-8 text-[11px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg whitespace-nowrap"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Grid / Empty */}
          {filteredServices.length === 0 ? (
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-10 text-center max-w-lg mx-auto space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center mx-auto text-[#8A6D36]">
                <Scissors className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#171717]">Nenhum item encontrado</h3>
                <p className="text-xs text-[#6B6B6B]">
                  Cadastre seus serviços e produtos ou importe o catálogo pronto Lumière.
                </p>
              </div>
              {isOwnerOrManager && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    size="sm"
                    variant="outline"
                    className="border-[#E5E2DC] text-xs rounded-xl"
                  >
                    Novo Manual
                  </Button>
                  <Button
                    onClick={() => setIsImportOpen(true)}
                    size="sm"
                    className="bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs"
                  >
                    Importar Lumière
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const onlineEnabled = item.onlineBookingEnabled !== false;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-xs",
                      isSelected ? "border-[#B89B5E] ring-1 ring-[#B89B5E]/30" : "border-[#E5E2DC]",
                      !item.isActive && "opacity-55"
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isOwnerOrManager && (
                            <button
                              type="button"
                              onClick={() => toggleSelectService(item.id)}
                              className={cn(
                                "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                isSelected
                                  ? "bg-[#171717] border-[#171717] text-white"
                                  : "border-[#D1CCC2] bg-white"
                              )}
                              aria-label={`Selecionar ${item.name}`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </button>
                          )}
                          <div className="min-w-0">
                            <span className="text-[11px] font-medium text-[#8A6D36] block truncate">
                              {item.category} · {item.type === "product" ? "Produto" : "Serviço"}
                            </span>
                            <h4 className="font-heading text-sm font-bold text-[#171717] truncate leading-snug mt-0.5">
                              {item.name}
                            </h4>
                          </div>
                        </div>

                        {isOwnerOrManager && (
                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(item)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-[#171717]"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatus(item)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-[#8A6D36]"
                              title={item.isActive ? "Inativar" : "Ativar"}
                            >
                              {item.isActive ? (
                                <PowerOff className="w-3.5 h-3.5 text-rose-600" />
                              ) : (
                                <Power className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-rose-600"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-[#6B6B6B] leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between border-t border-[#E5E2DC] pt-3.5 mt-4 gap-2">
                      <div>
                        <span className="text-[10px] text-[#6B6B6B] uppercase tracking-wider font-semibold block">
                          Valor
                        </span>
                        <span className="text-base font-bold text-[#171717] tabular-nums block mt-0.5">
                          {formatPriceDescription(item.price, item.priceType)}
                        </span>
                        {item.costPrice !== undefined && item.costPrice > 0 && (
                          <span className="text-[10px] text-[#6B6B6B] tabular-nums">
                            Custo: {formatBRL(item.costPrice)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          disabled={!isOwnerOrManager}
                          onClick={() => toggleOnlineBooking(item)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer disabled:cursor-default",
                            onlineEnabled
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]"
                          )}
                          title="Alternar visibilidade no agendamento online"
                        >
                          <Globe className="w-3 h-3" />
                          {onlineEnabled ? "Online" : "Interno"}
                        </button>

                        {item.type !== "product" && (
                          <span className="text-xs text-[#6B6B6B] font-medium flex items-center gap-1 tabular-nums">
                            <Clock className="w-3 h-3 text-[#8A6D36]" /> {item.durationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation of deletion Modal */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px] bg-white border border-[#E5E2DC] text-[#171717] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-rose-700 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Excluir Item?
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#6B6B6B] py-2">
            Tem certeza que deseja excluir permanentemente este item do catálogo?
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              className="rounded-xl border-[#E5E2DC] text-xs h-9 px-4"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs h-9 px-4"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Catalog Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl bg-white border border-[#E5E2DC] text-[#171717] rounded-2xl shadow-xl p-6 overflow-hidden flex flex-col h-[85vh] max-h-[700px]">
          <DialogHeader className="space-y-1 pb-3 border-b border-[#E5E2DC]">
            <DialogTitle className="text-lg font-heading font-bold text-[#171717] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8A6D36]" /> Biblioteca de Serviços Lumière
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Selecione os serviços prontos que deseja importar. Itens já existentes serão ignorados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 flex gap-2">
            <SearchBar
              value={importSearch}
              onChange={setImportSearch}
              placeholder="Filtrar por nome ou categoria..."
              containerClassName="flex-1"
              className="h-9 bg-[#FAF9F7] border-[#E5E2DC] rounded-xl text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleSelectAll(!isAllSelected)}
              className="h-9 border-[#E5E2DC] text-xs rounded-xl whitespace-nowrap"
            >
              {isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 my-1">
            {Object.keys(templatesByCategory).length === 0 ? (
              <div className="p-8 text-center text-[#6B6B6B] text-xs">
                Nenhum serviço encontrado.
              </div>
            ) : (
              Object.keys(templatesByCategory).map((catName) => {
                const templates = templatesByCategory[catName];
                const categoryKeys = templates.map((t) => `${t.category}::${t.name}`);
                const isCatAllSelected = categoryKeys.every((k) => selectedImportKeys[k]);
                const countSelectedInCat = categoryKeys.filter((k) => selectedImportKeys[k]).length;
                const isExpanded = expandedCategories[catName];

                return (
                  <div
                    key={catName}
                    className="border border-[#E5E2DC] bg-[#FAF9F7]/50 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-3 flex justify-between items-center border-b border-[#E5E2DC]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isCatAllSelected}
                          onChange={(e) => handleToggleCategoryAll(catName, e.target.checked)}
                          className="rounded border-[#D1CCC2] w-4 h-4 cursor-pointer"
                        />
                        <span
                          onClick={() =>
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [catName]: !prev[catName],
                            }))
                          }
                          className="text-xs font-semibold text-[#171717] cursor-pointer"
                        >
                          {catName}{" "}
                          <span className="text-[11px] text-[#6B6B6B] font-normal tabular-nums">
                            ({templates.length} itens
                            {countSelectedInCat > 0 ? ` · ${countSelectedInCat} sel.` : ""})
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCategories((prev) => ({
                            ...prev,
                            [catName]: !prev[catName],
                          }))
                        }
                        className="text-xs text-[#8A6D36] font-semibold hover:underline"
                      >
                        {isExpanded ? "Ocultar" : "Expandir"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-[#E5E2DC] bg-white px-4 py-1">
                        {templates.map((t) => {
                          const key = `${t.category}::${t.name}`;
                          const isSSelected = !!selectedImportKeys[key];
                          const alreadyUploaded = services.some(
                            (s) =>
                              s.name.toLowerCase() === t.name.toLowerCase() &&
                              s.category.toLowerCase() === t.category.toLowerCase()
                          );

                          return (
                            <div
                              key={t.name}
                              className={cn(
                                "py-2.5 flex justify-between items-center text-xs gap-4",
                                alreadyUploaded && "opacity-45"
                              )}
                            >
                              <div className="flex items-center gap-2.5 max-w-[70%]">
                                <input
                                  type="checkbox"
                                  disabled={alreadyUploaded}
                                  checked={alreadyUploaded || isSSelected}
                                  onChange={(e) =>
                                    handleToggleService(t.category, t.name, e.target.checked)
                                  }
                                  className="rounded border-[#D1CCC2] w-3.5 h-3.5 cursor-pointer"
                                />
                                <div>
                                  <p className="font-medium text-[#171717]">{t.name}</p>
                                  {t.description && (
                                    <p className="text-[11px] text-[#6B6B6B] line-clamp-1">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex items-center gap-2 shrink-0 tabular-nums">
                                <span className="font-semibold text-[#171717]">
                                  {formatPriceDescription(t.price, t.priceType)}
                                </span>
                                <span className="text-[11px] text-[#6B6B6B]">
                                  {alreadyUploaded ? "Salvo" : `${t.durationMinutes}m`}
                                </span>
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

          <div className="flex justify-between items-center border-t border-[#E5E2DC] pt-4 shrink-0">
            <div className="text-xs text-[#6B6B6B] tabular-nums">
              Selecionados: <strong className="text-[#171717]">{countSelected}</strong>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => setIsImportOpen(false)}
                className="rounded-xl border-[#E5E2DC] text-xs h-9 px-4"
              >
                Voltar
              </Button>
              <Button
                disabled={importing || countSelected === 0}
                onClick={executeImport}
                className="bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs h-9 px-5"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Sincronizando...
                  </>
                ) : (
                  `Importar (${countSelected})`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Source Import Dialog (CSV / PDF) */}
      <Dialog open={isMultipleImportOpen} onOpenChange={setIsMultipleImportOpen}>
        <DialogContent className="max-w-3xl bg-white border border-[#E5E2DC] text-[#171717] rounded-2xl shadow-xl p-6 overflow-hidden flex flex-col h-[85vh] max-h-[720px]">
          <DialogHeader className="space-y-1 pb-3 border-b border-[#E5E2DC]">
            <DialogTitle className="text-lg font-heading font-bold text-[#171717] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#8A6D36]" /> Importação de Catálogo (CSV ou PDF)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Envie planilhas CSV com mapeamento de colunas ou catálogos de preços em PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-4">
            {!multiImportFile ? (
              <div
                onDragOver={handleMultiDrag}
                onDragLeave={handleMultiDrag}
                onDrop={handleMultiDrop}
                onClick={() => {
                  const input = document.getElementById("multi-file-picker");
                  if (input) input.click();
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition",
                  dragActive
                    ? "border-[#B89B5E] bg-[#FAF9F7]"
                    : "border-[#E5E2DC] hover:border-[#B89B5E] bg-[#FAF9F7]/50"
                )}
              >
                <input
                  id="multi-file-picker"
                  type="file"
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={handleMultiFileChange}
                />
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E2DC] flex items-center justify-center mx-auto text-[#8A6D36]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-[#171717]">
                    Arraste ou clique para selecionar arquivo (.CSV ou .PDF)
                  </p>
                  <p className="text-xs text-[#6B6B6B]">
                    Suporta planilhas de outros sistemas e menus em PDF.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {importMode === "csv" ? (
                      <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
                    ) : (
                      <FileText className="w-6 h-6 text-rose-600" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-[#171717]">
                        {multiImportFile.name}
                      </p>
                      <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                        {(multiImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetMultipleImportState}
                    className="h-8 border-[#E5E2DC] text-xs rounded-lg"
                  >
                    Trocar Arquivo
                  </Button>
                </div>

                {isImportingProgress && pdfParsedItems.length === 0 && (
                  <div className="border border-[#E5E2DC] bg-[#FAF9F7] rounded-2xl p-8 text-center space-y-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[#8A6D36] mx-auto" />
                    <p className="text-xs font-semibold text-[#171717]">
                      Estruturando catálogo do PDF...
                    </p>
                  </div>
                )}

                {importMode === "csv" && !isImportingProgress && importHeaders.length > 0 && (
                  <div className="border border-[#E5E2DC] bg-[#FAF9F7] p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-[#171717] flex items-center gap-1.5">
                      <Settings2 className="w-4 h-4 text-[#8A6D36]" /> Mapeamento de Colunas ({importRows.length} linhas)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {(
                        [
                          { key: "name", label: "Nome do Item *" },
                          { key: "category", label: "Categoria" },
                          { key: "price", label: "Preço / Valor" },
                          { key: "durationMinutes", label: "Duração (min)" },
                          { key: "description", label: "Descrição" },
                          { key: "type", label: "Tipo (Serviço/Produto)" },
                        ] as const
                      ).map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-[11px] font-semibold text-[#6B6B6B]">
                            {field.label}
                          </Label>
                          <select
                            value={columnMappings[field.key]}
                            onChange={(e) =>
                              setColumnMappings((p) => ({
                                ...p,
                                [field.key]: parseInt(e.target.value, 10),
                              }))
                            }
                            className="w-full bg-white border border-[#E5E2DC] text-[#171717] rounded-xl text-xs p-2 h-9 outline-none"
                          >
                            <option value={-1}>Padrão / Ignorar</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>
                                Coluna: {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importMode === "pdf" && !isImportingProgress && pdfParsedItems.length > 0 && (
                  <div className="border border-[#E5E2DC] bg-[#FAF9F7] p-4 rounded-2xl space-y-2.5">
                    <p className="text-xs font-bold text-[#171717]">
                      {pdfParsedItems.length} itens extraídos do PDF
                    </p>
                    <div className="overflow-y-auto max-h-[260px] border border-[#E5E2DC] rounded-xl divide-y divide-[#E5E2DC] bg-white">
                      {pdfParsedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 flex justify-between items-center gap-4 text-xs"
                        >
                          <div>
                            <span className="text-[10px] font-semibold text-[#8A6D36]">
                              {item.category || "Geral"} ·{" "}
                              {item.type === "product" ? "Produto" : "Serviço"}
                            </span>
                            <h5 className="font-semibold text-[#171717]">{item.name}</h5>
                          </div>
                          <span className="font-bold text-[#171717] tabular-nums">
                            {formatBRL(Number(item.price || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isImportingProgress && (importProgressPercent > 0 || totalImportedCount > 0) && (
                  <div className="border border-[#E5E2DC] bg-[#FAF9F7] rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs text-[#6B6B6B] tabular-nums">
                      <span>Progresso: {importProgressPercent}%</span>
                      <span>Salvos: {totalImportedCount} itens</span>
                    </div>
                    <div className="w-full h-2 bg-[#E5E2DC] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#171717] transition-all duration-300"
                        style={{ width: `${importProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center border-t border-[#E5E2DC] pt-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsMultipleImportOpen(false)}
              disabled={isImportingProgress}
              className="rounded-xl border-[#E5E2DC] text-xs h-9 px-4"
            >
              Cancelar
            </Button>

            <div className="flex gap-2">
              {importMode === "csv" && importRows.length > 0 && !isImportingProgress && (
                <Button
                  onClick={processCsvImport}
                  className="bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs h-9 px-5"
                >
                  Confirmar Importação ({importRows.length} linhas)
                </Button>
              )}
              {importMode === "pdf" && pdfParsedItems.length > 0 && !isImportingProgress && (
                <Button
                  onClick={processPdfImport}
                  className="bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs h-9 px-5"
                >
                  Confirmar Itens ({pdfParsedItems.length})
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
