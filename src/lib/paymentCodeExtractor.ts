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

/**
 * eMola transaction code pattern
 * Codes starting with PP followed by uppercase letters, numbers, and dots
 * Example: PP1A2.B3C4D
 */
const EMOLA_PATTERN = /PP[A-Z0-9.]+/g;

/**
 * M-Pesa transaction code pattern
 * Exactly 11 characters, uppercase letters and numbers only
 * Example: ABC1234DE56
 */
const MPESA_PATTERN = /\b[A-Z0-9]{11}\b/g;

/**
 * Extract transaction codes from a message
 * Prioritizes eMola codes over M-Pesa
 */
export function extractTransactionCodes(message: string): ExtractedCode[] {
  const codes: ExtractedCode[] = [];
  const upperMessage = message.toUpperCase();

  // First, try to find eMola codes (higher priority)
  const emolaMatches = upperMessage.match(EMOLA_PATTERN);
  if (emolaMatches) {
    emolaMatches.forEach(code => {
      // eMola codes with PP prefix are high confidence
      codes.push({
        code: code,
        method: 'emola',
        confidence: code.length >= 8 ? 'high' : 'medium'
      });
    });
  }

  // Then, try to find M-Pesa codes
  const mpesaMatches = upperMessage.match(MPESA_PATTERN);
  if (mpesaMatches) {
    mpesaMatches.forEach(code => {
      // Avoid duplicates if the code was already matched as eMola
      const isDuplicate = codes.some(c => c.code.includes(code) || code.includes(c.code));
      if (!isDuplicate) {
        // M-Pesa codes are high confidence if they don't look like common words
        const isLikelyCode = !isCommonWord(code);
        codes.push({
          code: code,
          method: 'mpesa',
          confidence: isLikelyCode ? 'high' : 'medium'
        });
      }
    });
  }

  return codes;
}

/**
 * Check if a string is likely a common word rather than a transaction code
 */
function isCommonWord(str: string): boolean {
  const commonPatterns = [
    'TRANSFERENCIA',
    'CONFIRMACAO',
    'SUCESSO',
    'PAGAMENTO',
    'TRANSACAO',
    'RECEBIDO',
    'ENVIADO'
  ];
  return commonPatterns.some(pattern => str.includes(pattern));
}

/**
 * Get the best (highest confidence) code from extracted codes
 */
export function getBestCode(codes: ExtractedCode[]): ExtractedCode | null {
  if (codes.length === 0) return null;
  
  // Prioritize eMola with high confidence, then M-Pesa with high confidence
  const highConfidenceEmola = codes.find(c => c.method === 'emola' && c.confidence === 'high');
  if (highConfidenceEmola) return highConfidenceEmola;
  
  const highConfidenceMpesa = codes.find(c => c.method === 'mpesa' && c.confidence === 'high');
  if (highConfidenceMpesa) return highConfidenceMpesa;
  
  // Fall back to any eMola, then any M-Pesa
  const anyEmola = codes.find(c => c.method === 'emola');
  if (anyEmola) return anyEmola;
  
  return codes[0];
}

/**
 * Validate a manually entered transaction code
 */
export function validateManualCode(code: string): { isValid: boolean; method: PaymentMethod | null } {
  const upperCode = code.toUpperCase().trim();
  
  // Check eMola pattern first
  if (/^PP[A-Z0-9.]+$/.test(upperCode) && upperCode.length >= 6) {
    return { isValid: true, method: 'emola' };
  }
  
  // Check M-Pesa pattern
  if (/^[A-Z0-9]{11}$/.test(upperCode)) {
    return { isValid: true, method: 'mpesa' };
  }
  
  // Allow any alphanumeric code of reasonable length for flexibility
  if (/^[A-Z0-9.]{6,20}$/.test(upperCode)) {
    return { isValid: true, method: null };
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

/**
 * Generate WhatsApp confirmation message with payment code
 */
export function generatePaymentConfirmationMessage(
  appointmentDate: string,
  appointmentTime: string,
  serviceName: string,
  professionalName: string,
  transactionCode: string
): string {
  return `Olá 👋

Já efetuei o pagamento do meu agendamento.

📅 Data: ${appointmentDate}
⏰ Hora: ${appointmentTime}
✂️ Serviço: ${serviceName}
💈 Profissional: ${professionalName}

💳 Código da transação:
${transactionCode}

Aguardo a confirmação.
Obrigado.`;
}
