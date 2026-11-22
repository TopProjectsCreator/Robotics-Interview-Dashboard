import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

export type ChatConversationOption = {
  value: string;
  label: string;
  /** Unread conversations are shown with a red dot and a red label — never a text badge. */
  unread?: boolean;
};

export type ChatConversationGroup = {
  label?: string;
  options: ChatConversationOption[];
};

type ChatConversationDropdownProps = {
  value: string;
  groups: ChatConversationGroup[];
  onChange: (value: string) => void;
  id?: string;
  testId?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * Hand-built conversation picker for the chat workspace. It intentionally does
 * not use a native <select> (or a UI-library select): native option text cannot
 * be styled, so unread conversations used a "New — " prefix. This dropdown
 * renders its own listbox so unread state can be a red indicator instead.
 */
export function ChatConversationDropdown({
  value,
  groups,
  onChange,
  id,
  testId = "select-chat-conversation",
  ariaLabel = "Conversation",
  className = "",
}: ChatConversationDropdownProps) {
  const options = useMemo(() => groups.flatMap(group => group.options), [groups]);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options[selectedIndex];

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = optionRefs.current[activeIndex];
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openMenu = (index = selectedIndex) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: ChatConversationOption) => {
    onChange(option.value);
    closeMenu(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu();
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = options.length;
    if (count === 0) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(count - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(options[index]);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu();
        break;
      default:
        break;
    }
  };

  let optionIndex = -1;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-value={value}
        title={selected?.label}
        onClick={() => (open ? closeMenu(true) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        data-testid={testId}
        className="flex min-w-0 w-full items-center rounded-xl border border-[#d5e0e0] bg-white px-3 py-2 text-sm font-semibold text-[#385762] outline-none transition focus:border-[#16869a] focus:ring-2 focus:ring-[#16869a]/20 dark:border-[#355663] dark:bg-[#172b38] dark:text-[#e8eef2] sm:w-auto sm:min-w-[18rem]"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Team conversation"}</span>
        <ChevronDown size={16} aria-hidden="true" className={`ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          data-testid="chat-conversation-menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-[min(60dvh,380px)] w-full min-w-[16rem] overflow-y-auto overscroll-contain rounded-xl border border-[#d5e0e0] bg-white p-1.5 shadow-[0_12px_32px_rgba(24,58,75,0.2)] dark:border-[#355663] dark:bg-[#10212b] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
        >
          {groups.filter(group => group.options.length > 0).map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} role="group" aria-label={group.label}>
              {group.label && (
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8c91] dark:text-[#8fa6ac]">{group.label}</p>
              )}
              {group.options.map(option => {
                optionIndex += 1;
                const index = optionIndex;
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    ref={node => { optionRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={index === activeIndex ? 0 : -1}
                    data-testid={`chat-conversation-option-${option.value}`}
                    onClick={() => choose(option)}
                    onKeyDown={event => handleOptionKeyDown(event, index)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                      index === activeIndex ? "bg-[#edf4f3] dark:bg-[#1c3542]" : ""
                    } ${
                      option.unread
                        ? "font-semibold text-[#c9393a] dark:text-[#ff9b9b]"
                        : "text-[#385762] dark:text-[#e8eef2]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.unread && (
                      <span className="flex shrink-0 items-center" title="Unread messages" aria-label="Unread messages">
                        <span className="h-2 w-2 rounded-full bg-[#e0443e] shadow-[0_0_0_3px_rgba(224,68,62,0.15)]" aria-hidden="true" data-testid={`chat-unread-dot-${option.value}`} />
                      </span>
                    )}
                    {isSelected && <Check size={15} aria-hidden="true" className="shrink-0 text-[#16869a]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
