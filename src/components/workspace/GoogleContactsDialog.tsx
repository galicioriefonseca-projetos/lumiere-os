import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GoogleWorkspaceAccount,
  WorkspaceAuthError,
  clearWorkspaceToken,
  connectGoogleWorkspace,
  subscribeWorkspaceAuth,
} from '@/services/googleWorkspaceService';
import {
  GoogleContactFormInput,
  GoogleContactPerson,
  clientToGoogleContactInput,
  contactMatchesClient,
  createGoogleContact,
  deleteGoogleContact,
  fetchMyPeopleProfile,
  googleContactFormSchema,
  googleContactToFormInput,
  listDirectoryContacts,
  listGoogleContacts,
  listOtherContacts,
  searchGoogleContacts,
  updateGoogleContact,
} from '@/services/contactsService';
import type { Client } from '@/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  WorkspaceConfirmDetails,
  WorkspaceConfirmDialog,
} from './WorkspaceConfirmDialog';
import {
  AlertCircle,
  BookUser,
  Building2,
  Cake,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'google' | 'export' | 'form';
  prefillContact?: GoogleContactFormInput | null;
  clients?: Client[];
  canImportToCrm?: boolean;
  onImportContactsToCrm?: (
    contacts: GoogleContactPerson[]
  ) => Promise<{ imported: number; skipped: number }>;
  onContactSavedToGoogle?: (person: GoogleContactPerson) => Promise<void> | void;
  salonName?: string;
}

type GoogleSourceView = 'contacts' | 'other' | 'directory';

interface PendingContactsAction {
  confirmDetails: WorkspaceConfirmDetails;
  execute: () => Promise<void>;
}

const EMPTY_FORM: GoogleContactFormInput = {
  displayName: '',
  phone: '',
  email: '',
  birthDate: '',
  gender: '',
  organization: '',
  jobTitle: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  notes: '',
};

