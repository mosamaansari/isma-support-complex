import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useDropzone } from "react-dropzone";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import CategorySelect from "../../components/form/CategorySelect";
import BrandSelect from "../../components/form/BrandSelect";
import { ChevronLeftIcon, TrashBinIcon } from "../../icons";
import { restrictDecimalInput } from "../../utils/numberHelpers";

const productFormSchema = yup.object().shape({
  name: yup
    .string()
    .required("Product name is required")
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(100, "Product name must be less than 100 characters"),
  category: yup
    .string()
    .optional(),
  brand: yup
    .string()
    .required("Brand is required"),
  salePrice: yup
    .number()
    .required("Sale price is required")
    .min(0, "Sale price cannot be negative")
    .max(10000000, "Sale price is too large"),
  shopQuantity: yup
    .number()
    .required("Shop quantity is required")
    .min(0, "Shop quantity cannot be negative")
    .integer("Shop quantity must be a whole number"),
  warehouseQuantity: yup
    .number()
    .required("Warehouse quantity is required")
    .min(0, "Warehouse quantity cannot be negative")
    .integer("Warehouse quantity must be a whole number"),
  shopMinStockLevel: yup
    .number()
    .required("Shop minimum stock is required")
    .min(0, "Shop minimum stock cannot be negative")
    .integer("Shop minimum stock must be a whole number"),
  warehouseMinStockLevel: yup
    .number()
    .required("Warehouse minimum stock is required")
    .min(0, "Warehouse minimum stock cannot be negative")
    .integer("Warehouse minimum stock must be a whole number"),
  model: yup
    .string()
    .optional()
    .max(100, "Model name must be less than 100 characters"),
  manufacturer: yup
    .string()
    .optional()
    .max(100, "Manufacturer name must be less than 100 characters"),
  barcode: yup
    .string()
    .optional()
    .max(50, "Barcode must be less than 50 characters"),
});

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addProduct, updateProduct, getProduct } = useData();
  const { showSuccess, showError } = useAlert();
  const isEdit = !!id;

  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: yupResolver(productFormSchema),
    defaultValues: {
      name: "",
      category: "",
      brand: "",
      salePrice: undefined,
      shopQuantity: undefined,
      warehouseQuantity: undefined,
      shopMinStockLevel: undefined,
      warehouseMinStockLevel: undefined,
      model: "",
      manufacturer: "",
      barcode: "",
    },
  });

  const formData = {
    name: watch("name"),
    category: watch("category") || "",
    brand: watch("brand") || "",
    salePrice: watch("salePrice"),
    shopQuantity: watch("shopQuantity"),
    warehouseQuantity: watch("warehouseQuantity"),
    shopMinStockLevel: watch("shopMinStockLevel"),
    warehouseMinStockLevel: watch("warehouseMinStockLevel"),
    model: watch("model"),
    manufacturer: watch("manufacturer"),
    barcode: watch("barcode"),
  };

  useEffect(() => {
    if (isEdit && id) {
      const product = getProduct(id);
      if (product) {
        reset({
          name: product.name,
          category: product.category || "",
          brand: product.brand || "",
          salePrice: product.salePrice ?? undefined,
          shopQuantity: product.shopQuantity ?? undefined,
          warehouseQuantity: product.warehouseQuantity ?? undefined,
          shopMinStockLevel: (product as any).shopMinStockLevel ?? product.minStockLevel ?? undefined,
          warehouseMinStockLevel: (product as any).warehouseMinStockLevel ?? product.minStockLevel ?? undefined,
          model: product.model || "",
          manufacturer: product.manufacturer || "",
          barcode: product.barcode || "",
        });
        if (product.image) {
          setImagePreview(product.image);
        }
      }
    }
  }, [isEdit, id, getProduct, reset]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
  });

  const removeImage = () => {
    setImagePreview("");
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const productData = {
      name: data.name.trim(),
      category: data.category || undefined,
      brand: data.brand || undefined,
      salePrice: data.salePrice || undefined,
      shopQuantity: data.shopQuantity,
      warehouseQuantity: data.warehouseQuantity,
      shopMinStockLevel: data.shopMinStockLevel,
      warehouseMinStockLevel: data.warehouseMinStockLevel,
      minStockLevel: Math.min(data.shopMinStockLevel, data.warehouseMinStockLevel),
      model: data.model || undefined,
      manufacturer: data.manufacturer || undefined,
      barcode: data.barcode || undefined,
      image: imagePreview || undefined,
    };

    try {
      if (isEdit && id) {
        await updateProduct(id, productData);
        showSuccess("Product updated successfully!");
      } else {
        await addProduct(productData);
        showSuccess("Product added successfully!");
      }
      navigate("/inventory/products");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to save product. Please try again.");
      console.error("Error saving product:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title={`${isEdit ? "Edit" : "Add"} Product | Isma Sports Complex`}
        description={`${isEdit ? "Edit" : "Add"} product to inventory`}
      />
      <div className="mb-6">
        <Link to="/inventory/products">
          <Button variant="outline" size="sm">
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
          {isEdit ? "Edit Product" : "Add New Product"}
        </h1>

        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label>
              Product Name <span className="text-error-500">*</span>
            </Label>
            <Input
              name="name"
              value={formData.name}
              onChange={(e) => {
                setValue("name", e.target.value);
              }}
              onBlur={register("name").onBlur}
              placeholder="Enter product name"
              required
              error={!!errors.name}
              hint={errors.name?.message}
            />
          </div>

          <div>
            <Label>Category</Label>
            <CategorySelect
              value={formData.category || ""}
              onChange={(value) => {
                setValue("category", value);
              }}
            />
          </div>

          <div>
            <Label>
              Brand <span className="text-error-500">*</span>
            </Label>
            <BrandSelect
              value={formData.brand || ""}
              onChange={(value) => {
                setValue("brand", value);
              }}
              required
            />
            {errors.brand && (
              <p className="mt-1 text-sm text-error-500">{errors.brand.message}</p>
            )}
          </div>

          <div>
            <Label>
              Sale Price <span className="text-error-500">*</span>
            </Label>
            <Input
              type="number"
              name="salePrice"
              step={0.01}
              min="0.01"
              value={formData.salePrice ?? ""}
              onInput={restrictDecimalInput}
              onChange={(e) => {
                if (e.target.value === "") {
                  setValue("salePrice", undefined as any);
                } else {
                  const value = parseFloat(e.target.value);
                  setValue("salePrice", isNaN(value) ? (undefined as any) : value);
                }
              }}
              onBlur={register("salePrice").onBlur}
              placeholder="0.00"
              required
              error={!!errors.salePrice}
              hint={errors.salePrice?.message}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                Shop Quantity <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                name="shopQuantity"
                min="0"
                value={formData.shopQuantity ?? ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setValue("shopQuantity", undefined as any);
                  } else {
                    const value = parseInt(e.target.value);
                    setValue("shopQuantity", isNaN(value) ? (undefined as any) : value);
                  }
                }}
                onBlur={register("shopQuantity").onBlur}
                placeholder="0"
                required
                error={!!errors.shopQuantity}
                hint={errors.shopQuantity?.message}
              />
            </div>
            <div>
              <Label>
                Warehouse Quantity <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                name="warehouseQuantity"
                min="0"
                value={formData.warehouseQuantity ?? ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setValue("warehouseQuantity", undefined as any);
                  } else {
                    const value = parseInt(e.target.value);
                    setValue("warehouseQuantity", isNaN(value) ? (undefined as any) : value);
                  }
                }}
                onBlur={register("warehouseQuantity").onBlur}
                placeholder="0"
                required
                error={!!errors.warehouseQuantity}
                hint={errors.warehouseQuantity?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Model</Label>
              <Input
                name="model"
                value={formData.model}
                onChange={(e) => {
                  setValue("model", e.target.value);
                }}
                onBlur={register("model").onBlur}
                placeholder="Enter model (optional)"
                error={!!errors.model}
                hint={errors.model?.message}
              />
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Input
                name="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => {
                  setValue("manufacturer", e.target.value);
                }}
                onBlur={register("manufacturer").onBlur}
                placeholder="Enter manufacturer (optional)"
                error={!!errors.manufacturer}
                hint={errors.manufacturer?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                Shop Min Stock <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                name="shopMinStockLevel"
                min="0"
                value={formData.shopMinStockLevel ?? ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setValue("shopMinStockLevel", undefined as any);
                  } else {
                    const value = parseInt(e.target.value);
                    setValue("shopMinStockLevel", isNaN(value) ? (undefined as any) : value);
                  }
                }}
                onBlur={register("shopMinStockLevel").onBlur}
                placeholder="0"
                required
                error={!!errors.shopMinStockLevel}
                hint={errors.shopMinStockLevel?.message}
              />
            </div>
            <div>
              <Label>
                Warehouse Min Stock <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                name="warehouseMinStockLevel"
                min="0"
                value={formData.warehouseMinStockLevel ?? ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setValue("warehouseMinStockLevel", undefined as any);
                  } else {
                    const value = parseInt(e.target.value);
                    setValue("warehouseMinStockLevel", isNaN(value) ? (undefined as any) : value);
                  }
                }}
                onBlur={register("warehouseMinStockLevel").onBlur}
                placeholder="0"
                required
                error={!!errors.warehouseMinStockLevel}
                hint={errors.warehouseMinStockLevel?.message}
              />
            </div>
          </div>
          <div>
            <Label>Barcode (Optional)</Label>
            <Input
              name="barcode"
              value={formData.barcode}
              onChange={(e) => {
                setValue("barcode", e.target.value);
              }}
              onBlur={register("barcode").onBlur}
              placeholder="Enter barcode"
              error={!!errors.barcode}
              hint={errors.barcode?.message}
            />
          </div>

          <div>
            <Label>Product Image (Optional)</Label>
            {imagePreview ? (
              <div className="mt-2">
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-32 w-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <TrashBinIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`mt-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                    : "border-gray-300 dark:border-gray-700 hover:border-brand-400"
                }`}
              >
                <input {...getInputProps()} />
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {isDragActive
                      ? "Drop the image here"
                      : "Drag & drop an image here, or click to select"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    PNG, JPG, WEBP up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button type="submit" size="sm" loading={isSubmitting} disabled={isSubmitting}>
              {isEdit ? "Update Product" : "Add Product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/inventory/products")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
