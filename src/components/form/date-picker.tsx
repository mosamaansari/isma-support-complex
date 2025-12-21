import { useEffect } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  placeholder,
}: PropsType) {
  useEffect(() => {
    const inputElement = document.getElementById(id);
    if (!inputElement) return;

    const flatPickr = flatpickr(inputElement, {
      mode: mode || "single",
      static: false,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate,
      onChange,
      position: "auto",
      onReady: (selectedDates, dateStr, instance) => {
        // Move calendar to body to avoid overflow clipping
        const calendar = instance.calendarContainer;
        if (calendar && calendar.parentElement !== document.body) {
          document.body.appendChild(calendar);
        }
        if (calendar) {
          calendar.style.zIndex = '100000';
        }
      },
      onOpen: (selectedDates, dateStr, instance) => {
        // Ensure calendar is in body and properly positioned
        const calendar = instance.calendarContainer;
        if (calendar && calendar.parentElement !== document.body) {
          document.body.appendChild(calendar);
        }
        
        const inputRect = inputElement.getBoundingClientRect();
        if (calendar) {
          calendar.style.zIndex = '100000';
          calendar.style.position = 'fixed';
          
          // Calculate position
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const calendarWidth = calendar.offsetWidth || 320;
          const calendarHeight = calendar.offsetHeight || 380;
          const padding = 8;
          
          // Position below input by default
          let top = inputRect.bottom + padding;
          let left = inputRect.left;
          
          // Check if calendar would overflow on right
          if (left + calendarWidth > viewportWidth - padding) {
            left = Math.max(padding, viewportWidth - calendarWidth - padding);
          }
          
          // Check if calendar would overflow on left
          if (left < padding) {
            left = padding;
          }
          
          // Check if calendar would overflow on bottom
          if (top + calendarHeight > viewportHeight - padding) {
            // Show above input if not enough space below
            const spaceAbove = inputRect.top - padding;
            if (spaceAbove >= calendarHeight) {
              top = inputRect.top - calendarHeight - padding;
            } else {
              // Not enough space above either, position at top of viewport
              top = padding;
            }
          }
          
          calendar.style.top = `${top}px`;
          calendar.style.left = `${left}px`;
        }
      },
    });

    return () => {
      if (!Array.isArray(flatPickr)) {
        flatPickr.destroy();
      }
    };
  }, [mode, onChange, id, defaultDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800"
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
