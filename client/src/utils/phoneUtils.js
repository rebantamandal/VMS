// Simple phone number validator by country code.
// Expects `countryCode` like "+91" and `localNumber` containing digits only (no + or country code).
export const PHONE_RULES = {
  "+91": { min: 10, max: 10, name: "India" },
  "+1": { min: 10, max: 10, name: "USA/Canada" },
  "+44": { min: 9, max: 10, name: "UK" },
  "+61": { min: 9, max: 9, name: "Australia" },
  "+81": { min: 10, max: 11, name: "Japan" },
  "+971": { min: 9, max: 9, name: "UAE" },
  "+65": { min: 8, max: 8, name: "Singapore" },
  "+66": { min: 9, max: 9, name: "Thailand" },
  "+86": { min: 11, max: 11, name: "China" },
  "+27": { min: 9, max: 9, name: "South Africa" },
  "+49": { min: 10, max: 12, name: "Germany" },
  "+33": { min: 9, max: 9, name: "France" },
  "+46": { min: 7, max: 9, name: "Sweden" },
  // default fallback: accept 7-15 digits
};

export function validatePhoneLength(countryCode, localNumber) {
  if (!localNumber) return { valid: false, message: "Phone number is required" };

  // Normalize: remove spaces, dashes, parentheses
  const normalized = String(localNumber).replace(/[^0-9]/g, "");

  if (!/^[0-9]+$/.test(normalized)) {
    return { valid: false, message: "Phone must contain only digits" };
  }

  const rule = PHONE_RULES[countryCode];
  if (rule) {
    const len = normalized.length;
    if (len < rule.min || len > rule.max) {
      if (rule.min === rule.max) {
        return {
          valid: false,
          message: `Phone for ${rule.name} must be ${rule.min} digits`,
        };
      }
      return {
        valid: false,
        message: `Phone for ${rule.name} must be between ${rule.min} and ${rule.max} digits`,
      };
    }
    return { valid: true };
  }

  // Fallback: E.164 local length between 7 and 15
  if (normalized.length < 7 || normalized.length > 15) {
    return { valid: false, message: "Phone length must be between 7 and 15 digits" };
  }

  return { valid: true };
}
