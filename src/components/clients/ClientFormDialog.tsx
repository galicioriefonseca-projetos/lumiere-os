import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  Client,
  ClientAddress,
  ClientCustomField,
  ClientFormResponseValue,
} from '@/types';
import { CLIENT_GENDER_OPTIONS, normalizeClientGender } from '@/lib/clientGender';
import { lookupBrazilianCep } from '@/services/clientsService';
import { DynamicFormFieldsRenderer } from './DynamicFormFieldsRenderer';
import { cn } from '@/lib/utils';

export interface ClientFormSavePayload {
  name: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  gender: string;
  birthDate: string;
  cpf: string;
  rg: string;
  address: ClientAddress;
  notes: string;
  crmStage: NonNullable<Client['crmStage']>;
  source: NonNullable<Client['source']>;
  sourceLabel: string;
  responsibleId: string;
  tags: string[];
  anamneseResponses: Record<string, ClientFormResponseValue>;
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient: Client | null;
  initialCrmStage?: Client['crmStage'];
  professionals: Array<{ id: string; name: string }>;
  anamneseFields: ClientCustomField[];
  onOpenAnamneseConfig: () => void;
  onSave: (payload: ClientFormSavePayload) => Promise<void>;
}

type FormTab = 'main' | 'address' | 'anamnese' | 'crm';

