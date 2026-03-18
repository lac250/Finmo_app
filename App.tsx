
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  UserIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ZapIcon,
  TargetIcon
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
import { motion, AnimatePresence } from 'motion/react';
import { CategoryType, Transaction, BudgetStats, AIAdvice, FixedExpense } from './types';
import { CATEGORY_LABELS, CATEGORY_COLORS, SUBCATEGORIES, formatCurrency } from './constants';
import { getFinancialAdvice } from './services/geminiService';

interface User {
  id: number;
  username: string;
}

// --- Components ---

const Card: React.FC<{ className?: string, delay?: number, children?: React.ReactNode }> = ({ children, className = "", delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`glass p-6 rounded-3xl shadow-xl border-slate-800/50 ${className}`}
  >
    {children}
  </motion.div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = "", 
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger', 
  className?: string, 
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const variants = {
    primary: "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

// --- Main App ---

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Persistence states
  const [baseIncome, setBaseIncome] = useState<number>(() => {
    const saved = localStorage.getItem('finmo_income');
    return saved ? Number(saved) : 0;
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

  // Sync with LocalStorage
  useEffect(() => localStorage.setItem('finmo_income', baseIncome.toString()), [baseIncome]);
  useEffect(() => localStorage.setItem('finmo_payday', payday.toString()), [payday]);
  useEffect(() => localStorage.setItem('finmo_fixed', JSON.stringify(fixedExpenses)), [fixedExpenses]);
  useEffect(() => localStorage.setItem('finmo_transactions', JSON.stringify(transactions)), [transactions]);

  // Auth Logic
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Auth check failed", error);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setUsername('');
        setPassword('');
      } else {
        setAuthError(data.error || 'Erro na autenticação');
      }
    } catch (error) {
      setAuthError('Erro de conexão com o servidor');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setShowUserMenu(false);
  };

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

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RotateCcwIcon className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 overflow-x-hidden">
        {/* Landing Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-800/50 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-xl">
              <WalletIcon className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-xl font-bold tracking-tighter">Finmo</span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                <SparklesIcon className="w-4 h-4" /> Inteligência Financeira
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] text-white">
                Domine seus <span className="text-emerald-500">Meticais</span> com IA.
              </h1>
              <p className="text-xl text-slate-400 max-w-lg leading-relaxed">
                A aplicação definitiva para gestão financeira baseada na regra 50/30/20. Simples, estética e pragmática.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500 to-blue-500 blur-3xl opacity-20 animate-pulse" />
              <Card className="relative p-8 space-y-6">
                <h2 className="text-2xl font-black text-center">{isSignup ? 'Criar Conta' : 'Entrar'}</h2>
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium" 
                      required
                    />
                  </div>
                  {authError && <p className="text-red-400 text-xs font-bold text-center">{authError}</p>}
                  <Button type="submit" className="w-full py-4 text-lg">
                    {isSignup ? 'Cadastrar' : 'Entrar'}
                  </Button>
                </form>
                <p className="text-center text-sm text-slate-500">
                  {isSignup ? 'Já tem uma conta?' : 'Não tem uma conta?'} 
                  <button 
                    onClick={() => { setIsSignup(!isSignup); setAuthError(''); }} 
                    className="text-emerald-500 font-bold ml-2 hover:underline"
                  >
                    {isSignup ? 'Entrar' : 'Criar agora'}
                  </button>
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Features */}
          <section className="mt-40 grid md:grid-cols-3 gap-8">
            {[
              { icon: ZapIcon, title: "Regra 50/30/20", desc: "Organize automaticamente seus gastos em Necessidades, Desejos e Reserva.", color: "emerald" },
              { icon: ShieldCheckIcon, title: "Privacidade Total", desc: "Seus dados são seus. Sincronização segura com sua conta Google.", color: "blue" },
              { icon: TargetIcon, title: "Mentor IA", desc: "Receba conselhos pragmáticos baseados no seu comportamento financeiro.", color: "purple" }
            ].map((f, i) => (
              <Card key={i} delay={0.4 + i * 0.1} className="hover:border-slate-700 transition-all group">
                <div className={`p-4 bg-${f.color}-500/10 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-6 h-6 text-${f.color}-400`} />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </section>
        </main>

        <footer className="border-t border-slate-900 py-12 px-6 mt-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2 rounded-xl">
                <WalletIcon className="w-4 h-4 text-slate-400" />
              </div>
              <span className="font-bold tracking-tighter">Finmo</span>
            </div>
            <p className="text-sm text-slate-500">© 2026 Finmo. Feito para Moçambique.</p>
            <div className="flex gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-emerald-400 transition-colors">Termos</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Privacidade</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Suporte</a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 glass border-b border-slate-800/50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
            <WalletIcon className="w-5 h-5 text-slate-900" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">Finmo</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)} 
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all"
          >
            <Settings2Icon className="w-4 h-4 text-slate-400" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)} 
              className="flex items-center gap-2 p-1 pr-3 bg-slate-900 border border-slate-800 rounded-full hover:border-slate-700 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-xs font-bold hidden md:block">{user.username}</span>
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-3 w-56 glass rounded-3xl border-slate-700 py-3 shadow-2xl z-[60]"
                >
                  <div className="px-5 py-3 border-b border-slate-800 mb-2">
                    <p className="text-xs font-bold truncate">{user.username}</p>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="w-full text-left px-5 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                  >
                    <LogOutIcon className="w-4 h-4" /> Sair da Conta
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" 
              onClick={() => setShowSettings(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass p-8 rounded-[40px] max-w-md w-full space-y-8 shadow-2xl border-slate-700"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black">Configurações</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <XIcon className="w-6 h-6 text-slate-500" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Salário Base Mensal (MT)</label>
                  <div className="relative">
                    <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="number" 
                      value={baseIncome} 
                      onChange={(e) => setBaseIncome(Number(e.target.value))} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs text-slate-500 uppercase font-black tracking-widest">Dia do Pagamento</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="number" 
                      min="1" 
                      max="31" 
                      value={payday} 
                      onChange={(e) => setPayday(Number(e.target.value))} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                    />
                  </div>
                </div>
              </div>
              <Button onClick={() => setShowSettings(false)} className="w-full py-4 text-lg">
                Salvar Alterações
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Essenciais (50%)', val: stats.totalNeeds + stats.debtInterest + stats.debtNoInterest, target: targets[CategoryType.NEED], color: 'blue', icon: ZapIcon },
              { label: 'Desejos (30%)', val: stats.wants + stats.fixedWants, target: targets[CategoryType.WANT], color: 'purple', icon: SparklesIcon },
              { label: 'Reserva (20%)', val: stats.savings, target: targets[CategoryType.SAVING], color: 'emerald', icon: TargetIcon }
            ].map((c, i) => (
              <Card key={i} delay={i * 0.1} className={`border-l-4 border-${c.color}-500 group hover:translate-y-[-4px] transition-transform`}>
                <div className="flex justify-between items-start mb-4">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{c.label}</p>
                  <c.icon className={`w-4 h-4 text-${c.color}-500/50`} />
                </div>
                <p className="text-2xl font-black">{formatCurrency(c.val)}</p>
                <div className="mt-6 space-y-2">
                   <div className="flex justify-between text-[10px] font-bold">
                     <span className="text-slate-500">Progresso</span>
                     <span className={c.val > c.target ? 'text-red-400' : 'text-slate-400'}>
                       {Math.round((c.val / (c.target || 1)) * 100)}%
                     </span>
                   </div>
                   <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (c.val / (c.target || 1)) * 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full bg-${c.color}-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]`} 
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Chart Section */}
          <Card className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <LineChartIcon className="w-6 h-6 text-blue-400" /> Fluxo de Caixa
                </h2>
                <p className="text-sm text-slate-500 mt-1">Projeção inteligente do seu saldo para os próximos 30 dias</p>
              </div>
              <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Saldo</span>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                  <XAxis 
                    dataKey="day" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    interval={6} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `${v/1000}k`} 
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: '1px solid #1e293b', 
                      borderRadius: '16px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                    }} 
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#10b981" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorBal)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* AI Mentor */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 blur opacity-20 group-hover:opacity-40 transition-all duration-500 rounded-[40px]" />
            <Card className="relative p-10 overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black flex items-center gap-3">
                    <SparklesIcon className="w-8 h-8 text-emerald-400" /> Mentor IA
                  </h2>
                  <p className="text-slate-400 max-w-md">Análise profunda do seu comportamento financeiro com recomendações acionáveis.</p>
                </div>
                <Button 
                  onClick={async () => { 
                    setLoadingAdvice(true); 
                    const advice = await getFinancialAdvice(stats, transactions, stats.totalIncome);
                    setAiAdvice(advice); 
                    setLoadingAdvice(false); 
                  }} 
                  disabled={loadingAdvice}
                  className="px-10 py-4 text-lg"
                >
                  {loadingAdvice ? (
                    <>
                      <RotateCcwIcon className="w-5 h-5 animate-spin" /> Analisando...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5" /> Pedir Conselho
                    </>
                  )}
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {aiAdvice ? (
                  <motion.div 
                    key="advice"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-8 rounded-[32px] border-l-8 shadow-2xl ${
                      aiAdvice.status === 'critical' ? 'bg-red-500/5 border-red-500' : 
                      aiAdvice.status === 'warning' ? 'bg-orange-500/5 border-orange-500' : 
                      'bg-emerald-500/5 border-emerald-500'
                    }`}
                  >
                    <p className="text-2xl font-medium italic mb-8 text-white leading-relaxed">"{aiAdvice.message}"</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {aiAdvice.recommendations.map((r, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex gap-4 text-sm text-slate-300 bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50 group hover:border-emerald-500/30 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <ChevronRightIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="leading-relaxed">{r}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center space-y-4"
                  >
                    <div className="p-6 bg-slate-900 rounded-full">
                      <InfoIcon className="w-10 h-10 text-slate-700" />
                    </div>
                    <p className="text-slate-500 font-medium">Clique no botão acima para receber uma análise personalizada.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Form Card */}
          <Card className="p-8">
            <div className="flex p-1.5 bg-slate-950 rounded-2xl mb-8 border border-slate-900">
              {['expense', 'income', 'fixed'].map((t) => (
                <button 
                  key={t} 
                  onClick={() => setFormType(t as any)} 
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    formType === t ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t === 'expense' ? 'Gasto' : t === 'income' ? 'Renda' : 'Fixo'}
                </button>
              ))}
            </div>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                <input 
                  type="text" 
                  placeholder="Ex: Supermercado, Freelance..." 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Valor (MT)</label>
                <input 
                  type="number" 
                  placeholder="0,00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-black text-xl" 
                />
              </div>
              {formType !== 'income' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value as any)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold appearance-none"
                  >
                    <option value={CategoryType.NEED}>Necessidade (50%)</option>
                    <option value={CategoryType.WANT}>Desejo (30%)</option>
                    <option value={CategoryType.SAVING}>Reserva (20%)</option>
                  </select>
                </div>
              )}
              <Button type="submit" className="w-full py-4 text-lg mt-4">
                Adicionar Registro
              </Button>
            </form>
          </Card>

          {/* Activity List */}
          <Card className="p-8 min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-3">
                <ClockIcon className="w-4 h-4" /> Atividade Recente
              </h3>
              <span className="text-[10px] font-bold bg-slate-900 px-2 py-1 rounded-md text-slate-500">
                {transactions.length} total
              </span>
            </div>
            
            <div className="space-y-4 flex-1">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
                  <RotateCcwIcon className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sem registros ainda</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {transactions.slice(0, 8).map((t) => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group relative p-5 rounded-[24px] bg-slate-950/50 border border-slate-900 hover:border-slate-700 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-sm font-black truncate max-w-[140px] text-white">{t.description}</p>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full bg-${CATEGORY_COLORS[t.category] === '#3b82f6' ? 'blue' : CATEGORY_COLORS[t.category] === '#a855f7' ? 'purple' : 'emerald'}-500`} />
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">
                              {CATEGORY_LABELS[t.category].split(' (')[0]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-black ${t.category === CategoryType.INCOME ? 'text-emerald-400' : 'text-slate-100'}`}>
                            {t.category === CategoryType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                          <button 
                            onClick={() => { setTransactionToDelete(t.id); setShowDeleteModal(true); }}
                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {transactions.length > 8 && (
              <button className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors mt-6 border-t border-slate-900 pt-6">
                Ver Todo Histórico
              </button>
            )}
          </Card>
        </div>
      </main>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" 
              onClick={() => setShowDeleteModal(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative glass p-10 rounded-[40px] max-w-sm w-full text-center space-y-8 shadow-2xl border-slate-700"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <Trash2Icon className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black">Excluir Registro?</h3>
                <p className="text-slate-400 text-sm">Esta ação não pode ser desfeita. O valor será removido dos seus cálculos.</p>
              </div>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
                <Button variant="danger" onClick={() => transactionToDelete && handleDeleteTransaction(transactionToDelete)} className="flex-1 bg-red-500 text-white hover:bg-red-600 border-none">Excluir</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-slate-900/50 py-4 px-8 flex justify-between items-center z-40">
        <div className="flex items-center gap-6">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Finmo • v2.5</p>
          <div className="hidden md:flex gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-slate-400 transition-colors">Ajuda</a>
            <a href="#" className="hover:text-slate-400 transition-colors">API</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Feedback</a>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <CloudCheckIcon className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-emerald-400 font-black uppercase tracking-tighter">Sincronizado na Nuvem</span>
          </div>
        )}
      </footer>
    </div>
  );
};

export default App;
