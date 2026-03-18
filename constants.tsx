
import { CategoryType } from './types';

export const CURRENCY = 'MT';

export const CATEGORY_LABELS = {
  [CategoryType.NEED]: 'Necessidades Básicas (50%)',
  [CategoryType.WANT]: 'Desejos Pessoais (30%)',
  [CategoryType.SAVING]: 'Investimentos/Reserva (20%)',
  [CategoryType.DEBT_INTEREST]: 'Dívida',
  [CategoryType.DEBT_NO_INTEREST]: 'Dívida s/ Juros',
  [CategoryType.INCOME]: 'Renda Variável'
};

export const CATEGORY_COLORS = {
  [CategoryType.NEED]: '#3b82f6', // blue-500
  [CategoryType.WANT]: '#a855f7', // purple-500
  [CategoryType.SAVING]: '#10b981', // emerald-500
  [CategoryType.DEBT_INTEREST]: '#ef4444', // red-500
  [CategoryType.DEBT_NO_INTEREST]: '#f97316', // orange-500
  [CategoryType.INCOME]: '#22c55e' // green-500
};

export const SUBCATEGORIES = {
  [CategoryType.NEED]: [
    'Moradia',
    'Transporte',
    'Supermercado',
    'Saúde',
    'Educação',
    'Contas Fixas (Água/Luz)'
  ],
  [CategoryType.WANT]: [
    'Lazer & Diversão',
    'Restaurantes/Sair',
    'Compras/Vestuário',
    'Assinaturas/Streaming',
    'Viagens',
    'Hobby'
  ],
  [CategoryType.SAVING]: [
    'Reserva de Emergência',
    'Investimentos',
    'Aposentadoria',
    'Poupanca Específica'
  ],
  [CategoryType.DEBT_INTEREST]: [
    'Cartão de Crédito',
    'Cheque Especial',
    'Empréstimo Bancário',
    'Financiamento Veículo',
    'Microcrédito'
  ],
  [CategoryType.DEBT_NO_INTEREST]: [
    'Empréstimo Família',
    'Empréstimo Amigos',
    'Fiado (Loja/Mercado)',
    'Parcela sem Juros'
  ],
  [CategoryType.INCOME]: [
    'Freelance',
    'Bónus/Gratificação',
    'Venda de Artigos',
    'Dividendos/Investimentos',
    'Presentes',
    'Outros Ganhos'
  ]
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
  }).format(amount).replace('MZN', CURRENCY);
};
