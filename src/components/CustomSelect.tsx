import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  swatchClass?: string;
  textClass?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  textClassName?: string;
  size?: 'xs' | 'sm';
  disabled?: boolean;
  emptyText?: string;
  align?: 'left' | 'right';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = '選択してください',
  ariaLabel,
  className = '',
  textClassName = '',
  size = 'sm',
  disabled = false,
  emptyText = '選択肢がありません',
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, openUpward ? spaceAbove : spaceBelow));
    const width = Math.max(rect.width, 168);
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportW - 8) {
      left = Math.max(8, viewportW - width - 8);
    }
    if (left < 8) left = 8;

    setCoords({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left,
      width,
      maxHeight,
      openUpward,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, options.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      updatePosition();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const paddingClass = size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`inline-flex items-center justify-between gap-1.5 border border-slate-200 rounded-lg bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-50'
            : 'hover:border-slate-300 cursor-pointer'
        } ${paddingClass} ${className}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          {selectedOption?.swatchClass && (
            <span
              className={`w-2 h-2 rounded-xs shrink-0 ${selectedOption.swatchClass}`}
              aria-hidden="true"
            />
          )}
          <span
            className={`truncate ${
              selectedOption
                ? textClassName || selectedOption.textClass || 'text-slate-800'
                : 'text-slate-400'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180 text-blue-600' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              minWidth: `${coords.width}px`,
              maxWidth: 'min(320px, calc(100vw - 16px))',
              maxHeight: `${coords.maxHeight}px`,
              transform: coords.openUpward ? 'translateY(-100%)' : undefined,
            }}
            className="z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg py-1 overflow-y-auto"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">{emptyText}</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value === '' ? '__empty__' : opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                      opt.disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-50 text-blue-900 font-semibold cursor-pointer'
                          : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {opt.swatchClass && (
                        <span
                          className={`w-2 h-2 rounded-xs shrink-0 ${opt.swatchClass}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className={`truncate ${!isSelected && opt.textClass ? opt.textClass : ''}`}>
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {opt.subLabel}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </>
  );
};
