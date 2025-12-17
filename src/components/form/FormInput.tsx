import React from "react";
import Input from "./input/InputField";
import Label from "./Label";

interface FormInputProps {
  label: string;
  name: string;
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export default function FormInput({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  required = false,
  min,
  max,
  step,
  disabled = false,
  className = "",
}: FormInputProps) {
  return (
    <div className={className}>
      <Label>
        {label} {required && <span className="text-error-500">*</span>}
      </Label>
      <Input
        type={type}
        id={name}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        error={!!error}
        required={required}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        hint={error}
      />
    </div>
  );
}






