import { Download } from 'lucide-react';

interface ExportButtonProps {
  isEs?: boolean;
  onExport?: () => void;
}

export function ExportButton({ isEs = false, onExport }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {isEs ? 'Exportar Reporte' : 'Export Report'}
    </button>
  );
}
