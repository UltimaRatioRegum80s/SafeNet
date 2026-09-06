import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";

interface ReportFabProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

export function ReportFab({ onClick, disabled, title, className }: ReportFabProps) {
  return (
    <Button
      onClick={onClick}
      className={`nn-report-fab fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg z-50 disabled:opacity-40 transition-all duration-200${className ? ` ${className}` : ""}`}
      data-testid="fab-report"
      aria-label="Report an incident"
      disabled={disabled}
      title={title}
    >
      <PlusCircle className="h-6 w-6" />
    </Button>
  );
}
