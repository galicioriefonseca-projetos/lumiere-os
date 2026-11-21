import * as XLSX from 'xlsx';

export interface ParsedSpreadsheetResult {
  headers: string[];
  rows: string[][];
  sheetNames: string[];
  activeSheet: string;
  fileType: 'xlsx' | 'xls' | 'csv';
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function parseCsvText(rawText: string): string[][] {
  const cleanText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detect delimiter from first non-empty line outside quotes
  let commaCount = 0;
  let semicolonCount = 0;
  let inFirstQuotes = false;
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (ch === '"') {
      inFirstQuotes = !inFirstQuotes;
    } else if (!inFirstQuotes) {
      if (ch === ',') commaCount++;
      else if (ch === ';') semicolonCount++;
      else if (ch === '\n') break;
    }
  }
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const parsedLines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(currentValue.trim());
      parsedLines.push(row);
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    parsedLines.push(row);
  }

  return parsedLines;
}

function normalizeTable(rawLines: unknown[][]): { headers: string[]; rows: string[][] } {
  const nonEmptyLines = rawLines
    .map((line) => (Array.isArray(line) ? line.map((cell) => String(cell ?? '').trim()) : []))
    .filter((line) => line.some((cell) => cell.length > 0));

  if (nonEmptyLines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = nonEmptyLines[0];
  const maxCols = nonEmptyLines.reduce((max, row) => Math.max(max, row.length), rawHeaders.length);

  // Trim trailing completely empty columns
  let lastUsedCol = -1;
  for (let col = 0; col < maxCols; col++) {
    if (nonEmptyLines.some((row) => (row[col] || '').length > 0)) {
      lastUsedCol = col;
    }
  }

  const colCount = Math.max(lastUsedCol + 1, 1);
  const headers: string[] = [];
  for (let col = 0; col < colCount; col++) {
    const h = (rawHeaders[col] || '').trim();
    headers.push(h || `Coluna ${col + 1}`);
  }

  const rows = nonEmptyLines.slice(1).map((row) => {
    const normalizedRow: string[] = [];
    for (let col = 0; col < colCount; col++) {
      normalizedRow.push((row[col] || '').trim());
    }
    return normalizedRow;
  });

  return { headers, rows };
}

export function detectSpreadsheetExtension(fileName: string): 'xlsx' | 'xls' | 'csv' | null {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

export async function parseClientSpreadsheet(
  file: File,
  preferredSheetName?: string
): Promise<ParsedSpreadsheetResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('O arquivo excede o limite máximo de 10 MB.');
  }

  const ext = detectSpreadsheetExtension(file.name);
  if (!ext) {
    throw new Error('Formato não suportado. Envie uma planilha .xlsx, .xls ou .csv.');
  }

  if (ext === 'csv') {
    const text = await file.text();
    const parsedLines = parseCsvText(text);
    const { headers, rows } = normalizeTable(parsedLines);
    if (headers.length === 0) {
      throw new Error('O arquivo CSV selecionado está vazio.');
    }
    return {
      headers,
      rows,
      sheetNames: ['CSV'],
      activeSheet: 'CSV',
      fileType: 'csv',
    };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames || [];

  if (sheetNames.length === 0) {
    throw new Error('Nenhuma aba encontrada na planilha Excel.');
  }

  const targetSheet =
    preferredSheetName && sheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : sheetNames[0];

  const worksheet = workbook.Sheets[targetSheet];
  if (!worksheet) {
    throw new Error(`A aba "${targetSheet}" não pôde ser lida.`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
    dateNF: 'dd/mm/yyyy',
  });

  const { headers, rows } = normalizeTable(matrix);
  if (headers.length === 0) {
    throw new Error(`A aba "${targetSheet}" da planilha está vazia.`);
  }

  return {
    headers,
    rows,
    sheetNames,
    activeSheet: targetSheet,
    fileType: ext,
  };
}

export function parseCurrencyOrNumberSafe(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function downloadClientTemplateXlsx(): void {
  const sampleRows = [
    [
      'Nome Completo',
      'Gênero',
      'Celular / WhatsApp',
      'E-mail',
      'Etapa CRM',
      'Origem',
      'Observações',
      'Tags',
      'Valor Gasto (LTV)',
    ],
    [
      'Mariana Silva',
      'Feminino',
      '(11) 99999-1234',
      'mariana@email.com',
      'Cliente ativo',
      'Instagram',
      'Prefere atendimento pela manhã',
      'vip, loiros',
      '850,00',
    ],
    [
      'João Oliveira',
      'Masculino',
      '(11) 98888-4321',
      'joao@email.com',
      'Novo contato',
      'WhatsApp',
      'Solicitou orçamento',
      'lead',
      '0',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 32 },
    { wch: 18 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
  XLSX.writeFile(workbook, 'modelo-clientes-lumiereos.xlsx');
}