export const ClientFormDialog: React.FC<ClientFormDialogProps> = ({
  open,
  onOpenChange,
  editingClient,
  initialCrmStage = 'new',
  professionals,
  anamneseFields,
  onOpenAnamneseConfig,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<FormTab>('main');
  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('none');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');

  const [address, setAddress] = useState<ClientAddress>({
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  const [crmStage, setCrmStage] = useState<NonNullable<Client['crmStage']>>('new');
  const [source, setSource] = useState<NonNullable<Client['source']>>('whatsapp');
  const [sourceLabel, setSourceLabel] = useState('');
  const [responsibleId, setResponsibleId] = useState('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [anamneseResponses, setAnamneseResponses] = useState<Record<string, ClientFormResponseValue>>(
    {}
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab('main');
    if (editingClient) {
      setName(editingClient.name || '');
      setPhone(editingClient.phone || '');
      setSecondaryPhone(editingClient.secondaryPhone || '');
      setEmail(editingClient.email || '');
      setGender(normalizeClientGender(editingClient.gender) || 'none');
      setBirthDate(editingClient.birthDate || '');
      setCpf(editingClient.cpf || '');
      setRg(editingClient.rg || '');
      setAddress({
        zipCode: editingClient.address?.zipCode || '',
        street: editingClient.address?.street || '',
        number: editingClient.address?.number || '',
        complement: editingClient.address?.complement || '',
        neighborhood: editingClient.address?.neighborhood || '',
        city: editingClient.address?.city || '',
        state: editingClient.address?.state || '',
      });
      setCrmStage(editingClient.crmStage || 'new');
      setSource(editingClient.source || 'whatsapp');
      setSourceLabel(editingClient.sourceLabel || '');
      setResponsibleId(editingClient.responsibleId || 'none');
      setTags(Array.isArray(editingClient.tags) ? editingClient.tags : []);
      setNotes(editingClient.notes || '');
      setAnamneseResponses(editingClient.anamneseResponses || {});
    } else {
      setName('');
      setPhone('');
      setSecondaryPhone('');
      setEmail('');
      setGender('none');
      setBirthDate('');
      setCpf('');
      setRg('');
      setAddress({
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
      });
      setCrmStage(initialCrmStage || 'new');
      setSource('whatsapp');
      setSourceLabel('');
      setResponsibleId('none');
      setTags([]);
      setNotes('');
      setAnamneseResponses({});
    }
    setTagInput('');
  }, [open, editingClient, initialCrmStage]);

  const handleCepLookup = async () => {
    const cep = address.zipCode || '';
    if (cep.replace(/\D/g, '').length !== 8) {
      toast.error('Informe um CEP com 8 dígitos para buscar o endereço.');
      return;
    }
    setSearchingCep(true);
    try {
      const found = await lookupBrazilianCep(cep);
      if (!found) {
        toast.error('CEP não localizado. Preencha o endereço manualmente.');
        return;
      }
      setAddress((prev) => ({
        ...prev,
        zipCode: found.zipCode || prev.zipCode,
        street: found.street || prev.street,
        neighborhood: found.neighborhood || prev.neighborhood,
        city: found.city || prev.city,
        state: found.state || prev.state,
      }));
      toast.success('Endereço preenchido pelo CEP!');
    } finally {
      setSearchingCep(false);
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('main');
      toast.error('Informe o nome completo do cliente.');
      return;
    }
    if (!phone.trim()) {
      setActiveTab('main');
      toast.error('Informe o celular / WhatsApp do cliente.');
      return;
    }

    // Validate required anamnese fields
    const activeAnamnese = anamneseFields.filter((f) => f.isActive !== false && f.required);
    for (const reqField of activeAnamnese) {
      const val = anamneseResponses[reqField.slug] ?? reqField.defaultValue;
      if (val === undefined || val === null || String(val).trim() === '') {
        setActiveTab('anamnese');
        toast.error(`Preencha o campo obrigatório da Anamnese: "${reqField.label}".`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        secondaryPhone: secondaryPhone.trim(),
        email: email.trim(),
        gender: gender === 'none' ? '' : gender,
        birthDate: birthDate.trim(),
        cpf: cpf.trim(),
        rg: rg.trim(),
        address,
        notes: notes.trim(),
        crmStage,
        source,
        sourceLabel: sourceLabel.trim(),
        responsibleId,
        tags,
        anamneseResponses,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const activeAnamneseCount = anamneseFields.filter((f) => f.isActive !== false).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] bg-[#0c0c0e] border border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-0 border-b border-zinc-800 bg-[#121215] shrink-0">
          <DialogTitle className="font-heading text-lg font-medium text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#D4AF37]" />
            {editingClient ? 'Editar Cadastro 360° do Cliente' : 'Cadastrar Novo Cliente'}
          </DialogTitle>

          {/* Navigation tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-px overflow-x-auto">
            {(
              [
                { id: 'main', label: 'Dados Principais', icon: User },
                { id: 'address', label: 'Endereço & Docs', icon: MapPin },
                {
                  id: 'anamnese',
                  label: `Anamnese${activeAnamneseCount > 0 ? ` (${activeAnamneseCount})` : ''}`,
                  icon: ClipboardList,
                },
                { id: 'crm', label: 'CRM & Notas', icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isActive
                      ? 'border-[#D4AF37] text-white bg-[#0c0c0e] rounded-t-lg'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-5 flex-1">
            {activeTab === 'main' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8 space-y-1.5">
                    <Label htmlFor="cli-name" className="text-xs text-zinc-300">
                      Nome completo <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="cli-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome conforme documento"
                      className="bg-[#121215] border-zinc-800 text-white"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1.5">
                    <Label htmlFor="cli-birth" className="text-xs text-zinc-300">
                      Data de Aniversário
                    </Label>
                    <Input
                      id="cli-birth"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="bg-[#121215] border-zinc-800 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-phone" className="text-xs text-zinc-300">
                      Celular / WhatsApp <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="cli-phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="bg-[#121215] border-zinc-800 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-sec-phone" className="text-xs text-zinc-300">
                      Telefone Secundário (Opcional)
                    </Label>
                    <Input
                      id="cli-sec-phone"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="bg-[#121215] border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cli-email" className="text-xs text-zinc-300">
                    E-mail (Opcional)
                  </Label>
                  <Input
                    id="cli-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@exemplo.com"
                    className="bg-[#121215] border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-zinc-300">Gênero</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('none')}
                      className={cn(
                        'py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer',
                        gender === 'none'
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      )}
                    >
                      Não informar
                    </button>
                    {CLIENT_GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGender(opt.value)}
                        className={cn(
                          'py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer truncate',
                          gender === opt.value
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                            : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-cpf" className="text-xs text-zinc-300">
                      CPF
                    </Label>
                    <Input
                      id="cli-cpf"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="bg-[#121215] border-zinc-800 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-rg" className="text-xs text-zinc-300">
                      RG
                    </Label>
                    <Input
                      id="cli-rg"
                      value={rg}
                      onChange={(e) => setRg(e.target.value)}
                      placeholder="00.000.000-0"
                      className="bg-[#121215] border-zinc-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5 space-y-1.5">
                      <Label htmlFor="cli-cep" className="text-xs text-zinc-300">
                        CEP
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="cli-cep"
                          value={address.zipCode || ''}
                          onChange={(e) =>
                            setAddress((prev) => ({ ...prev, zipCode: e.target.value }))
                          }
                          placeholder="00000-000"
                          className="bg-[#121215] border-zinc-800 text-white font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={searchingCep}
                          onClick={handleCepLookup}
                          className="border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-zinc-200 px-3 shrink-0"
                          title="Buscar endereço automático pelo CEP"
                        >
                          {searchingCep ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4 text-[#D4AF37]" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="sm:col-span-5 space-y-1.5">
                      <Label htmlFor="cli-city" className="text-xs text-zinc-300">
                        Cidade
                      </Label>
                      <Input
                        id="cli-city"
                        value={address.city || ''}
                        onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                        placeholder="Ex: Sorocaba"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="cli-state" className="text-xs text-zinc-300">
                        UF
                      </Label>
                      <Input
                        id="cli-state"
                        maxLength={2}
                        value={address.state || ''}
                        onChange={(e) =>
                          setAddress((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))
                        }
                        placeholder="SP"
                        className="bg-[#121215] border-zinc-800 text-white uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8 space-y-1.5">
                      <Label htmlFor="cli-street" className="text-xs text-zinc-300">
                        Logradouro / Endereço
                      </Label>
                      <Input
                        id="cli-street"
                        value={address.street || ''}
                        onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                        placeholder="Rua, Avenida..."
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1.5">
                      <Label htmlFor="cli-num" className="text-xs text-zinc-300">
                        Número
                      </Label>
                      <Input
                        id="cli-num"
                        value={address.number || ''}
                        onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
                        placeholder="123"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cli-neighborhood" className="text-xs text-zinc-300">
                        Bairro
                      </Label>
                      <Input
                        id="cli-neighborhood"
                        value={address.neighborhood || ''}
                        onChange={(e) =>
                          setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))
                        }
                        placeholder="Bairro"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cli-comp" className="text-xs text-zinc-300">
                        Complemento
                      </Label>
                      <Input
                        id="cli-comp"
                        value={address.complement || ''}
                        onChange={(e) =>
                          setAddress((prev) => ({ ...prev, complement: e.target.value }))
                        }
                        placeholder="Apto, Bloco, Sala..."
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'anamnese' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                      Ficha de Anamnese do Cliente
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Campos configuráveis para alergias, histórico químico e restrições clínicas.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenAnamneseConfig}
                    className="border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-xs text-zinc-200 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
                    Configurar Campos
                  </Button>
                </div>

                {activeAnamneseCount === 0 ? (
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-6 text-center space-y-3">
                    <ClipboardList className="w-8 h-8 text-zinc-500 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-200">
                        Nenhum campo configurado na Anamnese ainda
                      </p>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Personalize sua ficha de Anamnese ou aplique os modelos prontos de beleza e estética em 1 clique.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={onOpenAnamneseConfig}
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-9 px-4"
                    >
                      Configurar Ficha de Anamnese
                    </Button>
                  </div>
                ) : (
                  <DynamicFormFieldsRenderer
                    fields={anamneseFields}
                    values={anamneseResponses}
                    onChange={(slug, val) =>
                      setAnamneseResponses((prev) => ({ ...prev, [slug]: val }))
                    }
                    theme="dark"
                  />
                )}
              </div>
            )}

            {activeTab === 'crm' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-300">Etapa no Pipeline CRM</Label>
                    <Select
                      value={crmStage}
                      onValueChange={(val: NonNullable<Client['crmStage']>) => setCrmStage(val)}
                    >
                      <SelectTrigger className="bg-[#121215] border-zinc-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121215] border-zinc-800 text-white">
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-300">Origem do Contato</Label>
                    <Select
                      value={source}
                      onValueChange={(val: NonNullable<Client['source']>) => setSource(val)}
                    >
                      <SelectTrigger className="bg-[#121215] border-zinc-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121215] border-zinc-800 text-white">
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

                {source === 'other' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-300">Descrição da Origem</Label>
                    <Input
                      value={sourceLabel}
                      onChange={(e) => setSourceLabel(e.target.value)}
                      placeholder="Ex: Evento local, Parceria..."
                      className="bg-[#121215] border-zinc-800 text-white"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Responsável pelo Acompanhamento</Label>
                  <Select value={responsibleId} onValueChange={setResponsibleId}>
                    <SelectTrigger className="bg-[#121215] border-zinc-800 text-white">
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                      <SelectItem value="none">Nenhum (Livre na recepção)</SelectItem>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Tags / Grupos de Segmentação</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Ex: loira, vip, alergica..."
                      className="bg-[#121215] border-zinc-800 text-white flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      className="border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-zinc-200"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                          className="inline-flex items-center gap-1 bg-[#1b1b22] border border-[#D4AF37]/30 text-[#D4AF37] px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                          title="Clique para remover tag"
                        >
                          #{tag}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cli-notes" className="text-xs text-zinc-300">
                    Observações Gerais e Preferências
                  </Label>
                  <textarea
                    id="cli-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Preferências de café, alergias rápidas, observações de atendimento..."
                    className="w-full rounded-lg border border-zinc-800 bg-[#121215] p-3 text-sm text-zinc-100 focus:outline-none focus:border-[#D4AF37]/60"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-zinc-800 bg-[#121215] flex items-center justify-between gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : editingClient ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Cliente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
