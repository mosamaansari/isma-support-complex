import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon, PlusIcon, TrashBinIcon, PencilIcon } from "../../icons";

export default function Settings() {
  const {
    settings,
    updateSettings,
    exportData,
    importData,
    currentUser,
    bankAccounts,
    refreshBankAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
  } = useData();
  const [formData, setFormData] = useState(settings);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showBankAccountForm, setShowBankAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [bankAccountForm, setBankAccountForm] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    ifscCode: "",
    accountHolder: "",
    branchName: "",
    isDefault: false,
  });

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, bankAccountForm);
        alert("Bank account updated successfully!");
      } else {
        await addBankAccount(bankAccountForm);
        alert("Bank account added successfully!");
      }
      setShowBankAccountForm(false);
      setEditingAccount(null);
      setBankAccountForm({
        accountName: "",
        accountNumber: "",
        bankName: "",
        ifscCode: "",
        accountHolder: "",
        branchName: "",
        isDefault: false,
      });
      refreshBankAccounts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save bank account");
    }
  };

  const handleEditBankAccount = (account: any) => {
    setEditingAccount(account);
    setBankAccountForm({
      accountName: account.accountName || "",
      accountNumber: account.accountNumber || "",
      bankName: account.bankName || "",
      ifscCode: account.ifscCode || "",
      accountHolder: account.accountHolder || "",
      branchName: account.branchName || "",
      isDefault: account.isDefault || false,
    });
    setShowBankAccountForm(true);
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (confirm("Are you sure you want to delete this bank account?")) {
      try {
        await deleteBankAccount(id);
        alert("Bank account deleted successfully!");
        refreshBankAccounts();
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to delete bank account");
      }
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
                    ifscCode: "",
                    accountHolder: "",
                    branchName: "",
                    isDefault: false,
                  });
                  setShowBankAccountForm(true);
                }}
                size="sm"
                variant="outline"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
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
                      Account Name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      value={bankAccountForm.accountName}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          accountName: e.target.value,
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
                    <Label>
                      IFSC Code <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      value={bankAccountForm.ifscCode}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          ifscCode: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>Account Holder</Label>
                    <Input
                      value={bankAccountForm.accountHolder}
                      onChange={(e) =>
                        setBankAccountForm({
                          ...bankAccountForm,
                          accountHolder: e.target.value,
                        })
                      }
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
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          IFSC: {account.ifscCode}
                        </p>
                        {account.accountHolder && (
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
    </>
  );
}
