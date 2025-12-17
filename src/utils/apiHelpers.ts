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
  // Parse payments if it's a JSON string
  let payments = sale.payments;
  if (typeof payments === 'string') {
    try {
      payments = JSON.parse(payments);
    } catch (e) {
      payments = null;
    }
  }
  
  return {
    ...sale,
    subtotal: decimalToNumber(sale.subtotal),
    discount: decimalToNumber(sale.discount || 0),
    tax: decimalToNumber(sale.tax || 0),
    total: decimalToNumber(sale.total),
    remainingBalance: sale.remainingBalance !== undefined && sale.remainingBalance !== null 
      ? decimalToNumber(sale.remainingBalance) 
      : undefined,
    payments: payments || [],
    date: sale.date ? (typeof sale.date === 'string' ? sale.date : new Date(sale.date).toISOString()) : sale.createdAt,
    customerCity: sale.customerCity || null,
    status: sale.status || 'completed',
    items: sale.items?.map((item: any) => ({
      ...item,
      unitPrice: decimalToNumber(item.unitPrice),
      customPrice: item.customPrice !== undefined && item.customPrice !== null 
        ? decimalToNumber(item.customPrice) 
        : undefined,
      discount: decimalToNumber(item.discount || 0),
      tax: decimalToNumber(item.tax || 0),
      total: decimalToNumber(item.total),
      discountType: item.discountType || 'percent',
      taxType: item.taxType || 'percent',
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

/**
 * Convert purchase from backend format to frontend format
 */
export const normalizePurchase = (purchase: any) => {
  // Parse payments if it's a JSON string
  let payments = purchase.payments;
  if (typeof payments === 'string') {
    try {
      payments = JSON.parse(payments);
    } catch (e) {
      payments = null;
    }
  }
  
  return {
    ...purchase,
    subtotal: decimalToNumber(purchase.subtotal),
    tax: decimalToNumber(purchase.tax || 0),
    total: decimalToNumber(purchase.total),
    remainingBalance: purchase.remainingBalance !== undefined && purchase.remainingBalance !== null 
      ? decimalToNumber(purchase.remainingBalance) 
      : 0,
    payments: payments || [],
    status: purchase.status || 'completed',
    date: purchase.date ? (typeof purchase.date === 'string' ? purchase.date : new Date(purchase.date).toISOString()) : purchase.createdAt,
    items: purchase.items?.map((item: any) => ({
      ...item,
      cost: decimalToNumber(item.cost),
      discount: decimalToNumber(item.discount || 0),
      total: decimalToNumber(item.total),
    })) || [],
  };
};


