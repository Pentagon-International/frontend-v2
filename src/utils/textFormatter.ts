/**
 * Converts text to title case where the first letter of each word is uppercase
 * and the rest of the letters are lowercase.
 *
 * Examples:
 * - "This is my new value" -> "This Is My New Value"
 * - "how are you Today ?" -> "How Are You Today ?"
 * - "HOSPITAL" -> "Hospital"
 * - "ASAP" -> "Asap"
 *
 * @param text - The text to convert to title case
 * @returns The text with first letter of each word uppercase and rest lowercase
 */
export const toTitleCase = (text: string): string => {
  if (!text) return text;

  return text
    .split(/(\s+)/) // Split by whitespace but keep the whitespace
    .map((word) => {
      // If it's whitespace, return as is
      if (/^\s+$/.test(word)) {
        return word;
      }

      // Convert word: first letter uppercase, rest lowercase
      if (word.length === 0) return word;
      if (word.length === 1) return word.toUpperCase();

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
};

/**
 * Handler function for Mantine TextInput onChange events
 * Automatically converts input to title case
 *
 * @param value - The input value
 * @param setValue - Function to set the value (from form.setFieldValue)
 * @param fieldPath - The field path for the form (e.g., "customer_address")
 */
export const handleTitleCaseInput = (
  value: string,
  setValue: (value: string) => void,
  fieldPath?: string
): void => {
  const formattedValue = toTitleCase(value);
  setValue(formattedValue);
};
