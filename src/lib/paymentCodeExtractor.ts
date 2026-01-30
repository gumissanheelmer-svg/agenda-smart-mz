/**
 * Utility functions for extracting M-Pesa and eMola transaction codes
 * from SMS/USSD confirmation messages
 */

export type PaymentMethod = 'mpesa' | 'emola' | 'unknown';

export interface ExtractedCode {
  code: string;
  method: PaymentMethod;
  confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedPaymentData {
  code: ExtractedCode | null;
  amount: number | null;
  phone: string | null;
  method: PaymentMethod;
}

export interface ValidationResult {
  isReady: boolean;
  hasCode: boolean;
  hasAmount: boolean;
  hasRecipient: boolean;
  amountMatches: boolean;
  recipientMatches: boolean;
  errorMessage: string | null;
}

/**
 * M-Pesa transaction code patterns:
 * - Primary: appears after "Confirmado " - most reliable
 * - Fallback: 10 to 12 alphanumeric characters
 */
const MPESA_PATTERN_CONFIRMED = /Confirmado\s+([A-Z0-9]{10,12})/i;
const MPESA_PATTERN_FALLBACK = /\b[A-Z0-9]{10,12}\b/g;

/**
 * eMola transaction code patterns:
 * a) PP + digits/date: PP260116.2026.W22156
 * b) CI + digits/date: CI260128.1526.P38805
 */
const EMOLA_PATTERN_A = /\bPP\d{6}\.\d{4}\.[A-Z]\d{5}\b/gi;
const EMOLA_PATTERN_B = /\bCI\d{6}\.\d{4}\.[A-Z]\d{5}\b/gi;
const EMOLA_PATTERN_GENERIC = /\b(?:PP|CI)[A-Z0-9.]{6,}\b/gi;

/**
 * Amount patterns (e.g., "Transferiste 50.00MT", "Recebeste 25,00MT")
 */
const AMOUNT_PATTERNS = [
  /(\d{1,6}(?:[.,]\d{1,2})?)\s*MT/gi,
  /(?:transferiste|recebeste|enviaste|valor|montante)\s*[:\s]*(\d{1,6}(?:[.,]\d{1,2})?)/gi,
];

/**
 * Recipient phone patterns:
 * - "para 258XXXXXXXXX" or "para XXXXXXXXX" (9 digits)
 * - "p/ 258XXXXXXXXX"
 */
const RECIPIENT_PATTERNS = [
  /(?:para|p\/)\s*(?:\+?258)?\s*(\d{9})/gi,
  /(?:para|p\/)\s*(\d{12})/gi,
  /(?:destino|para)\s*[:=]?\s*(?:\+?258)?(\d{9})/gi,
];

/**
 * Detect payment method from message content (not from code prefix)
 */
export function detectPaymentMethod(message: string): PaymentMethod {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('m-pesa') || lowerMessage.includes('mpesa')) {
    return 'mpesa';
  }
  
  if (lowerMessage.includes('emola') || lowerMessage.includes('e-mola')) {
    return 'emola';
  }
  
  return 'unknown';
}

/**
 * Extract transaction code from a message using improved patterns
 */
export function extractTransactionCode(message: string): ExtractedCode | null {
  const upperMessage = message.toUpperCase();
  const detectedMethod = detectPaymentMethod(message);

  // Try eMola patterns first (most specific)
  const emolaMatchA = upperMessage.match(EMOLA_PATTERN_A);
  if (emolaMatchA && emolaMatchA.length > 0) {
    return { 
      code: emolaMatchA[0], 
      method: detectedMethod !== 'unknown' ? detectedMethod : 'emola', 
      confidence: 'high' 
    };
  }

  const emolaMatchB = upperMessage.match(EMOLA_PATTERN_B);
  if (emolaMatchB && emolaMatchB.length > 0) {
    return { 
      code: emolaMatchB[0], 
      method: detectedMethod !== 'unknown' ? detectedMethod : 'emola', 
      confidence: 'high' 
    };
  }

  // Try M-Pesa pattern with "Confirmado"
  const mpesaConfirmed = message.match(MPESA_PATTERN_CONFIRMED);
  if (mpesaConfirmed && mpesaConfirmed[1]) {
    return { 
      code: mpesaConfirmed[1].toUpperCase(), 
      method: detectedMethod !== 'unknown' ? detectedMethod : 'mpesa', 
      confidence: 'high' 
    };
  }

  // Try generic eMola pattern
  const emolaGeneric = upperMessage.match(EMOLA_PATTERN_GENERIC);
  if (emolaGeneric && emolaGeneric.length > 0) {
    return { 
      code: emolaGeneric[0], 
      method: detectedMethod !== 'unknown' ? detectedMethod : 'emola', 
      confidence: 'medium' 
    };
  }

  // Fallback: M-Pesa pattern (10-12 alphanumeric)
  const mpesaFallback = upperMessage.match(MPESA_PATTERN_FALLBACK);
  if (mpesaFallback) {
    // Filter to only codes that have at least 1 letter and 1 digit
    const validCodes = mpesaFallback.filter(code => 
      /[A-Z]/.test(code) && /\d/.test(code) && !/^(PP|CI)/.test(code)
    );
    
    if (validCodes.length > 0) {
      return { 
        code: validCodes[0], 
        method: detectedMethod !== 'unknown' ? detectedMethod : 'mpesa', 
        confidence: 'medium' 
      };
    }
  }

  return null;
}

