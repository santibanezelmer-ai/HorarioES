import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { exportCSV, exportXLSX, exportPDF, type Row } from "@/lib/export";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ExportMenu({ rows, filename, title, disabled }: {
  rows: Row[]; filename: string; title: string; disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || rows.length === 0}>
          <Download className="w-4 h-4 mr-1.5" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(rows, filename)}>
          <FileText className="w-4 h-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXLSX(rows, filename)}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportPDF(title, rows)}>
          <Printer className="w-4 h-4 mr-2" /> PDF (imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
