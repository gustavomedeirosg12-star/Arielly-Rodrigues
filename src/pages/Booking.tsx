import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, User, CheckCircle2, AlertCircle, Sparkles, Settings, MapPin, Instagram, Info, Camera, MessageCircle, UserCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const WHATSAPP_NUMBER = '5534997204022';

export default function Booking() {
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ openTime: '09:00', closeTime: '18:00', slotInterval: 60 });
  const [loading, setLoading] = useState(true);

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [addGelPolish, setAddGelPolish] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);

  // Fetch Services and Settings
  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const fetchedServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(fetchedServices);
    });

    const unsubProfessionals = onSnapshot(collection(db, 'professionals'), (snapshot) => {
      const profs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProfessionals(profs.filter((p: any) => p.active !== false));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
      setLoading(false);
    });

    return () => {
      unsubServices();
      unsubProfessionals();
      unsubSettings();
    };
  }, []);

  const selectedServicesObjs = services.filter(s => selectedServices.includes(s.id));
  const hasTraditional = selectedServicesObjs.some(s => s.isTraditional);
  const basePrice = selectedServicesObjs.reduce((sum, s) => sum + (s.price || 0), 0);
  const finalPrice = basePrice + (hasTraditional && addGelPolish ? 10 : 0);

  useEffect(() => {
    if (!hasTraditional) {
      setAddGelPolish(false);
    }
  }, [hasTraditional]);

  // Generate Time Slots based on settings
  const generateTimeSlots = () => {
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

  const TIME_SLOTS = generateTimeSlots();

  const isTimeValid = (timeStr: string) => {
    const todayFormatted = new Date().toLocaleDateString('en-CA');
    if (selectedDate !== todayFormatted) return true; // Future date is fine
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);
    
    const minAdvanceMs = (settings.minAdvanceHours || 0) * 60 * 60 * 1000;
    return (slotDate.getTime() - new Date().getTime()) >= minAdvanceMs;
  };

  // Get today's date in YYYY-MM-DD format for the min attribute of the date picker
  const todayFormatted = format(new Date(), 'yyyy-MM-dd');

  // Fetch booked slots when date changes
  useEffect(() => {
    if (!selectedDate) {
      setBookedSlots([]);
      return;
    }

    const q = query(
      collection(db, 'appointments'),
      where('date', '==', selectedDate),
      where('status', 'in', ['pending', 'confirmed'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slots = snapshot.docs.map(doc => doc.data().time);
      setBookedSlots(slots);
      
      // If the currently selected time just got booked, clear it
      if (slots.includes(selectedTime)) {
        setSelectedTime('');
      }
    });

    return () => unsubscribe();
  }, [selectedDate, selectedTime]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value;
    if (!dateVal) {
      setSelectedDate('');
      return;
    }

    const dateObj = new Date(dateVal + 'T12:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, etc.

    if (settings.closedDays && settings.closedDays.includes(dayOfWeek)) {
      setError('O salão não abre neste dia da semana. Por favor, escolha outra data.');
      setSelectedDate('');
      return;
    }

    if (settings.blockedDates && settings.blockedDates.includes(dateVal)) {
      setError('Esta data não está disponível para agendamentos. Por favor, escolha outra.');
      setSelectedDate('');
      return;
    }

    setError('');
    setSelectedDate(dateVal);
  };

  const handleServiceSelect = (id: string) => {
    setSelectedServices(prev => {
      if (prev.includes(id)) {
        return prev.filter(sId => sId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (selectedServices.length === 0 || !selectedDate || !selectedTime || !name || !phone) {
      setError('Por favor, preencha todos os campos e escolha pelo menos um serviço.');
      return;
    }

    if (name.length < 2) {
      setError('Por favor, insira um nome válido.');
      return;
    }

    if (phone.length < 8) {
      setError('Por favor, insira um telefone válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      const prof = professionals.find(p => p.id === selectedProfessional);
      const serviceNames = selectedServicesObjs.map(s => s.name).join(', ');
      const serviceIds = selectedServicesObjs.map(s => s.id).join(',');
      const finalServiceName = serviceNames + (hasTraditional && addGelPolish ? ' (+ Esmaltação em Gel)' : '');
      
      const appointmentData: any = {
        customerName: name,
        customerPhone: phone,
        serviceId: serviceIds,
        serviceName: finalServiceName,
        price: finalPrice,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      if (prof) {
        appointmentData.professionalId = prof.id;
        appointmentData.professionalName = prof.name;
      }

      await addDoc(collection(db, 'appointments'), appointmentData);

      setSuccess(true);

      const formattedDate = format(new Date(selectedDate + 'T12:00:00'), "dd/MM/yyyy");
      const addOnText = (hasTraditional && addGelPolish) ? '\n*Adicional:* Esmaltação em Gel (+ R$ 10,00)' : '';
      const profText = prof ? `\n*Profissional:* ${prof.name}` : '';
      const message = `Olá! Gostaria de agendar um horário.\n\n*Serviços:* ${serviceNames}${addOnText}${profText}\n*Data:* ${formattedDate}\n*Horário:* ${selectedTime}\n*Nome:* ${name}\n*Telefone:* ${phone}\n*Valor Total:* R$ ${finalPrice},00`;
      
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      setSelectedServices([]);
      setSelectedProfessional('');
      setAddGelPolish(false);
      setSelectedDate('');
      setSelectedTime('');
      setName('');
      setPhone('');
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error booking appointment:', err);
      setError('Ocorreu um erro ao agendar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-gold-500 flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-gold-500/30">
      <header className="bg-zinc-950 py-12 px-4 text-center border-b border-gold-900/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold-900/20 via-black to-black"></div>
        <div className="relative z-10">
          <button 
            onClick={() => setShowRoleModal(true)} 
            className="absolute top-0 right-4 text-zinc-500 hover:text-gold-500 transition-colors" 
            title="Configurações de Acesso"
          >
            <Settings className="w-6 h-6" />
          </button>
          <h1 className="text-4xl md:text-5xl font-serif text-gold-500 tracking-widest uppercase">
            Arielly Rodrigues
          </h1>
          <p className="text-sm md:text-base tracking-[0.4em] text-zinc-400 mt-3 uppercase font-light">
            Esmalteria
          </p>
        </div>
      </header>

      {/* Galeria de Fotos */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-serif text-gold-500 mb-3 flex items-center justify-center gap-3">
            <Camera className="w-6 h-6" />
            Nosso Trabalho
          </h2>
          <p className="text-zinc-400">Um pouco da nossa arte em unhas para você se inspirar.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/PzzFPshN/1231.png" alt="Trabalho de Manicure 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/3yMLQGDF/454.png" alt="Trabalho de Manicure 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/ycJSD64T/Capturar1213212.png" alt="Trabalho de Manicure 3" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/Q7w4Z6y1/Whats-App-Image-2026-04-06-at-22-16-30-1.jpg" alt="Trabalho de Manicure 4" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/Nd48tW2h/Whats-App-Image-2026-04-06-at-22-16-30.jpg" alt="Trabalho de Manicure 5" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/ZRNdNQNZ/Whats-App-Image-2026-04-06-at-22-16-29-2.jpg" alt="Trabalho de Manicure 6" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/Ldp4JkjH/Whats-App-Image-2026-04-06-at-22-16-29-1.jpg" alt="Trabalho de Manicure 7" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-800 group">
            <img src="https://i.ibb.co/FSZ0wKN/Whats-App-Image-2026-04-06-at-22-16-29.jpg" alt="Trabalho de Manicure 8" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-12 grid lg:grid-cols-12 gap-12 border-t border-zinc-900">
        <section className="lg:col-span-7">
          <div className="mb-8">
            <h2 className="text-2xl font-serif text-gold-500 mb-2 flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Nossos Serviços
            </h2>
            <p className="text-zinc-400">Escolha o serviço ideal para realçar sua beleza.</p>
          </div>

          <div className="space-y-4">
            {services.length === 0 ? (
               <p className="text-zinc-500">Nenhum serviço disponível no momento.</p>
            ) : (
              services.map((service) => (
                <div 
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer ${
                    selectedServices.includes(service.id) 
                      ? 'border-gold-500 bg-zinc-900/80 shadow-[0_0_20px_rgba(212,175,55,0.1)]' 
                      : 'border-zinc-800 bg-zinc-950 hover:border-gold-900 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className={`font-medium text-lg ${selectedServices.includes(service.id) ? 'text-gold-400' : 'text-zinc-200'}`}>
                        {service.name}
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1">{service.description}</p>
                    </div>
                    <span className="font-semibold text-gold-400 bg-gold-900/20 px-4 py-1.5 rounded-full text-sm border border-gold-900/30 whitespace-nowrap">
                      R$ {service.price}
                    </span>
                  </div>
                </div>
              ))
            )}

            {hasTraditional && (
              <div 
                onClick={() => setAddGelPolish(!addGelPolish)}
                className="mt-6 p-4 rounded-xl border border-gold-900/50 bg-gold-900/10 flex items-center justify-between cursor-pointer hover:bg-gold-900/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${addGelPolish ? 'bg-gold-500 text-black' : 'border-2 border-zinc-600'}`}>
                    {addGelPolish && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">Adicionar Esmaltação em Gel</p>
                    <p className="text-sm text-zinc-400">Maior durabilidade e brilho</p>
                  </div>
                </div>
                <span className="font-semibold text-gold-400">+ R$ 10</span>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="bg-zinc-950 p-6 md:p-8 rounded-2xl border border-zinc-800 sticky top-8">
            <h2 className="text-2xl font-serif text-gold-500 mb-6">Agende seu Horário</h2>
            
            {success && (
              <div className="mb-6 p-4 bg-green-950/50 text-green-400 rounded-lg flex items-start gap-3 border border-green-900/50">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">Agendamento iniciado! Você será redirecionada para o WhatsApp.</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-950/50 text-red-400 rounded-lg flex items-start gap-3 border border-red-900/50">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-6">
              
              {/* Profissional Selection */}
              {professionals.length > 0 && (
                <div className="pt-6 border-t border-zinc-800">
                  <label className="block text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-gold-500" />
                    Profissional (Opcional)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setSelectedProfessional('')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                        selectedProfessional === ''
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Qualquer Profissional</p>
                        <p className="text-xs text-zinc-500">O primeiro disponível</p>
                      </div>
                    </div>
                    {professionals.map((prof) => (
                      <div
                        key={prof.id}
                        onClick={() => setSelectedProfessional(prof.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                          selectedProfessional === prof.id
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-gold-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{prof.name}</p>
                          <p className="text-xs text-zinc-500">{prof.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-zinc-800">
                <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold-500" />
                  Data
                </label>
                <input 
                  type="date"
                  min={todayFormatted}
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-full p-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 focus:bg-zinc-950 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all color-scheme-dark"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gold-500" />
                    Horário
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TIME_SLOTS.map(time => {
                      const isBooked = bookedSlots.includes(time);
                      const isValid = isTimeValid(time);
                      const disabled = isBooked || !isValid;
                      
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2 text-sm rounded-lg border transition-all ${
                            disabled 
                              ? 'bg-zinc-900 text-zinc-600 border-zinc-800 opacity-50 cursor-not-allowed line-through'
                              : selectedTime === time
                                ? 'bg-gold-500 text-black border-gold-500 font-medium shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-gold-500 hover:text-gold-400'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                  {bookedSlots.length === TIME_SLOTS.length && TIME_SLOTS.length > 0 && (
                    <p className="text-red-400 text-sm mt-2">Todos os horários esgotados para este dia.</p>
                  )}
                  {TIME_SLOTS.length === 0 && (
                    <p className="text-red-400 text-sm mt-2">Nenhum horário configurado.</p>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-gold-500" />
                    Seu Nome
                  </label>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como gostaria de ser chamada?"
                    className="w-full p-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 focus:bg-zinc-950 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gold-500" />
                    WhatsApp
                  </label>
                  <input 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full p-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 focus:bg-zinc-950 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-lg">
                <span className="text-zinc-400">Total:</span>
                <span className="font-serif text-2xl text-gold-400">R$ {finalPrice},00</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedDate || !selectedTime || selectedServices.length === 0}
                className="w-full py-4 bg-gradient-to-r from-gold-600 to-gold-400 hover:from-gold-500 hover:to-gold-300 text-black font-semibold rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Processando...' : 'Confirmar Agendamento'}
              </button>
              <p className="text-xs text-center text-zinc-500 mt-4">
                Ao confirmar, você será redirecionada para o WhatsApp.
              </p>
            </form>
          </div>
        </section>
      </main>

      {/* Políticas e Rodapé */}
      <footer className="bg-zinc-950 border-t border-zinc-900 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-3 md:grid-cols-2 gap-8 mb-12">
          
          {/* Políticas */}
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 h-fit">
            <h3 className="text-xl font-serif text-gold-500 mb-6 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Políticas do Salão
            </h3>
            <ul className="space-y-4 text-zinc-300 text-sm">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0"></div>
                <p><strong className="text-zinc-100">Tolerância de Atraso:</strong> Pedimos a gentileza de respeitar o horário agendado. Temos uma tolerância máxima de 15 minutos de atraso.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0"></div>
                <p><strong className="text-zinc-100">Cancelamentos:</strong> Imprevistos acontecem! Caso precise cancelar ou reagendar, por favor, nos avise com pelo menos 24 horas de antecedência.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0"></div>
                <p><strong className="text-zinc-100">Como Cancelar:</strong> O cancelamento deve ser feito diretamente pelo nosso WhatsApp.</p>
              </li>
            </ul>
          </div>

          {/* Contato e Localização */}
          <div className="space-y-6">
            <h3 className="text-xl font-serif text-gold-500 mb-6">Contato & Localização</h3>
            
            <div className="space-y-4 text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800 text-gold-500">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Endereço</p>
                  <p className="text-sm mb-1">Rua Iguaçu, Nº 138<br/>Marta Helena - CEP: 38402-047</p>
                  <a 
                    href="https://maps.google.com/?q=Rua+Iguaçu,+138,+Marta+Helena,+Uberlândia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gold-500 hover:text-gold-400 text-xs font-medium transition-colors"
                  >
                    <MapPin className="w-3 h-3" />
                    Como Chegar (Google Maps)
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800 text-gold-500">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Horário de Funcionamento</p>
                  <p className="text-sm">Terça a Sábado</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800 text-gold-500">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">WhatsApp</p>
                  <p className="text-sm">(34) 99720-4022</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a 
                href="https://www.instagram.com/ariellyrodrigues_esmalteria/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg"
              >
                <Instagram className="w-5 h-5" />
                Siga no Instagram
              </a>
            </div>
          </div>

          {/* Mapa Interativo */}
          <div className="h-[300px] lg:h-full min-h-[300px] rounded-2xl overflow-hidden border border-zinc-800/50 relative group">
            <div className="absolute inset-0 bg-gold-500/10 pointer-events-none group-hover:bg-transparent transition-colors z-10"></div>
            <iframe 
              src="https://maps.google.com/maps?q=Rua%20Igua%C3%A7u,%20138,%20Marta%20Helena,%20Uberl%C3%A2ndia&t=&z=15&ie=UTF8&iwloc=&output=embed" 
              className="w-full h-full border-0 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" 
              allowFullScreen 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de Localização"
            ></iframe>
          </div>
        </div>
        
        <div className="text-center text-zinc-600 text-xs border-t border-zinc-900 pt-8">
          &copy; {new Date().getFullYear()} Arielly Rodrigues Esmalteria. Todos os direitos reservados.
        </div>
      </footer>

      {showRoleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full relative">
            <button 
              onClick={() => setShowRoleModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <AlertCircle className="w-5 h-5 opacity-0" /> {/* Spacer */}
              <span className="absolute inset-0 flex items-center justify-center text-xl">&times;</span>
            </button>
            
            <h2 className="text-2xl font-serif text-gold-500 mb-2 text-center">Acesso ao Sistema</h2>
            <p className="text-zinc-400 text-sm text-center mb-6">Selecione como deseja acessar a plataforma.</p>
            
            <div className="space-y-3">
              <button 
                onClick={() => setShowRoleModal(false)}
                className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-white transition-colors flex items-center justify-center gap-2"
              >
                <User className="w-5 h-5 text-zinc-400" />
                Sou Cliente
              </button>
              
              <Link 
                to="/admin"
                className="w-full py-3 px-4 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Sou Administrador
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante de Dúvidas (WhatsApp) */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Tenho uma dúvida sobre os serviços da esmalteria.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:scale-110 transition-all flex items-center justify-center group"
        title="Dúvidas? Fale conosco"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="absolute right-full mr-4 bg-zinc-900 text-zinc-100 text-sm px-4 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-zinc-800 shadow-xl font-medium">
          Ficou com dúvida?
        </span>
      </a>
    </div>
  );
}
