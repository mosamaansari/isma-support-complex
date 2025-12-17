import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { DownloadIcon, TrashBinIcon, PencilIcon } from "../../icons";
import api from "../../services/api";

export default function Settings() {
  const {
    settings,
    updateSettings,
    refreshSettings,
    currentUser,
    bankAccounts,
    refreshBankAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
  } = useData();
  const { showSuccess, showError } = useAlert();
  const [formData, setFormData] = useState(settings);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showBankAccountForm, setShowBankAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [bankAccountForm, setBankAccountForm] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    accountHolder: "",
    branchName: "",
    isDefault: false,
  });

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // Exclude bank fields and system fields from formData
      const { bankName, bankAccountNumber, ifscCode, id, createdAt, updatedAt, ...cleanSettings } = settings as any;
      setFormData(cleanSettings);
    } else {
      refreshSettings();
    }
  }, [settings, refreshSettings]);

  useEffect(() => {
    refreshSettings();
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    // Frontend validation
    const errors: Record<string, string> = {};
    if (!formData.shopName || formData.shopName.trim() === "") {
      errors.shopName = "Shop name is required";
    }
    if (!formData.contactNumber || formData.contactNumber.trim() === "") {
      errors.contactNumber = "Contact number is required";
    }
    if (formData.email && formData.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      // Exclude id, createdAt, updatedAt, and bank fields from the data being sent
      const { id, createdAt, updatedAt, bankName, bankAccountNumber, ifscCode, ...settingsToUpdate } = formData as any;
      await updateSettings(settingsToUpdate);
      setFormErrors({});
      showSuccess("Settings updated successfully!");
      refreshSettings();
    } catch (error: any) {
      const errorData = error.response?.data;
      
      // Handle backend validation errors
      if (errorData?.error && typeof errorData.error === 'object') {
        const backendErrors: Record<string, string> = {};
        Object.keys(errorData.error).forEach((key) => {
          // Remove "data." prefix from error keys
          const fieldName = key.replace("data.", "");
          const errorMessages = errorData.error[key];
          if (Array.isArray(errorMessages) && errorMessages.length > 0) {
            backendErrors[fieldName] = errorMessages[0];
          } else if (typeof errorMessages === 'string') {
            backendErrors[fieldName] = errorMessages;
          }
        });
        setFormErrors(backendErrors);
        
        // Show general error message
        const firstError = Object.values(backendErrors)[0];
        if (firstError) {
          showError(firstError);
        }
      } else {
        showError(errorData?.message || errorData?.error || "Failed to update settings");
      }
    }
  };

  const handleExport = async () => {
    try {
      // Export to JSON (all data)
      const jsonData = await api.exportAllData();
      const blob = new Blob([jsonData], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `isma-sports-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess("Data backup exported successfully!");
    } catch (error: any) {
      console.error("Error exporting data:", error);
      showError("Failed to export data. Please try again.");
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showError("Please select a file to import");
      return;
    }

    const reader = new FileReader();
    
    reader.onerror = () => {
      showError("Error reading file. Please try again.");
    };

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        
        if (!content || content.trim() === "") {
          showError("File is empty. Please select a valid JSON file.");
          return;
        }

        let parsedData;
        
        // Parse JSON
        try {
          // Trim whitespace and try to parse
          const trimmedContent = content.trim();
          parsedData = JSON.parse(trimmedContent);
        } catch (parseError: any) {
          console.error("JSON Parse Error:", parseError);
          console.error("File content (first 500 chars):", content.substring(0, 500));
          showError(`Invalid JSON file: ${parseError.message}. Please check the file format.`);
          return;
        }

        // Validate that we have some data
        if (!parsedData || (typeof parsedData !== 'object')) {
          showError("Invalid file format. Expected a JSON object.");
          return;
        }

        // Handle both old format (direct data) and new format (with data wrapper)
        // If export format has { exportDate, version, data: {...} }, use data
        // Otherwise use the whole object
        let dataToImport;
        if (parsedData.data && typeof parsedData.data === 'object') {
          dataToImport = parsedData.data;
        } else if (parsedData.products || parsedData.sales || parsedData.settings) {
          // Old format - data is directly in the root
          dataToImport = parsedData;
        } else {
          showError("Invalid data structure. The file should contain exported data.");
          return;
        }

        // Validate data structure
        if (!dataToImport || (typeof dataToImport !== 'object')) {
          showError("Invalid data structure. The file should contain data objects.");
          return;
        }

        // Call backend API to import - send the data object directly
        await api.importAllData(dataToImport);
        
        showSuccess("Data imported successfully!");
        setImportFile(null);
        
        // Refresh all data
        refreshSettings();
        refreshBankAccounts();
        
        // Reload page after a short delay to show success message
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error: any) {
        console.error("Error importing data:", error);
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Error importing data. Please check the file format.";
        showError(errorMessage);
      }
    };
    
    // Read file as text with UTF-8 encoding
    reader.readAsText(importFile, "UTF-8");
  };

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Ensure accountHolder is set to accountName if not provided
      const formDataToSubmit = {
        ...bankAccountForm,
        accountHolder: bankAccountForm.accountHolder || bankAccountForm.accountName,
      };
      
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, formDataToSubmit);
        showSuccess("Bank account updated successfully!");
      } else {
        await addBankAccount(formDataToSubmit);
        showSuccess("Bank account added successfully!");
      }
      setShowBankAccountForm(false);
      setEditingAccount(null);
      setBankAccountForm({
        accountName: "",
        accountNumber: "",
        bankName: "",
        accountHolder: "",
        branchName: "",
        isDefault: false,
      });
      refreshBankAccounts();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to save bank account";
      showError(errorMessage);
    }
  };

  const handleEditBankAccount = (account: any) => {
    setEditingAccount(account);
    setBankAccountForm({
      accountName: account.accountName || "",
      accountNumber: account.accountNumber || "",
      bankName: account.bankName || "",
      accountHolder: account.accountHolder || account.accountName || "",
      branchName: account.branchName || "",
      isDefault: account.isDefault || false,
    });
    setShowBankAccountForm(true);
  };

  const handleDeleteBankAccount = (id: string) => {
    setAccountToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteBankAccount = async () => {
    if (!accountToDelete) return;
    
    try {
      await deleteBankAccount(accountToDelete);
      showSuccess("Bank account deleted successfully!");
      refreshBankAccounts();
      setDeleteModalOpen(false);
      setAccountToDelete(null);
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to delete bank account");
      setDeleteModalOpen(false);
      setAccountToDelete(null);
    }
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
                  value={formData.shopName || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, shopName: e.target.value });
                    if (formErrors.shopName) {
                      setFormErrors({ ...formErrors, shopName: "" });
                    }
                  }}
                  error={!!formErrors.shopName}
                  hint={formErrors.shopName}
                  required
                />
              </div>

              <div>
                <Label>Logo URL</Label>
                <Input
                  value={formData.logo || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, logo: e.target.value });
                    if (formErrors.logo) {
                      setFormErrors({ ...formErrors, logo: "" });
                    }
                  }}
                  error={!!formErrors.logo}
                  hint={formErrors.logo}
                  placeholder="/images/logo/logo.png"
                />
              </div>

              <div>
                <Label>
                  Contact Number <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.contactNumber || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, contactNumber: e.target.value });
                    if (formErrors.contactNumber) {
                      setFormErrors({ ...formErrors, contactNumber: "" });
                    }
                  }}
                  error={!!formErrors.contactNumber}
                  hint={formErrors.contactNumber}
                  required
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) {
                      setFormErrors({ ...formErrors, email: "" });
                    }
                  }}
                  error={!!formErrors.email}
                  hint={formErrors.email}
                />
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  value={formData.address || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                    if (formErrors.address) {
                      setFormErrors({ ...formErrors, address: "" });
                    }
                  }}
                  error={!!formErrors.address}
                  hint={formErrors.address}
                />
              </div>

              <div>
                <Label>GST Number</Label>
                <Input
                  value={formData.gstNumber || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, gstNumber: e.target.value });
                    if (formErrors.gstNumber) {
                      setFormErrors({ ...formErrors, gstNumber: "" });
                    }
                  }}
                  error={!!formErrors.gstNumber}
                  hint={formErrors.gstNumber}
                />
              </div>

              <Button type="submit" size="sm">
                Save Shop Information
              </Button>
            </form>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Bank Accounts
              </h2>
              <Button
                onClick={() => {
                  setEditingAccount(null);
                  setBankAccountForm({
                    accountName: "",
                    accountNumber: "",
                    bankName: "",
                    accountHolder: "",
                    branchName: "",
                    isDefault: false,
                  });
                  setShowBankAccountForm(true);
                }}
                size="sm"
                variant="outline"
                startIcon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Add Bank Account
              </Button>
            </div>

            {showBankAccountForm && (
              <div className="p-4 mb-4 bg-gray-50 rounded-lg dark:bg-gray-900">
                <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white">
                  {editingAccount ? "Edit Bank Account" : "Add New Bank Account"}
                </h3>
                <form onSubmit={handleBankAccountSubmit} className="space-y-3">
                  <div>
                    <Label>
                      Account Name / Holder Name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      value={bankAccountForm.accountName}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          accountName: e.target.value,
                          accountHolder: e.target.value, // Auto-fill accountHolder with accountName
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>
                      Account Number <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      value={bankAccountForm.accountNumber}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          accountNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>
                      Bank Name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      value={bankAccountForm.bankName}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          bankName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>Branch Name</Label>
                    <Input
                      value={bankAccountForm.branchName}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          branchName: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={bankAccountForm.isDefault}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          isDefault: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                    />
                    <Label htmlFor="isDefault" className="ml-2">
                      Set as Default Account
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      {editingAccount ? "Update" : "Add"} Account
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowBankAccountForm(false);
                        setEditingAccount(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {bankAccounts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No bank accounts added yet. Click "Add Bank Account" to add one.
                </p>
              ) : (
                bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 border border-gray-200 rounded-lg dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800 dark:text-white">
                            {account.accountName}
                          </h3>
                          {account.isDefault && (
                            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded dark:bg-green-900 dark:text-green-300">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {account.bankName} - {account.accountNumber}
                        </p>
                        {account.accountHolder && account.accountHolder !== account.accountName && (
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            Holder: {account.accountHolder}
                          </p>
                        )}
                        {account.branchName && (
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            Branch: {account.branchName}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditBankAccount(account)}
                          className="p-2 text-gray-600 transition-colors rounded hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBankAccount(account.id)}
                          className="p-2 text-red-600 transition-colors rounded hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <TrashBinIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setAccountToDelete(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full dark:bg-red-900/20">
            <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-center text-gray-900 dark:text-white">
            Delete Bank Account
          </h3>
          <p className="mb-6 text-sm text-center text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this bank account? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
                setAccountToDelete(null);
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteBankAccount}
              size="sm"
              variant="primary"
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
