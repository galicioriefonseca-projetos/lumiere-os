import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Salon, Professional, Service, Appointment } from '@/types';
import { getAvailableSlots, getAvailableDays } from '@/lib/availability';
import { 
  Calendar, 
  Clock, 
  User as UserIcon, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Phone, 
  Mail, 
  FileText, 
  ArrowLeft,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Help helper for UUIDs/nanoids for public creations
function generateSimpleId() {
  return 'bkg_' + Math.random().toString(36).substr(2, 9);
}

export default function BookingPage() {
  const { salonSlug } = useParams<{ salonSlug: string }>();
  const navigate = useNavigate();

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonId, setSalonId] = useState<string>('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard state (1 to 5, plus 6 for success)
  const [step, setStep] = useState(1);

  // Selected state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null | 'any'>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>(''); // HH:mm

  // Client info state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Service search query
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-calculated fields during check-out
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successAppointment, setSuccessAppointment] = useState<Appointment | null>(null);

  // Local calendar helper state
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12

  // Format helper for currency (BRL)
  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // 1. Fetch Salon, Professionals, and Services based on slug (and bookingEnabled)
  useEffect(() => {
    async function loadPublicData() {
      if (!salonSlug) {
        setErrorMsg('Salão não especificado.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Query salon by slug and secure check for bookingEnabled
        const salonsRef = collection(db, 'salons');
        const qSalon = query(salonsRef, where('slug', '==', salonSlug.toLowerCase()), limit(1));
        const salonSnap = await getDocs(qSalon);

        if (salonSnap.empty) {
          setErrorMsg('O salão solicitado não foi encontrado ou não está disponível para agendamento online.');
          setLoading(false);
          return;
        }

        const salonDoc = salonSnap.docs[0];
        const sData = { id: salonDoc.id, ...salonDoc.data() } as Salon;

        if (!sData.bookingEnabled) {
          setErrorMsg('O agendamento online para este salão está desabilitado no momento.');
          setSalon(sData);
          setLoading(false);
          return;
        }

        setSalon(sData);
        setSalonId(salonDoc.id);

        // Fetch Professionals & Services (public allowed due to rules rule)
        const prosRef = collection(db, 'salons', salonDoc.id, 'professionals');
        const prosSnap = await getDocs(query(prosRef, where('isActive', '==', true)));
        const loadedPros = prosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professional));
        setProfessionals(loadedPros);

        const servsRef = collection(db, 'salons', salonDoc.id, 'services');
        const servsSnap = await getDocs(query(servsRef, where('isActive', '==', true)));
        const loadedServs = servsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
        setServices(loadedServs);

        // Fetch active appointments to check slots for availability in next 45 days
        const apptsRef = collection(db, 'salons', salonDoc.id, 'appointments');
        const todayStr = new Date().toISOString().split('T')[0];
        const apptsSnap = await getDocs(query(apptsRef, where('date', '>=', todayStr)));
        const loadedAppts = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
        setAppointments(loadedAppts);

        setLoading(false);
      } catch (err: any) {
        console.error('Erro ao recolher dados públicos do salão:', err);
        setErrorMsg('Ocorreu um erro ao buscar as informações do estabelecimento. Por favor, tente novamente mais tarde.');
        setLoading(false);
      }
    }

    loadPublicData();
  }, [salonSlug]);

  // Filter and group services by category
  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group services
  const groupedServices: { [category: string]: Service[] } = {};
  filteredServices.forEach(s => {
    const cat = s.category || 'Outros';
    if (!groupedServices[cat]) {
      groupedServices[cat] = [];
    }
    groupedServices[cat].push(s);
  });

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // Helper handling professional selection inside step 3
  const handleSelectProfessional = (prof: Professional | 'any') => {
    setSelectedProfessional(prof);
    setSelectedDate('');
    setSelectedTime('');
    nextStep();
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setSelectedProfessional(null);
    setSelectedDate('');
    setSelectedTime('');
    nextStep();
  };

  // Compute availability slots for the custom calendar active day
  const getSlotsForDate = (dateStr: string) => {
    if (!salon || !salon.workingHours || !selectedService) return [];

    const duration = selectedService.durationMinutes;

    if (selectedProfessional === 'any' || !selectedProfessional) {
      // "Sem preferência" - Union of slots available for ANY professional, tagged keys
      const allSlots: { time: string; professional: Professional }[] = [];
      professionals.forEach(p => {
        const slots = getAvailableSlots(dateStr, p.id, duration, salon.workingHours!, appointments);
        slots.forEach(t => {
          // If multiple professionals have this slot, we can accumulate
          allSlots.push({ time: t, professional: p });
        });
      });

      // Filter uniques by time string
      const uniqueTimes = Array.from(new Set(allSlots.map(s => s.time))).sort();
      return uniqueTimes;
    } else {
      // Specific professional
      return getAvailableSlots(dateStr, selectedProfessional.id, duration, salon.workingHours!, appointments);
    }
  };

  // Find dynamic professional assignment for "Sem preferência" slot
  const assignProfessionalForTime = (timeStr: string, dateStr: string) => {
    if (!selectedService || !salon || !salon.workingHours) return null;
    if (selectedProfessional && selectedProfessional !== 'any') {
      return selectedProfessional;
    }

    // Loop through professionals to find the first one with this slot available
    for (const p of professionals) {
      const slots = getAvailableSlots(dateStr, p.id, selectedService.durationMinutes, salon.workingHours, appointments);
      if (slots.includes(timeStr)) {
        return p;
      }
    }
    return professionals[0] || null;
  };

  // Calendar render elements helpers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDate('');
    setSelectedTime('');
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDate('');
    setSelectedTime('');
  };

  const daysInMonthList = () => {
    const days: Date[] = [];
    const totalDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(currentYear, currentMonth - 1, i));
    }
    return days;
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handleConfirmAppointment = async () => {
    setSubmitError(null);
    if (!salon || !selectedService || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim()) {
      const msg = 'Por favor, preencha seu nome completo e telefone para confirmar.';
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    try {
      setSavingAppointment(true);

      // Resolve professional (especially for Sem preferência)
      let finalProf = selectedProfessional === 'any' || !selectedProfessional
        ? assignProfessionalForTime(selectedTime, selectedDate)
        : selectedProfessional;

      if (!finalProf) {
        // Fallback safety to help avoid empty professionalId
        finalProf = professionals[0] || { 
          id: 'generic_prof', 
          name: 'Atendente Lumière', 
          role: 'attendant', 
          phone: '', 
          isActive: true, 
          createdAt: 0, 
          updatedAt: 0 
        };
      }

      const apptId = generateSimpleId();
      const appRef = doc(db, 'salons', salonId, 'appointments', apptId);

      const apptData: Appointment = {
        id: apptId,
        clientId: 'client_guest_' + generateSimpleId().substring(4),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        professionalId: finalProf.id,
        professionalName: finalProf.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        serviceDuration: selectedService.durationMinutes,
        price: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        status: 'scheduled',
        source: 'client_booking',
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(appRef, apptData);

      setSuccessAppointment(apptData);
      toast.success('Agendamento confirmado com sucesso!');
      setStep(6); // Success screen
    } catch (err: any) {
      console.error('Erro ao agendar compromisso:', err);
      const msg = 'Não foi possível realizar seu agendamento. Verifique sua conexão e tente novamente.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSavingAppointment(false);
    }
  };

  // Render Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] text-[#171717] flex flex-col justify-center items-center p-6 font-sans select-none" id="booking_page_loading">
        <div className="w-11 h-11 border-4 border-[#E5E2DC] border-t-[#171717] rounded-full animate-spin"></div>
        <p className="mt-4 text-[#6B6B6B] font-medium text-sm">Carregando portal de agendamentos...</p>
      </div>
    );
  }

  // Render Booking Error (e.g., Disabled, Not found, Server Issues)
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] text-[#171717] flex flex-col justify-center items-center p-6 font-sans text-center max-w-sm mx-auto" id="booking_page_error">
        <CalendarDays className="w-14 h-14 text-[#8A6D36] mb-4 stroke-[1.5]" />
        <h1 className="text-xl font-bold tracking-tight text-[#171717] mb-2">Agendamento Online</h1>
        {salon && (
          <p className="text-base text-emerald-700 font-semibold mb-3">{salon.name}</p>
        )}
        <div className="p-4 bg-white border border-[#E5E2DC] rounded-2xl mb-6 shadow-xs">
          <p className="text-[#6B6B6B] text-sm leading-relaxed">{errorMsg}</p>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="px-6 py-3 bg-[#171717] text-white hover:bg-[#2B2B2B] rounded-xl transition font-semibold text-sm flex items-center gap-2 cursor-pointer"
          id="btn_back_home"
        >
          <ArrowLeft className="w-4 h-4" />
          Ir para LumièreOS
        </button>
      </div>
    );
  }

  const progressPct = ((step - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] font-sans select-none" id="booking_page_container">
      {/* Wizard Centered Card */}
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-between py-6 px-4" id="booking_page_card">
        
        {/* Progress header & Back actions (steps 2 to 5) */}
        {step > 1 && step < 6 && (
          <div className="flex items-center gap-3.5 mb-5" id="booking_header">
            <button 
              type="button"
              onClick={prevStep} 
              className="p-2.5 bg-white border border-[#E5E2DC] hover:bg-[#FAF9F7] active:scale-95 rounded-xl transition text-[#171717] shadow-xs cursor-pointer"
              id="booking_back_btn"
              title="Voltar"
              aria-label="Voltar passo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex justify-between items-center text-xs text-[#6B6B6B] font-medium mb-1.5">
                <span>Passo {step - 1} de 4</span>
                <span className="tabular-nums">{Math.round(progressPct)}% concluído</span>
              </div>
              <div className="w-full bg-[#E5E2DC] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#171717] h-full rounded-full transition-all duration-300" 
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Step Canvas */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: WELCOME SCREEN */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center py-4"
                id="booking_step_1"
              >
                {/* Salon Initials Avatar Logo */}
                <div className="w-20 h-20 bg-white border border-[#B89B5E]/40 text-[#8A6D36] flex items-center justify-center rounded-3xl mx-auto mb-6 text-2xl font-extrabold tracking-tight shadow-sm" id="salon_welcome_logo">
                  {salon?.name ? salon.name.substring(0, 2).toUpperCase() : 'LM'}
                </div>

                <p className="text-[11px] font-bold tracking-widest text-[#8A6D36] uppercase mb-1.5">
                  {salon?.businessType === 'barbershop' ? 'Barbearia' : salon?.businessType === 'clinic' ? 'Clínica de Estética' : 'Salão de Beleza'}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#171717] mb-2 leading-tight">{salon?.name}</h1>
                {(salon?.city || salon?.state) && (
                  <p className="text-[#6B6B6B] text-xs mb-7">{[salon?.city, salon?.state].filter(Boolean).join(' • ')}</p>
                )}

                <div className="p-5 bg-white border border-[#E5E2DC] rounded-2xl mb-8 text-left leading-relaxed shadow-xs">
                  <p className="text-sm text-[#171717]/90">
                    {salon?.bookingMessage || 'Seja muito bem-vindo ao nosso agendamento online! Escolha o seu serviço e reserve o seu horário em menos de um minuto de forma fácil e automatizada.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <button 
                    type="button"
                    onClick={nextStep} 
                    className="w-full py-3.5 bg-[#171717] hover:bg-[#2B2B2B] active:scale-[0.99] text-white font-semibold rounded-2xl shadow-md transition duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
                    id="btn_start_booking"
                  >
                    <Calendar className="w-4 h-4 text-[#D8C79F]" />
                    Agendar Horário
                  </button>
                  <p className="text-[10px] text-[#6B6B6B]">LumièreOS • Agendamento Online Oficial</p>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CHOOSE SERVICE */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-2 flex-1 flex flex-col justify-start"
                id="booking_step_2"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-[#171717] mb-1">Escolha o serviço</h2>
                  <p className="text-xs text-[#6B6B6B]">Selecione o procedimento que deseja realizar.</p>
                </div>

                {/* Search query */}
                <div className="relative mb-5">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                  <input 
                    type="text" 
                    placeholder="Buscar serviço..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-[#E5E2DC] focus:border-[#B89B5E] pl-10 pr-4 py-3 rounded-xl font-medium text-sm focus:outline-none placeholder-[#8B8881] text-[#171717] transition"
                    id="service_search_input"
                  />
                </div>

                {/* Services List grouped by Category */}
                <div className="flex-1 overflow-y-auto pr-1 max-h-[60vh] space-y-5" id="services_catalog_list">
                  {Object.keys(groupedServices).length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-[#E5E2DC]">
                      <p className="text-[#6B6B6B] text-sm">Nenhum serviço disponível com o filtro atual.</p>
                    </div>
                  ) : (
                    Object.keys(groupedServices).map(category => (
                      <div key={category} className="space-y-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1.5 px-1">
                          <span className="w-1.5 h-1.5 bg-[#B89B5E] rounded-full"></span>
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {groupedServices[category].map(service => {
                            const isSelected = selectedService?.id === service.id;
                            return (
                              <button
                                type="button"
                                key={service.id}
                                onClick={() => handleSelectService(service)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex justify-between items-center gap-3 group cursor-pointer ${
                                  isSelected 
                                    ? 'bg-[#F5F1E9] border-[#B89B5E] ring-1 ring-[#B89B5E]'
                                    : 'bg-white border-[#E5E2DC] hover:border-[#B89B5E]/60 hover:bg-[#FAF9F7]'
                                }`}
                                id={`service_item_${service.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-[#171717]">{service.name}</h4>
                                  {service.description && (
                                    <p className="text-xs text-[#6B6B6B] mt-1 line-clamp-2 leading-relaxed">{service.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 text-[11px] text-[#6B6B6B]">
                                    <span className="flex items-center gap-1 tabular-nums"><Clock className="w-3 h-3 text-[#8A6D36]" /> {service.durationMinutes} min</span>
                                    <span>•</span>
                                    <span>Preço Fixo</span>
                                  </div>
                                </div>
                                <div className="text-right flex flex-col justify-center items-end shrink-0">
                                  <span className="font-extrabold text-sm text-[#171717] tabular-nums">{formatBRL(service.price)}</span>
                                  {isSelected && (
                                    <span className="text-[10px] bg-[#171717] text-white font-semibold rounded-full px-2 py-0.5 mt-1.5 flex items-center gap-1">
                                      <CheckCircle className="w-2.5 h-2.5" /> Selecionado
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: CHOOSE PROFESSIONAL */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-2"
                id="booking_step_3"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-[#171717] mb-1">Qual é o profissional?</h2>
                  <p className="text-xs text-[#6B6B6B]">Escolha o membro da equipe para o atendimento.</p>
                </div>

                <div className="space-y-3 max-h-[64vh] overflow-y-auto pr-1" id="professionals_list">
                  {/* Option 1: No Preference */}
                  <button
                    type="button"
                    onClick={() => handleSelectProfessional('any')}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 group cursor-pointer ${
                      selectedProfessional === 'any'
                        ? 'bg-[#F5F1E9] border-[#B89B5E] ring-1 ring-[#B89B5E]'
                        : 'bg-white border-[#E5E2DC] hover:border-[#B89B5E]/60 hover:bg-[#FAF9F7]'
                    }`}
                    id="professional_item_any"
                  >
                    <div className="w-12 h-12 bg-[#F5F1E9] text-[#8A6D36] rounded-2xl flex items-center justify-center border border-[#B89B5E]/30 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#171717] flex flex-wrap items-center gap-1.5">
                        Qualquer Profissional
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Recomendado</span>
                      </h4>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">Atribuiremos o horário livre mais rápido disponível.</p>
                    </div>
                  </button>

                  <div className="text-[11px] font-bold text-[#6B6B6B] uppercase pt-2 px-1 tracking-wider">Membros da Equipe</div>

                  {professionals.length === 0 ? (
                    <p className="text-[#6B6B6B] text-sm px-1">Nenhum profissional cadastrado.</p>
                  ) : (
                    professionals.map(p => {
                      const isSelected = selectedProfessional && (selectedProfessional as Professional).id === p.id;
                      const avatarLetters = p.name.substring(0, 2).toUpperCase();

                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => handleSelectProfessional(p)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 group cursor-pointer ${
                            isSelected
                              ? 'bg-[#F5F1E9] border-[#B89B5E] ring-1 ring-[#B89B5E]'
                              : 'bg-white border-[#E5E2DC] hover:border-[#B89B5E]/60 hover:bg-[#FAF9F7]'
                          }`}
                          id={`professional_item_${p.id}`}
                        >
                          {p.photoURL || p.avatarUrl ? (
                            <img 
                              src={p.photoURL || p.avatarUrl} 
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-2xl object-cover border border-[#B89B5E]/40 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] text-[#8A6D36] text-sm font-extrabold flex items-center justify-center shrink-0">
                              {avatarLetters}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-[#171717] truncate">{p.name}</h4>
                            <p className="text-xs text-[#6B6B6B] mt-0.5 truncate">{p.professionalFunction || p.role || 'Especialista'}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: CHOOSE DATE & TIME */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-2"
                id="booking_step_4"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-[#171717] mb-1">Data e Horário</h2>
                  <p className="text-xs text-[#6B6B6B]">Selecione o momento ideal para o seu atendimento.</p>
                </div>

                {/* Date Navigator & Picker */}
                <div className="p-4 bg-white border border-[#E5E2DC] rounded-2xl mb-5 shadow-xs" id="calendar_box">
                  <div className="flex justify-between items-center mb-4">
                    <button 
                      type="button"
                      onClick={handlePrevMonth} 
                      className="p-2 hover:bg-[#FAF9F7] active:scale-95 rounded-lg transition text-[#6B6B6B] hover:text-[#171717] cursor-pointer"
                      title="Mês Anterior"
                      aria-label="Mês Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-bold tracking-tight uppercase text-[#171717]">
                      {monthNames[currentMonth - 1]} {currentYear}
                    </h3>
                    <button 
                      type="button"
                      onClick={handleNextMonth} 
                      className="p-2 hover:bg-[#FAF9F7] active:scale-95 rounded-lg transition text-[#6B6B6B] hover:text-[#171717] cursor-pointer"
                      title="Próximo Mês"
                      aria-label="Próximo Mês"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar list grid of days */}
                  <div className="grid grid-cols-7 gap-1.5 text-center mb-2 text-[10px] font-bold text-[#6B6B6B] uppercase">
                    <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: new Date(currentYear, currentMonth - 1, 1).getDay() }).map((_, idx) => (
                      <div key={`empty-${idx}`} />
                    ))}

                    {daysInMonthList().map((rawDate, idx) => {
                      const yr = rawDate.getFullYear();
                      const mn = String(rawDate.getMonth() + 1).padStart(2, '0');
                      const dy = String(rawDate.getDate()).padStart(2, '0');
                      const dayStr = `${yr}-${mn}-${dy}`;

                      const rawToday = new Date();
                      rawToday.setHours(0,0,0,0);
                      const isPast = rawDate.getTime() < rawToday.getTime();

                      const slotsAvailable = isPast ? [] : getSlotsForDate(dayStr);
                      const hasAvailableSlots = slotsAvailable.length > 0;
                      const isSelected = selectedDate === dayStr;

                      return (
                        <button
                          type="button"
                          key={`day-${idx}`}
                          disabled={isPast || !hasAvailableSlots}
                          onClick={() => {
                            setSelectedDate(dayStr);
                            setSelectedTime('');
                          }}
                          className={`aspect-square min-h-[40px] max-h-11 text-xs rounded-xl flex flex-col justify-center items-center font-bold relative transition tabular-nums ${
                            isPast || !hasAvailableSlots
                              ? 'text-[#B5B0A6] bg-transparent cursor-not-allowed font-medium'
                              : isSelected
                                ? 'bg-[#171717] text-white font-extrabold shadow-sm cursor-pointer'
                                : 'bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] border border-[#E5E2DC] cursor-pointer'
                          }`}
                        >
                          <span>{rawDate.getDate()}</span>
                          {!isPast && hasAvailableSlots && !isSelected && (
                            <span className="w-1 h-1 bg-[#B89B5E] rounded-full mt-0.5"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Selection Grid */}
                {selectedDate ? (
                  <div className="space-y-3" id="time_grid_section">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B] px-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8A6D36]" />
                      Horários em {selectedDate.split('-').reverse().join('/')}
                    </h3>

                    {getSlotsForDate(selectedDate).length === 0 ? (
                      <p className="text-[#6B6B6B] text-xs px-1">Infelizmente todos os horários estão agendados para este dia.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[26vh] overflow-y-auto pr-1">
                        {getSlotsForDate(selectedDate).map(t => {
                          const isSelectedT = selectedTime === t;
                          return (
                            <button
                              type="button"
                              key={t}
                              onClick={() => {
                                setSelectedTime(t);
                                nextStep();
                              }}
                              className={`min-h-[42px] py-2 rounded-xl transition text-xs font-bold tabular-nums cursor-pointer ${
                                isSelectedT
                                  ? 'bg-[#171717] text-white shadow-sm'
                                  : 'bg-white hover:bg-[#F5F1E9] text-[#171717] border border-[#E5E2DC] hover:border-[#B89B5E]'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 p-4 bg-white/70 border border-[#E5E2DC] border-dashed rounded-2xl text-[#6B6B6B] font-medium text-xs">
                    Escolha uma data disponível acima no calendário para carregar os horários.
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 5: PERSON DATA + RESUME AND SUBMIT */}
            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-1"
                id="booking_step_5"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-[#171717] mb-1">Seus Dados & Confirmação</h2>
                  <p className="text-xs text-[#6B6B6B]">Última etapa! Informe seus dados para finalizar.</p>
                </div>

                {/* Resume Card summary */}
                <div className="p-4 bg-white border border-[#E5E2DC] rounded-2xl mb-5 space-y-3 shadow-xs" id="booking_resume_card">
                  <div className="text-[10px] uppercase tracking-wider text-[#8A6D36] font-bold">Resumo da Reserva</div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-bold text-sm text-[#171717]">{selectedService?.name}</span>
                      <span className="font-bold text-sm text-[#171717] tabular-nums shrink-0">{formatBRL(selectedService?.price || 0)}</span>
                    </div>
                    <div className="text-xs text-[#6B6B6B] flex items-center gap-1.5 leading-none">
                      <Clock className="w-3.5 h-3.5 text-[#8A6D36]" /> Duração: {selectedService?.durationMinutes} min • Preço Fixo
                    </div>
                  </div>

                  <div className="h-[1px] bg-[#E5E2DC] my-1"></div>

                  <div className="grid grid-cols-2 gap-3 pb-1 text-xs">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Profissional</span>
                      <p className="font-bold text-[#171717] flex items-center gap-1 truncate">
                        <UserIcon className="w-3.5 h-3.5 text-[#8A6D36] shrink-0" />
                        <span className="truncate">{selectedProfessional === 'any' ? 'Automático' : selectedProfessional?.name}</span>
                      </p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Horário Marcado</span>
                      <p className="font-bold text-[#171717] flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#8A6D36] shrink-0" />
                        {selectedDate.split('-').reverse().join('/')} às {selectedTime}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Field Entries */}
                <form onSubmit={e => e.preventDefault()} className="space-y-3" id="guests_booking_form">
                  <div className="space-y-1">
                    <label className="text-xs text-[#171717] font-medium">Seu Nome Completo <span className="text-rose-600">*</span></label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Maria da Silva" 
                      value={clientName}
                      onChange={e => {
                        setClientName(e.target.value);
                        if (submitError) setSubmitError(null);
                      }}
                      className="w-full bg-white border border-[#E5E2DC] focus:border-[#B89B5E] p-3 rounded-xl text-sm focus:outline-none placeholder-[#8B8881] text-[#171717] font-medium"
                      id="input_client_name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#171717] font-medium">WhatsApp / Telefone <span className="text-rose-600">*</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input 
                        required
                        type="tel" 
                        placeholder="Ex: (11) 99999-9999" 
                        value={clientPhone}
                        onChange={e => {
                          setClientPhone(e.target.value);
                          if (submitError) setSubmitError(null);
                        }}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#B89B5E] pl-10 pr-4 p-3 rounded-xl text-sm focus:outline-none placeholder-[#8B8881] text-[#171717] tabular-nums"
                        id="input_client_phone"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#171717] font-medium">E-mail <span className="text-[#6B6B6B]">(Opcional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input 
                        type="email" 
                        placeholder="Ex: cliente@email.com" 
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#B89B5E] pl-10 pr-4 p-3 rounded-xl text-sm focus:outline-none placeholder-[#8B8881] text-[#171717] font-medium"
                        id="input_client_email"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#171717] font-medium">Observações especiais <span className="text-[#6B6B6B]">(Opcional)</span></label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-[#6B6B6B]" />
                      <textarea 
                        rows={2}
                        placeholder="Ex: Alergia a algum tipo de produto, cabelo sensível, etc." 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#B89B5E] pl-10 pr-4 p-3 rounded-xl text-sm focus:outline-none placeholder-[#8B8881] text-[#171717] font-medium resize-none leading-relaxed"
                        id="input_booking_notes"
                      />
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button 
                    type="button"
                    disabled={savingAppointment}
                    onClick={handleConfirmAppointment}
                    className="w-full mt-4 py-3.5 bg-[#171717] text-white font-bold hover:bg-[#2B2B2B] active:scale-[0.99] rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    id="btn_submit_booking"
                  >
                    {savingAppointment ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Enviando agendamento...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-[#D8C79F]" />
                        Finalizar e Confirmar
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 6: SUCCESS CONFIRMED SCREEN */}
            {step === 6 && (
              <motion.div 
                key="step6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
                id="booking_success_screen"
              >
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center rounded-3xl mx-auto mb-6 shadow-xs">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-[#171717] mb-2">Agendamento Confirmado!</h1>
                <p className="text-[#6B6B6B] text-xs leading-relaxed max-w-xs mx-auto mb-6">
                  Sua reserva foi concluída com sucesso no LumièreOS. Aguardamos sua visita!
                </p>

                {/* receipt details box */}
                <div className="p-4 bg-white border border-[#E5E2DC] rounded-2xl mb-7 text-left space-y-3.5 shadow-xs" id="receipt_summary">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-sm text-[#171717]">{selectedService?.name}</span>
                    <span className="font-bold text-sm text-[#171717] tabular-nums shrink-0">{formatBRL(selectedService?.price || 0)}</span>
                  </div>

                  <div className="h-[1px] bg-[#E5E2DC]"></div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Profissional</span>
                      <p className="font-bold text-[#171717] mt-0.5">{successAppointment?.professionalName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Horário Reservado</span>
                      <p className="font-bold text-[#171717] mt-0.5 tabular-nums">{selectedDate.split('-').reverse().join('/')} às {selectedTime}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Cliente</span>
                      <p className="font-bold text-[#171717] mt-0.5">{clientName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B6B6B] uppercase font-semibold">Origem</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">Online / Cliente</span>
                    </div>
                  </div>
                </div>

                {/* Interaction CTA Links */}
                <div className="space-y-3">
                  {/* WhatsApp redirect w/ pre-configured invoice format */}
                  <a
                    href={`https://wa.me/${salon?.phone ? salon.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(
                      `Olá! Acabo de fazer um agendamento online no LumièreOS:\n\n*Serviço:* ${selectedService?.name}\n*Profissional:* ${successAppointment?.professionalName}\n*Data:* ${selectedDate.split('-').reverse().join('/')}\n*Horário:* ${selectedTime}\n*Cliente:* ${clientName}\n\nGostaria de confirmar meu compromisso!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl transition shadow-sm flex items-center justify-center gap-2 text-sm"
                    id="btn_whatsapp_confirm"
                  >
                    <Phone className="w-4 h-4" />
                    Enviar WhatsApp ao Salão
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedService(null);
                      setSelectedProfessional(null);
                      setSelectedDate('');
                      setSelectedTime('');
                      setClientName('');
                      setClientPhone('');
                      setClientEmail('');
                      setNotes('');
                      setSubmitError(null);
                    }}
                    className="w-full py-3 bg-white hover:bg-[#FAF9F7] text-[#171717] font-bold rounded-2xl transition text-xs border border-[#E5E2DC] cursor-pointer"
                    id="btn_restart_booking"
                  >
                    Fazer outro agendamento
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footnotes logo */}
        {step < 6 && (
          <div className="text-center pt-4" id="booking_footer">
            <p className="text-[10px] text-zinc-600 font-mono tracking-tight flex items-center justify-center gap-1.5 leading-none">
              <span>Agendamento homologado de forma nativa por</span>
              <strong className="text-zinc-500">LumièreOS</strong>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
