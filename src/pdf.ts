import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface PdfSection { title: string; rows: [string, string][] }
export interface PdfInput { title: string; reference: string; sections: PdfSection[]; members: string[]; signature?: string | null; stamp?: string | null }

const RED = rgb(0.694, 0.173, 0.106), INK = rgb(0.09, 0.125, 0.17), MUTED = rgb(0.42, 0.45, 0.5);
const W = 595.28, H = 841.89, M = 48;

/** Standard PDF fonts only cover Latin-1: replace anything else so embedding never throws. */
const clean = (s: string): string => s.replace(/\r/g, '').replace(/\t/g, ' ').replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > max) { // break very long tokens
        let i = w.length - 1; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > max) i--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

async function embed(doc: PDFDocument, dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
  return dataUrl.startsWith('data:image/png') ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

export async function buildPdf(inp: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${inp.title} - ${inp.reference}`); doc.setCreator('Generali OneForm');
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage, y = 0, n = 0;
  const newPage = (): void => {
    page = doc.addPage([W, H]); n++; y = H - M;
    page.drawText(clean(`${inp.reference}  |  ${inp.title}`), { x: M, y: 24, size: 8, font: reg, color: MUTED });
    page.drawText(`Page ${n}`, { x: W - M - 30, y: 24, size: 8, font: reg, color: MUTED });
  };
  const room = (h: number): void => { if (y - h < 48) newPage(); };
  newPage();
  try {
    const logo = await doc.embedPng(new Uint8Array(await (await fetch('./assets/generali-logo.png')).arrayBuffer()));
    const d = logo.scale(54 / logo.height); page.drawImage(logo, { x: M, y: y - 54, width: d.width, height: 54 });
  } catch { page.drawText('GENERALI', { x: M, y: y - 30, size: 22, font: bold, color: RED }); }
  page.drawText('ONEFORM APPLICATION', { x: W - M - 150, y: y - 20, size: 10, font: bold, color: RED });
  page.drawText(clean(inp.reference), { x: W - M - 150, y: y - 36, size: 10, font: reg, color: INK });
  y -= 76; page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.5, color: RED }); y -= 28;
  for (const l of wrap(inp.title, bold, 17, W - 2 * M)) { page.drawText(l, { x: M, y, size: 17, font: bold, color: INK }); y -= 22; }
  y -= 6;
  for (const s of inp.sections) {
    const rows = s.rows.filter(([, v]) => v.trim() !== '');
    if (!rows.length) continue;
    room(60); page.drawText(clean(s.title), { x: M, y, size: 12, font: bold, color: RED }); y -= 18;
    for (const [label, value] of rows) {
      const lines = wrap(value, reg, 10, W - 2 * M);
      const ll = wrap(label, bold, 8, W - 2 * M);
      room(ll.length * 10 + Math.min(lines.length, 3) * 13 + 8);
      for (const l of ll) { page.drawText(l, { x: M, y, size: 8, font: bold, color: MUTED }); y -= 10; }
      for (const l of lines) { room(14); page.drawText(l, { x: M, y, size: 10, font: reg, color: INK }); y -= 13; }
      y -= 6;
    }
    y -= 6;
  }
  if (inp.members.length) {
    room(50); page.drawText('Persons to be insured', { x: M, y, size: 12, font: bold, color: RED }); y -= 18;
    inp.members.forEach((m, i) => { for (const l of wrap(`${i + 1}. ${m}`, reg, 9, W - 2 * M)) { room(13); page.drawText(l, { x: M, y, size: 9, font: reg, color: INK }); y -= 12; } });
    y -= 10;
  }
  room(170);
  page.drawText('Applicant signature', { x: M, y, size: 9, font: bold, color: MUTED });
  page.drawText('Company stamp', { x: W / 2 + 10, y, size: 9, font: bold, color: MUTED }); y -= 8;
  const box = { w: W / 2 - M - 10, h: 110 };
  for (const [src, x] of [[inp.signature, M], [inp.stamp, W / 2 + 10]] as const) {
    page.drawRectangle({ x, y: y - box.h, width: box.w, height: box.h, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.8 });
    if (!src) continue;
    const img = await embed(doc, src), k = Math.min((box.w - 12) / img.width, (box.h - 12) / img.height);
    page.drawImage(img, { x: x + (box.w - img.width * k) / 2, y: y - box.h + (box.h - img.height * k) / 2, width: img.width * k, height: img.height * k });
  }
  return doc.save();
}

export function downloadBytes(bytes: Uint8Array | string, filename: string, mime = 'application/pdf'): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename.replace(/[^\w.-]/g, '_');
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
