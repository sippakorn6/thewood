export function uid(prefix = "s"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const sorter = (v: any): any => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return v;
      seen.add(v);
      if (Array.isArray(v)) return v.map(sorter);
      const keys = Object.keys(v).sort();
      const out: any = {};
      for (const k of keys) out[k] = sorter(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sorter(obj));
}

export function makeCartKey(menuId: number, options: Record<string,string>, note: string): string {
  const cleanNote = (note || "").trim();
  const optStr = stableStringify(options || {});
  return `${menuId}::${optStr}::${cleanNote}`;
}

export function formatTHB(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " ฿";
}
