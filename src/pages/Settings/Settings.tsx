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
import { getTodayDate } from "../../utils/dateHelpers";
import { hasResourcePermission } from "../../utils/permissions";

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
    cards,
    refreshCards,
 
    deleteCard,
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
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isSubmittingBankAccount, setIsSubmittingBankAccount] = useState(false);

  const [deleteCardModalOpen, setDeleteCardModalOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);


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
    // Only fetch settings if the user has permission
    if (currentUser && hasResourcePermission(currentUser.role, 'settings:view', currentUser.permissions)) {
      refreshSettings();
    }

    // Only fetch bank accounts if the user has permission
    if (currentUser && hasResourcePermission(currentUser.role, 'bank_accounts:view', currentUser.permissions)) {
      if (bankAccounts.length === 0) {
        refreshBankAccounts();
      }
    }

    // Only fetch cards if the user has permission
    if (currentUser && hasResourcePermission(currentUser.role, 'cards:view', currentUser.permissions)) {
      if (cards.length === 0) {
        refreshCards();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

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

    setIsSubmittingSettings(true);
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
    } finally {
      setIsSubmittingSettings(false);
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
      link.download = `isma-sports-backup-${getTodayDate()}.json`;
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
    setIsSubmittingBankAccount(true);
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
    } finally {
      setIsSubmittingBankAccount(false);
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



 

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;

    try {
      await deleteCard(cardToDelete);
      showSuccess("Card deleted successfully!");
      refreshCards();
      setDeleteCardModalOpen(false);
      setCardToDelete(null);
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to delete card");
      setDeleteCardModalOpen(false);
      setCardToDelete(null);
    }
  };

  // Check overall access - if they can't see anything, show access denied
  const canViewAnything = currentUser && (
    hasResourcePermission(currentUser.role, 'settings:view', currentUser.permissions) ||
    hasResourcePermission(currentUser.role, 'bank_accounts:view', currentUser.permissions) ||
    hasResourcePermission(currentUser.role, 'cards:view', currentUser.permissions) ||
    hasResourcePermission(currentUser.role, 'backup:export', currentUser.permissions) ||
    currentUser.role === 'superadmin'
  );

  if (!currentUser || !canViewAnything) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Access denied. Insufficient permissions to view settings.
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
          {hasResourcePermission(currentUser.role, 'settings:view', currentUser.permissions) && (
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
                    disabled
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

                {hasResourcePermission(currentUser.role, 'settings:update', currentUser.permissions) && (
                  <Button type="submit" size="sm" loading={isSubmittingSettings} disabled={isSubmittingSettings}>
                    Save Shop Information
                  </Button>
                )}
              </form>
            </div>
          )}

          {hasResourcePermission(currentUser.role, 'bank_accounts:view', currentUser.permissions) && (
            <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Bank Accounts
                </h2>
                {hasResourcePermission(currentUser.role, 'bank_accounts:create', currentUser.permissions) && (
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
                )}
              </div>

              {showBankAccountForm && (
                <div className="p-4 mb-4 bg-gray-50 rounded-lg dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
                  <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white">
                    {editingAccount ? "Edit Bank Account" : "Add New Bank Account"}
                  </h3>
                  <form onSubmit={handleBankAccountSubmit} className="space-y-3">
                    <div>
                      <Label>
                        Account Name / Holder Name<span className="text-error-500">*</span>
                      </Label>
                      <Input
                        value={bankAccountForm.accountName}
                        onChange={(e) =>
                          setBankAccountForm({
                            ...bankAccountForm,
                            accountName: e.target.value,
                          })
                        }
                        placeholder="e.g. Shop Main Account"
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
                        placeholder="000000000000"
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
                        placeholder="e.g. HBL, Mezan, etc."
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
                        placeholder="Branch details"
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

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" size="sm" loading={isSubmittingBankAccount} disabled={isSubmittingBankAccount}>
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
                  <p className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No bank accounts added yet.
                  </p>
                ) : (
                  bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-200 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-800 dark:text-white text-base">
                              {account.accountName}
                            </h3>
                            {account.isDefault && (
                              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-green-700 bg-green-100 rounded dark:bg-green-900/30 dark:text-green-400">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                            {account.bankName} • {account.accountNumber}
                          </p>
                          {account.accountHolder && (
                            <p className="text-xs text-gray-500 mt-1">
                              Holder: {account.accountHolder}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {hasResourcePermission(currentUser.role, 'bank_accounts:update', currentUser.permissions) && (
                            <button
                              onClick={() => handleEditBankAccount(account)}
                              className="p-1.5 text-gray-600 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                              title="Edit"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                          {hasResourcePermission(currentUser.role, 'bank_accounts:delete', currentUser.permissions) && (
                            <button
                              onClick={() => handleDeleteBankAccount(account.id)}
                              className="p-1.5 text-red-600 transition-colors rounded-lg hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <TrashBinIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}


          {(hasResourcePermission(currentUser.role, 'backup:export', currentUser.permissions) || currentUser.role === 'superadmin') && (
            <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                Data Backup & Restore
              </h2>
              <div className="space-y-4">
                {hasResourcePermission(currentUser.role, 'backup:export', currentUser.permissions) && (
                  <div>
                    <Button onClick={handleExport} size="sm" variant="outline">
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Export Data Backup
                    </Button>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Download all data as JSON file for backup
                    </p>
                  </div>
                )}

                {currentUser.role === 'superadmin' && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Label>Import Data Backup</Label>
                    <div className="mt-2">
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
                    </div>
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Warning: Importing will replace all existing data! This cannot be undone.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Bank Account Confirmation Modal */}
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

      {/* Delete Card Confirmation Modal */}
      <Modal
        isOpen={deleteCardModalOpen}
        onClose={() => {
          setDeleteCardModalOpen(false);
          setCardToDelete(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full dark:bg-red-900/20">
            <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-center text-gray-900 dark:text-white">
            Delete Card
          </h3>
          <p className="mb-6 text-sm text-center text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this card? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setDeleteCardModalOpen(false);
                setCardToDelete(null);
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteCard}
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
