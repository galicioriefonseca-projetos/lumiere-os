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
import { SearchBar } from "@/components/ui/search-bar";
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
  FileSpreadsheet,
  FileText,
  Upload,
  ArrowRight,
  Settings2,
  ShoppingBag,
  Filter,
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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "service" | "product">("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    priceType: "fixed" as "fixed" | "from" | "variable",
    durationMinutes: "60",
    description: "",
    type: "service" as "service" | "product",
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

  // New Multi-source ( planilha / PDF ) Import States
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

  const [pdfParsedItems, setPdfParsedItems] = useState<any[]>([]);
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
      // Products do not have logical durations. If type is product, default to 0.
      const durationVal = formData.type === "product" ? 0 : parseInt(formData.durationMinutes, 10);
      
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
          type: formData.type,
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
          priceType: formData.priceType,
          durationMinutes: durationVal,
          description: formData.description.trim(),
          type: formData.type,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success(`${formData.type === "product" ? "Produto" : "Serviço"} cadastrado com sucesso!`);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar item.");
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
      type: "service",
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
      toast.success(`${item.type === "product" ? "Produto" : "Serviço"} ${!item.isActive ? "ativado" : "inativado"} com sucesso.`);
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
      toast.success("Item excluído com sucesso.");
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir item.");
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
      type: item.type || "service",
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

  // Filter service items based on query, selected category, and type
  const filteredServices = React.useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory =
        selectedCategoryFilter === "Todos" || s.category === selectedCategoryFilter;

      const itemType = s.type || "service";
      const matchesType =
        selectedTypeFilter === "all" || itemType === selectedTypeFilter;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [services, searchQuery, selectedCategoryFilter, selectedTypeFilter]);

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

  // Multiple Source (CSV / PDF) Importer Logic
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
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleMultiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleMultiFileLoad(e.dataTransfer.files[0]);
    }
  };

  const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleMultiFileLoad(e.target.files[0]);
    }
  };

  const handleMultiFileLoad = async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    setImportMode(isPdf ? "pdf" : "csv");
    setMultiImportFile(file);

    if (isPdf) {
      // PDF Processing Flow via Gemini on Backend
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
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pdfBase64: result,
              salonName: salonData?.name || "Lumiere Salon",
            }),
          });
          let data;
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            data = await res.json();
          } else {
            const rawText = await res.text();
            throw new Error(rawText || "Resposta inválida do servidor.");
          }

          if (!res.ok) {
            throw new Error(data?.error || "Erro desconhecido no processamento do catálogo em PDF.");
          }
          if (data.items && Array.isArray(data.items)) {
            setPdfParsedItems(data.items);
            const selectedMap: Record<number, boolean> = {};
            data.items.forEach((_, idx) => {
              selectedMap[idx] = true;
            });
            setSelectedPdfKeys(selectedMap);
            toast.success(`Identificados ${data.items.length} itens do catálogo em PDF usando IA.`);
          } else {
            toast.error("Formatos inválidos de catálogo. Tente outro arquivo.");
          }
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Falha ao processar o PDF. Verifique se o arquivo do catálogo está íntegro.");
          resetMultipleImportState();
        } finally {
          setIsImportingProgress(false);
        }
      };
      reader.onerror = () => {
        setIsImportingProgress(false);
        toast.error("Erro ao abrir arquivo PDF.");
      };
      reader.readAsDataURL(file);
    } else {
      // CSV Parsing Flow
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
          } else if ((char === ',' || char === ';') && !inQuotes) {
            row.push(currentValue.trim());
            currentValue = "";
          } else if (char === '\n' && !inQuotes) {
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

        const validLines = parsedLines.filter(r => r.some(cell => cell.length > 0));
        if (validLines.length === 0) {
          toast.error("Arquivo CSV vazio ou corrompido.");
          return;
        }

        const headers = validLines[0];
        const dataRows = validLines.slice(1);

        setImportHeaders(headers);
        setImportRows(dataRows);

        // Auto detect mapping columns
        const mapping = {
          name: -1,
          category: -1,
          price: -1,
          priceType: -1,
          durationMinutes: -1,
          description: -1,
          type: -1,
        };
        const cleanString = (str: string) => {
          return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };
        headers.forEach((hdr, idx) => {
          const cleaned = cleanString(hdr);
          if (cleaned.includes("nome") || cleaned.includes("name") || cleaned.includes("servi") || cleaned.includes("produ") || cleaned.includes("item") || cleaned.includes("título") || cleaned.includes("titulo")) {
            if (mapping.name === -1) mapping.name = idx;
          } else if (cleaned.includes("categor") || cleaned.includes("grupo") || cleaned.includes("seç") || cleaned.includes("sec") || cleaned.includes("família") || cleaned.includes("familia")) {
            if (mapping.category === -1) mapping.category = idx;
          } else if (cleaned.includes("preço") || cleaned.includes("preco") || cleaned.includes("valor") || cleaned.includes("price") || cleaned.includes("custo")) {
            if (mapping.price === -1) mapping.price = idx;
          } else if (cleaned.includes("tipo pre") || cleaned.includes("price type") || cleaned.includes("tipo de preco") || cleaned.includes("preço_tipo")) {
            if (mapping.priceType === -1) mapping.priceType = idx;
          } else if (cleaned.includes("dura") || cleaned.includes("tempo") || cleaned.includes("minutos") || cleaned.includes("duration") || cleaned.includes("time") || cleaned.includes("mins")) {
            if (mapping.durationMinutes === -1) mapping.durationMinutes = idx;
          } else if (cleaned.includes("descri") || cleaned.includes("detalhe") || cleaned.includes("observa") || cleaned.includes("notes") || cleaned.includes("info") || cleaned.includes("sobre")) {
            if (mapping.description === -1) mapping.description = idx;
          } else if (cleaned.includes("tipo") || cleaned.includes("type") || cleaned.includes("classificac") || cleaned.includes("funcao")) {
            if (mapping.type === -1) mapping.type = idx;
          }
        });
        setColumnMappings(mapping);
      };
      reader.readAsText(file, 'utf-8');
    }
  };

  const parseFloatSafe = (val: string): number => {
    if (!val) return 0;
    const sanitized = val
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isProductKeyword = (name: string, category: string): boolean => {
    const cleanedName = name.toLowerCase();
    const cleanedCategory = category.toLowerCase();
    const prodWords = [
      "produto", "venda", "home care", "shampoo", "creme", "hidratante", 
      "oleo", "gel", "mascara", "spray", "pote", "condicionador", 
      "esmalt", "pomada", "cera", "finalizador", "cosmetico", "batom",
      "sabonete", "perfume", "ampola", "locao", "loção"
    ];
    return prodWords.some(w => cleanedName.includes(w) || cleanedCategory.includes(w));
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
      // Load current services names map to prevent duplicates
      const existingMapName = new Set<string>();
      services.forEach((s) => {
        existingMapName.add(`${s.name.toLowerCase()}::${(s.type || "service").toLowerCase()}`);
      });

      for (let i = 0; i < total; i++) {
        const row = importRows[i];
        const nameVal = row[columnMappings.name]?.trim();
        if (!nameVal) continue;

        const categoryVal = columnMappings.category !== -1 ? row[columnMappings.category]?.trim() || "Importados" : "Importados";
        const priceVal = columnMappings.price !== -1 ? parseFloatSafe(row[columnMappings.price]) : 0;
        
        let priceTypeVal: "fixed" | "from" | "variable" = "fixed";
        if (columnMappings.priceType !== -1) {
          const rawPriceType = row[columnMappings.priceType]?.toLowerCase() || "";
          if (rawPriceType.includes("var") || rawPriceType.includes("sob") || rawPriceType.includes("aval")) {
            priceTypeVal = "variable";
          } else if (rawPriceType.includes("a partir") || rawPriceType.includes("from") || rawPriceType.includes("partir")) {
            priceTypeVal = "from";
          }
        }

        const rawDur = columnMappings.durationMinutes !== -1 ? parseInt(row[columnMappings.durationMinutes], 10) : 60;
        const durationMinutesVal = isNaN(rawDur) ? 60 : rawDur;
        
        const descriptionVal = columnMappings.description !== -1 ? row[columnMappings.description]?.trim() || "" : "";
        
        let typeVal: "service" | "product" = "service";
        if (columnMappings.type !== -1) {
          const rawType = row[columnMappings.type]?.toLowerCase() || "";
          if (rawType.includes("prod") || rawType.includes("venda") || rawType.includes("peça") || rawType.includes("peca")) {
            typeVal = "product";
          }
        } else if (isProductKeyword(nameVal, categoryVal)) {
          typeVal = "product";
        }

        // Skip exact duplicate name + type matches
        if (existingMapName.has(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`)) {
          continue;
        }

        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: nameVal,
          category: categoryVal,
          price: priceVal,
          priceType: priceTypeVal,
          durationMinutes: typeVal === "product" ? 0 : durationMinutesVal,
          description: descriptionVal,
          type: typeVal,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        count++;
        setTotalImportedCount(count);
        setImportProgressPercent(Math.round(((i + 1) / total) * 100));
      }

      toast.success(`${count} itens de catálogo importados e indexados com sucesso!`);
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

    let count = 0;
    const total = selectedItems.length;

    try {
      const existingMapName = new Set<string>();
      services.forEach((s) => {
        existingMapName.add(`${s.name.toLowerCase()}::${(s.type || "service").toLowerCase()}`);
      });

      for (let i = 0; i < total; i++) {
        const item = selectedItems[i];
        const nameVal = item.name?.trim();
        if (!nameVal) continue;

        const categoryVal = item.category?.trim() || "Importados AI";
        const priceVal = typeof item.price === "number" ? item.price : parseFloatSafe(String(item.price || "0"));
        
        let priceTypeVal: "fixed" | "from" | "variable" = "fixed";
        const rawPt = String(item.priceType || "").toLowerCase();
        if (rawPt.includes("var") || rawPt.includes("sob")) {
          priceTypeVal = "variable";
        } else if (rawPt.includes("from") || rawPt.includes("partir")) {
          priceTypeVal = "from";
        }

        const durationMinutesVal = typeof item.durationMinutes === "number" ? item.durationMinutes : parseInt(String(item.durationMinutes || "60"), 10) || 60;
        const descriptionVal = item.description?.trim() || "";
        
        let typeVal: "service" | "product" = "service";
        const rawType = String(item.type || "").toLowerCase();
        if (rawType.includes("prod") || rawType.includes("venda")) {
          typeVal = "product";
        } else if (isProductKeyword(nameVal, categoryVal)) {
          typeVal = "product";
        }

        if (existingMapName.has(`${nameVal.toLowerCase()}::${typeVal.toLowerCase()}`)) {
          continue;
        }

        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: nameVal,
          category: categoryVal,
          price: priceVal,
          priceType: priceTypeVal,
          durationMinutes: typeVal === "product" ? 0 : durationMinutesVal,
          description: descriptionVal,
          type: typeVal,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        count++;
        setTotalImportedCount(count);
        setImportProgressPercent(Math.round(((i + 1) / total) * 100));
      }

      toast.success(`${count} itens do PDF adicionados ao seu catálogo com sucesso!`);
      setIsMultipleImportOpen(false);
      resetMultipleImportState();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar itens importados do PDF.");
    } finally {
      setIsImportingProgress(false);
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

            <Button
              onClick={() => {
                resetMultipleImportState();
                setIsMultipleImportOpen(true);
              }}
              variant="outline"
              className="flex-1 md:flex-none h-10 border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 text-white font-medium text-xs rounded-xl px-5 select-none"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-[#D4AF37]" />
              Importar Planilha / PDF
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
                    {editingService ? "Editar Item" : "Cadastrar Novo Item"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-light">
                    {editingService ? "Altere as informações do item do seu catálogo." : "Preencha os campos para cadastrar um item manual."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  {/* Item Type selection toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">Tipo de Cadastro</Label>
                    <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 border border-white/5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, type: 'service' }))}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold select-none transition-all",
                          formData.type === 'service'
                            ? "bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37]"
                            : "text-zinc-400 hover:text-white border border-transparent"
                        )}
                      >
                        <Scissors className="w-3.5 h-3.5" /> Serviço
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, type: 'product' }))}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold select-none transition-all",
                          formData.type === 'product'
                            ? "bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37]"
                            : "text-zinc-400 hover:text-white border border-transparent"
                        )}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Produto
                      </button>
                    </div>
                  </div>

                  {/* Service / Product Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-slate-300 font-medium">Nome do {formData.type === "product" ? "Produto" : "Serviço"} *</Label>
                    <Input
                      id="name"
                      required
                      placeholder={formData.type === "product" ? "Ex: Condicionador L'Oréal Professional" : "Ex: Escova Orgânica Alisadora"}
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
                        placeholder="Ex: Cosméticos de Luxo"
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs text-slate-300 font-medium">Categoria do {formData.type === "product" ? "Produto" : "Serviço"} *</Label>
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
                        required={formData.type !== "product"}
                        disabled={formData.type === "product"}
                        type="number"
                        min="0"
                        placeholder={formData.type === "product" ? "N/A" : "60"}
                        value={formData.type === "product" ? "" : formData.durationMinutes}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            durationMinutes: e.target.value,
                          }))
                        }
                        className="bg-black/40 border-white/10 focus:border-[#D4AF37]/40 rounded-xl text-sm disabled:opacity-30"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs text-slate-300 font-medium">Descrição Opcional</Label>
                    <textarea
                      id="description"
                      placeholder={formData.type === "product" ? "Ex: Volume de 250ml, livre de parabenos." : "Ex: Breve resumo do serviço, técnica ou produtos utilizados."}
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
                    {editingService ? "Salvar Alterações" : `Cadastrar ${formData.type === "product" ? "Produto" : "Serviço"}`}
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
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar serviço por nome ou detalhes..."
            containerClassName="flex-1"
            className="h-10 bg-[#0c0c0f] border-white/5 rounded-xl text-sm focus:border-[#D4AF37]/30"
            showClearText={true}
          />

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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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

        {/* Type selector tab filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/5 pt-3">
          <div className="bg-black/60 border border-white/5 p-1 rounded-xl flex items-center shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setSelectedTypeFilter("all")}
              className={cn(
                "flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition select-none",
                selectedTypeFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Todos os Itens ({services.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter("service")}
              className={cn(
                "flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition select-none",
                selectedTypeFilter === "service" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Scissors className="w-3.5 h-3.5" /> Serviços ({services.filter(s => !s.type || s.type === "service").length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter("product")}
              className={cn(
                "flex-1 sm:flex-none py-1.5 px-3.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition select-none",
                selectedTypeFilter === "product" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Produtos ({services.filter(s => s.type === "product").length})
            </button>
          </div>
          <p className="text-[10px] font-mono text-zinc-500">
            Mostrando {filteredServices.length} de {services.length} itens cadastrados
          </p>
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
                  
                  {item.type === "product" ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-[#8e8e93] uppercase font-mono tracking-wider font-semibold">Tipo</span>
                      <span className="text-xs text-[#D4AF37] font-medium flex items-center gap-1 mt-1 leading-none">
                        <ShoppingBag className="w-3.5 h-3.5" /> Produto
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-[#8e8e93] uppercase font-mono tracking-wider font-semibold">Duração</span>
                      <span className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-1 leading-none">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" /> {item.durationMinutes} min
                      </span>
                    </div>
                  )}
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
            <SearchBar
              value={importSearch}
              onChange={setImportSearch}
              placeholder="Filtrar por nome ou categoria na biblioteca..."
              containerClassName="flex-1"
              className="h-9 bg-black/40 border-white/5 rounded-xl text-xs focus:border-[#D4AF37]/30"
            />
            
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

      {/* Multi-Source Import Dialog (CSV Column Mapping and AI PDF Parsing) */}
      <Dialog open={isMultipleImportOpen} onOpenChange={setIsMultipleImportOpen}>
        <DialogContent className="max-w-3xl bg-[#08080a] border border-[#D4AF37]/20 text-white rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col h-[85vh] max-h-[720px]">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-white/5">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-heading font-semibold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" /> Upload de Próprio Catálogo (Planilha ou PDF)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-light">
                  Faça a migração de qualquer outro SaaS de beleza ou clínica para o Lumière. Aceitamos planilhas CSV com mapeamento inteligente de colunas ou PDFs de catálogos de serviços digitais.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Core container content */}
          <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
            
            {/* If no file is loaded, show elegant drag-and-drop file upload zone */}
            {!multiImportFile && (
              <div
                onDragOver={handleMultiDrag}
                onDragLeave={handleMultiDrag}
                onDrop={handleMultiDrop}
                onClick={() => {
                  const input = document.getElementById("multi-file-picker");
                  if (input) input.click();
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition relative group",
                  dragActive 
                    ? "border-[#D4AF37] bg-[#D4AF37]/5" 
                    : "border-white/10 hover:border-[#D4AF37]/30 bg-black/40"
                )}
              >
                <input
                  id="multi-file-picker"
                  type="file"
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={handleMultiFileChange}
                />
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-[#D4AF37] group-hover:scale-105 transition-transform duration-300">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                      Arraste ou clique para selecionar arquivo
                    </p>
                    <p className="text-slate-400 text-xs">
                      Suporta arquivos de planilhas <span className="text-[#D4AF37] font-semibold">.CSV</span> ou catálogos de preço no formato <span className="text-[#D4AF37] font-semibold">.PDF</span>
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-6 text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Planilha de CRM</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-red-500" /> Cardápio / Catálogo em PDF</span>
                  </div>
                </div>
              </div>
            )}

            {/* If file is uploaded, render processing state or specific review boards */}
            {multiImportFile && (
              <div className="space-y-4 animate-fade-in">
                {/* File badge header and clean cancel option */}
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {importMode === "csv" ? (
                      <FileSpreadsheet className="w-7 h-7 text-emerald-500 shrink-0" />
                    ) : (
                      <FileText className="w-7 h-7 text-red-500 shrink-0" />
                    )}
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white max-w-[280px] sm:max-w-md truncate">{multiImportFile.name}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{(multiImportFile.size / 1024).toFixed(1)} KB • {importMode === 'csv' ? "Planilha de dados" : "Leitor AI de catálogo"}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetMultipleImportState}
                    className="h-8 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl text-xs px-3"
                  >
                    Resetar / Remover
                  </Button>
                </div>

                {/* Loading indicator while Gemini is parsing the PDF */}
                {isImportingProgress && pdfParsedItems.length === 0 && (
                  <div className="border border-white/5 bg-black/40 rounded-2xl p-8 text-center space-y-4 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-white">Análise inteligente por Inteligência Artificial</h4>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Nossa IA integrada ao Gemini 1.5 Flash está lendo o conteúdo textual e as tabelas do seu PDF para estruturar e mapear automaticamente serviços, preços e produtos! Isso pode levar de 5 a 15 segundos...
                      </p>
                    </div>
                  </div>
                )}

                {/* CSV Specific Map and Preview Section */}
                {importMode === "csv" && !isImportingProgress && importHeaders.length > 0 && (
                  <div className="space-y-4">
                    {/* Column Mapping form cards block */}
                    <div className="border border-white/5 bg-black/40 p-4 rounded-2xl space-y-3">
                      <h4 className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
                        <Settings2 className="w-4 h-4" /> Mapeamento inteligente de colunas
                      </h4>
                      <p className="text-[11px] text-slate-300 font-light leading-relaxed">
                        Mapeie a qual informação corresponde cada cabeçalho da sua planilha. Nosso motor já realizou uma pré-detecção com base no vocabulário comum dos CRM.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                        {/* Name Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Nome do Item *</Label>
                          <select
                            value={columnMappings.name}
                            onChange={(e) => setColumnMappings(p => ({ ...p, name: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>Selecione a coluna...</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Category Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Categoria</Label>
                          <select
                            value={columnMappings.category}
                            onChange={(e) => setColumnMappings(p => ({ ...p, category: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>Usar valor padrão ("Importados")</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Price Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Preço / Valor</Label>
                          <select
                            value={columnMappings.price}
                            onChange={(e) => setColumnMappings(p => ({ ...p, price: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>Preço zero por padrão</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Duration Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Duração (m)</Label>
                          <select
                            value={columnMappings.durationMinutes}
                            onChange={(e) => setColumnMappings(p => ({ ...p, durationMinutes: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>60 minutos por padrão</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Description Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Descrição / Observação</Label>
                          <select
                            value={columnMappings.description}
                            onChange={(e) => setColumnMappings(p => ({ ...p, description: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>Deixar vazio</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Type Column selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-zinc-400 uppercase">Tipo (Serviço ou Produto)</Label>
                          <select
                            value={columnMappings.type}
                            onChange={(e) => setColumnMappings(p => ({ ...p, type: parseInt(e.target.value) }))}
                            className="w-full bg-black border border-white/10 focus:border-[#D4AF37]/40 text-white rounded-xl text-xs p-2 h-9 outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                          >
                            <option value={-1}>Auto detectar por palavra-chave do Nome</option>
                            {importHeaders.map((h, i) => (
                              <option key={i} value={i}>Coluna: {h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Pre-mapped data table rows preview */}
                    <div className="border border-white/5 bg-black/20 rounded-2xl p-4 space-y-2">
                      <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Prévia das primeiras linhas ({importRows.length} linhas localizadas)</h4>
                      <div className="overflow-x-auto max-h-[140px] border border-white/5 rounded-xl divide-y divide-white/[0.04] bg-black/40">
                        {importRows.slice(0, 4).map((r, idx) => (
                          <div key={idx} className="p-2 px-3 text-[10px] font-sans flex items-center gap-4 text-zinc-300">
                            <span className="font-mono text-zinc-500 w-3 shrink-0">#{idx + 1}</span>
                            <span className="truncate w-32 font-medium text-white">{r[columnMappings.name] || <span className="italic opacity-35">Vazio</span>}</span>
                            <span className="truncate w-24">{columnMappings.category !== -1 ? r[columnMappings.category] : "Importados"}</span>
                            <span className="font-mono text-[#D4AF37] w-16">{columnMappings.price !== -1 ? r[columnMappings.price] : "0.00"}</span>
                            <span className="truncate flex-1 font-light italic">{columnMappings.description !== -1 ? r[columnMappings.description] : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Specific AI Mapped Items Section */}
                {importMode === "pdf" && !isImportingProgress && pdfParsedItems.length > 0 && (
                  <div className="space-y-4">
                    <div className="border border-white/5 bg-black/40 p-4 rounded-2xl space-y-2.5">
                      <div className="flex justify-between items-center pb-1">
                        <h4 className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 animate-pulse" /> Estruturação automática gerada pelo Gemini
                        </h4>
                        <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-full font-mono">
                          {pdfParsedItems.length} itens extraídos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-light leading-relaxed">
                        Nossa inteligência leu e categorizou os itens detectados no catálogo. Verifique abaixo a lista preliminar de ações mapeadas. Os produtos foram automaticamente configurados sem duração de agendamento por padrão.
                      </p>

                      <div className="overflow-y-auto max-h-[260px] border border-white/5 rounded-2xl divide-y divide-white/[0.04] bg-black/40 pr-1 select-none font-sans">
                        {pdfParsedItems.map((item, idx) => {
                          const isProduct = item.type === "product";
                          return (
                            <div key={idx} className="p-3 hover:bg-white/[0.01] transition flex justify-between items-center gap-4 text-xs">
                              <div className="space-y-1 max-w-[70%]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] uppercase font-mono font-bold text-[#D4AF37] bg-[#D4AF37]/5 px-2 py-0.5 rounded leading-none">
                                    {item.category}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded leading-none border",
                                    isProduct 
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                      : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                  )}>
                                    {isProduct ? "Produto" : "Serviço"}
                                  </span>
                                </div>
                                <h5 className="font-semibold text-slate-200">{item.name}</h5>
                                {item.description && (
                                  <p className="text-[10px] text-zinc-500 font-light line-clamp-1">{item.description}</p>
                                )}
                              </div>

                              <div className="text-right space-y-1 shrink-0 font-mono">
                                <p className="font-bold text-white text-xs">
                                  {formatPriceDescription(item.price, item.priceType || "fixed")}
                                </p>
                                {!isProduct && (
                                  <p className="text-[10px] text-zinc-500">{item.durationMinutes || 60}m de tempo</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Database importing visual progress component (for csv / manual lists) */}
                {isImportingProgress && pdfParsedItems.length > 0 && (
                  <div className="border border-white/5 bg-black/40 rounded-2xl p-6 text-center space-y-4 animate-fade-in">
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-[#D4AF37]">Importando e Sincronizando com o Catálogo CRM</h4>
                      <p className="text-[11px] text-slate-400 font-light">
                        Criando registros no Firestore do seu salão Lumière e evitando duplicações...
                      </p>
                    </div>

                    <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="absolute h-full left-0 top-0 bg-gradient-to-r from-yellow-500 to-[#D4AF37] transition-all duration-300"
                        style={{ width: `${importProgressPercent}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                      <span>Progresso: {importProgressPercent}%</span>
                      <span>Modificados/Salvos: {totalImportedCount} itens</span>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Action dialog control buttons */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4 shrink-0 mt-1">
            <Button
              variant="outline"
              onClick={() => setIsMultipleImportOpen(false)}
              disabled={isImportingProgress}
              className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-9.5 px-4 font-normal"
            >
              Cancelar / Fechar
            </Button>

            <div className="flex gap-2">
              {importMode === "csv" && importRows.length > 0 && !isImportingProgress && (
                <Button
                  onClick={processCsvImport}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl text-xs h-9.5 px-5 shadow-lg select-none"
                >
                  Confirmar Importação de {importRows.length} linhas
                </Button>
              )}

              {importMode === "pdf" && pdfParsedItems.length > 0 && !isImportingProgress && (
                <Button
                  onClick={processPdfImport}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl text-xs h-9.5 px-5 shadow-lg select-none"
                >
                  Confirmar Importação de {pdfParsedItems.length} itens (Leitor AI)
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
