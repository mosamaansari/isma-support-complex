// Helper functions to convert backend data types to frontend types

/**
 * Convert Prisma Decimal to number
 */
export const decimalToNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  return 0;
};

/**
 * Convert product from backend format to frontend format
 */
export const normalizeProduct = (product: any) => {
  return {
    ...product,
    cost: decimalToNumber(product.cost),
    salePrice: decimalToNumber(product.salePrice),
    quantity: typeof product.quantity === 'string' ? parseInt(product.quantity) : (product.quantity || 0),
    minStockLevel: typeof product.minStockLevel === 'string' ? parseInt(product.minStockLevel) : (product.minStockLevel || 0),
  };
};

/**
 * Convert sale from backend format to frontend format
 */
export const normalizeSale = (sale: any) => {
  return {
    ...sale,
    subtotal: decimalToNumber(sale.subtotal),
    discount: decimalToNumber(sale.discount || 0),
    tax: decimalToNumber(sale.tax || 0),
    total: decimalToNumber(sale.total),
    items: sale.items?.map((item: any) => ({
      ...item,
      unitPrice: decimalToNumber(item.unitPrice),
      discount: decimalToNumber(item.discount || 0),
      tax: decimalToNumber(item.tax || 0),
      total: decimalToNumber(item.total),
    })) || [],
  };
};

/**
 * Convert expense from backend format to frontend format
 */
export const normalizeExpense = (expense: any) => {
  return {
    ...expense,
    amount: decimalToNumber(expense.amount),
  };
};


