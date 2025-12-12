import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDropzone } from "react-dropzone";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import CategorySelect from "../../components/form/CategorySelect";
import { ChevronLeftIcon, TrashBinIcon } from "../../icons";

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addProduct, updateProduct, getProduct } = useData();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    cost: 0,
    salePrice: 0,
    quantity: "",
    minStockLevel: "",
    barcode: "",
    image: "",
  });
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    if (isEdit && id) {
      const product = getProduct(id);
      if (product) {
        setFormData({
          name: product.name,
          category: product.category,
          cost: product.cost,
          salePrice: product.salePrice,
          quantity: product.quantity.toString(),
          minStockLevel: product.minStockLevel.toString(),
          barcode: product.barcode || "",
          image: product.image || "",
        });
        if (product.image) {
          setImagePreview(product.image);
        }
      }
    }
  }, [isEdit, id, getProduct]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData({ ...formData, image: result });
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
    setFormData({ ...formData, image: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      name: formData.name,
      category: formData.category,
      cost: formData.cost,
      salePrice: formData.salePrice,
      quantity: parseInt(formData.quantity),
      minStockLevel: parseInt(formData.minStockLevel),
      barcode: formData.barcode || undefined,
      image: formData.image || undefined,
    };

    if (isEdit && id) {
      updateProduct(id, productData);
    } else {
      addProduct(productData);
    }

    navigate("/inventory/products");
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>
              Product Name <span className="text-error-500">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <Label>
              Category <span className="text-error-500">*</span>
            </Label>
            <CategorySelect
              value={formData.category}
              onChange={(value) =>
                setFormData({ ...formData, category: value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                Cost Price <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                step={0.01}
                min="0"
                value={String(formData.cost)}
                onChange={(e) =>
                  setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label>
                Sale Price <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                step={0.01}
                min="0"
                value={String(formData.salePrice)}
                onChange={(e) =>
                  setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                Quantity <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                placeholder="0"
                required
              />
            </div>

            <div>
              <Label>
                Minimum Stock Level <span className="text-error-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.minStockLevel}
                onChange={(e) =>
                  setFormData({ ...formData, minStockLevel: e.target.value })
                }
                placeholder="0"
                required
              />
            </div>
          </div>

          <div>
            <Label>Barcode (Optional)</Label>
            <Input
              value={formData.barcode}
              onChange={(e) =>
                setFormData({ ...formData, barcode: e.target.value })
              }
              placeholder="Enter barcode"
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
            <Button type="submit" size="sm">
              {isEdit ? "Update Product" : "Add Product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/inventory/products")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

