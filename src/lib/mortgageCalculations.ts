export interface MortgageParams {
  principal: number;
  annualRate: number;
  termMonths: number;
  extraPayment?: number;
}

export function calculateMonthlyPayment({
  principal,
  annualRate,
  termMonths,
}: MortgageParams): number {
  const monthlyRate = annualRate / 12 / 100;
  const numerator =
    principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  return numerator / denominator;
}

export function calculateTotalInterest({
  principal,
  annualRate,
  termMonths,
  monthlyPayment,
}: MortgageParams & { monthlyPayment: number }): number {
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;
  let totalInterest = 0;

  for (let month = 1; month <= termMonths; month++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;

    totalInterest += interestPayment;
    balance -= principalPayment;

    if (balance <= 0) break;
  }

  return totalInterest;
}

export function calculateRecastPayment({
  principal,
  annualRate,
  termMonths,
  extraPayment,
}: MortgageParams): number {
  const newPrincipal = principal - (extraPayment || 0);
  return calculateMonthlyPayment({
    principal: newPrincipal,
    annualRate,
    termMonths,
  });
}

export function calculateBreakEvenMonths(
  refinanceCosts: number,
  currentMonthlyPayment: number,
  newMonthlyPayment: number
): number {
  const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
  return Math.ceil(refinanceCosts / monthlySavings);
}

export function calculateAmortizationSchedule({
  principal,
  annualRate,
  termMonths,
  monthlyPayment,
}: MortgageParams & { monthlyPayment: number }): Array<{
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}> {
  const monthlyRate = annualRate / 12 / 100;
  let balance = principal;
  const schedule = [];

  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    balance -= principalPayment;

    schedule.push({
      month,
      payment: monthlyPayment,
      principal: principalPayment,
      interest,
      remainingBalance: Math.max(0, balance),
    });

    if (balance <= 0) break;
  }

  return schedule;
}
