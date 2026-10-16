/**
 * PDF Layout Helpers
 *
 * Simplified utilities matching the frontend calculator style.
 */

import type { jsPDF } from 'jspdf';
import { layout, type RGB } from './design-tokens';

/**
 * Draw a rounded rectangle with optional border
 */
export function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill?: RGB;
    border?: RGB;
    radius?: number;
  } = {}
): void {
  const { fill, border, radius = layout.cardRadius } = options;

  if (fill) {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.roundedRect(x, y, width, height, radius, radius, 'F');
  }

  if (border) {
    doc.setDrawColor(border.r, border.g, border.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, width, height, radius, radius, 'S');
  }
}

/**
 * Draw a pill/badge shape
 */
export function drawPill(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill?: RGB;
    border?: RGB;
  } = {}
): void {
  const { fill, border } = options;
  const radius = height / 2; // Full rounded

  if (fill) {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.roundedRect(x, y, width, height, radius, radius, 'F');
  }

  if (border) {
    doc.setDrawColor(border.r, border.g, border.b);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, radius, radius, 'S');
  }
}

/**
 * Set text color from RGB
 */
export function setColor(doc: jsPDF, color: RGB): void {
  doc.setTextColor(color.r, color.g, color.b);
}

/**
 * Format currency with commas, no cents
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format job count - no decimal if whole number
 */
export function formatJobs(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1).replace(/\.0$/, '');
}

/**
 * Get first name safely
 */
export function getFirstName(fullName: string): string {
  const firstName = fullName.trim().split(' ')[0];
  return firstName || 'there';
}

/**
 * Truncate text with ellipsis if too wide
 */
export function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}
