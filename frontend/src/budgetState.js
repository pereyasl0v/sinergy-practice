const RUB_EXPENSE_KEYS = ['housing', 'food', 'transport', 'other', 'materials'];

export function normalizeBudgetForCurrency(values, currency) {
  if (currency !== 'USD') return values;
  return {
    ...values,
    ...Object.fromEntries(RUB_EXPENSE_KEYS.map(key => [key, 0])),
  };
}
