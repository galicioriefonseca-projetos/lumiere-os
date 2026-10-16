import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Instagram, 
  MapPin, 
  Globe, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Search, 
  Filter, 
  CheckCircle2, 
  Copy, 
  Check,
  Eye,
  FileImage
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientApproval } from '@/types';

interface CreativeLibraryTabProps {
  approvals: ClientApproval[];
  agencyName: string;
}

export default function CreativeLibraryTab({
  approvals = [],
  agencyName
}: CreativeLibraryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Creative library shows approved items (or all with media)
  const creatives = approvals.filter(item => {
    return (item.mediaUrl || item.copyText || item.previewUrl);
  });

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'instagram_post':
        return (
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 gap-1 text-[10px]">
            <Instagram className="w-3 h-3" /> Instagram
          </Badge>
        );
      case 'gmn_post':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1 text-[10px]">
            <MapPin className="w-3 h-3" /> Google Meu Negócio
          </Badge>
        );
      case 'landing_page':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
            <Globe className="w-3 h-3" /> Site & Landing Page
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 gap-1 text-[10px]">
            <FileImage className="w-3 h-3" /> Criativo
          </Badge>
        );
    }
  };

  const handleCopyCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const filteredCreatives = creatives.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchCopy = (item.copyText || '').toLowerCase().includes(q);
      return matchTitle || matchCopy;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Acervo Visual & Histórico de Peças
          </div>
          <h3 className="text-xl font-bold text-white">Biblioteca de Criativos</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Tenha acesso permanente a todas as artes, fotos de Google Meu Negócio, carrosséis de Instagram e capturas de Landing Pages produzidas para a sua empresa pela <strong className="text-white">{agencyName}</strong>.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs text-[#8FAEA2] shrink-0">
          Total de Peças no Acervo: <strong className="text-white">{creatives.length}</strong>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#082019] p-3 rounded-xl border border-white/5 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#8FAEA2] absolute left-3 top-3" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por título ou copy..."
            className="pl-8 bg-black/40 border-white/10 text-white rounded-lg h-8 text-xs focus:border-[#DFC498]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'all' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Todos ({creatives.length})
          </button>
          <button
            onClick={() => setFilterType('instagram_post')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'instagram_post' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Instagram
          </button>
          <button
            onClick={() => setFilterType('gmn_post')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'gmn_post' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Google Meu Negócio
          </button>
          <button
            onClick={() => setFilterType('landing_page')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'landing_page' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Landing Pages
          </button>
        </div>
      </div>

      {/* Grid of Creatives */}
      {filteredCreatives.length === 0 ? (
        <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
              <FileImage className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum criativo encontrado</h4>
            <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
              Todas as peças aprovadas e publicadas pela agência ficarão salvas neste catálogo histórico.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreatives.map(item => (
            <Card
              key={item.id}
              className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/40 transition-all flex flex-col justify-between overflow-hidden shadow-lg group"
            >
              <div>
                {/* Media Image */}
                {item.mediaUrl ? (
                  <div className="relative h-48 w-full bg-black/40 overflow-hidden">
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      {getCategoryBadge(item.type)}
                    </div>
                    {item.status === 'approved' && (
                      <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-500/40 text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Aprovado
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                    {getCategoryBadge(item.type)}
                    <span className="text-[10px] text-[#8FAEA2]">
                      {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-2.5">
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {item.title}
                  </h4>

                  {item.copyText && (
                    <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs text-[#8FAEA2] leading-relaxed line-clamp-3">
                      {item.copyText}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 pt-0 border-t border-white/5 flex items-center justify-between gap-2">
                {item.copyText ? (
                  <Button
                    onClick={() => handleCopyCopyText(item.id, item.copyText || '')}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-[#8FAEA2] hover:text-white rounded-lg gap-1.5"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copiar Texto
                  </Button>
                ) : <span />}

                <div className="flex items-center gap-1.5">
                  {item.mediaUrl && (
                    <Button
                      onClick={() => window.open(item.mediaUrl, '_blank')}
                      variant="outline"
                      size="sm"
                      className="border-white/10 hover:bg-white/5 text-white h-8 px-2.5 rounded-lg text-xs gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Ver Imagem
                    </Button>
                  )}
                  {item.previewUrl && (
                    <Button
                      onClick={() => window.open(item.previewUrl, '_blank')}
                      size="sm"
                      className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-8 px-2.5 rounded-lg text-xs gap-1 shadow"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Link
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
