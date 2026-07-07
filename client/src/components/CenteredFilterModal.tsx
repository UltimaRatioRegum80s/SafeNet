import { useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CenteredFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function CenteredFilterModal({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: CenteredFilterModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOptionClick = (value: string) => {
    onSelect(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl min-w-[200px] max-w-[280px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-white">{title}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Options */}
        <div className="py-2">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleOptionClick(option.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                selectedValue === option.value
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-white hover:bg-gray-800'
              }`}
            >
              {option.icon && (
                <span className="opacity-70">{option.icon}</span>
              )}
              <span className="flex-1 text-sm">{option.label}</span>
              {selectedValue === option.value && (
                <Check size={18} className="text-blue-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
