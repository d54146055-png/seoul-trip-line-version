
import React, { useState, useMemo, useEffect } from 'react';
import { Expense, User } from '../types';
import { Plus, ArrowRight, Trash2, RefreshCw, X, CheckSquare, Square, ClipboardList, Wallet, AlertCircle, UserCog } from 'lucide-react';
import { addExpenseItem, addUser, deleteExpenseItem, updateUser, deleteUser } from '../services/firebaseService';

// Moved WavyBorder outside to avoid re-creation and fix typing issues
const WavyBorder = ({children}: {children?: React.ReactNode}) => (
  <div className="relative">
      {/* Top Wavy SVG */}
      <div className="h-3 w-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10' preserveAspectRatio='none'%3E%3Cpath d='M0 10 Q 5 0 10 10 T 20 10' fill='none' stroke='%23004AAD' stroke-width='2'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '20px 10px'
      }}></div>
      
      <div className="bg-[#FDFBF7] border-x-2 border-[#004AAD] px-4 py-8 min-h-[100px] flex items-center justify-center">
          {children}
      </div>

      {/* Bottom Wavy SVG */}
      <div className="h-3 w-full" style={{
           backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10' preserveAspectRatio='none'%3E%3Cpath d='M0 0 Q 5 10 10 0 T 20 0' fill='none' stroke='%23004AAD' stroke-width='2'/%3E%3C/svg%3E")`,
           backgroundRepeat: 'repeat-x',
           backgroundSize: '20px 10px'
      }}></div>
  </div>
);

const DoodleBackground = React.memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none bg-paper">
        {/* Strictly use the user provided image, no random generation fallback */}
        <img 
          src="/doodle_bg.jpg" 
          alt="Doodle Background" 
          className="w-full h-full object-cover opacity-[0.15]"
        />
    </div>
  );
});

interface Props {
  expenses: Expense[];
  users: User[];
}

