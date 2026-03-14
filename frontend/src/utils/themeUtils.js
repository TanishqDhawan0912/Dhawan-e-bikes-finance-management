// Theme utilities for adaptive text colors based on background colors
import { useState, useEffect } from "react";

/**
 * Determines if a color is light or dark
 * @param {string} color - The color to analyze (hex, rgb, or named color)
 * @returns {boolean} - True if the color is light, false if dark
 */
export function isLightColor(color) {
  // Handle named colors
  const namedColors = {
    white: true,
    black: false,
    red: false,
    blue: false,
    green: false,
    yellow: true,
    orange: false,
    purple: false,
    pink: true,
    gray: true,
    grey: true,
    brown: false,
    transparent: true,
  };

  // Check for named colors (case insensitive)
  const lowerColor = color.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(namedColors, lowerColor)) {
    return namedColors[lowerColor];
  }

  // Handle hex colors
  let hex = color;
  if (color.startsWith("#")) {
    hex = color.slice(1);
  }

  // Handle rgb/rgba colors
  if (color.startsWith("rgb")) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      return getLuminance(r, g, b) > 0.5;
    }
  }

  // If it's a 3-digit hex, expand to 6 digits
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Parse hex to RGB
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return getLuminance(r, g, b) > 0.5;
  }

  // Default to light for unknown colors
  return true;
}

/**
 * Calculate luminance of an RGB color
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {number} - Luminance value (0-1)
 */
function getLuminance(r, g, b) {
  // Normalize RGB values to 0-1 range
  const [rs, gs, bs] = [r, g, b].map((val) => val / 255);

  // Apply gamma correction
  const [rl, gl, bl] = [rs, gs, bs].map((val) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  );

  // Calculate luminance
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Returns appropriate text color for a given background color
 * @param {string} backgroundColor - The background color
 * @param {string} lightTextColor - Text color for light backgrounds (default: black)
 * @param {string} darkTextColor - Text color for dark backgrounds (default: white)
 * @returns {string} - The appropriate text color
 */
export function getTextColorForBackground(
  backgroundColor,
  lightTextColor = "#000000",
  darkTextColor = "#ffffff"
) {
  if (isLightColor(backgroundColor)) {
    return lightTextColor;
  } else {
    return darkTextColor;
  }
}

/**
 * Hook for getting system theme preference
 * @returns {boolean} - True if dark mode is preferred
 */
export function useSystemTheme() {
  const [isDark, setIsDark] = useState(
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setIsDark(e.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDark;
}

/**
 * Common color mappings for the application
 */
export const COLOR_MAPPINGS = {
  // Button colors
  primary: "#2563eb",
  secondary: "#6b7280",
  success: "#10b981",
  danger: "#dc2626",
  warning: "#f59e0b",

  // Background colors
  white: "#ffffff",
  gray: "#f3f4f6",
  darkGray: "#1f2937",

  // Text colors
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textWhite: "#ffffff",
  textBlack: "#000000",
};

/**
 * Get adaptive text color for common UI elements
 * @param {string} elementType - Type of element ('button', 'background', etc.)
 * @param {string} variant - Color variant ('primary', 'secondary', etc.)
 * @returns {string} - The appropriate text color
 */
export function getAdaptiveTextColor(elementType, variant) {
  const colorMap = {
    button: {
      primary: COLOR_MAPPINGS.textWhite,
      secondary: COLOR_MAPPINGS.textWhite,
      success: COLOR_MAPPINGS.textWhite,
      danger: COLOR_MAPPINGS.textWhite,
      warning: COLOR_MAPPINGS.textWhite,
    },
    background: {
      white: COLOR_MAPPINGS.textBlack,
      gray: COLOR_MAPPINGS.textBlack,
      dark: COLOR_MAPPINGS.textWhite,
    },
  };

  return colorMap[elementType]?.[variant] || COLOR_MAPPINGS.textBlack;
}