/**
 * Extract amount from confirmation message (REQUIRED for validation)
 */
export function extractAmount(message: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const matches = message.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        // Normalize comma to period and parse
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
 * Extract recipient phone number from confirmation message (REQUIRED for validation)
 * Returns normalized phone as "258XXXXXXXXX" (12 digits)
 */
export function extractRecipientPhone(message: string): string | null {
  for (const pattern of RECIPIENT_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const matches = message.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        let phone = match[1].replace(/\D/g, '');
        
        // Normalize to 12 digits with 258 prefix
        if (phone.length === 9) {
          phone = '258' + phone;
        }
        
        // Validate final format
        if (phone.length === 12 && phone.startsWith('258')) {
          return phone;
        }
      }
    }
  }
  return null;
}

/**
 * Normalize a Mozambique phone number to "258XXXXXXXXX" format
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle different formats
  if (cleaned.length === 9) {
    // Local format: add 258
    return '258' + cleaned;
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('258')) {
    // Already correct format
    return cleaned;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('258')) {
    // Missing a digit - try to fix
    return cleaned;
  }
  
  // Return as-is if we can't normalize
  return cleaned;
}

/**
 * Extract all payment data from a confirmation message
 */
export function extractPaymentData(message: string, preferredMethod?: PaymentMethod): ExtractedPaymentData {
  const detectedMethod = detectPaymentMethod(message);
  const code = extractTransactionCode(message);
  const amount = extractAmount(message);
  const phone = extractRecipientPhone(message);

  // Use detected method, or fall back to code's method, or preferred, or unknown
  let method: PaymentMethod = 'unknown';
  if (detectedMethod !== 'unknown') {
    method = detectedMethod;
  } else if (code?.method && code.method !== 'unknown') {
    method = code.method;
  } else if (preferredMethod) {
    method = preferredMethod;
  }

  return {
    code,
    amount,
    phone,
    method,
  };
}

/**
 * Validate if extracted data is complete and matches expected values
 */
export function validatePaymentData(
  extracted: ExtractedPaymentData,
  expectedAmount: number,
  expectedRecipientPhone: string
): ValidationResult {
  const normalizedExpectedPhone = normalizePhone(expectedRecipientPhone);
  
  const hasCode = extracted.code !== null;
  const hasAmount = extracted.amount !== null;
  const hasRecipient = extracted.phone !== null;
  
  // Allow small tolerance for amount (±0.50 MZN)
  const amountMatches = hasAmount && 
    Math.abs((extracted.amount || 0) - expectedAmount) < 0.50;
  
  const recipientMatches = hasRecipient && 
    extracted.phone === normalizedExpectedPhone;

  // Determine error message
  let errorMessage: string | null = null;
  
  if (!hasCode) {
    errorMessage = 'Código de transação não detectado. Cole a mensagem completa.';
  } else if (!hasAmount) {
    errorMessage = 'Valor não detectado na mensagem. Cole a mensagem completa do M-Pesa/eMola.';
  } else if (!hasRecipient) {
    errorMessage = 'Número do destinatário não detectado. Cole a mensagem completa do M-Pesa/eMola.';
  } else if (!amountMatches) {
    errorMessage = `Valor não corresponde. Esperado: ${expectedAmount.toFixed(2)} MZN, Detectado: ${extracted.amount?.toFixed(2)} MZN.`;
  } else if (!recipientMatches) {
    errorMessage = `Número do destinatário não corresponde ao número de pagamento do negócio.`;
  }

  const isReady = hasCode && hasAmount && hasRecipient && amountMatches && recipientMatches;

  return {
    isReady,
    hasCode,
    hasAmount,
    hasRecipient,
    amountMatches,
    recipientMatches,
    errorMessage,
  };
}

/**
 * Validate a manually entered transaction code format
 */
export function validateManualCode(code: string): { isValid: boolean; method: PaymentMethod | null } {
  const upperCode = code.toUpperCase().trim();
  
  if (!upperCode || upperCode.length < 10) {
    return { isValid: false, method: null };
  }
  
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
    return `Para efetuar o pagamento:\n\n1. Marque *150#\n2. Escolha "Transferir dinheiro"\n3. Selecione "M-Pesa"\n4. Digite o número: ${formattedPhone}\n5. Digite o valor\n6. Confirme com o seu PIN\n\nApós confirmar, copie a mensagem de confirmação completa.`;
  }
  
  if (method === 'emola') {
    return `Para efetuar o pagamento:\n\n1. Marque *898#\n2. Escolha "Transferir"\n3. Digite o número: ${formattedPhone}\n4. Digite o valor\n5. Confirme com o seu PIN\n\nApós confirmar, copie a mensagem de confirmação completa.`;
  }
  
  return '';
}
