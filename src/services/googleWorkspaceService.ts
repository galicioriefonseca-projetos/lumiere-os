import {
  GoogleAuthProvider,
  User as FirebaseUser,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.acls',
  'https://www.googleapis.com/auth/calendar.acls.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
] as const;

export const WORKSPACE_SCOPES = SCOPES;

export interface GoogleWorkspaceAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
}

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheets: SpreadsheetTabInfo[];
}

export interface SheetValuesResult {
  range: string;
  values: string[][];
}

export class WorkspaceAuthError extends Error {
  public readonly needsReauth: boolean;
  public readonly code?: string;

  constructor(message: string, needsReauth = true, code?: string) {
    super(message);
    this.name = 'WorkspaceAuthError';
    this.needsReauth = needsReauth;
    this.code = code;
  }
}

// Armazenamento estritamente em memória (nunca em localStorage ou sessionStorage)
let cachedAccessToken: string | null = null;
let connectedAccount: GoogleWorkspaceAccount | null = null;
let isSigningIn = false;
let authListenerInitialized = false;

type WorkspaceStateListener = (state: {
  isConnected: boolean;
  account: GoogleWorkspaceAccount | null;
}) => void;

const listeners = new Set<WorkspaceStateListener>();

function notifyListeners(): void {
  const snapshot = {
    isConnected: Boolean(cachedAccessToken),
    account: connectedAccount,
  };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('[WorkspaceAuth] Erro ao notificar listener:', err);
    }
  });
}

export function subscribeWorkspaceAuth(listener: WorkspaceStateListener): () => void {
  ensureAuthListener();
  listeners.add(listener);
  listener({
    isConnected: Boolean(cachedAccessToken),
    account: connectedAccount,
  });
  return () => {
    listeners.delete(listener);
  };
}

function createWorkspaceProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });
  return provider;
}

function ensureAuthListener(): void {
  if (authListenerInitialized || !auth) return;
  authListenerInitialized = true;

  onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (!user) {
      cachedAccessToken = null;
      connectedAccount = null;
      notifyListeners();
    } else if (!cachedAccessToken && !isSigningIn) {
      connectedAccount = null;
      notifyListeners();
    }
  });
}

export function initWorkspaceAuth(
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
): () => void {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!user || !isSigningIn) {
        cachedAccessToken = null;
        connectedAccount = null;
        notifyListeners();
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
}

