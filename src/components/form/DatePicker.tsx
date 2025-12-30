import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface DatePickerProps {
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: boolean;
  hint?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export default function DatePicker({
  name,
  value,
  onChange,
  onBlur,
  placeholder = "Today's date",
  className = "",
  required = false,
  error = false,
  hint,
  disabled = false,
}: DatePickerProps) {
  // Get today's date in YYYY-MM-DD format
  const getTodayDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayDate = getTodayDateStr();
  const [isOpen, setIsOpen] = useState(false);
  const [displayDate, setDisplayDate] = useState(value || todayDate);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [_calendarPosition, setCalendarPosition] = useState<{
    top: boolean;
    left: boolean;
    right: boolean;
  }>({ top: false, left: false, right: false });

  // Format date for display (DD/MM/YYYY)
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Sync display date with value prop
  useEffect(() => {
    if (value && value !== displayDate) {
      setDisplayDate(value);
      const newDate = new Date(value + "T00:00:00");
      if (!isNaN(newDate.getTime())) {
        setCurrentMonth(newDate);
      }
    }
  }, [value]);

  // Calculate calendar position based on available space using fixed positioning
  const [calendarStyle, setCalendarStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !inputRef.current) return;

    const updatePosition = () => {
      if (!inputRef.current) return;

      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (!inputRef.current) return;

        const inputRect = inputRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const calendarHeight = 380; // Approximate calendar height
        const calendarWidth = 320; // Calendar width
        const padding = 8; // Padding from viewport edge

        // Check space below and above
        const spaceBelow = viewportHeight - inputRect.bottom - padding;
        const spaceAbove = inputRect.top - padding;

        // Determine vertical position: show below if enough space, otherwise above
        const showOnTop = spaceBelow < calendarHeight && spaceAbove >= calendarHeight;

        // Calculate top position using fixed positioning
        let top = showOnTop
          ? inputRect.top - calendarHeight - padding
          : inputRect.bottom + padding;

        // Ensure calendar doesn't go off screen
        if (top < padding) top = padding;
        if (top + calendarHeight > viewportHeight - padding) {
          top = viewportHeight - calendarHeight - padding;
        }

        // Determine horizontal position: align with input left edge
        let left = inputRect.left;

        // Check if calendar would overflow on right
        if (left + calendarWidth > viewportWidth - padding) {
          left = viewportWidth - calendarWidth - padding;
        }

        // Check if calendar would overflow on left
        if (left < padding) {
          left = padding;
        }

        setCalendarStyle({
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          zIndex: 100000,
        });

        setCalendarPosition({
          top: showOnTop,
          left: false,
          right: false,
        });
      }, 0);
    };

    updatePosition();

    // Update on resize and scroll
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleDateSelect = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const selectedDateStr = `${year}-${month}-${dayStr}`;

    setDisplayDate(selectedDateStr);
    setIsOpen(false);

    if (onChange && hiddenInputRef.current) {
      hiddenInputRef.current.value = selectedDateStr;
      const syntheticEvent = {
        target: { value: selectedDateStr, name: name || "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth);
    if (direction === "prev") {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    const today = new Date();
    const todayStr = getTodayDateStr();
    setDisplayDate(todayStr);
    setCurrentMonth(today);
    setIsOpen(false);

    if (onChange && hiddenInputRef.current) {
      hiddenInputRef.current.value = todayStr;
      const syntheticEvent = {
        target: { value: todayStr, name: name || "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  // Generate calendar days
  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const days = generateCalendar();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number | null) => {
    if (!day || !displayDate) return false;
    // Handle YYYY-MM-DD format
    const selected = new Date(displayDate + "T00:00:00");
    if (isNaN(selected.getTime())) return false;
    return (
      day === selected.getDate() &&
      currentMonth.getMonth() === selected.getMonth() &&
      currentMonth.getFullYear() === selected.getFullYear()
    );
  };

  const inputClasses = `h-11 w-full rounded-lg border appearance-none px-4 py-2.5 pr-10 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 cursor-pointer dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${disabled
    ? "text-gray-500 border-gray-300 opacity-40 bg-gray-100 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
    : error
      ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800"
      : "bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800"
    } ${className}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={displayDate ? formatDisplayDate(displayDate) : ""}
          onClick={handleInputClick}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly
          className={inputClasses}
        />
        <button
          type="button"
          onClick={handleIconClick}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
          tabIndex={-1}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {/* Hidden native date input for form submission */}
      <input
        ref={hiddenInputRef}
        type="date"
        name={name}
        value={displayDate || ""}
        onChange={onChange}
        className="hidden"
        required={required}
      />

      {isOpen && !disabled && createPortal(
        <div
          ref={calendarRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 p-4 w-[320px]"
          style={calendarStyle}
        >
          {/* Header with month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth("prev")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => navigateMonth("next")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-xs font-semibold text-center text-gray-500 dark:text-gray-400 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const isTodayDay = isToday(day);
              const isSelectedDay = isSelected(day);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => day && handleDateSelect(day)}
                  disabled={!day}
                  className={`
                    h-9 w-9 text-sm rounded-lg transition-all duration-150 font-medium
                    ${!day ? "cursor-default invisible" : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"}
                    ${isSelectedDay
                      ? "bg-brand-500 text-white dark:bg-brand-600 font-semibold shadow-sm"
                      : isTodayDay
                        ? "text-brand-600 dark:text-brand-400 font-bold ring-1 ring-inset ring-brand-200 dark:ring-brand-800"
                        : DayLabelColor(day)
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between">
            <button
              type="button"
              onClick={goToToday}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        , document.body
      )}

      {hint && (
        <p
          className={`mt-1.5 text-xs ${error
            ? "text-error-500"
            : "text-gray-500 dark:text-gray-400"
            }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// Helper to determine text color for regular days
function DayLabelColor(day: number | null) {
  if (!day) return "";
  return "text-gray-700 dark:text-gray-300";
}




