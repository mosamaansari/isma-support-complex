import { useState, useEffect } from "react";
import Input from "./input/InputField";
import { restrictDecimalInput, handleDecimalInput } from "../../utils/numberHelpers";

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

  // Update local value when prop value changes (allowing 0 as a valid and visible value)
  useEffect(() => {
    setLocalValue(value !== null && value !== undefined ? String(value) : "");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      setLocalValue("");
      onValueChange(null);
      return;
    }

    // Use raw input value for local state to allow typing (including decimals)
    setLocalValue(inputValue);

    const numValue = handleDecimalInput(inputValue);
    if (numValue === undefined) {
      onValueChange(null);
      return;
    }

    // Apply max validation: only for percent type (typically 100)
    if (type === "percent" && effectiveMax !== undefined && numValue > effectiveMax) {
      // Don't clamp immediately during typing as it's annoying, 
      // but notify parent of the max allowed for calculations
      onValueChange(effectiveMax);
      return;
    }

    onValueChange(numValue);
  };

  const handleBlur = () => {
    // Sync local value with prop value on blur and apply clamping
    if (value !== null && value !== undefined) {
      let finalValue = value;
      if (type === "percent" && effectiveMax !== undefined && value > effectiveMax) {
        finalValue = effectiveMax;
      }
      setLocalValue(String(finalValue));
      onValueChange(finalValue);
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
          onInput={restrictDecimalInput}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={effectiveMax}
          step={typeof step === "string" ? parseFloat(step) : step}
          className="flex-1 rounded-r-none border-r-0 min-w-0 max-w-full"
        />
        <div className="flex-shrink-0 -ml-px relative">
          <select
            value={type}
            onChange={(e) => {
              const newType = e.target.value as "percent" | "value";
              onTypeChange(newType);
              // Only clamp if we are switching TO percent and the current value is > 100
              if (newType === "percent" && value !== null && value !== undefined && value > 100) {
                onValueChange(100);
                setLocalValue("100");
              }
            }}
            disabled={disabled}
            className="h-11 rounded-r-lg rounded-l-none border border-l-1 border-gray-300 bg-white dark:bg-gray-900 px-2 py-2.5 pr-6 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800 appearance-none cursor-pointer w-[60px] min-w-[60px] text-center"
          >
            <option value="value">Rs</option>
            <option value="percent">%</option>
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