const ExpenseView: React.FC<Props> = ({ expenses, users }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ amount: 0, payer: '' });
  const [selectedInvolved, setSelectedInvolved] = useState<string[]>([]);
  const [newUser, setNewUser] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const [krwAmount, setKrwAmount] = useState<string>('1000');
  const [exchangeRate] = useState(0.024); // 1 KRW to TWD
  
  // Calculate TWD based on KRW
  const twdAmount = krwAmount ? Math.floor(parseFloat(krwAmount) * exchangeRate).toLocaleString() : '0';

  useEffect(() => {
     if (users.length > 0) {
         if (!newExpense.payer) setNewExpense(prev => ({ ...prev, payer: users[0].name }));
         if (selectedInvolved.length === 0) setSelectedInvolved(users.map(u => u.name));
     }
  }, [users.length, isModalOpen]);

  const calculations = useMemo(() => {
    if (!users || users.length === 0) {
        return { debts: [], balances: {}, totalPaid: {}, totalShare: {} };
    }
    
    const balances: Record<string, number> = {};
    const totalPaid: Record<string, number> = {};
    const totalShare: Record<string, number> = {};

    users.forEach(u => {
        balances[u.name] = 0;
        totalPaid[u.name] = 0;
        totalShare[u.name] = 0;
    });

    expenses.forEach(exp => {
      const paidBy = exp.payer;
      const amount = Number(exp.amount) || 0;
      
      const validInvolved = (exp.involved || []).filter(name => users.some(u => u.name === name));
      const splitAmong = validInvolved.length > 0 ? validInvolved : users.map(u => u.name);
      
      const share = amount / splitAmong.length;

      if (totalPaid[paidBy] !== undefined) totalPaid[paidBy] += amount;
      if (balances[paidBy] !== undefined) balances[paidBy] += amount;
      
      splitAmong.forEach(person => {
        if (balances[person] !== undefined) {
             balances[person] -= share;
             totalShare[person] += share;
        }
      });
    });

    const debts: Array<{from: string, to: string, amount: number}> = [];
    let debtors = Object.entries(balances).filter(([_, val]) => val < -0.01).sort((a, b) => a[1] - b[1]);
    let creditors = Object.entries(balances).filter(([_, val]) => val > 0.01).sort((a, b) => b[1] - a[1]);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(Math.abs(d[1]), c[1]);
      
      if (amount > 0.01) {
          debts.push({ from: d[0], to: c[0], amount: Math.round(amount) });
      }

      debtors[i] = [d[0], d[1] + amount];
      creditors[j] = [c[0], c[1] - amount];

      if (Math.abs(debtors[i][1]) < 0.01) i++;
      if (creditors[j][1] < 0.01) j++;
    }

    return { debts, balances, totalPaid, totalShare };
  }, [expenses, users]);

  const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const handleAddUser = async () => {
    if (newUser.trim() && !users.find(u => u.name === newUser.trim())) {
      await addUser(newUser.trim());
      setNewUser('');
    }
  };

  const toggleInvolved = (name: string) => {
      setSelectedInvolved(prev => 
        prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
  };

  const handleAddExpense = async () => {
    if (newExpense.amount && newExpense.description && newExpense.payer && selectedInvolved.length > 0) {
      await addExpenseItem({
        amount: Number(newExpense.amount),
        description: newExpense.description!,
        payer: newExpense.payer!,
        date: new Date().toISOString(),
        involved: selectedInvolved
      });
      setIsModalOpen(false);
      setNewExpense({ amount: 0, payer: users[0]?.name });
    } else if (selectedInvolved.length === 0) {
        alert("請至少選擇一位參與分帳的人員。");
    }
  };

  return (
    <div className="h-full relative bg-paper overflow-hidden">
      {/* Background Layer */}
      <DoodleBackground />

      {/* Content Layer */}
      <div className="h-full overflow-y-auto p-4 pb-24 space-y-5 no-scrollbar relative z-10">
      
        {/* 1. Currency Converter Card */}
        <div className="bg-[#FDFBF7] rounded-2xl p-4 shadow-doodle border-2 border-ink">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-ink font-sans">匯率快換</h3>
              <div className="text-xs font-bold text-ink flex items-center gap-1">
                  <RefreshCw size={10} /> 1 KRW ≈ {exchangeRate} TWD
              </div>
          </div>

          <div className="flex items-center gap-2">
              {/* KRW Input */}
              <div className="flex-1">
                  <label className="text-xs font-bold text-ink block mb-1">韓幣 (₩)</label>
                  <div className="relative border-2 border-ink rounded-full bg-white h-10 flex items-center overflow-hidden">
                      <input 
                          type="number" 
                          value={krwAmount}
                          onChange={(e) => setKrwAmount(e.target.value)}
                          className="w-full h-full pl-3 pr-8 outline-none text-ink font-bold text-lg bg-transparent"
                      />
                      {/* Decorative Grid Fill */}
                      <div className="absolute right-0 top-0 bottom-0 w-8 border-l-2 border-ink" 
                          style={{backgroundImage: 'url(#doodle-grid)'}}></div>
                  </div>
              </div>

              {/* Arrow */}
              <ArrowRight size={24} strokeWidth={3} className="text-ink mt-5" />

              {/* TWD Output */}
              <div className="flex-1">
                  <label className="text-xs font-bold text-marker block mb-1">台幣 ($)</label>
                  <div className="relative border-2 border-ink rounded-full bg-white h-10 flex items-center overflow-hidden">
                      <div className="w-full h-full pl-3 pr-8 flex items-center text-ink font-bold text-lg text-marker">
                          {twdAmount}
                      </div>
                      {/* Decorative Grid Fill */}
                      <div className="absolute right-0 top-0 bottom-0 w-8 border-l-2 border-ink" 
                          style={{backgroundImage: 'url(#doodle-grid)'}}></div>
                  </div>
              </div>
          </div>
        </div>

        {/* 2. Total Expense Card */}
        <div className="bg-[#FDFBF7] rounded-2xl p-4 shadow-doodle border-2 border-ink relative">
          <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-ink font-sans">總花費 (Total)</h3>
              <button onClick={() => setIsSettlementOpen(true)} className="text-ink hover:text-marker transition-colors">
                  <div className="w-10 h-10 border-2 border-ink rounded-lg flex items-center justify-center bg-white shadow-sm">
                      <ClipboardList size={20} strokeWidth={2.5} />
                  </div>
              </button>
          </div>

          <div className="mb-6">
              <span className="text-5xl font-hand font-bold text-ink tracking-tight">₩ {totalSpent.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
              {/* Avatars */}
              <div className="flex -space-x-2">
                  {users.length > 0 ? users.map((u, i) => (
                      <button key={u.id} onClick={() => { setSelectedUser(u); setEditingName(u.name); }} className="w-8 h-8 rounded-full bg-white border-2 border-ink flex items-center justify-center text-xs font-bold text-ink uppercase hover:scale-110 transition-transform z-10">
                          {u.name.charAt(0)}
                      </button>
                  )) : (
                      <div className="text-xs text-gray-400 font-bold">No members</div>
                  )}
              </div>

              {/* Add Button Pill */}
              <div className="flex items-center">
                  <div className="relative">
                      <input 
                          className="bg-white border-2 border-ink rounded-full py-1 pl-3 pr-8 text-xs font-bold text-ink w-32 outline-none placeholder-ink/50" 
                          placeholder="新增人名..." 
                          value={newUser}
                          onChange={e => setNewUser(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                      />
                      <button onClick={handleAddUser} className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-ink text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center">
                          <Plus size={14} strokeWidth={3}/>
                      </button>
                  </div>
              </div>
          </div>
        </div>

        {/* 3. Recent Expenses (Wavy Box) */}
        <div>
          <h3 className="text-xl font-bold text-ink mb-2 font-sans ml-1">最近支出</h3>
          
          <WavyBorder>
              {expenses.length === 0 ? (
                  <div className="text-center">
                      <p className="text-2xl font-bold text-ink font-sans">暫無花費記錄</p>
                  </div>
              ) : (
                  <div className="w-full space-y-3">
                      {expenses.map(expense => (
                          <div key={expense.id} className="flex justify-between items-center border-b-2 border-dashed border-ink/20 pb-2 last:border-0">
                              <div>
                                  <p className="font-bold text-ink text-sm">{expense.description}</p>
                                  <p className="text-[10px] text-gray-500 font-bold">By {expense.payer}</p>
                              </div>
                              <div className="text-right">
                                  <p className="font-bold text-ink">₩ {Number(expense.amount).toLocaleString()}</p>
                                  <button onClick={() => deleteExpenseItem(expense.id)} className="text-marker text-[10px] font-bold hover:underline">Delete</button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </WavyBorder>
        </div>
      </div>

      {/* Floating Action Button for Add Expense */}
       <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-white text-ink rounded-full shadow-doodle flex items-center justify-center border-2 border-ink hover:scale-110 transition-transform z-20">
        <Plus size={32} strokeWidth={3} />
      </button>

      {/* --- Modals --- */}
      
      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[20px] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out] border-2 border-ink max-h-[85vh] overflow-y-auto no-scrollbar">
            <h2 className="text-2xl font-hand font-bold text-ink mb-6 text-center">Add Expense</h2>
            <div className="space-y-6">
               <div className="text-center bg-paper p-4 rounded-xl border-2 border-ink">
                  <label className="text-xs font-bold text-ink uppercase tracking-widest block mb-2">Amount (KRW)</label>
                  <input type="number" className="w-full text-4xl font-hand font-bold p-2 focus:outline-none bg-transparent text-center text-ink placeholder-gray-300" placeholder="0" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
               </div>
               <div>
                 <label className="text-xs font-bold text-ink uppercase ml-1">For What?</label>
                 <input type="text" className="w-full p-3 hand-input mt-1 font-bold" placeholder="e.g. Dinner, Taxi..." value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
               </div>
               
               <div>
                 <label className="text-xs font-bold text-ink uppercase ml-1">Paid By</label>
                 <div className="flex flex-wrap gap-2 mt-2">
                    {users.map(u => (
                        <button key={u.id} onClick={() => setNewExpense({...newExpense, payer: u.name})} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 border-ink transition-all ${newExpense.payer === u.name ? 'bg-ink text-white shadow-doodle-sm' : 'bg-white text-ink hover:bg-gray-50'}`}>
                            {u.name}
                        </button>
                    ))}
                 </div>
               </div>

               <div>
                 <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-bold text-ink uppercase ml-1">Split With</label>
                     <button onClick={() => setSelectedInvolved(selectedInvolved.length === users.length ? [] : users.map(u => u.name))} className="text-[10px] text-marker font-bold bg-marker/10 px-2 py-1 rounded">
                        {selectedInvolved.length === users.length ? 'Clear All' : 'Select All'}
                     </button>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    {users.map(u => (
                        <button key={`inv-${u.id}`} onClick={() => toggleInvolved(u.name)} className={`flex items-center p-2 rounded-xl text-sm font-bold transition-all border-2 ${selectedInvolved.includes(u.name) ? 'bg-paper border-ink text-ink' : 'bg-white border-gray-200 text-gray-300'}`}>
                            {selectedInvolved.includes(u.name) ? <CheckSquare size={18} className="mr-2 text-ink"/> : <Square size={18} className="mr-2"/>}
                            {u.name}
                        </button>
                    ))}
                 </div>
               </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-ink font-bold border-2 border-transparent hover:border-ink rounded-xl">Cancel</button>
              <button onClick={handleAddExpense} className="flex-1 py-3 bg-marker text-white rounded-xl font-bold shadow-doodle border-2 border-ink hover:bg-red-600 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {isSettlementOpen && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[20px] w-full max-w-sm p-6 shadow-2xl relative border-2 border-ink max-h-[90vh] overflow-y-auto no-scrollbar">
                <button onClick={() => setIsSettlementOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-ink"><X size={24} /></button>
                <h2 className="text-2xl font-hand font-bold text-ink mb-1 text-center">Settlement</h2>
                {users.length === 0 ? (
                     <div className="text-center py-8">
                         <AlertCircle className="mx-auto mb-2 text-ink" size={32}/>
                         <p className="font-bold text-sm text-gray-500">No members yet.</p>
                     </div>
                ) : (
                    <div className="space-y-4 mt-6">
                        {/* Who owes who */}
                        {calculations.debts.length > 0 && (
                            <div className="bg-paper p-3 rounded-xl border-2 border-ink mb-4">
                                <h4 className="font-bold text-ink text-sm mb-2 flex items-center"><Wallet size={14} className="mr-1"/> Transfers Needed:</h4>
                                {calculations.debts.map((d, i) => (
                                    <div key={i} className="flex justify-between text-sm font-bold border-b border-ink/10 py-1 last:border-0">
                                        <span>{d.from} <ArrowRight size={10} className="inline"/> {d.to}</span>
                                        <span className="text-marker">₩ {d.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Balances */}
                        {users.map(u => {
                            const balance = calculations.balances[u.name] || 0;
                            const isPositive = balance >= 0;
                            return (
                                <div key={u.id} className="bg-paper rounded-xl p-3 border-2 border-ink">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-ink text-lg">{u.name}</span>
                                        <span className={`text-sm font-bold px-2 py-0.5 rounded border-2 border-ink ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {isPositive ? '+' : '-'} ₩ {Math.abs(Math.round(balance)).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex text-[10px] font-bold text-gray-500 justify-between bg-white p-2 rounded-lg border border-ink/20">
                                        <span>Paid: ₩ {Math.round(calculations.totalPaid[u.name] || 0).toLocaleString()}</span>
                                        <span>Share: ₩ {Math.round(calculations.totalShare[u.name] || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* User Edit Modal */}
      {selectedUser && (
          <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-[20px] w-full max-w-xs p-6 shadow-2xl border-2 border-ink">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-ink flex items-center"><UserCog size={18} className="mr-2"/> Edit Member</h2>
                    <button onClick={() => setSelectedUser(null)}><X size={18} className="text-gray-400"/></button>
                 </div>
                 <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full p-3 hand-input font-bold text-center" />
                 <div className="flex flex-col gap-2 mt-6">
                    <button onClick={async () => { if (selectedUser && editingName.trim()) { await updateUser(selectedUser.id, editingName.trim()); setSelectedUser(null); } }} className="w-full py-3 bg-ink text-white rounded-xl font-bold border-2 border-ink shadow-doodle-sm">Save</button>
                    <button onClick={async () => { if (selectedUser && confirm(`Remove ${selectedUser.name}?`)) { await deleteUser(selectedUser.id); setSelectedUser(null); } }} className="w-full py-3 bg-white border-2 border-ink text-marker rounded-xl font-bold hover:bg-red-50">Remove</button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default ExpenseView;
