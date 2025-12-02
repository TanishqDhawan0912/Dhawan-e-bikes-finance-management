/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Gets today's date in dd/mm/yyyy format
 * @returns {string} Today's date in dd/mm/yyyy format
 */
export const getTodayFormatted = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Gets today's date in yyyy-mm-dd format for HTML5 date inputs
 * @returns {string} Today's date in yyyy-mm-dd format
 */
export const getTodayForInput = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Formats a date string to dd/mm/yyyy format
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date in dd/mm/yyyy format
 */
export const formatDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Formats a date string for HTML5 date input (yyyy-mm-dd)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date in yyyy-mm-dd format
 */
export const formatDateForInput = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Parses a date from dd/mm/yyyy format to yyyy-mm-dd format for API
 * @param {string} dateString - Date string in dd/mm/yyyy format
 * @returns {string} Date string in yyyy-mm-dd format
 */
export const parseDate = (dateString) => {
  if (!dateString) return "";

  const [day, month, year] = dateString.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};
