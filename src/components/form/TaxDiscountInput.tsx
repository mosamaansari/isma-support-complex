import { useState, useEffect } from "react";
import Input from "./input/InputField";

interface TaxDiscountInputProps {
  value: number | null | undefined;
  type: "percent" | "value";
  onValueChange: (value: number | null | undefined) => void;
  onTypeChange: (type: "percent" | "value") => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: string | number;
}

export default function TaxDiscountInput({
  value,
  type,
  onValueChange,
  onTypeChange,
  placeholder = "0",
  className = "",
  disabled = false,
  min,
  max,
  step = 0.01,
}: TaxDiscountInputProps) {
  // Set max to 100 for percentage type if not explicitly provided
  const effectiveMax = max !== undefined ? max : (type === "percent" ? 100 : undefined);
  
  const [localValue, setLocalValue] = useState<string>(
    value !== null && value !== undefined ? String(value) : ""
  );

  // Update local value when prop value changes (but don't sync if user is typing)
  useEffect(() => {
    setLocalValue(value !== null && value !== undefined && value !== 0 ? String(value) : "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputValue === "") {
      setLocalValue("");
      onValueChange(null);
      return;
    }
    
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      return;
    }

    // Apply max validation: if type is percent and no explicit max, limit to 100
    if (effectiveMax !== undefined && numValue > effectiveMax) {
      // Clamp to max value
      setLocalValue(String(effectiveMax));
      onValueChange(effectiveMax);
      return;
    }

    setLocalValue(inputValue);
    onValueChange(numValue);
  };

  const handleBlur = () => {
    // Sync local value with prop value on blur, and validate max
    if (value !== null && value !== undefined) {
      if (effectiveMax !== undefined && value > effectiveMax) {
        setLocalValue(String(effectiveMax));
        onValueChange(effectiveMax);
      } else {
        setLocalValue(value !== 0 ? String(value) : "");
      }
    } else {
      setLocalValue("");
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-stretch">
        <Input
          type="number"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={effectiveMax}
          step={typeof step === "string" ? parseFloat(step) : step}
          className="flex-1 rounded-r-none border-r-0"
        />
        <div className="flex-shrink-0 -ml-px relative">
          <select
            value={type}
            onChange={(e) => {
              const newType = e.target.value as "percent" | "value";
              onTypeChange(newType);
              // If changing to percent and value > 100, clamp it
              if (newType === "percent" && value !== null && value !== undefined && value > 100) {
                onValueChange(100);
                setLocalValue("100");
              }
            }}
            disabled={disabled}
            className="h-11 rounded-r-lg rounded-l-none border border-l-1 border-gray-300 bg-transparent px-2  py-2.5 pr-6 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 appearance-none cursor-pointer w-[50px] min-w-[50px] text-center"
          >
            <option value="percent">%</option>
            <option value="value">Rs</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

