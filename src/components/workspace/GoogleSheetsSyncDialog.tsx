import React, { useEffect, useState } from 'react';
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
import {
  SheetCellValue,
  SpreadsheetMetadata,
  WorkspaceAuthError,
  appendRowsToSpreadsheet,
  createGoogleSpreadsheetWithData,
  overwriteSpreadsheetTab,
  readSpreadsheetTabValues,
  subscribeWorkspaceAuth,
  trashDriveSpreadsheet,
} from '@/services/googleWorkspaceService';
import { GoogleSheetsPicker } from './GoogleSheetsPicker';
import {
  WorkspaceConfirmDetails,
  WorkspaceConfirmDialog,
} from './WorkspaceConfirmDialog';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleSheetsSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSpreadsheetTitle: string;
  defaultSheetTabTitle?: string;
  datasetLabel: string;
  headers: string[];
  rows: SheetCellValue[][];
}

type ExportDestination = 'new' | 'existing';
type ExistingWriteMode = 'append' | 'overwrite';

interface PendingAction {
  confirmDetails: WorkspaceConfirmDetails;
  execute: () => Promise<void>;
}

export function GoogleSheetsSyncDialog({
  open,
  onOpenChange,
  defaultSpreadsheetTitle,
  defaultSheetTabTitle = 'Dados',
  datasetLabel,
  headers,
  rows,
}: GoogleSheetsSyncDialogProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'browse'>('export');
  const [isConnected, setIsConnected] = useState(false);

  // Export state
  const [destination, setDestination] = useState<ExportDestination>('new');
  const [newSpreadsheetTitle, setNewSpreadsheetTitle] = useState(defaultSpreadsheetTitle);
  const [newTabTitle, setNewTabTitle] = useState(defaultSheetTabTitle);

  const [targetSpreadsheet, setTargetSpreadsheet] = useState<SpreadsheetMetadata | null>(null);
  const [targetSheetTab, setTargetSheetTab] = useState('');
  const [existingWriteMode, setExistingWriteMode] = useState<ExistingWriteMode>('append');
  const [includeHeaderOnAppend, setIncludeHeaderOnAppend] = useState(false);

  // Browse / preview state
  const [browseSpreadsheet, setBrowseSpreadsheet] = useState<SpreadsheetMetadata | null>(null);
  const [browseSheetTab, setBrowseSheetTab] = useState('');
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Confirmation & submission state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [lastResultUrl, setLastResultUrl] = useState<string | null>(null);
  const [lastResultTitle, setLastResultTitle] = useState<string | null>(null);

  useEffect(() => {
    return subscribeWorkspaceAuth((state) => {
      setIsConnected(state.isConnected);
    });
  }, []);

  useEffect(() => {
    if (open) {
      setNewSpreadsheetTitle(defaultSpreadsheetTitle);
      setNewTabTitle(defaultSheetTabTitle);
      setLastResultUrl(null);
      setLastResultTitle(null);
    }
  }, [open, defaultSpreadsheetTitle, defaultSheetTabTitle]);

  const handleLoadPreview = async (metadata: SpreadsheetMetadata, tabTitle: string) => {
    setIsLoadingPreview(true);
    try {
      const data = await readSpreadsheetTabValues(metadata.spreadsheetId, tabTitle);
      setPreviewHeaders(data.headers);
      setPreviewRows(data.rows);
      if (data.headers.length === 0) {
        toast.info(`A aba "${tabTitle}" está vazia no momento.`);
      }
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar visualização da aba.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRequestExport = () => {
    if (rows.length === 0) {
      toast.warning('Não há registros disponíveis no momento para enviar ao Google Sheets.');
      return;
    }

    if (destination === 'new') {
      const cleanTitle = newSpreadsheetTitle.trim() || defaultSpreadsheetTitle;
      const cleanTab = newTabTitle.trim() || defaultSheetTabTitle;

      setPendingAction({
        confirmDetails: {
          title: 'Confirmar criação no Google Sheets',
          description: `Uma nova planilha será criada no seu Google Drive com ${rows.length} ${
            rows.length === 1 ? 'linha de dados' : 'linhas de dados'
          } (${datasetLabel}).`,
          targetName: cleanTitle,
          sheetTabName: cleanTab,
          affectedCountLabel: `${rows.length} registros + cabeçalho`,
          confirmLabel: 'Criar e Enviar Planilha',
        },
        execute: async () => {
          const result = await createGoogleSpreadsheetWithData({
            title: cleanTitle,
            sheetTitle: cleanTab,
            values: [headers, ...rows],
          });
          setLastResultUrl(result.spreadsheetUrl);
          setLastResultTitle(result.title);
          toast.success(`Planilha "${result.title}" criada no Google Sheets!`);
        },
      });
      return;
    }

    if (!targetSpreadsheet || !targetSheetTab) {
      toast.warning('Selecione uma planilha e a aba de destino no Google Drive.');
      return;
    }

    if (existingWriteMode === 'append') {
      const payload = includeHeaderOnAppend ? [headers, ...rows] : rows;
      setPendingAction({
        confirmDetails: {
          title: 'Confirmar envio de linhas para o Google Sheets',
          description: `Novas linhas serão adicionadas ao final da aba selecionada sem apagar os dados existentes.`,
          targetName: targetSpreadsheet.title,
          sheetTabName: targetSheetTab,
          affectedCountLabel: `${rows.length} novas linhas (${datasetLabel})`,
          confirmLabel: 'Acrescentar Linhas',
        },
        execute: async () => {
          const result = await appendRowsToSpreadsheet({
            spreadsheetId: targetSpreadsheet.spreadsheetId,
            sheetTitle: targetSheetTab,
            values: payload,
          });
          setLastResultUrl(result.spreadsheetUrl);
          setLastResultTitle(targetSpreadsheet.title);
          toast.success(`${result.updatedRows} linha(s) adicionada(s) em "${targetSpreadsheet.title}"!`);
        },
      });
      return;
    }

    setPendingAction({
      confirmDetails: {
        title: 'Confirmar substituição de aba no Google Sheets',
        description: `Todo o conteúdo atual da aba "${targetSheetTab}" será substituído pelos novos dados de ${datasetLabel}.`,
        targetName: targetSpreadsheet.title,
        sheetTabName: targetSheetTab,
        affectedCountLabel: `${rows.length} registros + cabeçalho`,
        warningText:
          'Atenção: os dados atuais das colunas A:Z nesta aba serão apagados antes da gravação.',
        confirmLabel: 'Substituir Conteúdo da Aba',
        destructive: true,
      },
      execute: async () => {
        const result = await overwriteSpreadsheetTab({
          spreadsheetId: targetSpreadsheet.spreadsheetId,
          sheetTitle: targetSheetTab,
          values: [headers, ...rows],
        });
        setLastResultUrl(result.spreadsheetUrl);
        setLastResultTitle(targetSpreadsheet.title);
        toast.success(`Aba "${targetSheetTab}" atualizada com sucesso no Google Sheets!`);
      },
    });
  };

  const handleRequestTrash = (spreadsheet: SpreadsheetMetadata) => {
    setPendingAction({
      confirmDetails: {
        title: 'Mover planilha para a lixeira do Google Drive?',
        description:
          'A planilha selecionada será enviada para a Lixeira do seu Google Drive e deixará de aparecer nas listagens ativas.',
        targetName: spreadsheet.title,
        warningText:
          'Você poderá restaurá-la posteriormente acessando a Lixeira diretamente no Google Drive.',
        confirmLabel: 'Mover para Lixeira',
        destructive: true,
      },
      execute: async () => {
        await trashDriveSpreadsheet(spreadsheet.spreadsheetId);
        if (browseSpreadsheet?.spreadsheetId === spreadsheet.spreadsheetId) {
          setBrowseSpreadsheet(null);
          setBrowseSheetTab('');
          setPreviewHeaders([]);
          setPreviewRows([]);
        }
        toast.success(`Planilha "${spreadsheet.title}" movida para a lixeira do Google Drive.`);
      },
    });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsExecutingAction(true);
    try {
      await pendingAction.execute();
      setPendingAction(null);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
        setPendingAction(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao executar operação no Google Sheets.';
        toast.error(msg);
      }
    } finally {
      setIsExecutingAction(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] bg-white border border-[#E5E2DC] text-[#171717] shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold text-[#171717] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
              Integração Google Sheets &amp; Drive
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'export' | 'browse')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 bg-[#F0EFEC] p-1 rounded-lg">
              <TabsTrigger value="export" className="text-xs font-medium gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                Enviar para Google Sheets
              </TabsTrigger>
              <TabsTrigger value="browse" className="text-xs font-medium gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Explorar Planilhas ({isConnected ? 'Conectado' : 'Drive'})
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Enviar dados para o Google Sheets */}
            <TabsContent value="export" className="space-y-4 pt-3">
              <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[#6B6B6B]">Conjunto pronto para envio:</span>{' '}
                  <strong className="text-[#171717]">{datasetLabel}</strong>
                </div>
                <span className="rounded-full bg-[#F5F1E9] border border-[#D8C79F] px-2.5 py-0.5 font-semibold text-[#8A6D36]">
                  {rows.length} {rows.length === 1 ? 'linha' : 'linhas'} · {headers.length} colunas
                </span>
              </div>

              {lastResultUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-950 truncate">
                        Sincronizado com "{lastResultTitle || 'Google Sheets'}"
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Os dados foram gravados com sucesso na sua conta Google.
                      </p>
                    </div>
                  </div>
                  <a
                    href={lastResultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white px-3 py-1.5 text-xs font-semibold transition shrink-0"
                  >
                    Abrir no Google Sheets
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Seletor de Destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDestination('new')}
                  className={`rounded-xl border p-3.5 text-left transition flex items-start gap-2.5 ${
                    destination === 'new'
                      ? 'border-[#B89B5E] bg-[#F5F1E9]/60'
                      : 'border-[#E5E2DC] bg-white hover:bg-[#FAF9F7]'
                  }`}
                >
                  <FilePlus2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      destination === 'new' ? 'text-[#8A6D36]' : 'text-[#6B6B6B]'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-[#171717]">Criar Nova Planilha</p>
                    <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                      Gera um novo arquivo formatado no Google Sheets.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('existing')}
                  className={`rounded-xl border p-3.5 text-left transition flex items-start gap-2.5 ${
                    destination === 'existing'
                      ? 'border-[#B89B5E] bg-[#F5F1E9]/60'
                      : 'border-[#E5E2DC] bg-white hover:bg-[#FAF9F7]'
                  }`}
                >
                  <RefreshCw
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      destination === 'existing' ? 'text-[#8A6D36]' : 'text-[#6B6B6B]'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-[#171717]">Planilha Existente</p>
                    <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                      Acrescentar linhas ou atualizar uma aba do seu Drive.
                    </p>
                  </div>
                </button>
              </div>

              {destination === 'new' ? (
                <div className="space-y-3">
                  {!isConnected && (
                    <GoogleSheetsPicker
                      selectedSpreadsheet={null}
                      selectedSheetTitle=""
                      onSelectSpreadsheet={() => {}}
                      onSelectSheetTab={() => {}}
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="gs-new-title" className="text-xs text-[#171717]">
                        Nome da Planilha no Google Drive
                      </Label>
                      <Input
                        id="gs-new-title"
                        value={newSpreadsheetTitle}
                        onChange={(e) => setNewSpreadsheetTitle(e.target.value)}
                        placeholder={defaultSpreadsheetTitle}
                        className="h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gs-new-tab" className="text-xs text-[#171717]">
                        Nome da Aba Inicial
                      </Label>
                      <Input
                        id="gs-new-tab"
                        value={newTabTitle}
                        onChange={(e) => setNewTabTitle(e.target.value)}
                        placeholder={defaultSheetTabTitle}
                        className="h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <GoogleSheetsPicker
                    selectedSpreadsheet={targetSpreadsheet}
                    selectedSheetTitle={targetSheetTab}
                    onSelectSpreadsheet={(meta, defaultTab) => {
                      setTargetSpreadsheet(meta);
                      setTargetSheetTab(defaultTab);
                    }}
                    onSelectSheetTab={setTargetSheetTab}
                  />

                  {isConnected && targetSpreadsheet && (
                    <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-3.5 space-y-2.5">
                      <p className="text-xs font-semibold text-[#171717]">
                        Modo de gravação na aba "{targetSheetTab}"
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label
                          className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer text-xs ${
                            existingWriteMode === 'append'
                              ? 'border-[#B89B5E] bg-white'
                              : 'border-[#E5E2DC] bg-white/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="gs-write-mode"
                            checked={existingWriteMode === 'append'}
                            onChange={() => setExistingWriteMode('append')}
                            className="mt-0.5 accent-[#171717]"
                          />
                          <div>
                            <span className="font-semibold text-[#171717] block">
                              Acrescentar linhas (Append)
                            </span>
                            <span className="text-[11px] text-[#6B6B6B]">
                              Mantém o conteúdo atual e adiciona abaixo.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer text-xs ${
                            existingWriteMode === 'overwrite'
                              ? 'border-red-300 bg-red-50/40'
                              : 'border-[#E5E2DC] bg-white/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="gs-write-mode"
                            checked={existingWriteMode === 'overwrite'}
                            onChange={() => setExistingWriteMode('overwrite')}
                            className="mt-0.5 accent-red-600"
                          />
                          <div>
                            <span className="font-semibold text-[#171717] block">
                              Substituir aba inteira
                            </span>
                            <span className="text-[11px] text-[#6B6B6B]">
                              Limpa as células atuais e grava do zero.
                            </span>
                          </div>
                        </label>
                      </div>

                      {existingWriteMode === 'append' && (
                        <label className="flex items-center gap-2 text-xs text-[#4A4A4A] cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={includeHeaderOnAppend}
                            onChange={(e) => setIncludeHeaderOnAppend(e.target.checked)}
                            className="rounded border-[#E5E2DC] accent-[#171717]"
                          />
                          <span>Incluir linha de cabeçalho antes dos registros (útil para abas vazias)</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E2DC]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9]"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  disabled={
                    !isConnected ||
                    rows.length === 0 ||
                    (destination === 'existing' && (!targetSpreadsheet || !targetSheetTab))
                  }
                  onClick={handleRequestExport}
                  className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  Enviar para Google Sheets
                </Button>
              </div>
            </TabsContent>

            {/* Aba 2: Explorar e Pré-visualizar Planilhas do Google Drive */}
            <TabsContent value="browse" className="space-y-4 pt-3">
              <GoogleSheetsPicker
                selectedSpreadsheet={browseSpreadsheet}
                selectedSheetTitle={browseSheetTab}
                onSelectSpreadsheet={(meta, defaultTab) => {
                  setBrowseSpreadsheet(meta);
                  setBrowseSheetTab(defaultTab);
                  setPreviewHeaders([]);
                  setPreviewRows([]);
                  if (meta && defaultTab) {
                    void handleLoadPreview(meta, defaultTab);
                  }
                }}
                onSelectSheetTab={(tab) => {
                  setBrowseSheetTab(tab);
                  if (browseSpreadsheet && tab) {
                    void handleLoadPreview(browseSpreadsheet, tab);
                  }
                }}
                actionButtonLabel="Recarregar Dados da Aba"
                onConfirmSelection={handleLoadPreview}
                actionLoading={isLoadingPreview}
              />

              {browseSpreadsheet && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={browseSpreadsheet.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6D36] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir "{browseSpreadsheet.title}" no Google Sheets
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRequestTrash(browseSpreadsheet)}
                    className="h-8 px-3 border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Mover para Lixeira
                  </Button>
                </div>
              )}

              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-8 gap-2 text-xs text-[#6B6B6B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#9F844A]" />
                  Lendo células da aba "{browseSheetTab}"...
                </div>
              ) : previewHeaders.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
                    <span>
                      Pré-visualização ao vivo ({previewRows.length}{' '}
                      {previewRows.length === 1 ? 'linha' : 'linhas'})
                    </span>
                    {previewRows.length > 25 && (
                      <span>Exibindo as primeiras 25 linhas</span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-auto rounded-xl border border-[#E5E2DC] bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#FAF9F7] border-b border-[#E5E2DC]">
                        <tr>
                          {previewHeaders.map((hdr, idx) => (
                            <th
                              key={`${hdr}-${idx}`}
                              className="px-3 py-2 font-semibold text-[#171717] whitespace-nowrap"
                            >
                              {hdr}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2DC]">
                        {previewRows.slice(0, 25).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-[#FAF9F7]">
                            {previewHeaders.map((_, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-3 py-1.5 text-[#4A4A4A] whitespace-nowrap max-w-[180px] truncate"
                              >
                                {row[cIdx] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <WorkspaceConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingAction(null);
        }}
        details={pendingAction?.confirmDetails || null}
        loading={isExecutingAction}
        onConfirm={handleConfirmPendingAction}
      />
    </>
  );
}
