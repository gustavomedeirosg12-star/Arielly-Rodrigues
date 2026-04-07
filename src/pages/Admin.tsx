import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Calendar, Clock, LogOut, CheckCircle2, XCircle, Trash2, Lock, Scissors, Settings as SettingsIcon, Plus, Edit2, LayoutDashboard, Users, Briefcase, DollarSign } from 'lucide-react';
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ openTime: '09:00', closeTime: '18:00', slotInterval: 60 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'appointments' | 'services' | 'professionals' | 'settings'>('dashboard');

  // Block time state
  const [blockDate, setBlockDate] = useState('');
  const [blockTime, setBlockTime] = useState('');

  // Service form state
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', price: 0, duration: 60, isTraditional: false });

  // Professional form state
  const [editingProfessionalId, setEditingProfessionalId] = useState<string | null>(null);
  const [professionalForm, setProfessionalForm] = useState({ name: '', role: 'Manicure', active: true });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({ openTime: '09:00', closeTime: '18:00', slotInterval: 60 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Appointments
    const qApps = query(collection(db, 'appointments'), orderBy('date', 'desc'), orderBy('time', 'asc'));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Services
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Professionals
    const unsubProfessionals = onSnapshot(collection(db, 'professionals'), (snapshot) => {
      setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(data);
        setSettingsForm({ openTime: data.openTime, closeTime: data.closeTime, slotInterval: data.slotInterval });
      }
    });

    return () => {
      unsubApps();
      unsubServices();
      unsubProfessionals();
      unsubSettings();
    };
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

  // --- Appointments Logic ---
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
        serviceId: 'block',
        serviceName: 'Horário Bloqueado',
        price: 0,
        date: blockDate,
        time: blockTime,
        status: 'confirmed',
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

  // --- Services Logic ---
  const generateDefaultServices = async () => {
    if (!window.confirm('Isso irá adicionar os serviços padrão da Esmalteria. Deseja continuar?')) return;
    
    const defaultServices = [
      { name: 'Manicure e Pedicure (Pé e Mão)', description: 'Cutilagem e esmaltação tradicional.', price: 60, duration: 90, isTraditional: true },
      { name: 'Manicure Simples', description: 'Cutilagem e esmaltação tradicional das mãos.', price: 35, duration: 45, isTraditional: true },
      { name: 'Pedicure Simples', description: 'Cutilagem e esmaltação tradicional dos pés.', price: 35, duration: 45, isTraditional: true },
      { name: 'Alongamento em Gel', description: 'Alongamento completo com tip ou fibra de vidro.', price: 150, duration: 120, isTraditional: false },
      { name: 'Manutenção de Gel', description: 'Manutenção do alongamento (até 20 dias).', price: 90, duration: 90, isTraditional: false },
      { name: 'Banho de Gel', description: 'Cobertura de gel sobre a unha natural.', price: 80, duration: 60, isTraditional: false }
    ];

    try {
      for (const service of defaultServices) {
        await addDoc(collection(db, 'services'), service);
      }
      alert('Serviços recuperados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar serviços:', error);
      alert('Erro ao recuperar serviços.');
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingServiceId) {
        await updateDoc(doc(db, 'services', editingServiceId), serviceForm);
        alert('Serviço atualizado!');
      } else {
        await addDoc(collection(db, 'services'), serviceForm);
        alert('Serviço adicionado!');
      }
      setServiceForm({ name: '', description: '', price: 0, duration: 60, isTraditional: false });
      setEditingServiceId(null);
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Erro ao salvar serviço.');
    }
  };

  const editService = (service: any) => {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      description: service.description,
      price: service.price,
      duration: service.duration,
      isTraditional: service.isTraditional || false
    });
    setActiveTab('services');
  };

  const deleteService = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
      try {
        await deleteDoc(doc(db, 'services', id));
      } catch (error) {
        console.error('Error deleting service:', error);
        alert('Erro ao excluir serviço.');
      }
    }
  };

  // --- Professionals Logic ---
  const handleSaveProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProfessionalId) {
        await updateDoc(doc(db, 'professionals', editingProfessionalId), professionalForm);
        alert('Profissional atualizado!');
      } else {
        await addDoc(collection(db, 'professionals'), professionalForm);
        alert('Profissional adicionado!');
      }
      setProfessionalForm({ name: '', role: 'Manicure', active: true });
      setEditingProfessionalId(null);
    } catch (error) {
      console.error('Error saving professional:', error);
      alert('Erro ao salvar profissional.');
    }
  };

  const editProfessional = (prof: any) => {
    setEditingProfessionalId(prof.id);
    setProfessionalForm({
      name: prof.name,
      role: prof.role,
      active: prof.active
    });
    setActiveTab('professionals');
  };

  const deleteProfessional = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este profissional?')) {
      try {
        await deleteDoc(doc(db, 'professionals', id));
      } catch (error) {
        console.error('Error deleting professional:', error);
        alert('Erro ao excluir profissional.');
      }
    }
  };

  // --- Settings Logic ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'general'), settingsForm);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações.');
    }
  };

  // --- Render Helpers ---
  const generateTimeOptions = () => {
    const times = [];
    let [hour, minute] = settings.openTime.split(':').map(Number);
    const [closeHour, closeMinute] = settings.closeTime.split(':').map(Number);
    
    while (hour < closeHour || (hour === closeHour && minute <= closeMinute)) {
      times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      minute += settings.slotInterval;
      if (minute >= 60) {
        hour += Math.floor(minute / 60);
        minute = minute % 60;
      }
    }
    return times;
  };

  // --- Dashboard & CRM Calculations ---
  const confirmedApps = appointments.filter(a => a.status === 'confirmed');
  
  const revenueToday = confirmedApps
    .filter(a => isToday(parseISO(a.date)))
    .reduce((sum, a) => sum + a.price, 0);
    
  const revenueWeek = confirmedApps
    .filter(a => isThisWeek(parseISO(a.date)))
    .reduce((sum, a) => sum + a.price, 0);
    
  const revenueMonth = confirmedApps
    .filter(a => isThisMonth(parseISO(a.date)))
    .reduce((sum, a) => sum + a.price, 0);

  const customersMap = appointments.reduce((acc: any, app: any) => {
    if (app.customerName.includes('BLOQUEADO')) return acc;
    if (!acc[app.customerPhone]) {
      acc[app.customerPhone] = { name: app.customerName, phone: app.customerPhone, totalSpent: 0, appointments: 0 };
    }
    if (app.status === 'confirmed') {
      acc[app.customerPhone].totalSpent += app.price;
    }
    acc[app.customerPhone].appointments += 1;
    return acc;
  }, {});
  
  const customersList = Object.values(customersMap).sort((a: any, b: any) => b.totalSpent - a.totalSpent);

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
      <header className="bg-black border-b border-zinc-800 py-4 px-6 flex justify-between items-center sticky top-0 z-10">
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

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('crm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'crm' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Clientes (CRM)
          </button>
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'appointments' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" /> Agendamentos
          </button>
          <button 
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'services' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Scissors className="w-4 h-4" /> Serviços
          </button>
          <button 
            onClick={() => setActiveTab('professionals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'professionals' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Briefcase className="w-4 h-4" /> Profissionais
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-gold-500 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <SettingsIcon className="w-4 h-4" /> Configurações
          </button>
        </div>

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white mb-6">Resumo Financeiro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <DollarSign className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-medium">Faturamento Hoje</span>
                </div>
                <p className="text-3xl font-serif text-white">R$ {revenueToday}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <DollarSign className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-medium">Faturamento Semana</span>
                </div>
                <p className="text-3xl font-serif text-white">R$ {revenueWeek}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <DollarSign className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-medium">Faturamento Mês</span>
                </div>
                <p className="text-3xl font-serif text-white">R$ {revenueMonth}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-gold-500" />
                  <span className="text-sm font-medium">Agendamentos Concluídos</span>
                </div>
                <p className="text-3xl font-serif text-white">{confirmedApps.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: CRM */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white mb-6">Gestão de Clientes (CRM)</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="text-xs text-zinc-500 bg-black border-b border-zinc-800 uppercase">
                    <tr>
                      <th className="px-6 py-4 font-medium">Nome do Cliente</th>
                      <th className="px-6 py-4 font-medium">WhatsApp</th>
                      <th className="px-6 py-4 font-medium">Agendamentos</th>
                      <th className="px-6 py-4 font-medium">Total Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Nenhum cliente registrado.</td>
                      </tr>
                    ) : (
                      customersList.map((customer: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{customer.name}</td>
                          <td className="px-6 py-4">{customer.phone}</td>
                          <td className="px-6 py-4">{customer.appointments}</td>
                          <td className="px-6 py-4 text-gold-400">R$ {customer.totalSpent}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Appointments */}
        {activeTab === 'appointments' && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-lg font-medium text-gold-400 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Bloquear Horário
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Feche um horário na agenda (ex: almoço, imprevistos).
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
                      {generateTimeOptions().map(t => (
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
                              {app.professionalName && <p>Profissional: {app.professionalName}</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {!isBlocked && app.status !== 'confirmed' && (
                            <button onClick={() => updateStatus(app.id, 'confirmed')} className="p-2 bg-green-900/20 text-green-400 hover:bg-green-900/40 rounded-lg transition-colors" title="Confirmar">
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          )}
                          {!isBlocked && app.status !== 'cancelled' && (
                            <button onClick={() => updateStatus(app.id, 'cancelled')} className="p-2 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 rounded-lg transition-colors" title="Cancelar">
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button onClick={() => deleteAppointment(app.id)} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors" title="Excluir">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Services */}
        {activeTab === 'services' && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-lg font-medium text-gold-400 mb-4 flex items-center gap-2">
                  {editingServiceId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
                </h2>
                <form onSubmit={handleSaveService} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Nome do Serviço</label>
                    <input type="text" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" required />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Descrição</label>
                    <textarea value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" rows={2} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Preço (R$)</label>
                      <input type="number" min="0" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: Number(e.target.value)})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" required />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Duração (min)</label>
                      <input type="number" min="15" step="15" value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: Number(e.target.value)})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" required />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="isTraditional" checked={serviceForm.isTraditional} onChange={e => setServiceForm({...serviceForm, isTraditional: e.target.checked})} className="accent-gold-500" />
                    <label htmlFor="isTraditional" className="text-xs text-zinc-400 cursor-pointer">Permite adicionar Esmaltação em Gel (+R$10)</label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded text-sm transition-colors">
                      {editingServiceId ? 'Salvar' : 'Adicionar'}
                    </button>
                    {editingServiceId && (
                      <button type="button" onClick={() => { setEditingServiceId(null); setServiceForm({ name: '', description: '', price: 0, duration: 60, isTraditional: false }); }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-white">Serviços Cadastrados</h2>
                {services.length === 0 && (
                  <button 
                    onClick={generateDefaultServices}
                    className="px-4 py-2 bg-gold-600/20 text-gold-400 hover:bg-gold-600/30 border border-gold-600/50 rounded-lg text-sm transition-colors"
                  >
                    Recuperar Serviços Padrão
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {services.length === 0 ? (
                  <p className="text-zinc-500">Nenhum serviço cadastrado. Adicione o primeiro!</p>
                ) : (
                  services.map((service) => (
                    <div key={service.id} className="p-5 rounded-xl border bg-zinc-900 border-zinc-700 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-white text-lg flex items-center gap-2">
                          {service.name}
                          {service.isTraditional && <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">Tradicional</span>}
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">{service.description}</p>
                        <div className="flex gap-3 mt-2 text-xs text-gold-500">
                          <span>R$ {service.price}</span>
                          <span>&bull;</span>
                          <span>{service.duration} min</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => editService(service)} className="p-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteService(service.id)} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Professionals */}
        {activeTab === 'professionals' && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                <h2 className="text-lg font-medium text-gold-400 mb-4 flex items-center gap-2">
                  {editingProfessionalId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingProfessionalId ? 'Editar Profissional' : 'Novo Profissional'}
                </h2>
                <form onSubmit={handleSaveProfessional} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Nome</label>
                    <input type="text" value={professionalForm.name} onChange={e => setProfessionalForm({...professionalForm, name: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" required />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Cargo / Especialidade</label>
                    <input type="text" value={professionalForm.role} onChange={e => setProfessionalForm({...professionalForm, role: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" placeholder="Ex: Manicure, Nail Designer" required />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="activeProf" checked={professionalForm.active} onChange={e => setProfessionalForm({...professionalForm, active: e.target.checked})} className="accent-gold-500" />
                    <label htmlFor="activeProf" className="text-xs text-zinc-400 cursor-pointer">Profissional Ativo (Aparece no agendamento)</label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded text-sm transition-colors">
                      {editingProfessionalId ? 'Salvar' : 'Adicionar'}
                    </button>
                    {editingProfessionalId && (
                      <button type="button" onClick={() => { setEditingProfessionalId(null); setProfessionalForm({ name: '', role: 'Manicure', active: true }); }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="md:col-span-2">
              <h2 className="text-xl font-medium text-white mb-6">Profissionais Cadastrados</h2>
              <div className="space-y-4">
                {professionals.length === 0 ? (
                  <p className="text-zinc-500">Nenhum profissional cadastrado.</p>
                ) : (
                  professionals.map((prof) => (
                    <div key={prof.id} className={`p-5 rounded-xl border ${prof.active ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-800 opacity-70'} flex justify-between items-center`}>
                      <div>
                        <h3 className="font-medium text-white text-lg flex items-center gap-2">
                          {prof.name}
                          {!prof.active && <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full border border-red-900/50">Inativo</span>}
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">{prof.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => editProfessional(prof)} className="p-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProfessional(prof.id)} className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
              <h2 className="text-lg font-medium text-gold-400 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horário de Funcionamento
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Configure os horários que aparecerão disponíveis para agendamento no site.
              </p>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Abre às</label>
                    <input type="time" value={settingsForm.openTime} onChange={e => setSettingsForm({...settingsForm, openTime: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" style={{ colorScheme: 'dark' }} required />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Fecha às</label>
                    <input type="time" value={settingsForm.closeTime} onChange={e => setSettingsForm({...settingsForm, closeTime: e.target.value})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" style={{ colorScheme: 'dark' }} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Intervalo entre agendamentos (minutos)</label>
                  <select value={settingsForm.slotInterval} onChange={e => setSettingsForm({...settingsForm, slotInterval: Number(e.target.value)})} className="w-full p-2 bg-black border border-zinc-800 rounded text-sm text-white" required>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1 hora e meia</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors">
                  Salvar Configurações
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
