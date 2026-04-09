// Math and financial calculators.
// No API required -- pure computation.

// ─── calculate_tip ────────────────────────────────────────────────────────────

export function calculateTip(args: Record<string, unknown>): unknown {
  const bill = Number(args.bill ?? 0);
  const tipPercent = Number(args.tip_percent ?? 18);
  const splitWays = Math.max(1, Math.round(Number(args.split_ways ?? 1)));

  if (bill <= 0) return { error: "bill must be a positive number." };
  if (tipPercent < 0) return { error: "tip_percent must be non-negative." };

  const tipAmount = bill * (tipPercent / 100);
  const total = bill + tipAmount;
  const perPerson = total / splitWays;
  const tipPerPerson = tipAmount / splitWays;

  return {
    bill,
    tip_percent: tipPercent,
    tip_amount: round2(tipAmount),
    total: round2(total),
    split_ways: splitWays,
    per_person: round2(perPerson),
    tip_per_person: round2(tipPerPerson),
  };
}

// ─── calculate_mortgage ───────────────────────────────────────────────────────

export function calculateMortgage(args: Record<string, unknown>): unknown {
  const loanAmount = Number(args.loan_amount ?? 0);
  const annualRate = Number(args.annual_rate ?? 0);
  const termYears = Number(args.term_years ?? 0);

  if (loanAmount <= 0) return { error: "loan_amount must be a positive number." };
  if (annualRate < 0) return { error: "annual_rate must be non-negative." };
  if (termYears <= 0) return { error: "term_years must be a positive number." };

  const n = termYears * 12;

  let monthlyPayment: number;
  if (annualRate === 0) {
    monthlyPayment = loanAmount / n;
  } else {
    const r = annualRate / 100 / 12;
    monthlyPayment = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const totalPaid = monthlyPayment * n;
  const totalInterest = totalPaid - loanAmount;

  return {
    loan_amount: loanAmount,
    annual_rate_percent: annualRate,
    term_years: termYears,
    term_months: n,
    monthly_payment: round2(monthlyPayment),
    total_paid: round2(totalPaid),
    total_interest: round2(totalInterest),
    interest_to_principal_ratio: round2(totalInterest / loanAmount),
  };
}

// ─── calculate_bmi ────────────────────────────────────────────────────────────

export function calculateBmi(args: Record<string, unknown>): unknown {
  const weightKg = Number(args.weight_kg ?? 0);
  const heightCm = Number(args.height_cm ?? 0);

  if (weightKg <= 0) return { error: "weight_kg must be a positive number." };
  if (heightCm <= 0) return { error: "height_cm must be a positive number." };

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let category: string;
  if (bmi < 18.5) category = "Underweight";
  else if (bmi < 25) category = "Normal weight";
  else if (bmi < 30) category = "Overweight";
  else if (bmi < 35) category = "Obese (Class I)";
  else if (bmi < 40) category = "Obese (Class II)";
  else category = "Obese (Class III)";

  const healthyWeightMin = round2(18.5 * heightM * heightM);
  const healthyWeightMax = round2(24.9 * heightM * heightM);

  return {
    weight_kg: weightKg,
    height_cm: heightCm,
    bmi: round2(bmi),
    category,
    healthy_weight_range_kg: { min: healthyWeightMin, max: healthyWeightMax },
    note: "BMI is a screening tool, not a diagnostic measure. Consult a healthcare provider for medical advice.",
  };
}

// ─── calculate_compound_interest ─────────────────────────────────────────────

export function calculateCompoundInterest(args: Record<string, unknown>): unknown {
  const principal = Number(args.principal ?? 0);
  const annualRate = Number(args.annual_rate ?? 0);
  const years = Number(args.years ?? 0);
  const compoundsPerYear = Math.max(1, Number(args.compounds_per_year ?? 12));

  if (principal <= 0) return { error: "principal must be a positive number." };
  if (annualRate < 0) return { error: "annual_rate must be non-negative." };
  if (years <= 0) return { error: "years must be a positive number." };

  const r = annualRate / 100;
  const finalAmount = principal * Math.pow(1 + r / compoundsPerYear, compoundsPerYear * years);
  const totalInterest = finalAmount - principal;
  const effectiveAnnualRate = (Math.pow(1 + r / compoundsPerYear, compoundsPerYear) - 1) * 100;

  const compoundLabel: Record<number, string> = {
    1: "annually",
    2: "semi-annually",
    4: "quarterly",
    12: "monthly",
    52: "weekly",
    365: "daily",
  };

  return {
    principal,
    annual_rate_percent: annualRate,
    years,
    compounds_per_year: compoundsPerYear,
    compound_frequency: compoundLabel[compoundsPerYear] ?? `${compoundsPerYear}x per year`,
    final_amount: round2(finalAmount),
    total_interest: round2(totalInterest),
    growth_factor: round4(finalAmount / principal),
    effective_annual_rate_percent: round4(effectiveAnnualRate),
  };
}

// ─── convert_currency_estimate ────────────────────────────────────────────────

// Hardcoded approximate rates relative to USD (updated periodically -- not real-time).
const APPROX_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  AUD: 0.64,
  CAD: 0.74,
  CHF: 1.12,
  CNY: 0.138,
  INR: 0.012,
  MXN: 0.058,
  BRL: 0.20,
  SGD: 0.74,
  HKD: 0.128,
  KRW: 0.00073,
  NZD: 0.60,
  SEK: 0.096,
  NOK: 0.094,
  DKK: 0.145,
  ZAR: 0.054,
  TRY: 0.029,
  AED: 0.272,
  THB: 0.028,
  MYR: 0.225,
  IDR: 0.000063,
  PLN: 0.247,
  CZK: 0.044,
  HUF: 0.0027,
  ILS: 0.275,
  SAR: 0.267,
  PHP: 0.0175,
};

export function convertCurrencyEstimate(args: Record<string, unknown>): unknown {
  const amount = Number(args.amount ?? 0);
  const from = String(args.from_currency ?? "").toUpperCase().trim();
  const to = String(args.to_currency ?? "").toUpperCase().trim();

  if (amount <= 0) return { error: "amount must be a positive number." };
  if (!from) return { error: "from_currency is required (e.g. USD, EUR, AUD)." };
  if (!to) return { error: "to_currency is required (e.g. USD, EUR, AUD)." };

  if (!APPROX_RATES_TO_USD[from]) {
    return { error: `Currency "${from}" not in approximate rate table. Supported: ${Object.keys(APPROX_RATES_TO_USD).join(", ")}.` };
  }
  if (!APPROX_RATES_TO_USD[to]) {
    return { error: `Currency "${to}" not in approximate rate table. Supported: ${Object.keys(APPROX_RATES_TO_USD).join(", ")}.` };
  }

  const amountInUsd = amount * APPROX_RATES_TO_USD[from];
  const converted = amountInUsd / APPROX_RATES_TO_USD[to];
  const rate = APPROX_RATES_TO_USD[from] / APPROX_RATES_TO_USD[to];

  return {
    amount,
    from_currency: from,
    to_currency: to,
    converted_amount: round4(converted),
    approximate_rate: round6(rate),
    disclaimer: "APPROXIMATE RATES ONLY. These are hardcoded estimates and may not reflect current market rates. Use a real-time currency API (e.g. openexchangerates) for exact conversion.",
    supported_currencies: Object.keys(APPROX_RATES_TO_USD),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function round6(n: number): number { return Math.round(n * 1000000) / 1000000; }
