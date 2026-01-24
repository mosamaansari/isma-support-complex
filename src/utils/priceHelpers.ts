/**
 * Format a number as complete amount with commas (no abbreviations) for amounts < 1M
 * For amounts >= 1M, use "M" abbreviation
 * Examples:
 * - 10000 -> "Rs. 10,000.00"
 * - 2000 -> "Rs. 2,000.00"
 * - 1500000 -> "Rs. 1.5M"
 * - 5000000 -> "Rs. 5M"
 */
export function formatPriceWithCurrencyComplete(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  
  if (absAmount >= 1_000_000) {
    // Million or more - use M abbreviation
    const value = absAmount / 1_000_000;
    if (value >= 100) {
      return `${sign}Rs. ${value.toFixed(0)}M`;
    } else if (value >= 10) {
      return `${sign}Rs. ${value.toFixed(1)}M`;
    } else {
      return `${sign}Rs. ${value.toFixed(2)}M`;
    }
  } else {
    // Less than 1M - show complete price with commas
    return `${sign}Rs. ${formatCompleteAmount(absAmount)}`;
  }
}

/**
 * Format a number with abbreviations (K, M, B, T)
 * Examples:
 * - 1030 -> "1.03K"
 * - 1030000 -> "1.03M"
 * - 1030000000 -> "1.03B"
 * - 1030000000000 -> "1.03T"
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return "0";
  
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  
  if (absAmount >= 1_000_000_000_000) {
    // Trillion
    const value = absAmount / 1_000_000_000_000;
    return `${sign}${formatDecimal(value)}T`;
  } else if (absAmount >= 1_000_000_000) {
    // Billion
    const value = absAmount / 1_000_000_000;
    return `${sign}${formatDecimal(value)}B`;
  } else if (absAmount >= 1_000_000) {
    // Million
    const value = absAmount / 1_000_000;
    return `${sign}${formatDecimal(value)}M`;
  } else if (absAmount >= 1_000) {
    // Thousand
    const value = absAmount / 1_000;
    return `${sign}${formatDecimal(value)}K`;
  } else {
    // Less than 1000, show with 2 decimal places
    return `${sign}${absAmount.toFixed(2)}`;
  }
}

/**
 * Format decimal value with appropriate precision
 */
function formatDecimal(value: number): string {
  if (value >= 100) {
    return value.toFixed(0);
  } else if (value >= 10) {
    return value.toFixed(1);
  } else {
    return value.toFixed(2);
  }
}

/**
 * Format price with Rs. prefix and abbreviation
 */
export function formatPriceWithCurrency(amount: number): string {
  return `Rs. ${formatPrice(amount)}`;
}

/**
 * Format a number as complete amount with commas and two decimal places (no abbreviations)
 * Examples:
 * - 1030 -> "1,030.00"
 * - 1030000 -> "1,030,000.00"
 * - 50000 -> "50,000.00"
 */
export function formatCompleteAmount(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

