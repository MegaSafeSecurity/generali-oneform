export const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T => r.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T[] => [...r.querySelectorAll<T>(s)];
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ENT[c] ?? c);
