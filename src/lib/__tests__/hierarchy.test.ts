import { describe, expect, test } from "bun:test";
import { DEFAULT_COUNTRY, GHANA_16_REGIONS } from "../hierarchy";

describe("Ghana Country and Regions Hierarchy", () => {
  test("default country is Ghana with GH code", () => {
    expect(DEFAULT_COUNTRY.name).toBe("Ghana");
    expect(DEFAULT_COUNTRY.code).toBe("GH");
  });

  test("contains exactly all 16 Ghana regions with unique codes and names", () => {
    expect(GHANA_16_REGIONS).toHaveLength(16);

    const expectedRegions = [
      "Greater Accra",
      "Ashanti",
      "Western",
      "Western North",
      "Central",
      "Eastern",
      "Volta",
      "Oti",
      "Northern",
      "Savannah",
      "North East",
      "Upper East",
      "Upper West",
      "Bono",
      "Bono East",
      "Ahafo",
    ];

    const names = GHANA_16_REGIONS.map((r) => r.name);
    const codes = GHANA_16_REGIONS.map((r) => r.code);

    expect(new Set(names).size).toBe(16);
    expect(new Set(codes).size).toBe(16);

    for (const expected of expectedRegions) {
      expect(names).toContain(expected);
    }
  });
});
