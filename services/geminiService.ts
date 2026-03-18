
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CategoryType, BudgetStats } from "../types";

// Always use process.env.API_KEY directly for initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (
  stats: BudgetStats,
  transactions: Transaction[],
  totalIncome: number
) => {
  const prompt = `
    Atue como Finmo, um mentor financeiro especializado na regra 50/30/20. 
    Analise os seguintes dados financeiros do usuário (Moeda: Metical - MT):
    
    Renda Total Disponível: ${stats.totalIncome} MT (Base: ${stats.baseIncome} + Variável: ${stats.variableIncome})
    
    // Fix: Changed stats.needs to stats.totalNeeds as defined in BudgetStats type
    Gastos em Necessidades (Meta 50% de ${stats.totalIncome}): ${stats.totalNeeds + stats.debtInterest + stats.debtNoInterest} MT
    Dívidas Ativas: ${stats.debtInterest + stats.debtNoInterest} MT
    Gastos em Desejos (Meta 30% de ${stats.totalIncome}): ${stats.wants} MT
    Investimentos/Reserva (Meta 20% de ${stats.totalIncome}): ${stats.savings} MT
    
    Lista de movimentações recentes:
    ${transactions.slice(0, 15).map(t => `- ${t.category === 'INCOME' ? 'ENTRADA' : 'SAÍDA'}: ${t.description} - ${t.amount} MT (${t.subcategory})`).join('\n')}

    Sua resposta deve ser em JSON seguindo este esquema:
    {
      "status": "good" | "warning" | "critical",
      "message": "Uma mensagem curta, pragmática e incentivadora.",
      "recommendations": ["Recomendação 1", "Recomendação 2", "Recomendação 3"]
    }

    Regras de Mentoria:
    1. Se houver Renda Variável expressiva, sugira alocar 100% dela para a Reserva de Emergência ou Dívidas se o usuário estiver fora das metas.
    2. Se Necessidades + Dívidas > 50% da renda total, status é 'critical'.
    3. Fale sempre em Meticais (MT). Seja direto e encorajador.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            message: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["status", "message", "recommendations"]
        }
      }
    });

    // Accessing the .text property directly as it returns the string output
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Erro ao obter conselho da IA:", error);
    return {
      status: 'warning',
      message: 'Houve um erro na análise, mas continue monitorando suas entradas variáveis para acelerar sua independência.',
      recommendations: ['Mantenha o registro de proveniência', 'Não gaste a renda extra antes de recebê-la', 'Foco na reserva']
    };
  }
};