
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUpIcon, 
  WalletIcon, 
  CreditCardIcon, 
  PieChartIcon, 
  SparklesIcon,
  Trash2Icon,
  ChevronRightIcon,
  XIcon,
  RotateCcwIcon,
  CalendarIcon,
  RepeatIcon,
  Settings2Icon,
  InfoIcon,
  LineChartIcon,
  ClockIcon,
  LogOutIcon,
  CloudCheckIcon,
  UserIcon
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';
import { CategoryType, Transaction, BudgetStats, AIAdvice, FixedExpense } from './types';
import { CATEGORY_LABELS, CATEGORY_COLORS, SUBCATEGORIES, formatCurrency } from './constants';
import { getFinancialAdvice } from './services/geminiService';

interface User {
  name: string;
  email: string;
  picture: string;
}

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('finmo_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Persistence states
  const [baseIncome, setBaseIncome] = useState<number>(() => {
    const saved = localStorage.getItem('finmo_income');
    return saved ? Number(saved) : 0; // Padrão 0 conforme solicitado
  });

  const [payday, setPayday] = useState<number>(() => {
    const saved = localStorage.getItem('finmo_payday');
    return saved ? Number(saved) : 1;
  });

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => {
    const saved = localStorage.getItem('finmo_fixed');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('finmo_transactions');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // UI states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income' | 'fixed'>('expense');
  const [category, setCategory] = useState<CategoryType>(CategoryType.NEED);
  const [subcategory, setSubcategory] = useState<string>(SUBCATEGORIES[CategoryType.NEED][0]);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Sync with LocalStorage
  useEffect(() => localStorage.setItem('finmo_income', baseIncome.toString()), [baseIncome]);
  useEffect(() => localStorage.setItem('finmo_payday', payday.toString()), [payday]);
  useEffect(() => localStorage.setItem('finmo_fixed', JSON.stringify(fixedExpenses)), [fixedExpenses]);
  useEffect(() => localStorage.setItem('finmo_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => {
    if (user) localStorage.setItem('finmo_user', JSON.stringify(user));
    else localStorage.removeItem('finmo_user');
  }, [user]);

  // Google Auth Logic
  useEffect(() => {
    const handleCredentialResponse = (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        setUser({
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        });
      } catch (error) {
        console.error("Auth error", error);
      }
    };

    const initGoogle = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: "776077583626-v2i5c1s8unr1e23u9b9p3i8m9u9m4n9m.apps.googleusercontent.com",
          callback: handleCredentialResponse,
        });
        if (!user && googleBtnRef.current) {
          google.accounts.id.renderButton(googleBtnRef.current, { 
            theme: "outline", size: "large", type: "icon", shape: "circle" 
          });
        }
      }
    };

    if ((window as any).google) initGoogle();
    else {
      const t = setInterval(() => { if((window as any).google) { initGoogle(); clearInterval(t); } }, 500);
    }
  }, [user]);

  const stats = useMemo<BudgetStats>(() => {
    const s: BudgetStats = { 
      baseIncome, variableIncome: 0, totalIncome: 0, fixedNeeds: 0, variableNeeds: 0, 
      totalNeeds: 0, wants: 0, fixedWants: 0, savings: 0, debtInterest: 0, 
      debtNoInterest: 0, fixedDebts: 0, totalSpent: 0 
    };
    fixedExpenses.forEach(fe => {
      if (fe.category === CategoryType.NEED) s.fixedNeeds += fe.amount;
      if (fe.category === CategoryType.WANT) s.fixedWants += fe.amount;
      if (fe.category === CategoryType.DEBT_NO_INTEREST) s.fixedDebts += fe.amount;
    });
    transactions.forEach(t => {
      if (t.category === CategoryType.INCOME) s.variableIncome += t.amount;
      else {
        if (t.category === CategoryType.NEED) s.variableNeeds += t.amount;
        if (t.category === CategoryType.WANT) s.wants += t.amount;
        if (t.category === CategoryType.SAVING) s.savings += t.amount;
        if (t.category === CategoryType.DEBT_INTEREST) s.debtInterest += t.amount;
        if (t.category === CategoryType.DEBT_NO_INTEREST) s.debtNoInterest += t.amount;
      }
    });
    s.totalIncome = s.baseIncome + s.variableIncome;
    s.totalNeeds = s.fixedNeeds + s.variableNeeds;
    s.totalSpent = s.totalNeeds + s.wants + s.fixedWants + s.savings + s.debtInterest + s.debtNoInterest + s.fixedDebts;
    return s;
  }, [transactions, baseIncome, fixedExpenses]);

  const projectionData = useMemo(() => {
    const data = [];
    let currentBalance = stats.totalIncome - stats.totalSpent;
    const today = new Date();
    for (let i = 0; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDate() === payday && i > 0) currentBalance += baseIncome;
      data.push({
        day: date.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' }),
        balance: Math.max(0, currentBalance),
      });
    }
    return data;
  }, [stats, payday, baseIncome]);

  const targets = {
    [CategoryType.NEED]: stats.totalIncome * 0.5,
    [CategoryType.WANT]: stats.totalIncome * 0.3,
    [CategoryType.SAVING]: stats.totalIncome * 0.2,
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    const val = parseFloat(amount);
    if (formType === 'fixed') {
      setFixedExpenses([...fixedExpenses, { id: Math.random().toString(36).substr(2, 9), description, amount: val, category: category as any }]);
    } else {
      setTransactions([{ id: Math.random().toString(36).substr(2, 9), description, amount: val, category, subcategory, date: new Date().toISOString() }, ...transactions]);
    }
    setDescription(''); setAmount('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 glass border-b border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
            <WalletIcon className="w-5 h-5 text-slate-900" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">Finmo</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-900 border border-slate-800 rounded-full hover:border-slate-700 transition-all">
            <Settings2Icon className="w-4 h-4 text-slate-400" />
          </button>
          <div className="w-px h-6 bg-slate-800 mx-1" />
          {user ? (
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-8 h-8 rounded-full border border-emerald-500/50 overflow-hidden shadow-lg">
                <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-48 glass rounded-2xl border-slate-700 py-2 shadow-2xl z-[60] animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-800">
                    <p className="text-[10px] font-bold truncate">{user.name}</p>
                    <p className="text-[8px] text-slate-500">{user.email}</p>
                  </div>
                  <button onClick={() => { setUser(null); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                    <LogOutIcon className="w-3 h-3" /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative group">
              <div ref={googleBtnRef} className="opacity-0 absolute inset-0 z-10 cursor-pointer overflow-hidden rounded-full w-8 h-8" />
              <button className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-400 group-hover:text-emerald-400 transition-all">
                <UserIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative glass p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl border-slate-700 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Ajustes Base</h3>
              <button onClick={() => setShowSettings(false)}><XIcon className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 uppercase font-black">Salário Base (MT)</label>
                <input type="number" value={baseIncome} onChange={(e) => setBaseIncome(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 uppercase font-black">Dia do Pagamento</label>
                <input type="number" min="1" max="31" value={payday} onChange={(e) => setPayday(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl shadow-lg">Salvar Configurações</button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Essenciais (50%)', val: stats.totalNeeds + stats.debtInterest + stats.debtNoInterest, target: targets[CategoryType.NEED], color: 'blue' },
              { label: 'Desejos (30%)', val: stats.wants + stats.fixedWants, target: targets[CategoryType.WANT], color: 'purple' },
              { label: 'Reserva (20%)', val: stats.savings, target: targets[CategoryType.SAVING], color: 'emerald' }
            ].map((c, i) => (
              <div key={i} className={`glass p-6 rounded-3xl border-l-4 border-${c.color}-500 shadow-xl`}>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{c.label}</p>
                <p className="text-xl font-bold">{formatCurrency(c.val)}</p>
                <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-${c.color}-500 transition-all duration-500`} style={{ width: `${Math.min(100, (c.val / (c.target || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="glass p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-blue-400" /> Fluxo de Caixa</h2>
                <p className="text-xs text-slate-500">Projeção do saldo para os próximos 30 dias</p>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={6} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-3xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 blur opacity-20 group-hover:opacity-30 transition-all" />
            <div className="relative glass p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-emerald-400" /> Mentor IA</h2>
                <button onClick={async () => { setLoadingAdvice(true); setAiAdvice(await getFinancialAdvice(stats, transactions, stats.totalIncome)); setLoadingAdvice(false); }} disabled={loadingAdvice} className="bg-emerald-500 text-slate-950 font-bold px-6 py-2 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50">
                  {loadingAdvice ? 'Analisando...' : 'Pedir Conselho'}
                </button>
              </div>
              {aiAdvice && (
                <div className={`p-6 rounded-2xl border-l-4 animate-in fade-in slide-in-from-bottom-4 ${aiAdvice.status === 'critical' ? 'bg-red-500/10 border-red-500' : 'bg-emerald-500/10 border-emerald-500'}`}>
                   <p className="text-lg italic mb-4">"{aiAdvice.message}"</p>
                   <div className="grid md:grid-cols-2 gap-3">
                     {aiAdvice.recommendations.map((r, i) => (
                       <div key={i} className="flex gap-2 text-sm text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                         <ChevronRightIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" /> {r}
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass p-6 rounded-3xl space-y-4">
            <div className="flex p-1 bg-slate-900 rounded-xl mb-4">
              {['expense', 'income', 'fixed'].map((t) => (
                <button key={t} onClick={() => setFormType(t as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formType === t ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}>
                  {t === 'expense' ? 'Gasto' : t === 'income' ? 'Renda' : 'Fixo'}
                </button>
              ))}
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <input type="text" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="number" placeholder="Valor (MT)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
              {formType !== 'income' && (
                <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none">
                  <option value={CategoryType.NEED}>Necessidade (50%)</option>
                  <option value={CategoryType.WANT}>Desejo (30%)</option>
                  <option value={CategoryType.SAVING}>Reserva (20%)</option>
                </select>
              )}
              <button type="submit" className="w-full bg-white text-slate-950 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all">Adicionar</button>
            </form>
          </div>

          <div className="glass p-6 rounded-3xl min-h-[400px]">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-6 flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Atividade Recente</h3>
            <div className="space-y-3">
              {transactions.length === 0 ? <p className="text-center text-slate-600 py-10 text-xs italic">Sem registros ainda.</p> : transactions.slice(0, 8).map((t) => (
                <div key={t.id} className="group relative p-4 rounded-2xl bg-slate-900/50 border border-transparent hover:border-slate-800 transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold truncate max-w-[150px]">{t.description}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black">{CATEGORY_LABELS[t.category]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${t.category === CategoryType.INCOME ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {t.category === CategoryType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-slate-900 py-3 px-6 flex justify-between items-center z-40">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Finmo • v2.0</p>
        {user && <p className="text-[10px] text-emerald-500/70 font-bold flex items-center gap-1"><CloudCheckIcon className="w-3 h-3" /> Sincronizado</p>}
      </footer>
    </div>
  );
};

export default App;
