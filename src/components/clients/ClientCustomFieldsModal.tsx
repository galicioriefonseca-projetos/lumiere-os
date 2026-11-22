import React, { useEffect, useMemo, useState } from 'react';
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
  Edit2,
  Eye,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ClientCustomField, ClientCustomFieldType, ClientFormScope } from '@/types';
import {
  BEAUTY_FORM_PRESETS,
  deleteClientCustomField,
  saveClientCustomField,
  slugifyFieldName,
} from '@/services/clientsService';
import { DynamicFormFieldsRenderer } from './DynamicFormFieldsRenderer';
import { cn } from '@/lib/utils';

interface ClientCustomFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  initialScope: ClientFormScope;
  fields: ClientCustomField[];
}

const FIELD_TYPE_LABELS: Record<ClientCustomFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  select: 'Lista de seleção',
  boolean: 'Sim / Não',
};

export const ClientCustomFieldsModal: React.FC<ClientCustomFieldsModalProps> = ({
  open,
  onOpenChange,
  salonId,
  initialScope,
  fields,
}) => {
  const [scope, setScope] = useState<ClientFormScope>(initialScope);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<ClientCustomField | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // Field builder form state
  const [label, setLabel] = useState('');
  const [order, setOrder] = useState('1');
  const [type, setType] = useState<ClientCustomFieldType>('text');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (open) {
      setScope(initialScope);
      setEditorOpen(false);
      setEditingField(null);
    }
  }, [open, initialScope]);

  const scopedFields = useMemo(
    () =>
      fields
        .filter((f) => f.scope === scope)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt),
    [fields, scope]
  );

  const openNewFieldEditor = () => {
    setEditingField(null);
    setLabel('');
    setOrder(String(scopedFields.length + 1));
    setType('text');
    setSlug('');
    setSlugTouched(false);
    setDefaultValue('');
    setPlaceholder('');
    setOptionsText('');
    setRequired(false);
    setEditorOpen(true);
  };

  const openEditFieldEditor = (field: ClientCustomField) => {
    setEditingField(field);
    setLabel(field.label);
    setOrder(String(field.order ?? 1));
    setType(field.type);
    setSlug(field.slug);
    setSlugTouched(true);
    setDefaultValue(field.defaultValue || '');
    setPlaceholder(field.placeholder || '');
    setOptionsText((field.options || []).join(', '));
    setRequired(Boolean(field.required));
    setEditorOpen(true);
  };

  const handleLabelChange = (nextLabel: string) => {
    setLabel(nextLabel);
    if (!slugTouched) {
      setSlug(slugifyFieldName(nextLabel));
    }
  };

  const previewField: ClientCustomField = useMemo(
    () => ({
      id: 'preview',
      scope,
      label: label.trim() || 'Pré-visualização do campo',
      slug: slug.trim() || 'preview_campo',
      type,
      order: Number(order) || 1,
      defaultValue,
      placeholder: placeholder || defaultValue || 'Exemplo de preenchimento...',
      options: optionsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      required,
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    }),
    [scope, label, slug, type, order, defaultValue, placeholder, optionsText, required]
  );

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    if (!label.trim()) {
      toast.error('Informe o nome do campo.');
      return;
    }
    if (type === 'select' && (previewField.options || []).length === 0) {
      toast.error('Informe ao menos uma opção separada por vírgula para listas de seleção.');
      return;
    }

    setSaving(true);
    try {
      await saveClientCustomField(salonId, {
        id: editingField?.id,
        createdAt: editingField?.createdAt,
        scope,
        label: label.trim(),
        slug: slug.trim() || slugifyFieldName(label),
        type,
        order: Number(order) || 0,
        defaultValue: defaultValue.trim(),
        placeholder: placeholder.trim(),
        options: previewField.options,
        required,
        isActive: true,
      });
      toast.success(editingField ? 'Campo atualizado com sucesso!' : 'Novo campo adicionado!');
      setEditorOpen(false);
      setEditingField(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar campo da ficha.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (field: ClientCustomField) => {
    if (!salonId) return;
    if (!window.confirm(`Deseja remover o campo "${field.label}"?`)) return;
    try {
      await deleteClientCustomField(salonId, field.id);
      toast.success('Campo removido.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir campo.');
    }
  };

  const handleApplyPresets = async () => {
    if (!salonId) return;
    const presets = BEAUTY_FORM_PRESETS[scope];
    const existingSlugs = new Set(scopedFields.map((f) => f.slug));
    const missing = presets.filter((p) => !existingSlugs.has(p.slug));
    if (missing.length === 0) {
      toast.info('Todos os campos do modelo padrão já estão configurados nesta ficha.');
      return;
    }

    setApplyingPreset(true);
    try {
      for (let i = 0; i < missing.length; i++) {
        await saveClientCustomField(salonId, {
          ...missing[i],
          order: scopedFields.length + i + 1,
        });
      }
      toast.success(`${missing.length} campos essenciais adicionados à ficha!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao aplicar modelo padrão.');
    } finally {
      setApplyingPreset(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] bg-[#0c0c0e] border border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 bg-[#121215] shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="font-heading text-lg font-medium text-white flex items-center gap-2">
                {scope === 'anamnese' ? (
                  <ClipboardList className="w-5 h-5 text-[#D4AF37]" />
                ) : (
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                )}
                Configuração de Ficha — {scope === 'anamnese' ? 'Anamnese' : 'Prontuário'}
              </DialogTitle>
              <p className="text-xs text-zinc-400 mt-1">
                {scope === 'anamnese'
                  ? 'Personalize as perguntas de saúde, alergias e histórico exibidas no cadastro do cliente.'
                  : 'Personalize os campos técnicos de fórmulas, diagnósticos e protocolos registrados no atendimento.'}
              </p>
            </div>

            <div className="bg-[#0c0c0e] border border-zinc-800 rounded-lg p-1 flex items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScope('anamnese');
                  setEditorOpen(false);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                  scope === 'anamnese'
                    ? 'bg-[#D4AF37] text-black'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                Anamnese
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('prontuario');
                  setEditorOpen(false);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                  scope === 'prontuario'
                    ? 'bg-[#D4AF37] text-black'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                Prontuário
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {editorOpen ? (
            <form onSubmit={handleSaveField} className="space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h4 className="text-sm font-semibold text-[#D4AF37]">
                  {editingField ? 'Editar Campo Personalizado' : 'Novo Campo Personalizado'}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditorOpen(false);
                    setEditingField(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Voltar para a lista
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-9 space-y-1.5">
                      <Label className="text-xs text-zinc-300">
                        Nome do Campo <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        required
                        value={label}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        placeholder="Ex: Alergia a produtos químicos"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-xs text-zinc-300">Ordem</Label>
                      <Input
                        type="number"
                        min={0}
                        value={order}
                        onChange={(e) => setOrder(e.target.value)}
                        className="bg-[#121215] border-zinc-800 text-white tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-300">Tipo do Campo</Label>
                      <Select
                        value={type}
                        onValueChange={(v: ClientCustomFieldType) => setType(v)}
                      >
                        <SelectTrigger className="bg-[#121215] border-zinc-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                          {(Object.keys(FIELD_TYPE_LABELS) as ClientCustomFieldType[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {FIELD_TYPE_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-300">Nome Interno (slug)</Label>
                      <Input
                        value={slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setSlug(slugifyFieldName(e.target.value));
                        }}
                        placeholder="ex: alergia_produtos"
                        className="bg-[#121215] border-zinc-800 text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  {type === 'select' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-300">
                        Opções da Lista (separadas por vírgula) <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                        placeholder="Ex: Nenhuma, Coloração, Descoloração, Progressiva"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-300">Valor Padrão (opcional)</Label>
                      <Input
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                        placeholder="Valor exibido por padrão"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-300">Dica / Placeholder (opcional)</Label>
                      <Input
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        placeholder="Texto guia dentro do campo"
                        className="bg-[#121215] border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={required}
                      onChange={(e) => setRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-700 accent-[#D4AF37]"
                    />
                    Tornar preenchimento obrigatório ao salvar ficha
                  </label>
                </div>

                {/* Live Interactive Preview */}
                <div className="md:col-span-4 bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Pré-visualização ao vivo
                    </div>
                    <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-lg p-3">
                      <DynamicFormFieldsRenderer
                        fields={[previewField]}
                        values={{ [previewField.slug]: defaultValue }}
                        onChange={() => {}}
                        theme="dark"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Assim o campo aparecerá na ficha do cliente.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditorOpen(false);
                    setEditingField(null);
                  }}
                  className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold px-6"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Salvar Campo
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  onClick={openNewFieldEditor}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-9 px-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Adicionar Campo
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={applyingPreset}
                  onClick={handleApplyPresets}
                  className="border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-zinc-200 text-xs h-9 px-3.5"
                >
                  {applyingPreset ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
                  )}
                  Aplicar Modelo Padrão ({scope === 'anamnese' ? 'Anamnese' : 'Prontuário'})
                </Button>
              </div>

              {scopedFields.length === 0 ? (
                <div className="bg-[#121215] border border-zinc-800 rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-zinc-200">
                    Nenhum campo personalizado cadastrado nesta ficha
                  </p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Adicione perguntas personalizadas ou clique em "Aplicar Modelo Padrão" acima para começar imediatamente com perguntas prontas para salão e estética.
                  </p>
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#121215]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#18181c] border-b border-zinc-800 text-zinc-400 font-semibold">
                        <th className="p-3 w-16 text-center">Ordem</th>
                        <th className="p-3">Campo</th>
                        <th className="p-3">Slug interno</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 w-24 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {scopedFields.map((field) => (
                        <tr key={field.id} className="hover:bg-zinc-900/50">
                          <td className="p-3 text-center font-mono text-zinc-400 tabular-nums">
                            {field.order}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-zinc-100">{field.label}</span>
                            {field.required && (
                              <span className="ml-2 text-[10px] text-rose-400 font-medium">
                                Obrigatório
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-zinc-400">{field.slug}</td>
                          <td className="p-3 text-zinc-300">
                            {FIELD_TYPE_LABELS[field.type] || field.type}
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditFieldEditor(field)}
                                className="h-7 w-7 text-zinc-400 hover:text-[#D4AF37]"
                                title="Editar campo"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteField(field)}
                                className="h-7 w-7 text-zinc-400 hover:text-rose-400"
                                title="Remover campo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
