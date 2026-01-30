import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  MessageCircle,
  ChevronRight,
  Loader2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  extractPaymentData,
  validatePaymentData,
  validateManualCode,
  getPaymentInstructions,
  normalizePhone,
  PaymentMethod,
  ExtractedPaymentData,
  ValidationResult
} from '@/lib/paymentCodeExtractor';
import { getClientToBusinessMessage } from '@/lib/whatsappTemplates';
import { openWhatsApp, normalizeMozWhatsapp } from '@/lib/whatsapp';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface PaymentStepProps {
  paymentMethods: PaymentMethod[];
  mpesaNumber: string | null;
  emolaNumber: string | null;
  whatsappNumber: string;
  businessName: string;
  businessId: string;
  appointmentId: string | null;
  clientName: string;
  appointmentDate: Date;
  appointmentTime: string;
  serviceName: string;
  servicePrice: number;
  professionalName: string;
  onBack: () => void;
  onComplete: () => void;
}

export function PaymentStep({
  paymentMethods,
  mpesaNumber,
  emolaNumber,
  whatsappNumber,
  businessName,
  businessId,
  appointmentId,
  clientName,
  appointmentDate,
  appointmentTime,
  serviceName,
  servicePrice,
  professionalName,
  onBack,
  onComplete
}: PaymentStepProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    paymentMethods.length === 1 ? paymentMethods[0] : null
  );
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedPaymentData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get the expected phone for the selected payment method
  const getPhoneForMethod = (method: PaymentMethod): string => {
    if (method === 'mpesa' && mpesaNumber) return mpesaNumber;
    if (method === 'emola' && emolaNumber) return emolaNumber;
    return '';
  };

  const expectedRecipientPhone = selectedMethod ? normalizePhone(getPhoneForMethod(selectedMethod)) : '';

  // Extract and validate when message changes
  useEffect(() => {
    if (confirmationMessage.trim()) {
      const data = extractPaymentData(confirmationMessage, selectedMethod || undefined);
      setExtractedData(data);
      
      // Auto-fill code if found
      if (data.code && !isManualEntry) {
        setManualCode(data.code.code);
      }
      
      // Validate against expected values
      if (expectedRecipientPhone) {
        const validationResult = validatePaymentData(data, servicePrice, expectedRecipientPhone);
        setValidation(validationResult);
      }
    } else {
      setExtractedData(null);
      setValidation(null);
      if (!isManualEntry) {
        setManualCode('');
      }
    }
  }, [confirmationMessage, selectedMethod, servicePrice, expectedRecipientPhone, isManualEntry]);

  // Re-validate when manual code changes
  useEffect(() => {
    if (isManualEntry && manualCode.trim() && extractedData) {
      // Update validation with manual code
      const updatedData: ExtractedPaymentData = {
        ...extractedData,
        code: validateManualCode(manualCode).isValid ? {
          code: manualCode.toUpperCase().trim(),
          method: extractedData.method || selectedMethod || 'unknown',
          confidence: 'high'
        } : null
      };
      const validationResult = validatePaymentData(updatedData, servicePrice, expectedRecipientPhone);
      setValidation(validationResult);
    }
  }, [manualCode, isManualEntry, extractedData, servicePrice, expectedRecipientPhone, selectedMethod]);

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number.replace(/\D/g, ''));
    toast({
      title: 'Número copiado!',
      description: 'Cole no campo de transferência.',
    });
  };

  const handleManualCodeChange = (value: string) => {
    setManualCode(value.toUpperCase());
    setIsManualEntry(true);
    setValidationError(null);
  };

  const handleConfirmPayment = async () => {
    if (!validation?.isReady || !appointmentId || isValidating) return;
    
    setIsValidating(true);
    setValidationError(null);

    try {
      const codeToSubmit = manualCode.trim().toUpperCase();
      
      // Call the RPC to validate and confirm payment
      const { data, error } = await supabase.rpc('validate_and_confirm_payment', {
        p_appointment_id: appointmentId,
        p_barbershop_id: businessId,
        p_payment_method: extractedData?.method || selectedMethod || 'unknown',
        p_phone_expected: expectedRecipientPhone,
        p_amount_expected: servicePrice,
        p_confirmation_text: confirmationMessage,
        p_transaction_code: codeToSubmit,
        p_amount_detected: extractedData?.amount,
        p_phone_detected: extractedData?.phone,
        p_max_hours: 2
      });

      if (error) {
        console.error('Payment validation error:', error);
        setValidationError('Erro ao validar pagamento. Tente novamente.');
        return;
      }

      const result = data as { success: boolean; error?: string; code?: string };

      if (!result.success) {
        // Show specific error based on code
        const errorMessages: Record<string, string> = {
          'CODE_REUSED': 'Este código de transação já foi utilizado. Use um novo pagamento.',
          'ALREADY_CONFIRMED': 'Este agendamento já possui um pagamento confirmado.',
          'VALIDATION_FAILED': result.error || 'Validação falhou. Verifique os dados.',
        };
        
        setValidationError(errorMessages[result.code || ''] || result.error || 'Erro de validação');
        
        toast({
          title: 'Pagamento não aceite',
          description: errorMessages[result.code || ''] || result.error,
          variant: 'destructive',
        });
        return;
      }

      // Payment accepted!
      setIsPaymentConfirmed(true);
      toast({
        title: 'Pagamento ACEITO ✅',
        description: 'Agora envie a confirmação no WhatsApp.',
      });
    } catch (err) {
      console.error('Payment validation exception:', err);
      setValidationError('Erro inesperado. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const formattedDate = format(appointmentDate, "dd 'de' MMMM", { locale: pt });

  const handleSendWhatsApp = () => {
    if (!isPaymentConfirmed) return;

    if (!whatsappNumber?.trim()) {
      toast({
        title: 'WhatsApp não configurado',
        description: 'O negócio não tem um número de WhatsApp definido nas configurações.',
        variant: 'destructive',
      });
      return;
    }

    const paymentMethodLabel = extractedData?.method === 'mpesa' ? 'M-Pesa' : 
                               extractedData?.method === 'emola' ? 'eMola' : 
                               selectedMethod === 'mpesa' ? 'M-Pesa' : 'eMola';
    const message = getClientToBusinessMessage({
      clientName,
      professionalName,
      serviceName,
      appointmentDate: format(appointmentDate, 'yyyy-MM-dd'),
      appointmentTime,
      price: servicePrice,
      businessName,
      paymentMethod: paymentMethodLabel,
      transactionCode: manualCode.trim(),
    });

    const opened = openWhatsApp(whatsappNumber, message);
    if (!opened) {
      toast({
        title: 'Número inválido',
        description: 'Número do WhatsApp do negócio inválido. Peça ao dono para configurar corretamente.',
        variant: 'destructive',
      });
      return;
    }

    onComplete();
  };

  // Check if confirmation button should be enabled
  const canConfirmPayment = validation?.isReady === true && appointmentId !== null;

  return (
    <Card className="border-border/50 bg-card/90 backdrop-blur-md shadow-xl animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl font-display flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Efetuar Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo do agendamento */}
        <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Serviço:</span>
            <span className="text-foreground font-medium">{serviceName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor:</span>
            <span className="text-primary font-bold">{servicePrice.toFixed(0)} MZN</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data:</span>
            <span className="text-foreground">{formattedDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Hora:</span>
            <span className="text-foreground">{appointmentTime}</span>
          </div>
        </div>

        {/* Estado: Pagamento confirmado - mostrar apenas botão WhatsApp */}
        {isPaymentConfirmed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-600">Pagamento ACEITO ✅</p>
                <p className="text-sm text-muted-foreground">
                  Código: {manualCode}
                </p>
              </div>
            </div>

            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleSendWhatsApp}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Enviar confirmação no WhatsApp
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <>
            {/* Seleção de método de pagamento */}
            {paymentMethods.length > 1 && !selectedMethod && (
              <div className="space-y-3">
                <Label>Escolha o método de pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.includes('mpesa') && mpesaNumber && (
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => setSelectedMethod('mpesa')}
                    >
                      <Smartphone className="w-6 h-6 text-red-500" />
                      <span className="font-medium">M-Pesa</span>
                    </Button>
                  )}
                  {paymentMethods.includes('emola') && emolaNumber && (
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => setSelectedMethod('emola')}
                    >
                      <Smartphone className="w-6 h-6 text-orange-500" />
                      <span className="font-medium">eMola</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Instruções de pagamento */}
            {selectedMethod && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Smartphone className={`w-4 h-4 ${selectedMethod === 'mpesa' ? 'text-red-500' : 'text-orange-500'}`} />
                      Pagar via {selectedMethod === 'mpesa' ? 'M-Pesa' : 'eMola'}
                    </Label>
                    {paymentMethods.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMethod(null)}
                        className="text-xs"
                      >
                        Trocar
                      </Button>
                    )}
                  </div>
                  
                  {/* Número para transferência */}
                  <div className="bg-secondary/70 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">Transfira para:</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-bold text-foreground">
                        {getPhoneForMethod(selectedMethod)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyNumber(getPhoneForMethod(selectedMethod))}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar
                      </Button>
                    </div>
                  </div>

                  {/* Instruções detalhadas */}
                  <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted/30 rounded-lg p-3">
                    {getPaymentInstructions(selectedMethod, getPhoneForMethod(selectedMethod))}
                  </div>
                </div>

                {/* Campo para colar mensagem de confirmação */}
                <div className="space-y-3">
                  <Label htmlFor="confirmation">
                    Cole aqui a mensagem de confirmação completa (M-Pesa ou eMola)
                  </Label>
                  <Textarea
                    id="confirmation"
                    placeholder="Cole a mensagem SMS/USSD que recebeu após a transferência..."
                    value={confirmationMessage}
                    onChange={(e) => {
                      setConfirmationMessage(e.target.value);
                      setValidationError(null);
                      setIsManualEntry(false);
                    }}
                    className="min-h-[100px] bg-input border-border"
                  />

                  {/* Dados detectados (INFO, não válido ainda) */}
                  {extractedData && confirmationMessage.trim() && (
                    <div className="space-y-2">
                      {/* Código detectado */}
                      {extractedData.code ? (
                        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-600">Código detectado (a validar)</p>
                            <p className="text-xs text-muted-foreground">
                              {extractedData.method === 'emola' ? 'eMola' : 
                               extractedData.method === 'mpesa' ? 'M-Pesa' : 'Método'}: {extractedData.code.code}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                          <p className="text-sm text-destructive">
                            Código não detectado. Cole a mensagem completa.
                          </p>
                        </div>
                      )}

                      {/* Valor detectado */}
                      {extractedData.amount !== null ? (
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          validation?.amountMatches 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-yellow-500/10 text-yellow-600'
                        }`}>
                          <span>💰 Valor detectado: {extractedData.amount.toFixed(2)} MZN</span>
                          {validation?.amountMatches ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span className="text-xs">(esperado: {servicePrice.toFixed(2)} MZN)</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-sm text-destructive">
                          <AlertCircle className="w-4 h-4" />
                          <span>Valor não detectado na mensagem</span>
                        </div>
                      )}

                      {/* Destinatário detectado */}
                      {extractedData.phone ? (
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          validation?.recipientMatches 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          <span>📱 Destinatário: {extractedData.phone}</span>
                          {validation?.recipientMatches ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span className="text-xs">(não corresponde)</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-sm text-destructive">
                          <AlertCircle className="w-4 h-4" />
                          <span>Número do destinatário não detectado</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Campo para código manual */}
                <div className="space-y-2">
                  <Label htmlFor="manualCode">
                    Código da transação
                    {extractedData?.code && (
                      <span className="text-xs text-muted-foreground ml-2">(edite se necessário)</span>
                    )}
                  </Label>
                  <Input
                    id="manualCode"
                    placeholder="Ex: DAT2IVYA7R0 ou PP260116.2026.W22156"
                    value={manualCode}
                    onChange={(e) => handleManualCodeChange(e.target.value)}
                    className="bg-input border-border font-mono uppercase"
                  />
                  {manualCode && (
                    <p className="text-xs text-muted-foreground">
                      {validateManualCode(manualCode).isValid 
                        ? `Formato válido (${validateManualCode(manualCode).method === 'mpesa' ? 'M-Pesa' : 'eMola'})` 
                        : 'Formato inválido. M-Pesa: 10–12 caracteres. eMola: PP ou CI + data/código.'}
                    </p>
                  )}
                </div>

                {/* Mensagem de erro de validação */}
                {validation?.errorMessage && !validation.isReady && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{validation.errorMessage}</p>
                  </div>
                )}

                {/* Erro de validação anti-fraude do servidor */}
                {validationError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{validationError}</p>
                  </div>
                )}

                {/* Botão de confirmar pagamento */}
                <div className="space-y-3 pt-2">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full"
                    disabled={!canConfirmPayment || isValidating}
                    onClick={handleConfirmPayment}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Confirmar pagamento
                      </>
                    )}
                  </Button>
                  
                  {!canConfirmPayment && confirmationMessage.trim() && (
                    <p className="text-xs text-center text-muted-foreground">
                      {!validation?.hasCode 
                        ? 'Cole a mensagem de confirmação completa para detectar o código.' 
                        : !validation?.hasAmount 
                        ? 'Valor não detectado. Cole a mensagem completa.' 
                        : !validation?.hasRecipient 
                        ? 'Destinatário não detectado. Cole a mensagem completa.' 
                        : !validation?.amountMatches 
                        ? 'O valor detectado não corresponde ao valor do serviço.' 
                        : !validation?.recipientMatches 
                        ? 'O destinatário não corresponde ao número de pagamento.' 
                        : 'Verifique os dados da confirmação.'}
                    </p>
                  )}
                  
                  {!confirmationMessage.trim() && (
                    <p className="text-xs text-center text-muted-foreground">
                      Cole a mensagem de confirmação para validar o pagamento.
                    </p>
                  )}
                  
                  {!appointmentId && (
                    <p className="text-xs text-center text-destructive">
                      Erro: Agendamento não criado. Volte e tente novamente.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Botão voltar - não mostrar se pagamento confirmado ou validando */}
        {!isPaymentConfirmed && !isValidating && (
          <Button variant="outline" className="w-full" onClick={onBack}>
            Voltar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
