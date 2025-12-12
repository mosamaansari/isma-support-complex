import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon } from "../../icons";

export default function Settings() {
  const { settings, updateSettings, exportData, importData, currentUser } =
    useData();
  const [formData, setFormData] = useState(settings);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    alert("Settings updated successfully!");
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `isma_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importFile) {
      alert("Please select a file to import");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const result = await importData(content);
      if (result) {
        alert("Data imported successfully!");
        setImportFile(null);
        window.location.reload();
      } else {
        alert("Error importing data. Please check the file format.");
      }
    };
    reader.readAsText(importFile);
  };

  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Access denied. Admin or SuperAdmin privileges required.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Settings | Isma Sports Complex"
        description="Manage shop settings and data backup"
      />
      <div className="max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
          Settings
        </h1>

        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Shop Information
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>
                  Shop Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.shopName}
                  onChange={(e) =>
                    setFormData({ ...formData, shopName: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label>Logo URL</Label>
                <Input
                  value={formData.logo}
                  onChange={(e) =>
                    setFormData({ ...formData, logo: e.target.value })
                  }
                  placeholder="/images/logo/logo.png"
                />
              </div>

              <div>
                <Label>
                  Contact Number <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.contactNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, contactNumber: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>GST Number</Label>
                <Input
                  value={formData.gstNumber || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, gstNumber: e.target.value })
                  }
                />
              </div>

              <Button type="submit" size="sm">
                Save Shop Information
              </Button>
            </form>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Bank Account Details
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>
                  Bank Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label>
                  Account Number <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.bankAccountNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccountNumber: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label>
                  IFSC Code <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.ifscCode}
                  onChange={(e) =>
                    setFormData({ ...formData, ifscCode: e.target.value })
                  }
                  required
                />
              </div>

              <Button type="submit" size="sm">
                Save Bank Details
              </Button>
            </form>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Data Backup & Restore
            </h2>
            <div className="space-y-4">
              <div>
                <Button onClick={handleExport} size="sm" variant="outline">
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export Data Backup
                </Button>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Download all data as JSON file for backup
                </p>
              </div>

              <div>
                <Label>Import Data Backup</Label>
              <input
                type="file"
                accept=".json"
                onChange={(e) =>
                  setImportFile(e.target.files?.[0] || null)
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
                <Button
                  onClick={handleImport}
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={!importFile}
                >
                  Import Data
                </Button>
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Warning: Importing will replace all existing data!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

