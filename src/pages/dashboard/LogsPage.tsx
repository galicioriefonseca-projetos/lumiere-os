import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Terminal, 
  AlertTriangle, 
  Info, 
  XCircle, 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  User as UserIcon, 
  Globe, 
  MapPin,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductionLog } from '../../types';

export default function LogsPage() {
  const { userData, salonData } = useAuth();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  
  // UTILS
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Authorization check: Only owner, manager, or platform_admin can access logs
  const isAuthorized = 
    userData && 
    (userData.role === 'owner' || 
     userData.role === 'manager' || 
     userData.role === 'platform_admin');

  useEffect(() => {
    if (!isAuthorized || !salonData?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Only query logs using basic reference to avoid composite index requirements
    const logsRef = collection(db, `salons/${salonData.id}/productionLogs`);
    const q = query(logsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList: ProductionLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          logsList.push({ id: doc.id, ...data } as ProductionLog);
        }
      });
      
      // Sort client-side descending by createdAt
      logsList.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return timeB - timeA;
      });

      setLogs(logsList);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar logs em tempo real:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData?.id, isAuthorized]);

  // Handle Log Copying
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Soft Clear All Logs
  const clearAllLogs = async () => {
    if (!salonData?.id || logs.length === 0) return;
    if (!window.confirm('Tem certeza que deseja arquivar estes logs? Eles serão ocultados da tela (soft-delete), mas preservados no histórico do sistema.')) return;

    setIsClearing(true);
    try {
      // Soft delete batch
      const batch = writeBatch(db);
      logs.forEach((log) => {
        const logDocRef = doc(db, `salons/${salonData.id}/productionLogs/${log.id}`);
        batch.update(logDocRef, {
          isActive: false,
          deletedAt: Date.now()
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Falha ao limpar logs com soft delete:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Extract unique users from logs for filtering
  const uniqueUsers = Array.from(
    new Map(
      logs
        .filter(log => log.userEmail)
        .map(log => [log.userEmail, { email: log.userEmail, name: log.userName }])
    ).values()
  );

  // Client filtering
  const filteredLogs = logs.filter(log => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesUser = selectedUser === 'all' || log.userEmail === selectedUser;
    
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      !searchQuery || 
      log.message.toLowerCase().includes(term) || 
      (log.stack && log.stack.toLowerCase().includes(term)) ||
      log.pagePath.toLowerCase().includes(term) ||
      (log.userName && log.userName.toLowerCase().includes(term)) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(term));

    return matchesLevel && matchesUser && matchesSearch;
  });

  const getLevelBadge = (level: 'error' | 'warning' | 'info') => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-400/10 text-red-400 border border-red-500/10">
            <XCircle className="w-3 h-3" />
            Crash / Erro
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-500/10">
            <AlertTriangle className="w-3 h-3" />
            Alerta
          </span>
        );
      case 'info':
        default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-500/10">
            <Info className="w-3 h-3" />
            Sessão
          </span>
        );
    }
  };

  // Convert Firebase/number timestamp
  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    const date = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!isAuthorized) {
    return (
      <div id="logs-unauthorized" className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-neutral-400 mb-6 text-sm">
            Seu nível de acesso atual não possui permissões para visualizar ou gerenciar os logs de auditoria técnica do sistema.
          </p>
          <button 
            onClick={() => window.history.back()}
            className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
          >
            Voltar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="production-logs-page" className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <Terminal className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">Faturamento & Monitoramento</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Logs de Sistema em Produção</h1>
          <p className="text-neutral-400 text-sm mt-0.5">
            Monitoramento de falhas, exceções não tratadas e ações estruturais em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={clearAllLogs}
            disabled={isClearing || logs.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Limpando...' : 'Limpar Todos (Soft Delete)'}
          </button>
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl">
          <p className="text-xs text-neutral-400 font-mono">Total Registrado</p>
          <p className="text-2xl font-bold mt-1 text-white">{logs.length}</p>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl">
          <p className="text-xs text-neutral-400 font-mono">Erros / Crashes</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {logs.filter(l => l.level === 'error').length}
          </p>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl">
          <p className="text-xs text-neutral-400 font-mono">Alertas</p>
          <p className="text-2xl font-bold mt-1 text-yellow-400">
            {logs.filter(l => l.level === 'warning').length}
          </p>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl">
          <p className="text-xs text-neutral-400 font-mono">Filtrados</p>
          <p className="text-2xl font-bold mt-1 text-[#D4AF37]">{filteredLogs.length}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-neutral-900/45 border border-neutral-850 p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="relative col-span-1 md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Pesquisar por mensagem, rota, trecho do stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#D4AF37]/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none"
          />
        </div>

        {/* Level Filter */}
        <div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#D4AF37]/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Filtro de Gravidade: Todos</option>
            <option value="error">Apenas Erros (Crashes)</option>
            <option value="warning">Apenas Alertas</option>
            <option value="info">Apenas Eventos Informativos</option>
          </select>
        </div>

        {/* User Filter */}
        <div>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-[#D4AF37]/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Usuário Responsável: Todos</option>
            {uniqueUsers.map(user => (
              <option key={user.email} value={user.email}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            Carregando histórico do cache em segurança...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            <Terminal className="w-10 h-10 text-neutral-600 mx-auto mb-3 animate-pulse" />
            Nenhum registro encontrado correspondente aos filtros.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              return (
                <div 
                  key={log.id} 
                  className={`transition-colors hover:bg-neutral-900/30 ${isExpanded ? 'bg-neutral-900/40' : ''}`}
                >
                  {/* Log Summary Row */}
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 flex items-start justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {getLevelBadge(log.level)}
                        <span className="text-xs text-neutral-400 font-mono">
                          {formatTimestamp(log.createdAt)}
                        </span>
                        {log.userName && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-400 bg-neutral-850 px-1.5 py-0.5 rounded">
                            <UserIcon className="w-2.5 h-2.5" />
                            {log.userName} ({log.userRole})
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-white mt-1 break-all line-clamp-2 md:line-clamp-1">
                        {log.message}
                      </p>

                      <div className="flex items-center gap-3 text-neutral-500 text-xs font-mono">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D4AF37]/60" />
                          {log.pagePath}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(
                            `[LumiereOS Log] ${formatTimestamp(log.createdAt)}\nLVL: ${log.level.toUpperCase()}\nMSG: ${log.message}\nPATH: ${log.pagePath}\nUSER: ${log.userName || 'N/A'}\nUA: ${log.userAgent}\nSTACK:\n${log.stack || 'N/A'}`,
                            log.id
                          );
                        }}
                        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                        title="Copiar log completo"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible details pane */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden bg-neutral-950/60 border-t border-neutral-850"
                      >
                        <div className="p-4 space-y-4 text-xs font-mono">
                          
                          {/* Metadata grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-950/80 p-3 rounded-lg border border-neutral-850">
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase font-bold text-[10px]">Identificador do Log</p>
                              <p className="text-neutral-300 break-all">{log.id}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase font-bold text-[10px]">Salão de Origem</p>
                              <p className="text-[#D4AF37] break-all">{log.salonId}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase font-bold text-[10px]">Sessão do Usuário</p>
                              <p className="text-neutral-300 break-all">
                                {log.userEmail ? `${log.userName} (${log.userEmail})` : 'Usuário Não Autenticado'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-neutral-500 uppercase font-bold text-[10px]">Dispositivo / Navegador</p>
                              <p className="text-neutral-300 flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                                <span className="truncate" title={log.userAgent}>{log.userAgent}</span>
                              </p>
                            </div>
                          </div>

                          {/* Stacktrace pane */}
                          <div className="space-y-1.5">
                            <p className="text-neutral-500 uppercase font-bold text-[10px]">Trace Completo / Detalhes do Ambiente</p>
                            {log.stack ? (
                              <pre className="bg-red-950/15 border border-red-900/10 text-neutral-300 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-96 whitespace-pre-wrap font-mono">
                                {log.stack}
                              </pre>
                            ) : (
                              <p className="text-neutral-500 italic p-3 bg-neutral-900/40 rounded border border-neutral-850">
                                Nenhum rastreamento de pilha para este evento.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
