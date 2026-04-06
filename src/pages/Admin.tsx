import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, LogOut, CheckCircle2, XCircle, Trash2, Lock } from 'lucide-react';

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Block time state
  const [blockDate, setBlockDate] = useState('');
  const [blockTime, setBlockTime] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'appointments'), orderBy('date', 'desc'), orderBy('time', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAppointments(apps);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      alert('Erro ao fazer login.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const deleteAppointment = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (error) {
        console.error('Error deleting:', error);
        alert('Erro ao excluir.');
      }
    }
  };

  const handleBlockTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate || !blockTime) return;

    try {
      await addDoc(collection(db, 'appointments'), {
        customerName: 'BLOQUEADO (Admin)',
        customerPhone: '00000000000',
        serviceId: 'manicure', // dummy
        serviceName: 'Horário Bloqueado',
        price: 0,
        date: blockDate,
        time: blockTime,
        status: 'confirmed', // Confirmed so it blocks the slot
        createdAt: serverTimestamp()
      });
      setBlockDate('');
      setBlockTime('');
      alert('Horário bloqueado com sucesso!');
    } catch (error) {
      console.error('Error blocking time:', error);
      alert('Erro ao bloquear horário.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-gold-500 flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 p-8 rounded-2xl border border-zinc-800 max-w-md w-full text-center">
          <h1 className="text-2xl font-serif text-gold-500 mb-2">Acesso Restrito</h1>
          <p className="text-zinc-400 mb-8">Faça login para acessar o painel de controle da Esmalteria.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (user.email !== 'gustavomedeirosg12@gmail.com') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-950 p-8 rounded-2xl border border-red-900/50 max-w-md w-full text-center">
          <h1 className="text-2xl font-serif text-red-500 mb-2">Acesso Negado</h1>
          <p className="text-zinc-400 mb-8">Sua conta ({user.email}) não tem permissão de administrador para acessar este painel.</p>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sair e Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <header className="bg-black border-b border-zinc-800 py-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-serif text-gold-500">Painel Admin</h1>
          <p className="text-xs text-zinc-500">Arielly Rodrigues Esmalteria</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid md:grid-cols-3 gap-8">
        
        {/* Sidebar: Block Times */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
            <h2 className="text-lg font-medium text-gold-400 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Bloquear Horário
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Use isso para fechar um horário na agenda (ex: horário de almoço, imprevistos).
            </p>
            <form onSubmit={handleBlockTime} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Data</label>
                <input 
                  type="date" 
                  value={blockDate}
                  onChange={e => setBlockDate(e.target.value)}
                  className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white"
                  style={{ colorScheme: 'dark' }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Horário</label>
                <select 
                  value={blockTime}
                  onChange={e => setBlockTime(e.target.value)}
                  className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white"
                  required
                >
                  <option value="">Selecione...</option>
                  {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                Bloquear Horário
              </button>
            </form>
          </div>
        </div>

        {/* Main Content: Appointments List */}
        <div className="md:col-span-2">
          <h2 className="text-xl font-medium text-white mb-6">Todos os Agendamentos</h2>
          
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-zinc-500">Nenhum agendamento encontrado.</p>
            ) : (
              appointments.map((app) => {
                const isBlocked = app.customerName.includes('BLOQUEADO');
                
                return (
                  <div key={app.id} className={`p-5 rounded-xl border ${isBlocked ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-900 border-zinc-700'} flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center`}>
                    
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-black px-2 py-1 rounded text-xs text-gold-400 border border-zinc-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {app.date.split('-').reverse().join('/')}
                        </span>
                        <span className="bg-black px-2 py-1 rounded text-xs text-gold-400 border border-zinc-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {app.time}
                        </span>
                        {!isBlocked && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            app.status === 'confirmed' ? 'bg-green-900/30 text-green-400' : 
                            app.status === 'cancelled' ? 'bg-red-900/30 text-red-400' : 
                            'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {app.status === 'confirmed' ? 'Confirmado' : app.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                          </span>
                        )}
                      </div>
                      
                      <h3 className={`font-medium ${isBlocked ? 'text-zinc-500' : 'text-white'} text-lg`}>
                        {app.customerName}
                      </h3>
                      
                      {!isBlocked && (
                        <div className="text-sm text-zinc-400 mt-1">
                          <p>{app.serviceName} - R$ {app.price}</p>
                          <p>WhatsApp: {app.customerPhone}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {!isBlocked && app.status !== 'confirmed' && (
                        <button 
                          onClick={() => updateStatus(app.id, 'confirmed')}
                          className="p-2 bg-green-900/20 text-green-400 hover:bg-green-900/40 rounded-lg transition-colors"
                          title="Confirmar"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                      {!isBlocked && app.status !== 'cancelled' && (
                        <button 
                          onClick={() => updateStatus(app.id, 'cancelled')}
                          className="p-2 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 rounded-lg transition-colors"
                          title="Cancelar"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteAppointment(app.id)}
                        className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
