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


