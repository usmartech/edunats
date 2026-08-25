import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Time and Date Utilities
export function getTimeAgo(timestamp: string | number | Date): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
}

export function formatDate(date?: string | number | Date | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
}

export function formatDateTime(date?: string | number | Date | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleString();
}

export function formatTime(date?: string | number | Date | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleTimeString();
}

// String Utilities
export function capitalizeFirst(str?: string | null): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncateText(text?: string | null, maxLength = 100): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function sanitizeInput(input?: string | null): string {
  if (!input) return "";
  return input.replace(/[<>]/g, "");
}

// Number Utilities
export function formatCurrency(amount: number | string, currency = "₵"): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num)) return `${currency}0.00`;
  return `${currency}${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercentage(value: number, total: number): string {
  if (!total || total === 0) return "0%";
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

export function roundToDecimal(number: number, decimals = 2): number {
  return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Array and Object Utilities
export function groupBy<T>(array: T[], key: keyof T | string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String((item as Record<string, any>)[key as string]);
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(
  array: T[],
  key: keyof T | string,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    let aVal = (a as Record<string, any>)[key as string];
    let bVal = (b as Record<string, any>)[key as string];

    if (
      aVal !== null &&
      aVal !== undefined &&
      bVal !== null &&
      bVal !== undefined &&
      !isNaN(aVal as any) &&
      !isNaN(bVal as any) &&
      typeof aVal !== "boolean" &&
      typeof bVal !== "boolean"
    ) {
      aVal = parseFloat(aVal as any);
      bVal = parseFloat(bVal as any);
    }

    if (order === "desc") {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });
}

export function filterBy<T>(
  array: T[],
  filters: Record<string, any>
): T[] {
  return array.filter((item) => {
    return Object.keys(filters).every((key) => {
      const filterValue = filters[key];
      const itemValue = (item as Record<string, any>)[key];

      if (filterValue === undefined || filterValue === null || filterValue === "") {
        return true;
      }

      if (typeof filterValue === "string") {
        return (
          itemValue !== undefined &&
          itemValue !== null &&
          String(itemValue).toLowerCase().includes(filterValue.toLowerCase())
        );
      }

      return itemValue === filterValue;
    });
  });
}

// Validation Utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

export function validatePassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

export function validateRequired(value: any): boolean {
  return value !== null && value !== undefined && value.toString().trim().length > 0;
}

// Storage Utilities
export function saveToStorage<T>(key: string, data: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Error saving to localStorage:", error);
    return false;
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T | null = null): T | null {
  if (typeof window === "undefined") return defaultValue;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    return defaultValue;
  }
}

export function removeFromStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Error removing from localStorage:", error);
    return false;
  }
}

export function clearStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
}

// DOM Utilities
export function createElement(
  tag: string,
  className = "",
  innerHTML = ""
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (innerHTML) element.innerHTML = innerHTML;
  return element;
}

export function addClass(element: HTMLElement | null | undefined, className: string): void {
  if (element && element.classList) {
    element.classList.add(className);
  }
}

export function removeClass(element: HTMLElement | null | undefined, className: string): void {
  if (element && element.classList) {
    element.classList.remove(className);
  }
}

export function toggleClass(element: HTMLElement | null | undefined, className: string): void {
  if (element && element.classList) {
    element.classList.toggle(className);
  }
}

export function showElement(element: HTMLElement | null | undefined): void {
  if (element) {
    element.style.display = "";
    removeClass(element, "hidden");
  }
}

export function hideElement(element: HTMLElement | null | undefined): void {
  if (element) {
    element.style.display = "none";
    addClass(element, "hidden");
  }
}

// Event Utilities
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
