import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Client, ClientHistory } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Edit2, Users, Search, Kanban, List, Filter, Archive,
  MessageSquare, User, Tag, Calendar, AlertCircle, Sparkles, FolderOpen, RotateCcw,
  Upload, FileSpreadsheet, Check, CheckCircle2, ArrowRight, AlertTriangle, Settings2
} from 'lucide-react';

import KanbanBoard from '../../components/crm/KanbanBoard';
import ClientDetailsDrawer from '../../components/crm/ClientDetailsDrawer';

const CRM_STAGES = [
  { id: 'all', label: 'Todas as etapas' },
  { id: 'new', label: 'Novo contato' },
  { id: 'in_service', label: 'Em atendimento' },
  { id: 'scheduled', label: 'Agendado' },
  { id: 'follow_up', label: 'Em acompanhamento' },
  { id: 'future_return', label: 'Retorno futuro' },
  { id: 'active', label: 'Cliente ativo' },
  { id: 'inactive_lost', label: 'Inativo / Perdido' }
] as const;

export default function ClientsPage() {
  const { salonData, currentUser, userData } = useAuth();
  const userRole = userData?.role || 'professional';

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, number>>({
    name: -1,
    phone: -1,
    email: -1,
    notes: -1,
    crmStage: -1,
    source: -1,
    tags: -1,
    lifetimeValue: -1,
  });
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [totalImported, setTotalImported] = useState(0);

  const resetImportState = () => {
    setImportFile(null);
    setImportHeaders([]);
    setImportRows([]);
    setColumnMappings({
      name: -1,
      phone: -1,
      email: -1,
      notes: -1,
      crmStage: -1,
      source: -1,
      tags: -1,
      lifetimeValue: -1,
    });
    setImportProgress(0);
    setTotalImported(0);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileLoad(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileLoad(e.target.files[0]);
    }
  };

  // Parse CSV File
  const handleFileLoad = (file: File) => {
    setImportFile(file);
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
        toast.error("O arquivo selecionado está vazio.");
        return;
      }

      const headers = validLines[0];
      const dataRows = validLines.slice(1);

      setImportHeaders(headers);
      setImportRows(dataRows);

      // Auto detect mappings
      const detected = autoDetectMappings(headers);
      setColumnMappings(detected);
    };
    reader.readAsText(file, 'utf-8');
  };

  const autoDetectMappings = (headers: string[]) => {
    const mapping: Record<string, number> = {
      name: -1,
      phone: -1,
      email: -1,
      notes: -1,
      crmStage: -1,
      source: -1,
      tags: -1,
      lifetimeValue: -1,
    };

    const cleanString = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    headers.forEach((hdr, idx) => {
      const cleaned = cleanString(hdr);
      if (cleaned.includes('nome') || cleaned.includes('name') || cleaned.includes('cliente')) {
        if (mapping.name === -1) mapping.name = idx;
      } else if (cleaned.includes('celular') || cleaned.includes('whatsapp') || cleaned.includes('telefone') || cleaned.includes('phone') || cleaned.includes('tel') || cleaned.includes('contato')) {
        if (mapping.phone === -1) mapping.phone = idx;
      } else if (cleaned.includes('email') || cleaned.includes('e-mail') || cleaned.includes('mail') || cleaned.includes('correio')) {
        if (mapping.email === -1) mapping.email = idx;
      } else if (cleaned.includes('note') || cleaned.includes('obs') || cleaned.includes('observa') || cleaned.includes('desc') || cleaned.includes('comentar') || cleaned.includes('comentario') || cleaned.includes('detalhe')) {
        if (mapping.notes === -1) mapping.notes = idx;
      } else if (cleaned.includes('etapa') || cleaned.includes('fase') || cleaned.includes('stage') || cleaned.includes('grupo') || cleaned.includes('crm') || cleaned.includes('status')) {
        if (mapping.crmStage === -1) mapping.crmStage = idx;
      } else if (cleaned.includes('origem') || cleaned.includes('source') || cleaned.includes('canal') || cleaned.includes('meio') || cleaned.includes('como conheceu')) {
        if (mapping.source === -1) mapping.source = idx;
      } else if (cleaned.includes('marcador') || cleaned.includes('tag') || cleaned.includes('etiqueta')) {
        if (mapping.tags === -1) mapping.tags = idx;
      } else if (cleaned.includes('ltv') || cleaned.includes('gasto') || cleaned.includes('faturamento') || cleaned.includes('total') || cleaned.includes('spent')) {
        if (mapping.lifetimeValue === -1) mapping.lifetimeValue = idx;
      }
    });

    return mapping;
  };

  const processImport = async () => {
    if (!salonData || !importRows.length) return;
    if (columnMappings.name === -1) {
      toast.error("Por favor, selecione qual coluna contém o Nome do cliente.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setTotalImported(0);

    let count = 0;
    const total = importRows.length;

    const cleanString = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const mapCrmStage = (val: string): Client['crmStage'] => {
      const cleaned = cleanString(val);
      if (cleaned.includes('novo') || cleaned.includes('new') || cleaned.includes('entrada')) return 'new';
      if (cleaned.includes('atendimento') || cleaned.includes('service') || cleaned.includes('atendendo') || cleaned.includes('in_service')) return 'in_service';
      if (cleaned.includes('agendado') || cleaned.includes('scheduled') || cleaned.includes('reserva') || cleaned.includes('marcado')) return 'scheduled';
      if (cleaned.includes('acompanhamento') || cleaned.includes('follow') || cleaned.includes('follow_up') || cleaned.includes('retorno_proximo') || cleaned.includes('conversa')) return 'follow_up';
      if (cleaned.includes('retorno') || cleaned.includes('futuro') || cleaned.includes('future_return') || cleaned.includes('retorno_futuro')) return 'future_return';
      if (cleaned.includes('ativo') || cleaned.includes('active') || cleaned.includes('cliente_ativo') || cleaned.includes('concluido')) return 'active';
      if (cleaned.includes('inativo') || cleaned.includes('perdido') || cleaned.includes('lost') || cleaned.includes('inactive_lost') || cleaned.includes('cancelado')) return 'inactive_lost';
      return 'new';
    };

    const mapSource = (val: string): { source: Client['source']; sourceLabel: string } => {
      const cleaned = cleanString(val);
      if (cleaned.includes('instagram') || cleaned.includes('insta')) return { source: 'instagram', sourceLabel: '' };
      if (cleaned.includes('google') || cleaned.includes('maps')) return { source: 'google', sourceLabel: '' };
      if (cleaned.includes('indicacao') || cleaned.includes('amigo')) return { source: 'indication', sourceLabel: '' };
      if (cleaned.includes('whatsapp') || cleaned.includes('whats') || cleaned.includes('wpp')) return { source: 'whatsapp', sourceLabel: '' };
      if (cleaned.includes('balcao') || cleaned.includes('direto') || cleaned.includes('walk_in') || cleaned.includes('presencial')) return { source: 'walk_in', sourceLabel: '' };
      if (cleaned) {
        return { source: 'other', sourceLabel: val };
      }
      return { source: 'whatsapp', sourceLabel: '' };
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

    try {
      for (let i = 0; i < total; i++) {
        const row = importRows[i];
        
        const nameVal = row[columnMappings.name]?.trim();
        if (!nameVal) {
          continue;
        }

        const phoneVal = columnMappings.phone !== -1 ? row[columnMappings.phone]?.trim() || '' : '';
        const emailVal = columnMappings.email !== -1 ? row[columnMappings.email]?.trim() || '' : '';
        const notesVal = columnMappings.notes !== -1 ? row[columnMappings.notes]?.trim() || '' : '';
        
        const rawStage = columnMappings.crmStage !== -1 ? row[columnMappings.crmStage]?.trim() || '' : '';
        const crmStageVal = rawStage ? mapCrmStage(rawStage) : 'new';

        const rawSource = columnMappings.source !== -1 ? row[columnMappings.source]?.trim() || '' : '';
        const { source: sourceVal, sourceLabel: sourceLabelVal } = mapSource(rawSource);

        const tagsVal = columnMappings.tags !== -1 ? 
          row[columnMappings.tags] ? row[columnMappings.tags].split(/[,\s]+/).map((t: string) => t.trim()).filter(Boolean) : [] 
          : [];

        const ltvVal = columnMappings.lifetimeValue !== -1 ? parseFloatSafe(row[columnMappings.lifetimeValue]) : 0;

        const ref = doc(collection(db, `salons/${salonData.id}/clients`));
        const newClient: Client = {
          id: ref.id,
          name: nameVal,
          phone: phoneVal,
          email: emailVal,
          notes: notesVal,
          crmStage: crmStageVal,
          source: sourceVal,
          sourceLabel: sourceLabelVal,
          responsibleId: '',
          responsibleName: '',
          status: 'active',
          archived: false,
          tags: tagsVal,
          lifetimeValue: ltvVal,
          totalSpent: ltvVal,
          totalAppointments: ltvVal > 0 ? 1 : 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: currentUser?.uid || '',
          updatedBy: currentUser?.uid || ''
        };

        await setDoc(ref, newClient);

        // Created activity history entry for each client
        const histId = doc(collection(db, `salons/${salonData.id}/clients/${ref.id}/history`)).id;
        await setDoc(doc(db, `salons/${salonData.id}/clients/${ref.id}/history`, histId), {
          id: histId,
          type: 'created',
          title: 'Importado de outro SaaS',
          description: `Importação automática via migração Lumière. Etapa definida: "${getStageLabel(crmStageVal)}".`,
          createdBy: currentUser?.uid || '',
          createdByName: currentUser?.displayName || currentUser?.email || 'Sistema/Importador',
          createdAt: Date.now()
        });

        count++;
        setTotalImported(count);
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }

      toast.success(`${count} clientes importados e devidamente organizados no CRM com sucesso!`);
      setIsImportDialogOpen(false);
      resetImportState();
    } catch (err) {
      console.error("Error during clients import:", err);
      toast.error("Houve um problema durante a importação. Algumas gravações podem ter falhado.");
    } finally {
      setIsImporting(false);
    }
  };

  // Filters state
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState<boolean>(false);
  const [filterNoAction, setFilterNoAction] = useState<boolean>(false);
  const [filterCreatedThisMonth, setFilterCreatedThisMonth] = useState<boolean>(false);
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    crmStage: 'new' as Client['crmStage'],
    source: 'whatsapp' as Client['source'],
    sourceLabel: '',
    responsibleId: 'none',
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper translations
  const getStageLabel = (stageId: string) => {
    const maps: Record<string, string> = {
      new: 'Novo contato',
      in_service: 'Em atendimento',
      scheduled: 'Agendado',
      follow_up: 'Em acompanhamento',
      future_return: 'Retorno futuro',
      active: 'Cliente ativo',
      inactive_lost: 'Inativo / Perdido'
    };
    return maps[stageId] || stageId;
  };

  // 1. Fetch Clients, Professionals, and Services
  useEffect(() => {
    if (!salonData) return;

    setLoading(true);

    // Clients Listener
    const qc = query(collection(db, `salons/${salonData.id}/clients`));
    const unsubscribeClients = onSnapshot(qc, (snapshot) => {
      const cls: Client[] = [];
      snapshot.forEach((doc) => {
        cls.push({ id: doc.id, ...doc.data() } as Client);
      });
      const sorted = cls.sort((a, b) => b.createdAt - a.createdAt);
      setClients(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error loading clients:", error);
      toast.error('Erro ao carregar clientes do salão.');
      setLoading(false);
    });

    // Professionals Listener
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsubscribeProfs = onSnapshot(qp, (snapshot) => {
      const profsList: any[] = [];
      snapshot.forEach(d => {
        profsList.push({ id: d.id, ...d.data() });
      });
      setProfessionals(profsList);
    });

    // Services Listener
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    const unsubscribeSvcs = onSnapshot(qs, (snapshot) => {
      const svcsList: any[] = [];
      snapshot.forEach(d => {
        svcsList.push({ id: d.id, ...d.data() });
      });
      setServices(svcsList);
    });

    return () => {
      unsubscribeClients();
      unsubscribeProfs();
      unsubscribeSvcs();
    };
  }, [salonData]);

  // 2. Perform Filtering
  useEffect(() => {
    let list = [...clients];

    // Role-based CRM security: professionals can only see clients assigned to them
    if (userRole === 'professional' && userData?.id) {
      list = list.filter(c => c.responsibleId === userData.id);
    }

    // Filter by Archived Status
    if (!showArchived) {
      list = list.filter(c => !c.archived && c.status !== 'inactive');
    } else {
      list = list.filter(c => c.archived || c.status === 'inactive');
    }

    // Search query: name, phone, email
    const s = search.toLowerCase();
    if (s) {
      list = list.filter(c => 
        c.name.toLowerCase().includes(s) || 
        c.phone.includes(s) || 
        (c.email && c.email.toLowerCase().includes(s))
      );
    }

    // Filter Stage
    if (filterStage && filterStage !== 'all') {
      list = list.filter(c => (c.crmStage || 'new') === filterStage);
    }

    // Filter Source
    if (filterSource && filterSource !== 'all') {
      list = list.filter(c => c.source === filterSource);
    }

    // Filter Responsible Professional
    if (filterResponsible && filterResponsible !== 'all') {
      list = list.filter(c => c.responsibleId === filterResponsible);
    }

    // Filter Next Action Overdue
    if (filterOverdue) {
      list = list.filter(c => c.nextActionAt && c.nextActionAt < todayStr);
    }

    // Filter No Next Action Planeada
    if (filterNoAction) {
      list = list.filter(c => !c.nextActionAt);
    }

    // Filter Created inside Current Month
    if (filterCreatedThisMonth) {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      list = list.filter(c => {
        if (!c.createdAt) return false;
        const createdMonth = new Date(c.createdAt).toISOString().substring(0, 7);
        return createdMonth === currentMonth;
      });
    }

    setFilteredClients(list);
  }, [
    search, clients, filterStage, filterSource, filterResponsible, 
    filterOverdue, filterNoAction, filterCreatedThisMonth, showArchived, userRole, userData
  ]);

  // Save or Create Client
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const selectedProfObj = professionals.find(p => p.id === formData.responsibleId);
      const responsibleName = selectedProfObj ? selectedProfObj.name : '';

      const updatedPayload: Partial<Client> = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || '',
        notes: formData.notes.trim() || '',
        crmStage: formData.crmStage,
        source: formData.source,
        sourceLabel: formData.sourceLabel.trim() || '',
        responsibleId: formData.responsibleId === 'none' ? '' : formData.responsibleId,
        responsibleName: formData.responsibleId === 'none' ? '' : responsibleName,
        status: 'active',
        archived: false,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || '',
      };

      if (editingClient) {
        // Edit Profile
        const ref = doc(db, `salons/${salonData.id}/clients`, editingClient.id);
        await updateDoc(ref, updatedPayload);

        // Record standard history logs if stage changed
        if (formData.crmStage !== editingClient.crmStage) {
          const histId = doc(collection(db, `salons/${salonData.id}/clients/${editingClient.id}/history`)).id;
          await setDoc(doc(db, `salons/${salonData.id}/clients/${editingClient.id}/history`, histId), {
            id: histId,
            type: 'stage_changed',
            title: 'Etapa alterada manualmente',
            description: `Cliente movido de "${getStageLabel(editingClient.crmStage || 'new')}" para "${getStageLabel(formData.crmStage)}" via formulário de edição.`,
            previousValue: editingClient.crmStage || 'new',
            newValue: formData.crmStage,
            createdBy: currentUser?.uid || '',
            createdByName: currentUser?.displayName || currentUser?.email || 'Membro',
            createdAt: Date.now()
          });
        }

        toast.success('Cliente atualizado!');
      } else {
        // Create Profile
        const ref = doc(collection(db, `salons/${salonData.id}/clients`));
        const fullPayload: Client = {
          id: ref.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || '',
          notes: formData.notes.trim() || '',
          crmStage: formData.crmStage,
          source: formData.source,
          sourceLabel: formData.sourceLabel.trim() || '',
          responsibleId: formData.responsibleId === 'none' ? '' : formData.responsibleId,
          responsibleName: formData.responsibleId === 'none' ? '' : responsibleName,
          status: 'active',
          archived: false,
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: currentUser?.uid || '',
          updatedBy: currentUser?.uid || '',
        };

        await setDoc(ref, fullPayload);

        // Created activity history entry
        const histId = doc(collection(db, `salons/${salonData.id}/clients/${ref.id}/history`)).id;
        await setDoc(doc(db, `salons/${salonData.id}/clients/${ref.id}/history`, histId), {
          id: histId,
          type: 'created',
          title: 'Cliente Cadastrado',
          description: `Novo cadastro efetuado e direcionado à etapa "${getStageLabel(formData.crmStage)}".`,
          createdBy: currentUser?.uid || '',
          createdByName: currentUser?.displayName || currentUser?.email || 'Membro',
          createdAt: Date.now()
        });

        toast.success('Novo cliente cadastrado no CRM!');
      }

      setIsDialogOpen(false);
      resetForm();
      setEditingClient(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      notes: '',
      crmStage: 'new',
      source: 'whatsapp',
      sourceLabel: '',
      responsibleId: 'none',
    });
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      notes: c.notes || '',
      crmStage: c.crmStage || 'new',
      source: c.source || 'whatsapp',
      sourceLabel: c.sourceLabel || '',
      responsibleId: c.responsibleId || 'none',
    });
    setIsDialogOpen(true);
  };

  const openDrawer = (c: Client) => {
    setSelectedClient(c);
    setIsDrawerOpen(true);
  };

  // Fast quick add at target stage from Kanban card click
  const handleQuickAddClient = (targetStage: Client['crmStage']) => {
    resetForm();
    setFormData(prev => ({ ...prev, crmStage: targetStage }));
    setEditingClient(null);
    setIsDialogOpen(true);
  };

  // Drag and drop Stage update handler
  const handleMoveClient = async (clientId: string, targetStage: Client['crmStage']) => {
    if (!salonData) return;
    try {
      const originalClient = clients.find(c => c.id === clientId);
      if (!originalClient) return;

      const ref = doc(db, `salons/${salonData.id}/clients`, clientId);
      await updateDoc(ref, {
        crmStage: targetStage,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || ''
      });

      // Log movement to subcollection history
      const histId = doc(collection(db, `salons/${salonData.id}/clients/${clientId}/history`)).id;
      const userName = currentUser?.displayName || currentUser?.email || 'Membro';
      const prevLabel = getStageLabel(originalClient.crmStage || 'new');
      const targetLabel = getStageLabel(targetStage);

      await setDoc(doc(db, `salons/${salonData.id}/clients/${clientId}/history`, histId), {
        id: histId,
        type: 'stage_changed',
        title: 'Movimentação no Kanban',
        description: `Arrastado da etapa "${prevLabel}" para "${targetLabel}".`,
        previousValue: originalClient.crmStage || 'new',
        newValue: targetStage,
        createdBy: currentUser?.uid || '',
        createdByName: userName,
        createdAt: Date.now()
      });

      toast.success(`Cliente movido para "${targetLabel}"`);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao atualizar etapa do CRM.');
    }
  };

  // Soft Delete / Arquivar
  const handleSoftArchive = async (client: Client) => {
    if (!salonData) return;
    if (!window.confirm(`Mover o cliente "${client.name}" para os Arquivados?`)) return;

    try {
      await updateDoc(doc(db, `salons/${salonData.id}/clients/${client.id}`), {
        status: 'inactive',
        archived: true,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || ''
      });

      // Record History
      const histId = doc(collection(db, `salons/${salonData.id}/clients/${client.id}/history`)).id;
      await setDoc(doc(db, `salons/${salonData.id}/clients/${client.id}/history`, histId), {
        id: histId,
        type: 'data_updated',
        title: 'Arquivado',
        description: 'O cliente foi transferido para os Arquivos para fins de conformidade históricas.',
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || currentUser?.email || 'Membro',
        createdAt: Date.now()
      });

      toast.success('Cliente arquivado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao arquivar.');
    }
  };

  // Restore Customer back from soft-archive
  const handleRestoreClient = async (client: Client) => {
    if (!salonData) return;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/clients/${client.id}`), {
        status: 'active',
        archived: false,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || ''
      });

      const histId = doc(collection(db, `salons/${salonData.id}/clients/${client.id}/history`)).id;
      await setDoc(doc(db, `salons/${salonData.id}/clients/${client.id}/history`, histId), {
        id: histId,
        type: 'data_updated',
        title: 'Restaurado',
        description: 'Perfil restaurado de volta ao painel ativo do CRM.',
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || currentUser?.email || 'Membro',
        createdAt: Date.now()
      });

      toast.success('Cliente restaurado de volta ao CRM ativo!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao restaurar cliente.');
    }
  };

  // Compute stats card values
  const activeClients = clients.filter(c => !c.archived && c.status !== 'inactive');
  const countNew = activeClients.filter(c => (c.crmStage || 'new') === 'new').length;
  const countScheduled = activeClients.filter(c => c.crmStage === 'scheduled').length;
  const countDelayed = activeClients.filter(c => c.nextActionAt && c.nextActionAt < todayStr).length;
  const countReturn = activeClients.filter(c => c.crmStage === 'future_return').length;

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ⚠️ Top Indicators Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Contatos Ativos</span>
            <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
          </div>
          <div className="text-xl font-bold text-white mt-2 font-mono">
            {activeClients.length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Total na base ativa</div>
        </Card>

        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Novos Contatos</span>
            <Users className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-400 mt-2 font-mono">
            {countNew}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Aguardando contato</div>
        </Card>

        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Agendados</span>
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400 mt-2 font-mono">
            {countScheduled}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Visitas marcadas</div>
        </Card>

        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Ações Atrasadas</span>
            <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          </div>
          <div className="text-xl font-bold text-[#EF4444] mt-2 font-mono">
            {countDelayed}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Planejamentos vencidos</div>
        </Card>

        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Retornos Futuros</span>
            <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-400 mt-2 font-mono">
            {countReturn}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Retornos programados</div>
        </Card>

        <Card className="border-border bg-[#0b0b0d] flex flex-col justify-between p-4 rounded-xl shadow-lg">
          <div className="text-zinc-500 text-xs font-semibold flex items-center justify-between">
            <span>Arquivados</span>
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-zinc-400 mt-2 font-mono">
            {clients.filter(c => c.archived || c.status === 'inactive').length}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Registros silenciados</div>
        </Card>
      </div>

      {/* ⚠️ Page main title and top actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="text-3xl font-heading font-light text-zinc-100 flex items-center gap-2">
            CRM de Clientes
            <span className="text-xs bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25 px-2.5 py-0.5 rounded-full font-medium">LumièreOS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Organize clientes, retornos e oportunidades em um fluxo de trabalho visual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          {/* View switch buttons */}
          <div className="bg-[#121215] border border-zinc-c rounded-lg p-1 flex items-center">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'kanban' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Quadro
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>

          {/* Import List Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
            setIsImportDialogOpen(open);
            if (!open) resetImportState();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-zinc-800 hover:border-[#D4AF37]/50 text-zinc-300 hover:text-white h-10 px-4 rounded-lg flex items-center gap-2 font-medium">
                <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" /> Importar Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] bg-[#0c0c0e] border border-zinc-800 text-white shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal text-zinc-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" /> Migrar de Outro SaaS (CSV)
                </DialogTitle>
              </DialogHeader>

              {/* Step 1: Upload */}
              {!importFile && (
                <div className="space-y-4 py-4">
                  <p className="text-sm text-zinc-400">
                    Facilite a transição para o <strong>LumièreOS</strong>. Carregue um arquivo de planilha no formato <strong>CSV</strong> (separado por vírgula ou ponto-e-vírgula) para carregar todos os dados de forma massiva.
                  </p>

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition cursor-pointer ${
                      dragActive 
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5' 
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'
                    }`}
                  >
                    <Upload className="w-10 h-10 text-zinc-500" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-zinc-200">Arraste seu arquivo CSV aqui</p>
                      <p className="text-xs text-zinc-500 mt-1">Ou clique para navegar nos seus arquivos</p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="mt-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg cursor-pointer transition">
                      Procurar Arquivo
                    </label>
                  </div>

                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50 text-xs text-zinc-400 space-y-1">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Dica de Reconhecimento
                    </span>
                    <p>Nosso sistema utiliza inteligência heurística para identificar as colunas automaticamente (Nome, Celular, E-mail, Origem, Etapas do Funil, etc.).</p>
                    <p className="mt-1">Formatos de stage como 'Novo', 'Atendimento', 'Agendado', 'Ativo' serão mapeados sem necessidade de ajuste extra.</p>
                  </div>
                </div>
              )}

              {/* Step 2: Mapping Columns & Preview */}
              {importFile && !isImporting && (
                <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="flex justify-between items-center bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
                      <div className="text-left w-full">
                        <p className="text-xs font-semibold text-zinc-200 truncate max-w-[280px]">{importFile.name}</p>
                        <p className="text-[10px] text-zinc-500">{importRows.length} linhas de clientes identificadas</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetImportState} className="text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
                      Trocar Arquivo
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5 align-left">
                      <Settings2 className="w-3.5 h-3.5" /> Mapeamento de Colunas
                    </h4>

                    <div className="grid grid-cols-2 gap-3.5 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800">
                      {/* Name mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400 flex items-center gap-1">
                          Nome Completo <span className="text-red-500">*</span>
                        </Label>
                        <Select 
                          value={String(columnMappings.name)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, name: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Phone mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">Celular / WhatsApp</Label>
                        <Select 
                          value={String(columnMappings.phone)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, phone: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Email mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">E-mail</Label>
                        <Select 
                          value={String(columnMappings.email)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, email: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Notes mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">Observações / Notas</Label>
                        <Select 
                          value={String(columnMappings.notes)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, notes: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* CRM Stage mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">Etapa do Funil/CRM</Label>
                        <Select 
                          value={String(columnMappings.crmStage)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, crmStage: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Criar na etapa "Novo contato"</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Source mapping */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">Origem do Lead</Label>
                        <Select 
                          value={String(columnMappings.source)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, source: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Tags mapping */}
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[11px] text-zinc-400">Marcadores / Tags (separados por vírgula)</Label>
                        <Select 
                          value={String(columnMappings.tags)} 
                          onValueChange={(val) => setColumnMappings(prev => ({ ...prev, tags: Number(val) }))}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 text-[12px] h-9 text-left">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                            <SelectItem value="-1">Não mapeado</SelectItem>
                            {importHeaders.map((hdr, idx) => (
                              <SelectItem key={hdr + idx} value={String(idx)}>{hdr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Columns Preview Card */}
                  <div className="space-y-2 mt-4">
                    <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1 text-left">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Pré-visualização dos Primeiros Registros:
                    </span>
                    <div className="bg-zinc-950 rounded-lg border border-zinc-900 overflow-x-auto text-[11px] text-zinc-400">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-900/50">
                            <th className="p-2 py-1.5 font-medium text-zinc-300">#</th>
                            <th className="p-2 py-1.5 font-medium text-zinc-300">Nome Mapeado</th>
                            <th className="p-2 py-1.5 font-medium text-zinc-300">Celular</th>
                            <th className="p-2 py-1.5 font-medium text-zinc-300">CRM Stage</th>
                            <th className="p-2 py-1.5 font-medium text-zinc-300">Origem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 3).map((row, idx) => {
                            const nameVal = columnMappings.name !== -1 ? row[columnMappings.name] : '';
                            const phoneVal = columnMappings.phone !== -1 ? row[columnMappings.phone] : '';
                            const stageVal = columnMappings.crmStage !== -1 ? row[columnMappings.crmStage] : '-';
                            const srcVal = columnMappings.source !== -1 ? row[columnMappings.source] : '-';
                            return (
                              <tr key={idx} className="border-b border-zinc-900/50">
                                <td className="p-2 py-1.5 text-zinc-600">{idx + 1}</td>
                                <td className="p-2 py-1.5 text-zinc-200 font-semibold truncate max-w-[120px]">{nameVal || '(Sem nome - Ignorado)'}</td>
                                <td className="p-2 py-1.5 text-zinc-300">{phoneVal || '-'}</td>
                                <td className="p-2 py-1.5 text-[#D4AF37]">{stageVal || '-'}</td>
                                <td className="p-2 py-1.5">{srcVal || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-4 justify-end border-t border-zinc-900">
                    <Button variant="ghost" onClick={resetImportState} className="text-zinc-400 hover:text-white">
                      Reiniciar
                    </Button>
                    <Button 
                      onClick={processImport} 
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold gap-2 flex items-center h-10 px-5"
                      disabled={columnMappings.name === -1}
                    >
                      Importar {importRows.length} Clientes <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Loading Progress */}
              {isImporting && (
                <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
                  <div>
                    <h3 className="text-base font-semibold text-zinc-200">Efetuando transição de dados...</h3>
                    <p className="text-xs text-zinc-500 mt-1">Carregando e indexando os registros no seu CRM</p>
                  </div>
                  <div className="w-full max-w-xs bg-zinc-900 rounded-full h-2 overflow-hidden mt-2">
                    <div 
                      className="bg-[#D4AF37] h-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-400 mt-1">
                    {totalImported} de {importRows.length} importados ({importProgress}%)
                  </span>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) { setEditingClient(null); resetForm(); }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-10 px-5 rounded-lg flex items-center gap-2 grow md:grow-0">
                <Plus className="w-4 h-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-[#0c0c0e] border border-zinc-800 text-white shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal text-zinc-100">
                  {editingClient ? 'Editar Cadastro de Cliente' : 'Cadastrar no CRM'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" required value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="bg-[#121215] border-zinc-800" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Celular (WhatsApp)</Label>
                    <Input id="phone" required placeholder="(00) 00000-0000" value={formData.phone} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} className="bg-[#121215] border-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail (Opcional)</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} className="bg-[#121215] border-zinc-800" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fase de Entrada</Label>
                    <Select value={formData.crmStage} onValueChange={(val: any) => setFormData(p => ({...p, crmStage: val}))}>
                      <SelectTrigger className="bg-[#121215] border-zinc-800 text-white rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                        <SelectItem value="new">Novo contato</SelectItem>
                        <SelectItem value="in_service">Em atendimento</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="follow_up">Em acompanhamento</SelectItem>
                        <SelectItem value="future_return">Retorno futuro</SelectItem>
                        <SelectItem value="active">Cliente ativo</SelectItem>
                        <SelectItem value="inactive_lost">Inativo / Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Origem do Leads</Label>
                    <Select value={formData.source} onValueChange={(val: any) => setFormData(p => ({...p, source: val}))}>
                      <SelectTrigger className="bg-[#121215] border-zinc-800 text-white rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="google">Google Maps</SelectItem>
                        <SelectItem value="indication">Indicação</SelectItem>
                        <SelectItem value="walk_in">Atendimento Direto</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.source === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="sourceLabel">Descrição da Origem</Label>
                    <Input id="sourceLabel" placeholder="Escreva a origem" value={formData.sourceLabel} onChange={(e) => setFormData(p => ({...p, sourceLabel: e.target.value}))} className="bg-[#121215] border-zinc-800" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Responsável pelo CRM</Label>
                  <Select value={formData.responsibleId} onValueChange={(val) => setFormData(p => ({...p, responsibleId: val}))}>
                    <SelectTrigger className="bg-[#121215] border-zinc-800 text-white rounded-lg">
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                      <SelectItem value="none">Nenhum (Livre recepção)</SelectItem>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações Iniciais</Label>
                  <Input id="notes" placeholder="Alergias, preferências, cortes, etc." value={formData.notes} onChange={(e) => setFormData(p => ({...p, notes: e.target.value}))} className="bg-[#121215] border-zinc-800" />
                </div>

                <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-lg">
                  {editingClient ? 'Salvar Alterações' : 'Criar Conta no CRM'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ⚠️ Filtering tools */}
      <div className="bg-[#0b0b0d] border border-zinc-800/80 p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-[#D4AF37]" /> Painel de Filtros Avançados
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Searching string */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs text-medium">Pesquisa Rápida</Label>
            <SearchBar 
              value={search}
              onChange={setSearch}
              placeholder="Nome, celular ou e-mail..." 
              className="bg-[#121215] border-zinc-800 text-white w-full max-w-none"
            />
          </div>

          {/* Filter CRM Stage */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs text-medium">Filtrar por Etapa</Label>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="bg-[#121215] border-zinc-800 text-white rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                {CRM_STAGES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Origin */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs text-medium">Filtrar por Origem</Label>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="bg-[#121215] border-zinc-800 text-white rounded-lg">
                <SelectValue placeholder="Selecione origem" />
              </SelectTrigger>
              <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="google">Google Maps</SelectItem>
                <SelectItem value="indication">Indicação</SelectItem>
                <SelectItem value="walk_in">Atendimento Direto</SelectItem>
                <SelectItem value="other">Outra Origem</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter CRM Responsible */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs text-medium">Responsável Técnico</Label>
            <Select value={filterResponsible} onValueChange={setFilterResponsible}>
              <SelectTrigger className="bg-[#121215] border-zinc-800 text-[#D4AF37] rounded-lg">
                <SelectValue placeholder="Profissional responsável" />
              </SelectTrigger>
              <SelectContent className="bg-[#121215] border border-zinc-800 text-white">
                <SelectItem value="all">Toda a equipe (Geral)</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action checks / capsules */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/40">
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`p-2 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              filterOverdue 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 font-semibold' 
                : 'bg-[#121215] border-zinc-800 text-zinc-400'
            }`}
          >
            ⚠️ Próxima ação em Atraso
          </button>

          <button
            onClick={() => setFilterNoAction(!filterNoAction)}
            className={`p-2 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              filterNoAction 
                ? 'bg-amber-400/10 border-amber-400/35 text-amber-300 font-semibold' 
                : 'bg-[#121215] border-zinc-800 text-zinc-400'
            }`}
          >
            📋 Sem próxima ação
          </button>

          <button
            onClick={() => setFilterCreatedThisMonth(!filterCreatedThisMonth)}
            className={`p-2 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              filterCreatedThisMonth 
                ? 'bg-blue-500/10 border-blue-500/35 text-blue-400 font-semibold' 
                : 'bg-[#121215] border-zinc-800 text-zinc-400'
            }`}
          >
            📅 Cadastrados este mês
          </button>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`p-2 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ml-auto ${
              showArchived 
                ? 'bg-zinc-800 border-zinc-700 text-white font-semibold' 
                : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            📂 Ver Arquivados
          </button>
        </div>
      </div>

      {/* ⚠️ Render matching View Mode */}
      {filteredClients.length === 0 ? (
        <Card className="border-border bg-[#0b0b0d] py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#1b1b22] border border-[#D4AF37]/20 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-medium text-zinc-200 mb-1">Nenhum cliente no filtro atual</h3>
            <p className="text-zinc-500 text-sm max-w-sm">
              Não encontramos clientes correspondentes a essa combinação de filtros ou buscas. Tente redefinir.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard 
          clients={filteredClients}
          userRole={userRole}
          onMoveClient={handleMoveClient}
          onSelectClient={openDrawer}
          onQuickAddClient={handleQuickAddClient}
          onArchiveClient={handleSoftArchive}
        />
      ) : (
        /* Structured List View */
        <div className="bg-[#0b0b0d] border border-zinc-800/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-zinc-300">
              <thead>
                <tr className="bg-[#121215] text-zinc-400 text-xs font-semibold border-b border-zinc-800">
                  <th className="p-4 pl-6">Cliente</th>
                  <th className="p-4">Etapa CRM</th>
                  <th className="p-4">Celular</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Tags</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4 pr-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredClients.map((client) => {
                  const isActionOverdue = client.nextActionAt && client.nextActionAt < todayStr;
                  return (
                    <tr 
                      key={client.id} 
                      onClick={() => openDrawer(client)}
                      className="hover:bg-[#121215]/40 transition duration-150 cursor-pointer group"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#15151a] border border-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] font-semibold text-xs text-center shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-white block group-hover:text-[#D4AF37] transition">
                              {client.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">ID: {client.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          client.crmStage === 'new' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                          client.crmStage === 'in_service' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                          client.crmStage === 'scheduled' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                          client.crmStage === 'follow_up' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                          client.crmStage === 'future_return' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' :
                          client.crmStage === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {getStageLabel(client.crmStage || 'new')}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs">{client.phone || '-'}</td>
                      <td className="p-4 capitalize text-xs text-zinc-400">
                        {client.source === 'other' ? (client.sourceLabel || 'Outro') : (client.source || '-')}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {client.tags && client.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[9px] bg-zinc-900 border border-zinc-800 text-[#D4AF37] px-1 py-0.5 rounded capitalize">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-xs font-semibold text-zinc-300">
                        {client.responsibleName || 'Sem responsável'}
                      </td>
                      <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {showArchived ? (
                            <Button
                              onClick={() => handleRestoreClient(client)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-400 hover:text-emerald-300 rounded hover:bg-emerald-500/10"
                              title="Restaurar de volta ao CRM"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => openEdit(client)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-400 hover:text-[#D4AF37] rounded hover:bg-zinc-800"
                                title="Editar dados"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                onClick={() => handleSoftArchive(client)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10"
                                title="Arquivar cliente"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ⚠️ Side Drawer for client history/timeline detail sheet */}
      <ClientDetailsDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        client={selectedClient}
        salonId={salonData?.id || ''}
        currentUser={currentUser}
        userRole={userRole}
        professionals={professionals}
        services={services}
        onClientUpdated={() => {
          // No need to manually refetch since the onSnapshot handles it perfectly
        }}
      />
    </div>
  );
}
