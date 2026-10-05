// Utilidades de exportación: CSV, XLSX y PDF (vía print).
import * as XLSX from "xlsx";

export type Row = Record<string, string | number | null | undefined>;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(rows: Row[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export function exportXLSX(rows: Row[], filename: string, sheet = "Datos") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

export function exportPDF(title: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  const tbody = rows.map((r) => `<tr>${cols.map((c) => `<td>${(r[c] ?? "")}</td>`).join("")}</tr>`).join("");
  // Orientación automática: muchas columnas => horizontal.
  const landscape = cols.length > 6;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 8mm; }
      html,body{margin:0;padding:0}
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
      #sheet{padding:0;transform-origin:top left}
      h1{font-size:14px;margin:0 0 4px}
      .meta{font-size:10px;color:#666;margin:0 0 8px}
      table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px}
      th,td{border:1px solid #ccc;padding:2px 4px;text-align:left;word-break:break-word;overflow-wrap:anywhere}
      th{background:#f3f4f6}
      tr:nth-child(even) td{background:#fafafa}
      @media print{ button{display:none} }
    </style></head>
    <body><div id="sheet"><h1>${title}</h1>
    <p class="meta">Generado ${new Date().toLocaleString()}</p>
    <table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tbody}</tbody></table>
    </div>
    <script>
      (function(){
        var W = ${landscape ? 1093 : 764}, H = ${landscape ? 764 : 1093};
        var el = document.getElementById('sheet');
        function fit(){
          el.style.transform = 'scale(1)';
          var s = Math.min(W / el.scrollWidth, H / el.scrollHeight, 1);
          if (s < 0.5) s = 0.5; // por debajo de esto se reparte en varias hojas
          el.style.transform = 'scale(' + s + ')';
        }
        fit();
        setTimeout(function(){ fit(); window.print(); }, 300);
      })();
    <\/script>
    </body></html>`);
  win.document.close();
}
