import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Select from "../form/Select";
import api from "../../services/api";
import { useAlert } from "../../context/AlertContext";
import { useData } from "../../context/DataContext";
import { getTodayDate } from "../../utils/dateHelpers";

interface TransferBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    date?: string; // Date for which to transfer balance
}

export default function TransferBalanceModal({
    isOpen,
    onClose,
    onSuccess,
    date: selectedDate,
}: TransferBalanceModalProps) {
    const { showSuccess } = useAlert();
    const { currentUser, bankAccounts } = useData();
    const [amount, setAmount] = useState<number | null>(0);
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fromType, setFromType] = useState<"cash" | "bank">("cash");
    const [toType, setToType] = useState<"cash" | "bank">("bank");
    const [fromBankId, setFromBankId] = useState<string | undefined>();
    const [toBankId, setToBankId] = useState<string | undefined>();

    const [currentRunningBalance, setCurrentRunningBalance] = useState<number>(0);

    // Field-specific errors
    const [errors, setErrors] = useState<{
        amount?: string;
        fromBank?: string;
        toBank?: string;
        general?: string;
    }>({});

    useEffect(() => {
        if (isOpen) {
            setFromType("cash");
            setToType("bank");
            setFromBankId(undefined);
            setToBankId(undefined);
            setAmount(0);
            setDescription("");
            setErrors({});

            fetchSourceBalance("cash", undefined);
        }
    }, [isOpen, selectedDate]);

    const fetchSourceBalance = (type: string, bankId: string | undefined) => {
        const dateStr = selectedDate || getTodayDate();
        api.getOpeningBalance(dateStr).then(balance => {
            if (balance) {
                if (type === "bank" && bankId) {
                    const bank = (balance.bankBalances as any[])?.find((b: any) => b.bankAccountId === bankId);
                    setCurrentRunningBalance(Number(bank?.balance) || 0);
                } else if (type === "cash") {
                    setCurrentRunningBalance(Number(balance.cashBalance) || 0);
                } else {
                    setCurrentRunningBalance(0);
                }
            } else {
                setCurrentRunningBalance(0);
            }
        }).catch(() => setCurrentRunningBalance(0));
    };

    useEffect(() => {
        if (fromType && isOpen) {
            fetchSourceBalance(fromType, fromBankId);
        }
    }, [fromType, fromBankId, isOpen])


    const handleSubmit = async () => {
        setErrors({});

        if (amount === null || amount <= 0) {
            setErrors({ amount: "Amount must be greater than 0" });
            return;
        }

        if (fromType === "bank" && !fromBankId) {
            setErrors({ fromBank: "Please select a source bank account" });
            return;
        }

        if (toType === "bank" && !toBankId) {
            setErrors({ toBank: "Please select a destination bank account" });
            return;
        }

        if (fromType === toType && fromType === "bank" && fromBankId === toBankId) {
            setErrors({ general: "Source and destination cannot be the same" });
            return;
        }

        if (fromType === toType && fromType === "cash") {
            setErrors({ general: "Cannot transfer from cash to cash" });
            return;
        }

        if (!currentUser) {
            setErrors({ general: "User not logged in" });
            return;
        }

        setIsSubmitting(true);
        try {
            const dateStr = selectedDate || getTodayDate();

            await api.transferOpeningBalance({
                date: dateStr,
                amount: amount || 0,
                fromType: fromType,
                toType: toType,
                fromBankAccountId: fromType === "bank" ? fromBankId : undefined,
                toBankAccountId: toType === "bank" ? toBankId : undefined,
                description: description || undefined,
            });

            showSuccess(`Balance transferred successfully!`);
            setAmount(0);
            setDescription("");
            setFromType("cash");
            setToType("bank");
            setFromBankId(undefined);
            setToBankId(undefined);
            setErrors({});
            onSuccess();
            onClose();
        } catch (error: any) {
            const errorData = error.response?.data;
            if (errorData?.error) {
                setErrors({ general: errorData.error || errorData.message || "Failed to transfer balance" });
            } else {
                setErrors({ general: "Failed to transfer balance. Please try again." });
            }
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md m-4">
            <div className="p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                    Transfer Balance
                </h2>

                {errors.general && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">{errors.general}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="p-3 bg-brand-50 dark:bg-brand-900/10 rounded-lg border border-brand-100 dark:border-brand-900/20">
                        <p className="text-xs text-brand-700 dark:text-brand-300">
                            Available Source Balance: <span className="font-bold">Rs. {currentRunningBalance.toFixed(2)}</span>
                        </p>
                    </div>

                    {/* Source Selection */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                        <h3 className="font-medium text-gray-800 dark:text-gray-200">From</h3>
                        <div>
                            <Label>Source Type <span className="text-error-500">*</span></Label>
                            <Select
                                value={fromType}
                                onChange={(value) => {
                                    setFromType(value as "cash" | "bank");
                                    if (value === "cash") setFromBankId(undefined);
                                }}
                                options={[
                                    { value: "cash", label: "Cash" },
                                    { value: "bank", label: "Bank Account" },
                                ]}
                            />
                        </div>

                        {fromType === "bank" && (
                            <div>
                                <Label>Source Bank <span className="text-error-500">*</span></Label>
                                <Select
                                    value={fromBankId || ""}
                                    onChange={(value) => {
                                        setFromBankId(value || undefined);
                                        setErrors((prev) => ({ ...prev, fromBank: undefined }));
                                    }}
                                    placeholder="Select Bank Account"
                                    options={bankAccounts.map((bank) => ({
                                        value: bank.id,
                                        label: `${bank.bankName} - ${bank.accountNumber}`,
                                    }))}
                                />
                                {errors.fromBank && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.fromBank}</p>}
                            </div>
                        )}
                    </div>

                    {/* Destination Selection */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                        <h3 className="font-medium text-gray-800 dark:text-gray-200">To</h3>
                        <div>
                            <Label>Destination Type <span className="text-error-500">*</span></Label>
                            <Select
                                value={toType}
                                onChange={(value) => {
                                    setToType(value as "cash" | "bank");
                                    if (value === "cash") setToBankId(undefined);
                                }}
                                options={[
                                    { value: "cash", label: "Cash" },
                                    { value: "bank", label: "Bank Account" },
                                ]}
                            />
                        </div>

                        {toType === "bank" && (
                            <div>
                                <Label>Destination Bank <span className="text-error-500">*</span></Label>
                                <Select
                                    value={toBankId || ""}
                                    onChange={(value) => {
                                        setToBankId(value || undefined);
                                        setErrors((prev) => ({ ...prev, toBank: undefined }));
                                    }}
                                    placeholder="Select Bank Account"
                                    options={bankAccounts.map((bank) => ({
                                        value: bank.id,
                                        label: `${bank.bankName} - ${bank.accountNumber}`,
                                    }))}
                                />
                                {errors.toBank && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.toBank}</p>}
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Transfer Amount <span className="text-error-500">*</span></Label>
                        <Input
                            type="number"
                            step={0.01}
                            value={amount}
                            onChange={(e) => {
                                const value = e.target.value === "" ? null : parseFloat(e.target.value);
                                if (value !== null && value < 0) return;
                                if (value) {
                                    setAmount(isNaN(value) ? null : value);
                                } else {
                                    setAmount(null);
                                }
                                setErrors((prev) => ({ ...prev, amount: undefined }));
                            }}
                            placeholder="Enter amount"
                            required
                            className={errors.amount ? "border-red-500" : ""}
                        />
                        {errors.amount && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.amount}</p>}
                    </div>

                    <div>
                        <Label>Description (Optional)</Label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300"
                            placeholder="Add description for transfer"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleSubmit}
                            loading={isSubmitting}
                            disabled={isSubmitting || (amount === null || amount <= 0) || (fromType === "bank" && !fromBankId) || (toType === "bank" && !toBankId)}
                            className="flex-1"
                            size="sm"
                        >
                            Transfer
                        </Button>
                        <Button variant="outline" onClick={onClose} className="flex-1" size="sm">
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
