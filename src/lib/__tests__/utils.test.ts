import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  getTimeAgo,
  formatDate,
  formatDateTime,
  formatTime,
  capitalizeFirst,
  truncateText,
  sanitizeInput,
  formatCurrency,
  formatPercentage,
  roundToDecimal,
  groupBy,
  sortBy,
  filterBy,
  validateEmail,
  validatePhone,
  validatePassword,
  validateRequired,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  clearStorage,
  createElement,
  addClass,
  removeClass,
  toggleClass,
  showElement,
  hideElement,
  debounce,
  throttle,
} from "../utils";

describe("Time and Date Utilities", () => {
  test("getTimeAgo returns appropriate time relative string", () => {
    const now = Date.now();
    expect(getTimeAgo(now)).toBe("Just now");
    expect(getTimeAgo(now - 120 * 1000)).toBe("2m ago");
    expect(getTimeAgo(now - 7200 * 1000)).toBe("2h ago");
    expect(getTimeAgo(now - 2 * 86400 * 1000)).toBe("2d ago");
    expect(getTimeAgo(now - 60 * 86400 * 1000)).toBe("2mo ago");
    expect(getTimeAgo(now - 400 * 86400 * 1000)).toBe("1y ago");
  });

  test("formatDate, formatDateTime, formatTime", () => {
    expect(formatDate(null)).toBe("N/A");
    expect(formatDate("invalid date")).toBe("N/A");
    expect(formatDate("2023-01-01")).not.toBe("N/A");

    expect(formatDateTime(null)).toBe("N/A");
    expect(formatDateTime("2023-01-01T10:00:00Z")).not.toBe("N/A");

    expect(formatTime(null)).toBe("N/A");
    expect(formatTime("2023-01-01T10:00:00Z")).not.toBe("N/A");
  });
});

describe("String Utilities", () => {
  test("capitalizeFirst", () => {
    expect(capitalizeFirst("hello")).toBe("Hello");
    expect(capitalizeFirst("WORLD")).toBe("World");
    expect(capitalizeFirst("")).toBe("");
  });

  test("truncateText", () => {
    expect(truncateText("short", 10)).toBe("short");
    expect(truncateText("hello world string", 5)).toBe("hello...");
    expect(truncateText("")).toBe("");
  });

  test("sanitizeInput", () => {
    expect(sanitizeInput("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
    expect(sanitizeInput("hello world")).toBe("hello world");
    expect(sanitizeInput("")).toBe("");
  });
});

describe("Number Utilities", () => {
  test("formatCurrency", () => {
    expect(formatCurrency(1234.56, "GH₵")).toBe("GH₵1,234.56");
    expect(formatCurrency("invalid")).toBe("₵0.00");
  });

  test("formatPercentage", () => {
    expect(formatPercentage(50, 200)).toBe("25.0%");
    expect(formatPercentage(10, 0)).toBe("0%");
  });

  test("roundToDecimal", () => {
    expect(roundToDecimal(12.3456, 2)).toBe(12.35);
    expect(roundToDecimal(12.3456, 1)).toBe(12.3);
  });
});

describe("Array and Object Utilities", () => {
  test("groupBy", () => {
    const list = [
      { category: "fruit", name: "apple" },
      { category: "fruit", name: "banana" },
      { category: "veggie", name: "carrot" },
    ];
    const grouped = groupBy(list, "category");
    expect(grouped['fruit']?.length).toBe(2);
    expect(grouped['veggie']?.length).toBe(1);
  });

  test("sortBy", () => {
    const list = [{ age: 30 }, { age: 20 }, { age: 25 }];
    const sortedAsc = sortBy(list, "age", "asc");
    expect(sortedAsc[0]?.age).toBe(20);

    const sortedDesc = sortBy(list, "age", "desc");
    expect(sortedDesc[0]?.age).toBe(30);
  });

  test("filterBy", () => {
    const list = [
      { name: "John", role: "admin" },
      { name: "Jane", role: "user" },
    ];
    const filtered = filterBy(list, { name: "jo" });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.name).toBe("John");
  });
});

describe("Validation Utilities", () => {
  test("validateEmail", () => {
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("invalid-email")).toBe(false);
  });

  test("validatePhone", () => {
    expect(validatePhone("+233241234567")).toBe(true);
    expect(validatePhone("abc")).toBe(false);
  });

  test("validatePassword", () => {
    expect(validatePassword("Strong123")).toBe(true);
    expect(validatePassword("weak")).toBe(false);
  });

  test("validateRequired", () => {
    expect(validateRequired("test")).toBe(true);
    expect(validateRequired("   ")).toBe(false);
    expect(validateRequired(null)).toBe(false);
  });
});

