"use client";
import { useRef } from "react";
type Item = { id: string; name: string; quantity: number; unit: string; instructions: string; notes: string | null };
export function PrescriptionLabels({ patient, doctor, recordId, items }: { patient: string; doctor: string; recordId: string; items: Item[] }) {
  const labels = useRef<HTMLDivElement>(null);
  function print() {
    const w = window.open("", "_blank", "width=680,height=720");
    if (!w || !labels.current) { if (w) w.close(); return; }
    w.document.title = "Etiket resep";
    const style = w.document.createElement("style");
    style.textContent = "body{font:14px Arial;color:#111;margin:16px}.etiket{border:1px solid #111;border-radius:6px;padding:12px;margin:0 0 12px;width:85mm;max-width:100%;box-sizing:border-box;break-inside:avoid}p{margin:5px 0}h3{margin:0 0 8px}";
    w.document.head.appendChild(style);
    w.document.body.appendChild(w.document.importNode(labels.current, true));
    w.focus(); w.print();
  }
  return <><button type="button" onClick={print} className="rounded-lg border px-3 py-2 text-sm font-semibold">Cetak etiket</button><div className="hidden" aria-hidden="true"><div ref={labels}>{items.map(item => <section key={item.id} className="etiket"><h3>Etiket obat</h3><p>Resep: {recordId}</p><p>Pasien: {patient}</p><p>Dokter: {doctor}</p><p><strong>{item.name}</strong> — {item.quantity} {item.unit}</p><p>Aturan pakai: {item.instructions}</p>{item.notes && <p>Catatan: {item.notes}</p>}<p>Gunakan sesuai petunjuk tenaga kesehatan.</p></section>)}</div></div></>;
}
