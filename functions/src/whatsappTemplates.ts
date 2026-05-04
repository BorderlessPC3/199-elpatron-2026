export function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

export function buildReminderBody(
  clientName: string,
  amount: number,
  dueDate: string,
  loanShort: string,
): string {
  return `Lembrete El Patrón: Olá ${clientName}, a parcela de ${formatBrl(
    amount,
  )} vence amanhã (${dueDate}). Empréstimo #${loanShort}.`;
}

export function buildOverdueBody(
  clientName: string,
  amount: number,
  dueDate: string,
  loanShort: string,
): string {
  return `Aviso El Patrón: ${clientName}, parcela de ${formatBrl(
    amount,
  )} com vencimento em ${dueDate} está em atraso. Empréstimo #${loanShort}.`;
}

export function buildConfirmationBody(
  clientName: string,
  amount: number,
  dueDate: string,
): string {
  return `El Patrón: Pagamento confirmado! ${clientName}, parcela de ${formatBrl(
    amount,
  )} (${dueDate}) recebida. Obrigado.`;
}
