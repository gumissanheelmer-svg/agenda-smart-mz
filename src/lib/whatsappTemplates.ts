import { format } from 'date-fns';

export type BusinessType = 'barbearia' | 'salao' | 'salao_barbearia';

interface AppointmentDetails {
  clientName: string;
  professionalName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  price: number;
  businessName?: string;
}

/**
 * Gera mensagem de confirmação do CLIENTE para o ESTABELECIMENTO (após agendar)
 */
export function getClientToBusinessMessage(
  details: AppointmentDetails,
  businessType: BusinessType
): string {
  const formattedDate = format(new Date(details.appointmentDate), 'dd/MM/yyyy');
  const priceFormatted = `${details.price.toFixed(0)} MZN`;
  const businessName = details.businessName || 'Estabelecimento';

  if (businessType === 'salao') {
    // Template feminino para salão de beleza
    return (
      `Olá! Fiz um agendamento no ${businessName} 💅✨\n\n` +
      `👩 Cliente: ${details.clientName}\n` +
      `💅 Serviço: ${details.serviceName}\n` +
      `👩‍💼 Profissional: ${details.professionalName}\n` +
      `📅 Data: ${formattedDate}\n` +
      `⏰ Hora: ${details.appointmentTime}\n` +
      `💰 Valor: ${priceFormatted}\n\n` +
      `Aguardo confirmação! 💕`
    );
  }

  if (businessType === 'salao_barbearia') {
    // Template híbrido (neutro)
    return (
      `Olá! Fiz um agendamento no ${businessName} ✨\n\n` +
      `👤 Cliente: ${details.clientName}\n` +
      `✂️ Serviço: ${details.serviceName}\n` +
      `👨‍💼 Profissional: ${details.professionalName}\n` +
      `📅 Data: ${formattedDate}\n` +
      `⏰ Hora: ${details.appointmentTime}\n` +
      `💰 Valor: ${priceFormatted}\n\n` +
      `Aguardo confirmação! 🙏`
    );
  }

  // Template padrão para barbearia (masculino)
  return (
    `Olá! Fiz um agendamento na ${businessName} 💈\n\n` +
    `👤 Cliente: ${details.clientName}\n` +
    `💇‍♂️ Serviço: ${details.serviceName}\n` +
    `✂️ Barbeiro: ${details.professionalName}\n` +
    `📅 Data: ${formattedDate}\n` +
    `⏰ Hora: ${details.appointmentTime}\n` +
    `💰 Valor: ${priceFormatted}\n\n` +
    `Aguardo confirmação! 🙏`
  );
}

/**
 * Gera mensagem de confirmação do ESTABELECIMENTO para o CLIENTE (admin enviando)
 */
export function getBusinessToClientMessage(
  details: AppointmentDetails,
  businessType: BusinessType,
  professionalLabel: string
): string {
  const formattedDate = format(new Date(details.appointmentDate), 'dd/MM/yyyy');
  const priceFormatted = `${details.price.toFixed(0)} MZN`;

  if (businessType === 'salao') {
    // Template feminino para salão
    return (
      `Olá ${details.clientName}! 💅✨\n\n` +
      `Confirmamos seu agendamento:\n\n` +
      `💅 Serviço: ${details.serviceName}\n` +
      `👩‍💼 Profissional: ${details.professionalName}\n` +
      `📅 Data: ${formattedDate}\n` +
      `⏰ Hora: ${details.appointmentTime}\n` +
      `💰 Valor: ${priceFormatted}\n\n` +
      `Esperamos por você! 💕`
    );
  }

  if (businessType === 'salao_barbearia') {
    // Template híbrido (neutro)
    return (
      `Olá ${details.clientName}! ✨\n\n` +
      `Confirmamos seu agendamento:\n\n` +
      `✂️ Serviço: ${details.serviceName}\n` +
      `👨‍💼 Profissional: ${details.professionalName}\n` +
      `📅 Data: ${formattedDate}\n` +
      `⏰ Hora: ${details.appointmentTime}\n` +
      `💰 Valor: ${priceFormatted}\n\n` +
      `Aguardamos você! ✨`
    );
  }

  // Template padrão para barbearia (masculino)
  return (
    `Olá ${details.clientName}! 💈\n\n` +
    `Confirmamos seu agendamento:\n\n` +
    `💇‍♂️ Serviço: ${details.serviceName}\n` +
    `✂️ ${professionalLabel}: ${details.professionalName}\n` +
    `📅 Data: ${formattedDate}\n` +
    `⏰ Hora: ${details.appointmentTime}\n` +
    `💰 Valor: ${priceFormatted}\n\n` +
    `Aguardamos você! 🤙`
  );
}

/**
 * Gera mensagem genérica do profissional para o cliente
 */
export function getProfessionalToClientMessage(
  clientName: string,
  businessType: BusinessType
): string {
  if (businessType === 'salao') {
    return `Olá ${clientName}! 💅 Aqui é do seu salão de beleza.`;
  }
  
  if (businessType === 'salao_barbearia') {
    return `Olá ${clientName}! ✨ Aqui é do seu estabelecimento de beleza.`;
  }
  
  return `Olá ${clientName}! 💈 Aqui é da sua barbearia.`;
}

/**
 * Gera link completo do WhatsApp com mensagem codificada
 */
export function generateWhatsAppLink(phoneNumber: string, message: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