export function clearWorkspaceToken(): void {
  cachedAccessToken = null;
  connectedAccount = null;
  notifyListeners();
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function getConnectedWorkspaceAccount(): GoogleWorkspaceAccount | null {
  return connectedAccount;
}

export function isWorkspaceConnected(): boolean {
  return Boolean(cachedAccessToken);
}

export async function connectGoogleWorkspace(): Promise<{
  account: GoogleWorkspaceAccount;
  accessToken: string;
}> {
  if (!auth) {
    throw new WorkspaceAuthError('Serviço de autenticação não inicializado.', false);
  }

  ensureAuthListener();
  const provider = createWorkspaceProvider();

  try {
    isSigningIn = true;
    const currentUser = auth.currentUser as FirebaseUser | null;
    let resolvedUser: FirebaseUser | null = currentUser;
    let accessToken: string | undefined;

    if (!currentUser) {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken;
      resolvedUser = result.user;
    } else {
      const hasGoogleProvider = currentUser.providerData.some(
        (item) => item.providerId === 'google.com'
      );

      if (hasGoogleProvider) {
        const result = await reauthenticateWithPopup(currentUser, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        accessToken = credential?.accessToken;
        resolvedUser = result.user;
      } else {
        try {
          const result = await linkWithPopup(currentUser, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          accessToken = credential?.accessToken;
          resolvedUser = result.user;
        } catch (linkErr: unknown) {
          const errCode = (linkErr as { code?: string })?.code;
          if (
            errCode === 'auth/credential-already-in-use' ||
            errCode === 'auth/email-already-in-use' ||
            errCode === 'auth/provider-already-linked'
          ) {
            const fallbackCred = GoogleAuthProvider.credentialFromError(
              linkErr as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
            );
            if (fallbackCred?.accessToken) {
              accessToken = fallbackCred.accessToken;
            } else {
              throw new WorkspaceAuthError(
                'Esta conta do Google já está associada a outro usuário. Entre com sua conta Google no LumièreOS ou escolha outra conta Google no seletor.',
                true,
                errCode
              );
            }
          } else {
            throw linkErr;
          }
        }
      }
    }

    if (!accessToken) {
      throw new WorkspaceAuthError(
        'Não foi possível obter o token de acesso do Google Sheets/Drive. Tente autorizar novamente marcando todas as permissões.',
        true
      );
    }

    const googleProfile = resolvedUser?.providerData.find(
      (p) => p.providerId === 'google.com'
    );

    cachedAccessToken = accessToken;
    connectedAccount = {
      uid: resolvedUser?.uid || '',
      email: googleProfile?.email || resolvedUser?.email || null,
      displayName: googleProfile?.displayName || resolvedUser?.displayName || null,
    };

    notifyListeners();
    return { account: connectedAccount, accessToken };
  } catch (err: unknown) {
    const firebaseCode = (err as { code?: string })?.code;
    if (firebaseCode === 'auth/popup-closed-by-user' || firebaseCode === 'auth/cancelled-popup-request') {
      throw new WorkspaceAuthError('Autorização cancelada pelo usuário.', true, firebaseCode);
    }
    if (firebaseCode === 'auth/popup-blocked') {
      throw new WorkspaceAuthError(
        'O popup do Google foi bloqueado pelo navegador. Libere popups para este site e tente novamente.',
        true,
        firebaseCode
      );
    }
    if (firebaseCode === 'auth/user-mismatch') {
      const currentEmail = auth.currentUser?.email;
      throw new WorkspaceAuthError(
        currentEmail
          ? `Selecione a mesma conta Google usada no login (${currentEmail}) para autorizar o acesso às planilhas.`
          : 'A conta Google selecionada não corresponde à sessão ativa.',
        true,
        firebaseCode
      );
    }
    if (err instanceof WorkspaceAuthError) {
      throw err;
    }
    const fallbackMessage =
      err instanceof Error ? err.message : 'Falha ao conectar com a conta Google.';
    throw new WorkspaceAuthError(fallbackMessage, true, firebaseCode);
  } finally {
    isSigningIn = false;
  }
}

export async function workspaceFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new WorkspaceAuthError(
      'Conecte sua conta Google para acessar os recursos do Google Workspace.',
      true
    );
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearWorkspaceToken();
    throw new WorkspaceAuthError(
      'Sua autorização do Google expirou. Clique em "Conectar com o Google" novamente.',
      true,
      '401'
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const apiError = (parsed as { error?: { message?: string; status?: string } })?.error;
    const message =
      apiError?.message ||
      `Erro na API do Google (${response.status}). Verifique as permissões solicitadas.`;

    if (response.status === 403 && message.toLowerCase().includes('insufficient')) {
      clearWorkspaceToken();
      throw new WorkspaceAuthError(
        'Permissões insuficientes para o Google Sheets/Drive. Reconecte e marque todas as caixas de permissão.',
        true,
        '403'
      );
    }

    throw new Error(message);
  }

  return (parsed ?? {}) as T;
}

function escapeSheetTitle(sheetTitle: string): string {
  return `'${sheetTitle.replace(/'/g, "''")}'`;
}

export async function listDriveSpreadsheets(searchTerm?: string): Promise<DriveSpreadsheetFile[]> {
  const sanitizedSearch = searchTerm?.trim().replace(/'/g, "\\'");
  const queryParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];
  if (sanitizedSearch) {
    queryParts.push(`name contains '${sanitizedSearch}'`);
  }

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '30',
    fields: 'files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const data = await workspaceFetch<{ files?: DriveSpreadsheetFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  );
  return data.files || [];
}

interface RawSpreadsheetApiResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties?: {
    title?: string;
  };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
      index?: number;
      gridProperties?: {
        rowCount?: number;
        columnCount?: number;
      };
    };
  }>;
}

