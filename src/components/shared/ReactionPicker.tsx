import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { REACTION_TYPES, getReaction, type ReactionType } from "@/lib/reactions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
interface ReactionPickerProps {
  currentReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  totalCount: number;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export function ReactionPicker({
  currentReaction,
  onReact,
  totalCount,
  size = "md",
  disabled = false,
  className,
}: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const updatePickerPos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPickerPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  // Close on outside click for mobile
  useEffect(() => {
    if (!showPicker || !isMobile) return;
    const handler = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("touchstart", handler, { passive: true });
    return () => document.removeEventListener("touchstart", handler);
  }, [showPicker, isMobile]);

  const openPicker = useCallback(() => {
    updatePickerPos();
    setShowPicker(true);
  }, [updatePickerPos]);

  const handleMouseEnter = () => {
    if (isMobile || disabled) return;
    clearTimers();
    openPicker();
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    hideTimer.current = setTimeout(() => setShowPicker(false), 300);
  };

  const handleTouchStart = () => {
    if (!isMobile || disabled) return;
    longPressTimer.current = setTimeout(() => {
      openPicker();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSelect = (key: ReactionType) => {
    setShowPicker(false);
    onReact(key);
  };

  const handleClick = () => {
    if (disabled) return;
    if (isMobile && !showPicker) return;
    onReact("pray");
  };

  const reaction = currentReaction ? getReaction(currentReaction) : null;
  const isSm = size === "sm";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Picker popup via portal */}
      {showPicker && createPortal(
        <div
          className="fixed z-[9999]"
          style={{ top: pickerPos.top, left: pickerPos.left, transform: "translate(-50%, -100%)" }}
          onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-0.5 bg-popover border border-border rounded-full px-2 py-1.5 shadow-lg reaction-picker-enter">
            {REACTION_TYPES.map((r, i) => (
              <button
                key={r.key}
                onClick={() => handleSelect(r.key as ReactionType)}
                className={cn(
                  "reaction-emoji-item flex flex-col items-center transition-transform hover:scale-125 rounded-full p-1.5",
                  currentReaction === r.key && "bg-muted"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
                title={r.label}
              >
                {r.key === "pray" ? (
                  <PrayingHands className="h-6 w-6" />
                ) : (
                  <span className="text-xl leading-none select-none">{r.emoji}</span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Main button */}
      <button
        ref={buttonRef}
        className={cn(
          "flex items-center gap-1 transition-colors",
          isSm ? "text-[10px] font-medium" : "text-sm",
          reaction ? reaction.color : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-default"
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        disabled={disabled}
      >
        {reaction ? (
          reaction.key === "pray" ? (
            <PrayingHands className={cn(isSm ? "h-2.5 w-2.5" : "h-5 w-5", "transition-opacity opacity-100")} />
          ) : (
            <span className={cn(isSm ? "text-xs" : "text-base", "leading-none select-none")}>{reaction.emoji}</span>
          )
        ) : (
          <PrayingHands className={cn(isSm ? "h-2.5 w-2.5" : "h-5 w-5", "transition-opacity opacity-50")} />
        )}
        {totalCount > 0 && <span>{totalCount}</span>}
      </button>
    </div>
  );
}