describe("Storage Utilities", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    const localStorageMock = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    };
    // @ts-ignore
    global.window = global.window || {};
    // @ts-ignore
    global.window.localStorage = localStorageMock;
    // @ts-ignore
    global.localStorage = localStorageMock;
  });

  test("saveToStorage, loadFromStorage, removeFromStorage, clearStorage", () => {
    expect(saveToStorage("testKey", { value: 123 })).toBe(true);
    expect(loadFromStorage("testKey")).toEqual({ value: 123 });
    expect(removeFromStorage("testKey")).toBe(true);
    expect(loadFromStorage("testKey", "default")).toBe("default");

    saveToStorage("key1", "val1");
    expect(clearStorage()).toBe(true);
    expect(loadFromStorage("key1")).toBeNull();
  });
});

describe("DOM Utilities", () => {
  beforeEach(() => {
    const createEl = (tag: string) => {
      const classListSet = new Set<string>();
      const elem: any = {
        tagName: tag.toUpperCase(),
        className: "",
        innerHTML: "",
        style: {},
        classList: {
          add: (...cls: string[]) => {
            cls.forEach((c) => classListSet.add(c));
            elem.className = Array.from(classListSet).join(" ");
          },
          remove: (...cls: string[]) => {
            cls.forEach((c) => classListSet.delete(c));
            elem.className = Array.from(classListSet).join(" ");
          },
          toggle: (c: string) => {
            if (classListSet.has(c)) {
              classListSet.delete(c);
            } else {
              classListSet.add(c);
            }
            elem.className = Array.from(classListSet).join(" ");
          },
          contains: (c: string) => classListSet.has(c),
        },
      };
      return elem;
    };

    // @ts-ignore
    global.document = {
      createElement: createEl as any,
    } as any;
  });

  test("createElement, addClass, removeClass, toggleClass, showElement, hideElement", () => {
    const el = createElement("div", "box", "span text</span>");
    expect(el).not.toBeNull();
    if (!el) return;

    expect(el.className).toBe("box");
    expect(el.innerHTML).toBe("span text</span>");

    addClass(el, "active");
    expect(el.classList.contains("active")).toBe(true);

    removeClass(el, "active");
    expect(el.classList.contains("active")).toBe(false);

    toggleClass(el, "toggle");
    expect(el.classList.contains("toggle")).toBe(true);

    hideElement(el);
    expect(el.style.display).toBe("none");
    expect(el.classList.contains("hidden")).toBe(true);

    showElement(el);
    expect(el.style.display).toBe("");
    expect(el.classList.contains("hidden")).toBe(false);
  });
});

describe("Event Utilities", () => {
  test("debounce", async () => {
    let count = 0;
    const fn = debounce(() => {
      count++;
    }, 50);

    fn();
    fn();
    fn();

    expect(count).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(count).toBe(1);
  });

  test("throttle", async () => {
    let count = 0;
    const fn = throttle(() => {
      count++;
    }, 50);

    fn();
    fn();
    expect(count).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));
    fn();
    expect(count).toBe(2);
  });
});
