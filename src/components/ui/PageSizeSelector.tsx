import Select from "../form/Select";
import Label from "../form/Label";

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  options?: number[];
  className?: string;
}

export default function PageSizeSelector({
  pageSize,
  onPageSizeChange,
  options = [10, 20, 50, 100],
  className = "",
}: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Label className="mb-0 text-sm flex-nowrap whitespace-nowrap">Items per page:</Label>
      <Select
        value={pageSize.toString()}
        onChange={(value) => onPageSizeChange(parseInt(value))}
        options={options.map((size) => ({
          value: size.toString(),
          label: size.toString(),
        }))}
        className="w-20"
      />
    </div>
  );
}