export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields:
      'spreadsheetId,spreadsheetUrl,properties.title,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
  });

  const data = await workspaceFetch<RawSpreadsheetApiResponse>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`
  );

  const sheets: SpreadsheetTabInfo[] = (data.sheets || [])
    .map((sheet, idx) => {
      const props = sheet.properties || {};
      return {
        sheetId: props.sheetId ?? idx,
        title: props.title || `Aba ${idx + 1}`,
        index: props.index ?? idx,
        rowCount: props.gridProperties?.rowCount ?? 1000,
        columnCount: props.gridProperties?.columnCount ?? 26,
      };
    })
    .sort((a, b) => a.index - b.index);

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
    title: data.properties?.title || 'Planilha sem título',
    sheets,
  };
}

export async function readSpreadsheetTabValues(
  spreadsheetId: string,
  sheetTitle: string,
  cellRange = 'A1:Z2000'
): Promise<{ headers: string[]; rows: string[][]; rawValues: string[][] }> {
  const fullRange = `${escapeSheetTitle(sheetTitle)}!${cellRange}`;
  const data = await workspaceFetch<SheetValuesResult>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(fullRange)}?majorDimension=ROWS`
  );

  const rawValues = (data.values || [])
    .map((line) => line.map((cell) => String(cell ?? '').trim()))
    .filter((line) => line.some((cell) => cell.length > 0));

  if (rawValues.length === 0) {
    return { headers: [], rows: [], rawValues: [] };
  }

  const rawHeaders = rawValues[0];
  const maxCols = rawValues.reduce((max, row) => Math.max(max, row.length), rawHeaders.length);

  let lastUsedCol = -1;
  for (let col = 0; col < maxCols; col++) {
    if (rawValues.some((row) => (row[col] || '').length > 0)) {
      lastUsedCol = col;
    }
  }

  const colCount = Math.max(lastUsedCol + 1, 1);
  const headers: string[] = [];
  for (let col = 0; col < colCount; col++) {
    const h = (rawHeaders[col] || '').trim();
    headers.push(h || `Coluna ${col + 1}`);
  }

  const rows = rawValues.slice(1).map((row) => {
    const normalized: string[] = [];
    for (let col = 0; col < colCount; col++) {
      normalized.push((row[col] || '').trim());
    }
    return normalized;
  });

  return { headers, rows, rawValues };
}

export type SheetCellValue = string | number | boolean;

export async function createGoogleSpreadsheetWithData(params: {
  title: string;
  sheetTitle: string;
  values: SheetCellValue[][];
}): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetTitle: string;
  writtenRows: number;
}> {
  const cleanTitle = params.title.trim() || 'Planilha LumièreOS';
  const cleanSheetTitle = params.sheetTitle.trim() || 'Dados';

  const created = await workspaceFetch<RawSpreadsheetApiResponse>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          title: cleanTitle,
          locale: 'pt_BR',
        },
        sheets: [
          {
            properties: {
              title: cleanSheetTitle,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    }
  );

  const createdSheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;

  if (params.values.length > 0) {
    const range = `${escapeSheetTitle(cleanSheetTitle)}!A1`;
    await workspaceFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        created.spreadsheetId
      )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({
          range,
          majorDimension: 'ROWS',
          values: params.values,
        }),
      }
    );

    // Estiliza o cabeçalho (linha 1 em negrito com fundo suave marfim) e auto-ajusta colunas
    try {
      await workspaceFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          created.spreadsheetId
        )}:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: createdSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.96, green: 0.95, blue: 0.91 },
                      textFormat: {
                        bold: true,
                        foregroundColor: { red: 0.09, green: 0.09, blue: 0.09 },
                      },
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat)',
                },
              },
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId: createdSheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: Math.max(params.values[0]?.length || 1, 1),
                  },
                },
              },
            ],
          }),
        }
      );
    } catch (formatErr) {
      console.warn('[WorkspaceSheets] Aviso ao aplicar formatação visual:', formatErr);
    }
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    title: created.properties?.title || cleanTitle,
    sheetTitle: cleanSheetTitle,
    writtenRows: params.values.length,
  };
}

export async function appendRowsToSpreadsheet(params: {
  spreadsheetId: string;
  sheetTitle: string;
  values: SheetCellValue[][];
}): Promise<{ updatedRows: number; spreadsheetUrl: string }> {
  const range = `${escapeSheetTitle(params.sheetTitle)}!A1`;
  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      params.spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: params.values,
      }),
    }
  );

  return {
    updatedRows: params.values.length,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${params.spreadsheetId}/edit`,
  };
}

export async function overwriteSpreadsheetTab(params: {
  spreadsheetId: string;
  sheetTitle: string;
  values: SheetCellValue[][];
}): Promise<{ updatedRows: number; spreadsheetUrl: string }> {
  const clearRange = `${escapeSheetTitle(params.sheetTitle)}!A:Z`;
  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      params.spreadsheetId
    )}/values/${encodeURIComponent(clearRange)}:clear`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  const writeRange = `${escapeSheetTitle(params.sheetTitle)}!A1`;
  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      params.spreadsheetId
    )}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: params.values,
      }),
    }
  );

  return {
    updatedRows: params.values.length,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${params.spreadsheetId}/edit`,
  };
}

export async function trashDriveSpreadsheet(fileId: string): Promise<void> {
  await workspaceFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      body: JSON.stringify({ trashed: true }),
    }
  );
}
