// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';

export async function extractText(filePath: string, fileType: string): Promise<string> {
  const buffer = await readFile(filePath);

  switch (fileType) {
    case 'pdf':
      return extractPdfText(buffer);
    case 'xlsx':
    case 'xls':
    case 'csv':
      return extractExcelText(buffer);
    case 'docx':
    case 'doc':
      return extractWordText(buffer);
    default:
      return buffer.toString('utf-8');
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

function extractExcelText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    lines.push(`\n=== Sheet: ${sheetName} ===\n`);
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(csv);
  }

  return lines.join('\n');
}

async function extractWordText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromBuffer(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return extractPdfText(buffer);
    case 'xlsx':
    case 'xls':
    case 'csv':
      return extractExcelText(buffer);
    case 'docx':
    case 'doc':
      return extractWordText(buffer);
    default:
      return buffer.toString('utf-8');
  }
}

export function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    pdf: 'pdf',
    xlsx: 'xlsx',
    xls: 'xls',
    csv: 'csv',
    docx: 'docx',
    doc: 'doc',
    txt: 'txt',
  };
  return typeMap[ext] || 'unknown';
}
