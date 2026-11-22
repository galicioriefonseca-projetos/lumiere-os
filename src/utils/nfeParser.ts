import type { NfeParsedInvoice, NfeParsedItem } from '../types/index.js';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function extractTagValue(block: string, tagName: string): string {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tagName}>`, 'i');
  const match = block.match(regex);
  if (!match || !match[1]) return '';
  return decodeXmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
}

function extractTagBlock(source: string, tagName: string): string {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tagName}>`, 'i');
  const match = source.match(regex);
  return match ? match[0] : '';
}

function extractAllBlocks(source: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:[a-zA-Z0-9_]+:)?${tagName}>`, 'gi');
  return source.match(regex) || [];
}

function parseSafeNumber(raw: string): number {
  const cleaned = raw.trim().replace(',', '.');
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export function parseBrazilianNfeXml(rawXml: string): NfeParsedInvoice {
  if (!rawXml || typeof rawXml !== 'string') {
    throw new Error('Conteúdo XML vazio ou inválido.');
  }

  // Sanitize any DTD / DOCTYPE / Entity declarations to prevent XXE
  const sanitizedXml = rawXml
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .trim();

  const infNfeMatch = sanitizedXml.match(/<infNFe\b[^>]*Id=["']?([^"'\s>]+)["']?[^>]*>/i);
  const infNfeBlock = extractTagBlock(sanitizedXml, 'infNFe');
  if (!infNfeBlock) {
    throw new Error('Arquivo XML não corresponde a uma NF-e padrão (<infNFe> não encontrado).');
  }

  const ideBlock = extractTagBlock(infNfeBlock, 'ide');
  const emitBlock = extractTagBlock(infNfeBlock, 'emit');
  const enderEmitBlock = extractTagBlock(emitBlock, 'enderEmit');
  const totalBlock = extractTagBlock(infNfeBlock, 'ICMSTot');

  const invoiceNumber = extractTagValue(ideBlock, 'nNF') || 'S/N';
  const rawIssueDate = extractTagValue(ideBlock, 'dhEmi') || extractTagValue(ideBlock, 'dEmi');
  const issueDate =
    rawIssueDate && /^\d{4}-\d{2}-\d{2}/.test(rawIssueDate)
      ? rawIssueDate.substring(0, 10)
      : new Date().toISOString().substring(0, 10);

  const invoiceKey = (infNfeMatch?.[1] || extractTagValue(sanitizedXml, 'chNFe') || '').replace(/^NFe/i, '');

  const cnpj = extractTagValue(emitBlock, 'CNPJ') || extractTagValue(emitBlock, 'CPF');
  const companyName = extractTagValue(emitBlock, 'xNome') || 'Fornecedor NF-e';
  const tradeName = extractTagValue(emitBlock, 'xFant') || companyName;

  const detBlocks = extractAllBlocks(infNfeBlock, 'det');
  const items: NfeParsedItem[] = detBlocks
    .map((det) => {
      const prodBlock = extractTagBlock(det, 'prod');
      if (!prodBlock) return null;
      const code = extractTagValue(prodBlock, 'cProd');
      const rawEan = extractTagValue(prodBlock, 'cEAN');
      const ean = rawEan && rawEan.toUpperCase() !== 'SEM GTIN' ? rawEan : '';
      const name = extractTagValue(prodBlock, 'xProd');
      const unit = extractTagValue(prodBlock, 'uCom') || 'un';
      const quantity = parseSafeNumber(extractTagValue(prodBlock, 'qCom'));
      const unitCost = parseSafeNumber(extractTagValue(prodBlock, 'vUnCom'));
      const totalCost = parseSafeNumber(extractTagValue(prodBlock, 'vProd')) || Number((quantity * unitCost).toFixed(2));

      if (!name || quantity <= 0) return null;
      return {
        code,
        ean,
        name,
        unit,
        quantity,
        unitCost: unitCost > 0 ? unitCost : Number((totalCost / quantity).toFixed(2)),
        totalCost,
      };
    })
    .filter((item): item is NfeParsedItem => item !== null);

  if (items.length === 0) {
    throw new Error('Nenhum item de produto válido encontrado no XML desta Nota Fiscal.');
  }

  const parsedTotal = parseSafeNumber(extractTagValue(totalBlock, 'vNF'));
  const calculatedTotal = Number(items.reduce((acc, item) => acc + item.totalCost, 0).toFixed(2));

  return {
    invoiceNumber,
    invoiceKey,
    issueDate,
    totalValue: parsedTotal > 0 ? parsedTotal : calculatedTotal,
    supplier: {
      document: cnpj,
      companyName,
      tradeName,
      phone: extractTagValue(enderEmitBlock, 'fone'),
      zipCode: extractTagValue(enderEmitBlock, 'CEP'),
      state: extractTagValue(enderEmitBlock, 'UF'),
      city: extractTagValue(enderEmitBlock, 'xMun'),
      address: extractTagValue(enderEmitBlock, 'xLgr'),
      number: extractTagValue(enderEmitBlock, 'nro'),
      neighborhood: extractTagValue(enderEmitBlock, 'xBairro'),
    },
    items,
  };
}
