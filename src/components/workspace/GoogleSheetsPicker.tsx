import React, { useEffect, useState } from 'react';
import {
  DriveSpreadsheetFile,
  GoogleWorkspaceAccount,
  SpreadsheetMetadata,
  WorkspaceAuthError,
  clearWorkspaceToken,
  connectGoogleWorkspace,
  getSpreadsheetMetadata,
  listDriveSpreadsheets,
  subscribeWorkspaceAuth,
} from '@/services/googleWorkspaceService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleSheetsPickerProps {
  selectedSpreadsheet: SpreadsheetMetadata | null;
  selectedSheetTitle: string;
  onSelectSpreadsheet: (metadata: SpreadsheetMetadata | null, defaultTab: string) => void;
  onSelectSheetTab: (sheetTitle: string) => void;
  actionButtonLabel?: string;
  onConfirmSelection?: (metadata: SpreadsheetMetadata, sheetTitle: string) => Promise<void> | void;
  actionLoading?: boolean;
  emptyActionHint?: string;
}

export function GoogleSheetsPicker({
  selectedSpreadsheet,
  selectedSheetTitle,
  onSelectSpreadsheet,
  onSelectSheetTab,
  actionButtonLabel,
  onConfirmSelection,
  actionLoading = false,
  emptyActionHint,
}: GoogleSheetsPickerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<GoogleWorkspaceAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeWorkspaceAuth((state) => {
      setIsConnected(state.isConnected);
      setAccount(state.account);
    });
    return unsubscribe;
  }, []);

  const loadFiles = async (term?: string) => {
    setIsLoadingFiles(true);
    try {
      const result = await listDriveSpreadsheets(term);
      setFiles(result);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao listar planilhas no Google Drive.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      void loadFiles();
    } else {
      setFiles([]);
      onSelectSpreadsheet(null, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await connectGoogleWorkspace();
      toast.success(
        res.account.email
          ? `Conectado ao Google Sheets (${res.account.email})`
          : 'Conta Google conectada com sucesso!'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível conectar com o Google.';
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePickFile = async (file: DriveSpreadsheetFile) => {
    setIsLoadingMeta(true);
    try {
      const metadata = await getSpreadsheetMetadata(file.id);
      const defaultTab = metadata.sheets[0]?.title || '';
      onSelectSpreadsheet(metadata, defaultTab);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao ler abas da planilha.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingMeta(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F1E9] border border-[#D8C79F]">
          <FileSpreadsheet className="h-6 w-6 text-[#8A6D36]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[#171717]">
            Conecte sua conta Google Workspace
          </h4>
          <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto leading-relaxed">
            Autorize o acesso ao Google Drive e Google Sheets para listar suas planilhas, escolher abas e sincronizar dados com segurança.
          </p>
        </div>
        <div className="flex justify-center pt-1">
          <GoogleSignInButton onClick={() => void handleConnect()} loading={isConnecting} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status da Conta Google Conectada */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-[#171717] font-medium truncate">
            Google conectado{account?.email ? `: ${account.email}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleConnect()}
            disabled={isConnecting}
            className="h-7 px-2 text-[11px] text-[#8A6D36] hover:bg-[#F5F1E9]"
          >
            Trocar conta
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              clearWorkspaceToken();
              onSelectSpreadsheet(null, '');
            }}
            className="h-7 px-2 text-[11px] text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 gap-1"
          >
            <LogOut className="h-3 w-3" />
            Desconectar
          </Button>
        </div>
      </div>

      {/* Busca e Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void loadFiles(searchTerm);
              }
            }}
            placeholder="Buscar planilha no Google Drive..."
            className="pl-9 h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadFiles(searchTerm)}
          disabled={isLoadingFiles}
          className="h-9 px-3 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1.5"
        >
          {isLoadingFiles ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Lista de Planilhas do Google Drive */}
      <div className="max-h-48 overflow-y-auto rounded-xl border border-[#E5E2DC] bg-white divide-y divide-[#E5E2DC]">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-[#6B6B6B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#9F844A]" />
            Carregando planilhas do Google Drive...
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-[#6B6B6B]">
            Nenhuma planilha Google Sheets encontrada{searchTerm ? ` para "${searchTerm}"` : ''}.
          </div>
        ) : (
          files.map((file) => {
            const isSelected = selectedSpreadsheet?.spreadsheetId === file.id;
            return (
              <div
                key={file.id}
                onClick={() => void handlePickFile(file)}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition text-left ${
                  isSelected
                    ? 'bg-[#F5F1E9] border-l-2 border-l-[#B89B5E]'
                    : 'hover:bg-[#FAF9F7]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? 'text-[#8A6D36]' : 'text-emerald-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#171717] truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-[#6B6B6B] truncate">
                      {file.modifiedTime
                        ? `Atualizada em ${new Date(file.modifiedTime).toLocaleDateString('pt-BR')}`
                        : 'Google Sheets'}
                    </p>
                  </div>
                </div>
                {file.webViewLink && (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-[#6B6B6B] hover:text-[#171717] hover:bg-white transition shrink-0"
                    title="Abrir no Google Sheets"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Seleção de Aba da Planilha Escolhida */}
      {isLoadingMeta && (
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B] py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9F844A]" />
          Carregando abas da planilha...
        </div>
      )}

      {selectedSpreadsheet && !isLoadingMeta && (
        <div className="rounded-xl border border-[#D8C79F] bg-[#FAF9F7] p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6D36]">
                Planilha selecionada
              </p>
              <p className="text-xs font-semibold text-[#171717] truncate">
                {selectedSpreadsheet.title}
              </p>
            </div>
            <div className="w-full sm:w-52">
              <Select value={selectedSheetTitle} onValueChange={onSelectSheetTab}>
                <SelectTrigger className="h-8 bg-white border-[#E5E2DC] text-xs text-[#171717]">
                  <SelectValue placeholder="Selecione a aba" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#E5E2DC] text-[#171717]">
                  {selectedSpreadsheet.sheets.map((sheet) => (
                    <SelectItem key={sheet.sheetId} value={sheet.title}>
                      Aba: {sheet.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {actionButtonLabel && onConfirmSelection && (
            <div className="flex items-center justify-end gap-2 pt-1">
              {emptyActionHint && (
                <span className="text-[11px] text-[#6B6B6B] mr-auto">{emptyActionHint}</span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={actionLoading || !selectedSheetTitle}
                onClick={() => void onConfirmSelection(selectedSpreadsheet, selectedSheetTitle)}
                className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold h-9 px-4 gap-2 text-xs"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  actionButtonLabel
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
