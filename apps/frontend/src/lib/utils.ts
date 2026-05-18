import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, decimals: number = 2): string {
  // If the value is very small, we might want to show more decimals to avoid 0.00
  const effectiveDecimals = value !== 0 && Math.abs(value) < 0.01 ? Math.max(decimals, 6) : decimals;
  
  return value.toLocaleString("en-US", {
    minimumFractionDigits: effectiveDecimals,
    maximumFractionDigits: effectiveDecimals,
  })
}
