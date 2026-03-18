
export enum CategoryType {
  NEED = 'NEED',      // 50%
  WANT = 'WANT',      // 30%
  SAVING = 'SAVING',  // 20%
  DEBT_INTEREST = 'DEBT_INTEREST',
  DEBT_NO_INTEREST = 'DEBT_NO_INTEREST',
  INCOME = 'INCOME'   // Variable/Extra Income
}

export interface FixedExpense {
  id: string;
  description: string;
  amount: number;
  category: CategoryType.NEED | CategoryType.WANT | CategoryType.DEBT_NO_INTEREST;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  interestAmount?: number; // New field for tracking interest costs in debts
  category: CategoryType;
  subcategory: string;
  date: string;
  dueDate?: string;
}

export interface BudgetStats {
  baseIncome: number;
  variableIncome: number;
  totalIncome: number;
  fixedNeeds: number;
  variableNeeds: number;
  totalNeeds: number;
  wants: number;
  fixedWants: number;
  savings: number;
  debtInterest: number;
  debtNoInterest: number;
  fixedDebts: number;
  totalSpent: number;
}

export interface AIAdvice {
  status: 'good' | 'warning' | 'critical';
  message: string;
  recommendations: string[];
}
