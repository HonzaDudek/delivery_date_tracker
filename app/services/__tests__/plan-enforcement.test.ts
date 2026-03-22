import { describe, it, expect } from "vitest";
import {
  canCreateZone,
  canUseCustomStyling,
  canRemoveBranding,
  canAccessAnalytics,
  getPlanFeatures,
  isPaidPlan,
} from "../plan-enforcement";

describe("Plan Enforcement", () => {
  describe("canCreateZone", () => {
    it("allows free plan to create first zone", () => {
      const result = canCreateZone({ plan: "free", currentZoneCount: 0 });
      expect(result.allowed).toBe(true);
      expect(result.upgradeRequired).toBeUndefined();
    });

    it("blocks free plan from creating second zone", () => {
      const result = canCreateZone({ plan: "free", currentZoneCount: 1 });
      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe(true);
      expect(result.reason).toContain("1 shipping zone");
      expect(result.reason).toContain("Upgrade to Pro");
    });

    it("blocks free plan when already over limit", () => {
      const result = canCreateZone({ plan: "free", currentZoneCount: 5 });
      expect(result.allowed).toBe(false);
    });

    it("allows pro plan unlimited zones", () => {
      const result = canCreateZone({ plan: "pro", currentZoneCount: 100 });
      expect(result.allowed).toBe(true);
    });

    it("allows pro plan first zone", () => {
      const result = canCreateZone({ plan: "pro", currentZoneCount: 0 });
      expect(result.allowed).toBe(true);
    });
  });

  describe("canUseCustomStyling", () => {
    it("blocks on free plan", () => {
      const result = canUseCustomStyling("free");
      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe(true);
    });

    it("allows on pro plan", () => {
      const result = canUseCustomStyling("pro");
      expect(result.allowed).toBe(true);
    });
  });

  describe("canRemoveBranding", () => {
    it("blocks on free plan", () => {
      const result = canRemoveBranding("free");
      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe(true);
    });

    it("allows on pro plan", () => {
      const result = canRemoveBranding("pro");
      expect(result.allowed).toBe(true);
    });
  });

  describe("canAccessAnalytics", () => {
    it("blocks on free plan", () => {
      const result = canAccessAnalytics("free");
      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe(true);
    });

    it("allows on pro plan", () => {
      const result = canAccessAnalytics("pro");
      expect(result.allowed).toBe(true);
    });
  });

  describe("getPlanFeatures", () => {
    it("returns free plan features", () => {
      const features = getPlanFeatures("free");
      expect(features.maxShippingZones).toBe(1);
      expect(features.customStyling).toBe(false);
    });

    it("returns pro plan features", () => {
      const features = getPlanFeatures("pro");
      expect(features.maxShippingZones).toBe(Infinity);
      expect(features.customStyling).toBe(true);
    });
  });

  describe("isPaidPlan", () => {
    it("free is not paid", () => {
      expect(isPaidPlan("free")).toBe(false);
    });

    it("pro is paid", () => {
      expect(isPaidPlan("pro")).toBe(true);
    });
  });
});
