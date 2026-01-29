/**
 * Utility functions for extracting M-Pesa and eMola transaction codes
 * from SMS/USSD confirmation messages
 */

export type PaymentMethod = 'mpesa' | 'emola';

export interface ExtractedCode {
  code: string;
  method: PaymentMethod;
  confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedPaymentData {
  code: ExtractedCode | null;
  amount: number | null;
  phone: string | null;
}

/**
 * M-Pesa transaction code pattern (Mozambique)
 * - 10 to 12 characters
 * - Uppercase letters and numbers
 * - Heuristic: must contain at least 1 letter and 1 digit
 */
const MPESA_PATTERN = /\b[A-Z0-9]{10,12}\b/g;

/**
 * eMola transaction code patterns:
 * a) PP + digits/date: PP260116.2026.W22156
 * b) CI + digits/date: CI260128.1526.P38805
 */
const EMOLA_PATTERN_A = /\bPP\d{6}\.\d{4}\.[A-Z]\d{5}\b/g;
const EMOLA_PATTERN_B = /\bCI\d{6}\.\d{4}\.[A-Z]\d{5}\b/g;
const EMOLA_PATTERN_GENERIC = /\b(?:PP|CI)[A-Z0-9.]{6,}\b/g;

/**
 * Amount patterns (e.g., "20.00MT", "25,00 MZN", "100 MT")
 */
const AMOUNT_PATTERNS = [
  /(\d+(?:[.,]\d{1,2})?)\s*(?:MT|MZN|Mtn|mzn)/gi,
  /(?:valor|montante|quantia)[:\s]*(\d+(?:[.,]\d{1,2})?)/gi,
  /(?:MZN|MT)\s*(\d+(?:[.,]\d{1,2})?)/gi,
];

/**
 * Phone patterns (e.g., "para 258856091272", "para 856091272")
 */
const PHONE_PATTERNS = [
  /(?:para|to|destino)[:\s]*(?:\+?258)?(\d{9})/gi,
  /(?:para|to|destino)[:\s]*(\d{12})/gi,
  /258(\d{9})/g,
];

/**
 * Extract transaction codes from a message
 * Prioritizes exact pattern matches
 */
export function extractTransactionCodes(message: string): ExtractedCode[] {
  const codes: ExtractedCode[] = [];
  const upperMessage = message.toUpperCase();

  // First, try to find eMola codes with specific patterns
  const emolaMatchesA = upperMessage.match(EMOLA_PATTERN_A);
  if (emolaMatchesA) {
    emolaMatchesA.forEach(code => {
      codes.push({ code, method: 'emola', confidence: 'high' });
    });
  }

  const emolaMatchesB = upperMessage.match(EMOLA_PATTERN_B);
  if (emolaMatchesB) {
    emolaMatchesB.forEach(code => {
      if (!codes.some(c => c.code === code)) {
        codes.push({ code, method: 'emola', confidence: 'high' });
      }
    });
  }

  // Then try generic eMola pattern
  const emolaMatchesGeneric = upperMessage.match(EMOLA_PATTERN_GENERIC);
  if (emolaMatchesGeneric) {
    emolaMatchesGeneric.forEach(code => {
      if (!codes.some(c => c.code === code)) {
        codes.push({ code, method: 'emola', confidence: 'medium' });
      }
    });
  }

  // Then, try to find M-Pesa codes
  const mpesaMatches = upperMessage.match(MPESA_PATTERN);
  if (mpesaMatches) {
    mpesaMatches.forEach(code => {
      // Heuristic: avoid generic matches (must include at least 1 letter and 1 digit)
      if (!/[A-Z]/.test(code) || !/\d/.test(code)) return;

      // Avoid duplicates and eMola codes
      if (codes.some(c => c.code === code)) return;
      if (/^(PP|CI)/.test(code)) return;

      codes.push({ code, method: 'mpesa', confidence: 'high' });
    });
  }

  return codes;
}

/**
 * Extract amount from confirmation message
 */
export function extractAmount(message: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }
    }
  }
  return null;
}

/**
 * Extract phone number from confirmation message
 */
export function extractPhone(message: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        let phone = match[1].replace(/\D/g, '');
        // Normalize to 12 digits with 258 prefix
        if (phone.length === 9) {
          phone = '258' + phone;
        }
        if (phone.length === 12 && phone.startsWith('258')) {
          return phone;
        }
      }
    }
  }
  return null;
}

/**
 * Extract all payment data from a confirmation message
 */
export function extractPaymentData(message: string, preferredMethod?: PaymentMethod): ExtractedPaymentData {
  const codes = extractTransactionCodes(message);
  
  // Select best code (prefer specified method, then highest confidence)
  let bestCode: ExtractedCode | null = null;
  if (codes.length > 0) {
    if (preferredMethod) {
      bestCode = codes.find(c => c.method === preferredMethod) || codes[0];
    } else {
      bestCode = codes[0];
    }
  }

  return {
    code: bestCode,
    amount: extractAmount(message),
    phone: extractPhone(message),
  };
}

/**
 * Get the best (highest confidence) code from extracted codes
 */
export function getBestCode(codes: ExtractedCode[]): ExtractedCode | null {
  if (codes.length === 0) return null;
  
  // Prioritize by confidence, then by method (eMola first for consistency)
  const sorted = [...codes].sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  });
  
  return sorted[0];
}

/**
 * Validate a manually entered transaction code
 */
export function validateManualCode(code: string): { isValid: boolean; method: PaymentMethod | null } {
  const upperCode = code.toUpperCase().trim();
  
  // Check eMola specific patterns first
  if (/^PP\d{6}\.\d{4}\.[A-Z]\d{5}$/.test(upperCode)) {
    return { isValid: true, method: 'emola' };
  }
  if (/^CI\d{6}\.\d{4}\.[A-Z]\d{5}$/.test(upperCode)) {
    return { isValid: true, method: 'emola' };
  }
  // Check generic eMola pattern: starts with PP or CI, contains letters, numbers, and dots
  if (/^(PP|CI)[A-Z0-9.]{6,}$/.test(upperCode)) {
    return { isValid: true, method: 'emola' };
  }
  
  // Check M-Pesa pattern: 10-12 chars, letters+numbers (must contain at least 1 letter and 1 digit)
  if (/^[A-Z0-9]{10,12}$/.test(upperCode) && /[A-Z]/.test(upperCode) && /\d/.test(upperCode)) {
    // Make sure it's not an eMola code
    if (!/^(PP|CI)/.test(upperCode)) {
      return { isValid: true, method: 'mpesa' };
    }
  }
  
  return { isValid: false, method: null };
}

/**
 * Generate payment instructions for a given method
 */
export function getPaymentInstructions(method: PaymentMethod, phoneNumber: string): string {
  const formattedPhone = phoneNumber.replace(/\D/g, '');
  
  if (method === 'mpesa') {
    return `Para efetuar o pagamento:\n\n1. Marque *150#\n2. Escolha "Transferir dinheiro"\n3. Selecione "M-Pesa"\n4. Digite o número: ${formattedPhone}\n5. Digite o valor\n6. Confirme com o seu PIN\n\nApós confirmar, copie a mensagem de confirmação recebida.`;
  }
  
  if (method === 'emola') {
    return `Para efetuar o pagamento:\n\n1. Marque *898#\n2. Escolha "Transferir"\n3. Digite o número: ${formattedPhone}\n4. Digite o valor\n5. Confirme com o seu PIN\n\nApós confirmar, copie a mensagem de confirmação recebida.`;
  }
  
  return '';
}