function formatBirthDateShort(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function GoogleContactsDialog({
  open,
  onOpenChange,
  initialTab = 'google',
  prefillContact = null,
  clients = [],
  canImportToCrm = false,
  onImportContactsToCrm,
  onContactSavedToGoogle,
  salonName,
}: GoogleContactsDialogProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<GoogleWorkspaceAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'google' | 'export' | 'form'>(initialTab);

  // User profile (people/me)
  const [myProfile, setMyProfile] = useState<GoogleContactPerson | null>(null);

  // Google Contacts list state
  const [sourceView, setSourceView] = useState<GoogleSourceView>('contacts');
  const [googleContacts, setGoogleContacts] = useState<GoogleContactPerson[]>([]);
  const [otherContacts, setOtherContacts] = useState<GoogleContactPerson[]>([]);
  const [directoryContacts, setDirectoryContacts] = useState<GoogleContactPerson[]>([]);
  const [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  const [contactsNextPageToken, setContactsNextPageToken] = useState<string | undefined>();
  const [otherNextPageToken, setOtherNextPageToken] = useState<string | undefined>();
  const [directoryNextPageToken, setDirectoryNextPageToken] = useState<string | undefined>();
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Search & selection inside Google Contacts tab
  const [googleSearchInput, setGoogleSearchInput] = useState('');
  const [selectedGoogleKeys, setSelectedGoogleKeys] = useState<string[]>([]);
  const [isImportingToCrm, setIsImportingToCrm] = useState(false);

  // Export Clients -> Google Contacts tab
  const [clientExportSearch, setClientExportSearch] = useState('');
  const [selectedExportClientIds, setSelectedExportClientIds] = useState<string[]>([]);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Create / Edit Contact Form state
  const [editingTarget, setEditingTarget] = useState<{
    resourceName: string;
    etag?: string;
  } | null>(null);
  const [formValues, setFormValues] = useState<GoogleContactFormInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof GoogleContactFormInput, string>>>({});
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Mandatory Workspace confirmation state
  const [pendingAction, setPendingAction] = useState<PendingContactsAction | null>(null);
  const [isConfirmExecuting, setIsConfirmExecuting] = useState(false);

  useEffect(() => {
    return subscribeWorkspaceAuth((state) => {
      setIsConnected(state.isConnected);
      setAccount(state.account);
      if (!state.isConnected) {
        setMyProfile(null);
        setGoogleContacts([]);
        setOtherContacts([]);
        setDirectoryContacts([]);
        setSelectedGoogleKeys([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    if (prefillContact) {
      setEditingTarget(null);
      setFormValues({ ...EMPTY_FORM, ...prefillContact });
      setFormErrors({});
    }
  }, [open, initialTab, prefillContact]);

  const handleAuthError = useCallback((err: unknown): boolean => {
    if (err instanceof WorkspaceAuthError) {
      setListError(err.message);
      toast.error(err.message);
      return true;
    }
    return false;
  }, []);

  const loadSourceData = useCallback(
    async (targetSource: GoogleSourceView, searchQuery = '', appendPageToken?: string) => {
      if (!isConnected) return;
      if (appendPageToken) {
        setLoadingMore(true);
      } else {
        setLoadingList(true);
        setListError(null);
      }

      try {
        if (targetSource === 'contacts') {
          if (searchQuery.trim() && !appendPageToken) {
            const results = await searchGoogleContacts(searchQuery.trim());
            setGoogleContacts(results);
            setContactsNextPageToken(undefined);
          } else {
            const res = await listGoogleContacts(appendPageToken);
            setGoogleContacts((prev) =>
              appendPageToken ? [...prev, ...res.contacts] : res.contacts
            );
            setContactsNextPageToken(res.nextPageToken);
          }
        } else if (targetSource === 'other') {
          const res = await listOtherContacts(appendPageToken, searchQuery.trim());
          setOtherContacts((prev) =>
            appendPageToken ? [...prev, ...res.contacts] : res.contacts
          );
          setOtherNextPageToken(res.nextPageToken);
        } else {
          const res = await listDirectoryContacts(appendPageToken, searchQuery.trim());
          setDirectoryUnavailable(Boolean(res.directoryUnavailable));
          setDirectoryContacts((prev) =>
            appendPageToken ? [...prev, ...res.contacts] : res.contacts
          );
          setDirectoryNextPageToken(res.nextPageToken);
        }
      } catch (err) {
        if (!handleAuthError(err)) {
          const msg =
            err instanceof Error ? err.message : 'Não foi possível carregar os contatos do Google.';
          setListError(msg);
          toast.error(msg);
        }
      } finally {
        setLoadingList(false);
        setLoadingMore(false);
      }
    },
    [isConnected, handleAuthError]
  );

  const loadInitialWorkspaceData = useCallback(async () => {
    if (!isConnected) return;
    try {
      const profile = await fetchMyPeopleProfile();
      setMyProfile(profile);
    } catch (err) {
      // Perfil people/me é informativo; apenas trata erro se sessão expirou
      if (err instanceof WorkspaceAuthError) {
        handleAuthError(err);
        return;
      }
    }
    await loadSourceData(sourceView, googleSearchInput);
  }, [isConnected, sourceView, googleSearchInput, loadSourceData, handleAuthError]);

  useEffect(() => {
    if (open && isConnected) {
      loadInitialWorkspaceData();
    }
  }, [open, isConnected, sourceView]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setListError(null);
      await connectGoogleWorkspace();
      toast.success('Conta Google conectada ao módulo de Contatos.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao conectar conta Google.';
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearWorkspaceToken();
    toast.success('Sessão Google Workspace desconectada.');
  };

  const activeContactsList = useMemo(() => {
    if (sourceView === 'contacts') return googleContacts;
    if (sourceView === 'other') return otherContacts;
    return directoryContacts;
  }, [sourceView, googleContacts, otherContacts, directoryContacts]);

  const activeNextPageToken = useMemo(() => {
    if (sourceView === 'contacts') return contactsNextPageToken;
    if (sourceView === 'other') return otherNextPageToken;
    return directoryNextPageToken;
  }, [sourceView, contactsNextPageToken, otherNextPageToken, directoryNextPageToken]);

  const filteredGoogleContacts = useMemo(() => {
    const q = googleSearchInput.trim().toLowerCase();
    if (!q) return activeContactsList;
    return activeContactsList.filter((person) => {
      const nameMatch = person.displayName.toLowerCase().includes(q);
      const emailMatch = person.emailAddresses.some((e) =>
        e.value.toLowerCase().includes(q)
      );
      const phoneMatch = person.phoneNumbers.some((p) =>
        p.value.toLowerCase().includes(q)
      );
      const orgMatch = person.organization?.toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch || Boolean(orgMatch);
    });
  }, [activeContactsList, googleSearchInput]);

  const getContactKey = (person: GoogleContactPerson, idx: number): string =>
    person.resourceName || `${person.source}-${person.primaryEmail || person.primaryPhone || idx}`;

  const matchedClientKeys = useMemo(() => {
    const matched = new Set<string>();
    if (!clients.length) return matched;
    activeContactsList.forEach((person, idx) => {
      if (clients.some((client) => contactMatchesClient(person, client))) {
        matched.add(getContactKey(person, idx));
      }
    });
    return matched;
  }, [activeContactsList, clients]);

  const toggleSelectGoogleContact = (key: string) => {
    setSelectedGoogleKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectUnsyncedGoogleContacts = () => {
    const keys = filteredGoogleContacts
      .map((person, idx) => ({ key: getContactKey(person, idx), person }))
      .filter(({ key }) => !matchedClientKeys.has(key))
      .map(({ key }) => key);
    setSelectedGoogleKeys(keys);
  };

  const handleImportSelectedToCrm = async () => {
    if (!onImportContactsToCrm || selectedGoogleKeys.length === 0) return;
    const selectedSet = new Set(selectedGoogleKeys);
    const chosen = activeContactsList.filter((person, idx) =>
      selectedSet.has(getContactKey(person, idx))
    );
    if (chosen.length === 0) return;

    try {
      setIsImportingToCrm(true);
      const result = await onImportContactsToCrm(chosen);
      if (result.imported > 0) {
        toast.success(
          `${result.imported} contato(s) importado(s) para o CRM${
            result.skipped > 0 ? ` (${result.skipped} já cadastrado(s) ignorado(s))` : ''
          }.`
        );
      } else {
        toast.info('Todos os contatos selecionados já existem na base do CRM.');
      }
      setSelectedGoogleKeys([]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao importar contatos para o CRM.'
      );
    } finally {
      setIsImportingToCrm(false);
    }
  };

  const handleStartEditContact = (person: GoogleContactPerson) => {
    setEditingTarget({
      resourceName: person.resourceName,
      etag: person.etag,
    });
    setFormValues(googleContactToFormInput(person));
    setFormErrors({});
    setActiveTab('form');
  };

  const handleStartCopyToGoogleContacts = (person: GoogleContactPerson) => {
    setEditingTarget(null);
    setFormValues(googleContactToFormInput(person));
    setFormErrors({});
    setActiveTab('form');
  };

  const handleRequestDeleteContact = (person: GoogleContactPerson) => {
    setPendingAction({
      confirmDetails: {
        title: `Excluir "${person.displayName}" do Google Contatos?`,
        description:
          'Esta ação removerá permanentemente este contato da sua agenda no Google Contatos.',
        targetLabel: 'Contato:',
        targetName: person.primaryEmail || person.primaryPhone || person.displayName,
        warningText: 'A exclusão no Google Contatos não pode ser desfeita pelo LumièreOS.',
        confirmLabel: 'Sim, excluir contato',
        destructive: true,
      },
      execute: async () => {
        await deleteGoogleContact(person.resourceName);
        setGoogleContacts((prev) =>
          prev.filter((item) => item.resourceName !== person.resourceName)
        );
        setSelectedGoogleKeys((prev) =>
          prev.filter((key) => key !== person.resourceName)
        );
        toast.success(`"${person.displayName}" removido do Google Contatos.`);
      },
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = googleContactFormSchema.safeParse(formValues);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof GoogleContactFormInput, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof GoogleContactFormInput | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      });
      setFormErrors(nextErrors);
      return;
    }

    setFormErrors({});
    const cleanData = parsed.data;
    const isEditing = Boolean(editingTarget?.resourceName);

    setPendingAction({
      confirmDetails: {
        title: isEditing
          ? `Atualizar "${cleanData.displayName}" no Google Contatos?`
          : `Salvar "${cleanData.displayName}" no Google Contatos?`,
        description: isEditing
          ? 'Os dados deste contato serão atualizados diretamente na sua conta Google.'
          : 'Um novo contato será criado na sua agenda do Google Contatos.',
        targetLabel: 'Contato:',
        targetName: [cleanData.displayName, cleanData.phone, cleanData.email].filter(Boolean).join(' · '),
        confirmLabel: isEditing ? 'Confirmar atualização' : 'Salvar no Google Contatos',
      },
      execute: async () => {
        setIsSavingForm(true);
        try {
          let saved: GoogleContactPerson;
          if (isEditing && editingTarget) {
            saved = await updateGoogleContact(
              editingTarget.resourceName,
              editingTarget.etag,
              cleanData
            );
            setGoogleContacts((prev) =>
              prev.map((item) =>
                item.resourceName === saved.resourceName ? saved : item
              )
            );
            toast.success(`"${saved.displayName}" atualizado no Google Contatos!`);
          } else {
            saved = await createGoogleContact(cleanData);
            setGoogleContacts((prev) => [saved, ...prev]);
            toast.success(`"${saved.displayName}" adicionado ao Google Contatos!`);
          }

          if (onContactSavedToGoogle) {
            await onContactSavedToGoogle(saved);
          }

          setEditingTarget(null);
          setFormValues(EMPTY_FORM);
          setActiveTab('google');
          setSourceView('contacts');
        } finally {
          setIsSavingForm(false);
        }
      },
    });
  };

  // Clients available for export (must have at least name and phone or email)
  const exportableClients = useMemo(() => {
    const q = clientExportSearch.trim().toLowerCase();
    return clients
      .filter((c) => !c.archived && (Boolean(c.phone?.trim()) || Boolean(c.email?.trim())))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      });
  }, [clients, clientExportSearch]);

  const syncedClientIdsInGoogle = useMemo(() => {
    const synced = new Set<string>();
    const allKnownGoogle = [...googleContacts, ...otherContacts];
    if (allKnownGoogle.length === 0) return synced;
    exportableClients.forEach((client) => {
      if (allKnownGoogle.some((person) => contactMatchesClient(person, client))) {
        synced.add(client.id);
      }
    });
    return synced;
  }, [exportableClients, googleContacts, otherContacts]);

  const handleSelectUnsyncedClients = () => {
    const ids = exportableClients
      .filter((c) => !syncedClientIdsInGoogle.has(c.id))
      .map((c) => c.id);
    setSelectedExportClientIds(ids);
  };

  const handleRequestBatchExport = () => {
    const selectedSet = new Set(selectedExportClientIds);
    const chosen = exportableClients.filter((c) => selectedSet.has(c.id));
    if (chosen.length === 0) return;

    setPendingAction({
      confirmDetails: {
        title: `Enviar ${chosen.length} cliente(s) para o Google Contatos?`,
        description:
          'Cada cliente selecionado será criado como um contato na sua conta Google conectada.',
        targetLabel: 'Conta Google:',
        targetName: account?.email || 'Conta Google conectada',
        affectedCountLabel: `${chosen.length} cliente(s)`,
        warningText:
          chosen.some((c) => syncedClientIdsInGoogle.has(c.id))
            ? 'Alguns clientes selecionados já possuem telefone ou e-mail semelhante no Google Contatos.'
            : undefined,
        confirmLabel: `Criar ${chosen.length} contato(s) no Google`,
      },
      execute: async () => {
        setIsBatchExporting(true);
        setBatchProgress({ current: 0, total: chosen.length });
        let createdCount = 0;
        const newlyCreated: GoogleContactPerson[] = [];

        try {
          for (let i = 0; i < chosen.length; i += 1) {
            const client = chosen[i];
            const payload = clientToGoogleContactInput(client, salonName);
            const created = await createGoogleContact(payload);
            newlyCreated.push(created);
            createdCount += 1;
            setBatchProgress({ current: i + 1, total: chosen.length });
          }

          if (newlyCreated.length > 0) {
            setGoogleContacts((prev) => [...newlyCreated, ...prev]);
          }
          setSelectedExportClientIds([]);
          toast.success(
            `${createdCount} cliente(s) enviado(s) com sucesso para o Google Contatos!`
          );
        } finally {
          setIsBatchExporting(false);
          setBatchProgress({ current: 0, total: 0 });
        }
      },
    });
  };

  const handleConfirmExecute = async () => {
    if (!pendingAction) return;
    try {
      setIsConfirmExecuting(true);
      await pendingAction.execute();
      setPendingAction(null);
    } catch (err) {
      if (!handleAuthError(err)) {
        toast.error(
          err instanceof Error ? err.message : 'Erro ao executar ação no Google Contatos.'
        );
      }
    } finally {
      setIsConfirmExecuting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl w-[calc(100vw-1rem)] max-h-[92vh] flex flex-col overflow-hidden p-0 rounded-2xl bg-white border border-[#E5E2DC] text-[#171717] shadow-2xl">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 border-b border-[#E5E2DC] bg-[#FAF9F7] shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                  <BookUser className="w-5 h-5 text-[#8A6D36]" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-heading font-bold text-[#171717] truncate">
                    Google Contatos
                  </DialogTitle>
                  <p className="text-xs text-[#6B6B6B] truncate">
                    Sincronize clientes entre o LumièreOS e sua agenda do Google Contacts
                  </p>
                </div>
              </div>

              {isConnected && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E2DC] text-xs text-[#171717] flex items-center gap-2 max-w-[230px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate font-medium">
                      {myProfile?.primaryEmail || account?.email || 'Conta Google'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loadingList}
                    onClick={() => loadInitialWorkspaceData()}
                    className="h-8 px-2.5 rounded-xl border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717]"
                    title="Atualizar contatos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDisconnect}
                    className="h-8 px-2.5 rounded-xl border-[#E5E2DC] bg-white hover:bg-red-50 hover:text-red-600 text-[#6B6B6B]"
                    title="Desconectar sessão Google"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {!isConnected ? (
            <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-5 overflow-y-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#F5F1E9] border border-[#D4AF37]/30 flex items-center justify-center">
                <BookUser className="w-8 h-8 text-[#8A6D36]" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-[#171717]">
                  Conecte seu Google Contatos
                </h3>
                <p className="text-sm text-[#6B6B6B] leading-relaxed">
                  Importe contatos da sua agenda pessoal ou corporativa diretamente para o CRM de clientes, e mantenha seus clientes do salão salvos com segurança no Google Contacts.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left">
                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <Download className="w-4 h-4 text-[#8A6D36] mb-1.5" />
                  <p className="text-xs font-semibold text-[#171717]">Importar p/ o CRM</p>
                  <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                    Traga telefones, e-mails, aniversários e endereços sem duplicar.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <Upload className="w-4 h-4 text-[#8A6D36] mb-1.5" />
                  <p className="text-xs font-semibold text-[#171717]">Enviar Clientes</p>
                  <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                    Exporte clientes selecionados para o Google Contatos com um clique.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <UserCheck className="w-4 h-4 text-[#8A6D36] mb-1.5" />
                  <p className="text-xs font-semibold text-[#171717]">Gestão Segura</p>
                  <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                    Toda criação, edição ou exclusão exige sua confirmação explícita.
                  </p>
                </div>
              </div>
              <GoogleSignInButton
                onClick={handleConnect}
                loading={isConnecting}
                className="min-w-[240px]"
              />
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'google' | 'export' | 'form')}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-[#E5E2DC] bg-white shrink-0">
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-[#FAF9F7] border border-[#E5E2DC] p-1 rounded-xl h-auto gap-1">
                  <TabsTrigger
                    value="google"
                    className="rounded-lg text-xs font-semibold px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-[#8A6D36]" />
                    Agenda Google ({googleContacts.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="export"
                    className="rounded-lg text-xs font-semibold px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#8A6D36]" />
                    Enviar Clientes ({clients.filter((c) => !c.archived).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="form"
                    className="rounded-lg text-xs font-semibold px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#8A6D36]" />
                    {editingTarget ? 'Editar Contato' : 'Novo Contato Google'}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB 1: GOOGLE CONTACTS BROWSER */}
              <TabsContent
                value="google"
                className="flex-1 min-h-0 flex flex-col m-0 overflow-hidden"
              >
                <div className="px-4 sm:px-6 py-3 border-b border-[#E5E2DC] bg-[#FAF9F7]/70 space-y-3 shrink-0">
                  {/* Perfil conectado resumido (usando scopes user.*.read) */}
                  {myProfile && (myProfile.organization || myProfile.birthDate || myProfile.primaryPhone) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B6B] bg-white border border-[#E5E2DC] rounded-xl px-3 py-2">
                      <span className="font-semibold text-[#171717]">
                        Seu Perfil Google: {myProfile.displayName}
                      </span>
                      {myProfile.primaryPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#8A6D36]" />
                          {myProfile.primaryPhone}
                        </span>
                      )}
                      {myProfile.organization && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#8A6D36]" />
                          {myProfile.organization}
                        </span>
                      )}
                      {myProfile.birthDate && (
                        <span className="inline-flex items-center gap-1">
                          <Cake className="w-3 h-3 text-[#8A6D36]" />
                          {formatBirthDateShort(myProfile.birthDate)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Source switcher + Search */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                    <div className="flex items-center gap-1 bg-white border border-[#E5E2DC] rounded-xl p-1 overflow-x-auto">
                      {(
                        [
                          { id: 'contacts', label: 'Meus Contatos' },
                          { id: 'other', label: 'Outros Contatos' },
                          { id: 'directory', label: 'Diretório' },
                        ] as Array<{ id: GoogleSourceView; label: string }>
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setSourceView(tab.id);
                            setSelectedGoogleKeys([]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                            sourceView === tab.id
                              ? 'bg-[#171717] text-white'
                              : 'text-[#6B6B6B] hover:text-[#171717]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        loadSourceData(sourceView, googleSearchInput);
                      }}
                      className="flex items-center gap-2 flex-1 sm:max-w-xs"
                    >
                      <div className="relative flex-1 min-w-0">
                        <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={googleSearchInput}
                          onChange={(e) => setGoogleSearchInput(e.target.value)}
                          placeholder="Buscar nome, telefone ou e-mail..."
                          className="h-9 pl-8 text-xs bg-white border-[#E5E2DC] rounded-xl"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={loadingList}
                        className="h-9 px-3 rounded-xl border-[#E5E2DC] bg-white text-xs font-semibold"
                      >
                        Buscar
                      </Button>
                    </form>
                  </div>

                  {/* Selection action bar */}
                  {canImportToCrm && onImportContactsToCrm && activeContactsList.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleSelectUnsyncedGoogleContacts}
                          className="h-8 text-[11px] font-semibold rounded-lg border-[#E5E2DC] bg-white hover:bg-[#F5F1E9]"
                        >
                          Selecionar novos (não no CRM)
                        </Button>
                        {selectedGoogleKeys.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedGoogleKeys([])}
                            className="text-[11px] font-medium text-[#6B6B6B] hover:text-[#171717] underline cursor-pointer"
                          >
                            Limpar ({selectedGoogleKeys.length})
                          </button>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={selectedGoogleKeys.length === 0 || isImportingToCrm}
                        onClick={handleImportSelectedToCrm}
                        className="h-8 px-3.5 rounded-lg bg-[#171717] hover:bg-[#2a2a2a] text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        {isImportingToCrm ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Importar p/ Clientes ({selectedGoogleKeys.length})
                      </Button>
                    </div>
                  )}
                </div>

                {/* Contacts List Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 bg-white">
                  {listError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{listError}</span>
                    </div>
                  )}

                  {loadingList ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#6B6B6B]">
                      <Loader2 className="w-6 h-6 animate-spin text-[#B89B5E]" />
                      <p className="text-xs">Carregando contatos do Google...</p>
                    </div>
                  ) : sourceView === 'directory' && directoryUnavailable ? (
                    <div className="py-10 px-4 text-center rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2">
                      <Building2 className="w-8 h-8 text-[#8A6D36] mx-auto opacity-70" />
                      <p className="text-sm font-semibold text-[#171717]">
                        Diretório Corporativo indisponível nesta conta
                      </p>
                      <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
                        O diretório de domínio está disponível apenas para contas Google Workspace empresariais com diretório compartilhado ativo.
                      </p>
                    </div>
                  ) : filteredGoogleContacts.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2">
                      <Users className="w-8 h-8 text-[#8A6D36] mx-auto opacity-60" />
                      <p className="text-sm font-semibold text-[#171717]">
                        Nenhum contato encontrado
                      </p>
                      <p className="text-xs text-[#6B6B6B]">
                        Tente outro termo na busca ou cadastre um novo contato na aba ao lado.
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredGoogleContacts.map((person, idx) => {
                        const key = getContactKey(person, idx);
                        const isChecked = selectedGoogleKeys.includes(key);
                        const alreadyInCrm = matchedClientKeys.has(key);

                        return (
                          <div
                            key={key}
                            className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isChecked
                                ? 'border-[#B89B5E] bg-[#FAF7F0]'
                                : 'border-[#E5E2DC] bg-white hover:bg-[#FAF9F7]'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {canImportToCrm && onImportContactsToCrm && (
                                <button
                                  type="button"
                                  onClick={() => toggleSelectGoogleContact(key)}
                                  aria-label={`Selecionar ${person.displayName}`}
                                  className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer ${
                                    isChecked
                                      ? 'bg-[#171717] border-[#171717] text-white'
                                      : 'bg-white border-[#D6D2CA] hover:border-[#171717]'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              {person.photoUrl ? (
                                <img
                                  src={person.photoUrl}
                                  alt={person.displayName}
                                  className="w-10 h-10 rounded-full object-cover border border-[#E5E2DC] shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#F5F1E9] border border-[#D4AF37]/30 flex items-center justify-center text-[#8A6D36] font-bold text-sm shrink-0">
                                  {person.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="font-semibold text-sm text-[#171717] truncate">
                                    {person.displayName}
                                  </span>
                                  {alreadyInCrm && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                                      <CheckCircle2 className="w-3 h-3" /> Já no CRM
                                    </span>
                                  )}
                                  {person.organization && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#FAF9F7] border border-[#E5E2DC] text-[#6B6B6B] text-[10px] font-medium truncate max-w-[180px]">
                                      {person.organization}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6B6B]">
                                  {person.primaryPhone && (
                                    <span className="inline-flex items-center gap-1 font-mono text-[#171717]">
                                      <Phone className="w-3 h-3 text-[#8A6D36]" />
                                      {person.primaryPhone}
                                    </span>
                                  )}
                                  {person.primaryEmail && (
                                    <span className="inline-flex items-center gap-1 truncate max-w-[230px]">
                                      <Mail className="w-3 h-3 text-[#8A6D36]" />
                                      {person.primaryEmail}
                                    </span>
                                  )}
                                  {person.birthDate && (
                                    <span className="inline-flex items-center gap-1">
                                      <Cake className="w-3 h-3 text-[#8A6D36]" />
                                      {formatBirthDateShort(person.birthDate)}
                                    </span>
                                  )}
                                  {(person.address?.city || person.formattedAddress) && (
                                    <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                      <MapPin className="w-3 h-3 text-[#8A6D36]" />
                                      {person.address?.city || person.formattedAddress}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {sourceView === 'contacts' && person.resourceName ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStartEditContact(person)}
                                    className="h-8 px-2.5 rounded-lg border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-xs font-medium flex items-center gap-1"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#8A6D36]" />
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRequestDeleteContact(person)}
                                    className="h-8 px-2.5 rounded-lg border-[#E5E2DC] bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-[#6B6B6B]"
                                    title="Excluir contato do Google"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartCopyToGoogleContacts(person)}
                                  className="h-8 px-2.5 rounded-lg border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-xs font-medium flex items-center gap-1"
                                >
                                  <UserPlus className="w-3.5 h-3.5 text-[#8A6D36]" />
                                  Salvar em Contatos
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {activeNextPageToken && (
                        <div className="pt-2 flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={loadingMore}
                            onClick={() =>
                              loadSourceData(
                                sourceView,
                                googleSearchInput,
                                activeNextPageToken
                              )
                            }
                            className="h-9 px-4 rounded-xl border-[#E5E2DC] text-xs font-semibold"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                Carregando mais...
                              </>
                            ) : (
                              'Carregar mais contatos'
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: EXPORT CLIENTS TO GOOGLE CONTACTS */}
              <TabsContent
                value="export"
                className="flex-1 min-h-0 flex flex-col m-0 overflow-hidden"
              >
                {clients.length === 0 ? (
                  <div className="p-8 text-center space-y-3 bg-[#FAF9F7] m-6 rounded-2xl border border-[#E5E2DC]">
                    <Users className="w-8 h-8 text-[#8A6D36] mx-auto opacity-70" />
                    <h4 className="text-sm font-bold text-[#171717]">
                      Envio em lote disponível na tela de Clientes
                    </h4>
                    <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
                      Para enviar vários clientes do seu salão para o Google Contatos de uma só vez, abra o botão "Google Contatos" dentro de Clientes ou salve um cliente individual pela ficha dele.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 sm:px-6 py-3 border-b border-[#E5E2DC] bg-[#FAF9F7]/70 space-y-3 shrink-0">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                        <div className="relative flex-1 sm:max-w-sm">
                          <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <Input
                            value={clientExportSearch}
                            onChange={(e) => setClientExportSearch(e.target.value)}
                            placeholder="Filtrar clientes do salão..."
                            className="h-9 pl-8 text-xs bg-white border-[#E5E2DC] rounded-xl"
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSelectUnsyncedClients}
                            className="h-9 text-xs font-semibold rounded-xl border-[#E5E2DC] bg-white"
                          >
                            Selecionar não sincronizados
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={selectedExportClientIds.length === 0 || isBatchExporting}
                            onClick={handleRequestBatchExport}
                            className="h-9 px-4 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            {isBatchExporting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            Enviar p/ Google ({selectedExportClientIds.length})
                          </Button>
                        </div>
                      </div>

                      {isBatchExporting && batchProgress.total > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold text-[#6B6B6B]">
                            <span>Enviando contatos para o Google...</span>
                            <span>
                              {batchProgress.current} / {batchProgress.total}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#E5E2DC] overflow-hidden">
                            <div
                              className="h-full bg-[#B89B5E] transition-all"
                              style={{
                                width: `${Math.round(
                                  (batchProgress.current / batchProgress.total) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-white">
                      {exportableClients.length === 0 ? (
                        <div className="py-10 text-center text-xs text-[#6B6B6B]">
                          Nenhum cliente ativo com telefone ou e-mail encontrado.
                        </div>
                      ) : (
                        exportableClients.map((client) => {
                          const isChecked = selectedExportClientIds.includes(client.id);
                          const alreadySynced = syncedClientIdsInGoogle.has(client.id);

                          return (
                            <div
                              key={client.id}
                              onClick={() =>
                                setSelectedExportClientIds((prev) =>
                                  prev.includes(client.id)
                                    ? prev.filter((id) => id !== client.id)
                                    : [...prev, client.id]
                                )
                              }
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                isChecked
                                  ? 'border-[#B89B5E] bg-[#FAF7F0]'
                                  : 'border-[#E5E2DC] bg-white hover:bg-[#FAF9F7]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                    isChecked
                                      ? 'bg-[#171717] border-[#171717] text-white'
                                      : 'bg-white border-[#D6D2CA]'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-[#171717] truncate">
                                      {client.name}
                                    </span>
                                    {alreadySynced && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                                        <CheckCircle2 className="w-3 h-3" /> Já no Google
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#6B6B6B] mt-0.5">
                                    {client.phone && <span>{client.phone}</span>}
                                    {client.email && <span>{client.email}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* TAB 3: CREATE / EDIT GOOGLE CONTACT FORM */}
              <TabsContent
                value="form"
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 m-0 bg-white"
              >
                <form onSubmit={handleFormSubmit} className="space-y-4 max-w-2xl mx-auto">
                  {editingTarget && (
                    <div className="p-3 rounded-xl bg-[#F5F1E9] border border-[#D4AF37]/30 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#7A5E29]">
                        Editando contato existente do Google Contatos
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingTarget(null);
                          setFormValues(EMPTY_FORM);
                          setFormErrors({});
                        }}
                        className="h-7 text-xs text-[#7A5E29]"
                      >
                        Cancelar edição
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="gc-name" className="text-xs font-semibold text-[#171717]">
                        Nome completo *
                      </Label>
                      <Input
                        id="gc-name"
                        value={formValues.displayName}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, displayName: e.target.value }))
                        }
                        placeholder="Ex: Maria Clara Oliveira"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                      {formErrors.displayName && (
                        <p className="text-[11px] text-red-600">{formErrors.displayName}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-phone" className="text-xs font-semibold text-[#171717]">
                        Telefone / WhatsApp
                      </Label>
                      <Input
                        id="gc-phone"
                        value={formValues.phone || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="(11) 99999-9999"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-email" className="text-xs font-semibold text-[#171717]">
                        E-mail
                      </Label>
                      <Input
                        id="gc-email"
                        type="email"
                        value={formValues.email || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="cliente@email.com"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                      {formErrors.email && (
                        <p className="text-[11px] text-red-600">{formErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-bday" className="text-xs font-semibold text-[#171717]">
                        Data de aniversário
                      </Label>
                      <Input
                        id="gc-bday"
                        type="date"
                        value={formValues.birthDate || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, birthDate: e.target.value }))
                        }
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                      {formErrors.birthDate && (
                        <p className="text-[11px] text-red-600">{formErrors.birthDate}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#171717]">Gênero</Label>
                      <Select
                        value={formValues.gender || 'none'}
                        onValueChange={(val) =>
                          setFormValues((prev) => ({
                            ...prev,
                            gender:
                              val === 'none'
                                ? ''
                                : (val as GoogleContactFormInput['gender']),
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]">
                          <SelectValue placeholder="Selecionar gênero" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefiro não dizer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-org" className="text-xs font-semibold text-[#171717]">
                        Empresa / Etiqueta
                      </Label>
                      <Input
                        id="gc-org"
                        value={formValues.organization || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, organization: e.target.value }))
                        }
                        placeholder={salonName ? `Cliente · ${salonName}` : 'Ex: Cliente VIP'}
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-job" className="text-xs font-semibold text-[#171717]">
                        Cargo / Profissão
                      </Label>
                      <Input
                        id="gc-job"
                        value={formValues.jobTitle || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, jobTitle: e.target.value }))
                        }
                        placeholder="Ex: Empresária"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="gc-street" className="text-xs font-semibold text-[#171717]">
                        Endereço
                      </Label>
                      <Input
                        id="gc-street"
                        value={formValues.street || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, street: e.target.value }))
                        }
                        placeholder="Rua, número e bairro"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gc-city" className="text-xs font-semibold text-[#171717]">
                        Cidade
                      </Label>
                      <Input
                        id="gc-city"
                        value={formValues.city || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, city: e.target.value }))
                        }
                        placeholder="Cidade"
                        className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="gc-state" className="text-xs font-semibold text-[#171717]">
                          UF
                        </Label>
                        <Input
                          id="gc-state"
                          value={formValues.state || ''}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, state: e.target.value }))
                          }
                          placeholder="SP"
                          className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="gc-zip" className="text-xs font-semibold text-[#171717]">
                          CEP
                        </Label>
                        <Input
                          id="gc-zip"
                          value={formValues.zipCode || ''}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, zipCode: e.target.value }))
                          }
                          placeholder="00000-000"
                          className="h-10 rounded-xl border-[#E5E2DC] bg-[#FAF9F7]"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="gc-notes" className="text-xs font-semibold text-[#171717]">
                        Observações
                      </Label>
                      <Textarea
                        id="gc-notes"
                        rows={3}
                        value={formValues.notes || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        placeholder="Preferências de atendimento, observações ou histórico resumido..."
                        className="rounded-xl border-[#E5E2DC] bg-[#FAF9F7] text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#E5E2DC]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingTarget(null);
                        setFormValues(EMPTY_FORM);
                        setActiveTab('google');
                      }}
                      className="h-10 rounded-xl border-[#E5E2DC]"
                    >
                      Voltar para lista
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingForm}
                      className="h-10 px-5 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-semibold"
                    >
                      {isSavingForm ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          Salvando...
                        </>
                      ) : editingTarget ? (
                        'Revisar e Atualizar no Google'
                      ) : (
                        'Revisar e Salvar no Google'
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <WorkspaceConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isConfirmExecuting) {
            setPendingAction(null);
          }
        }}
        details={pendingAction?.confirmDetails || null}
        loading={isConfirmExecuting}
        onConfirm={handleConfirmExecute}
      />
    </>
  );
}
