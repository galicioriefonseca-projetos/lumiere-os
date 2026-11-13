import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Star, ExternalLink, Compass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface GoogleBusinessMapProps {
  businessName: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  rankingPosition?: number;
  keyword?: string;
  directionRequests?: number;
  rating?: number;
  totalReviews?: number;
  heightClass?: string;
}

export default function GoogleBusinessMap({
  businessName,
  address = 'Av. Paulista, 1000 - Bela Vista',
  city = 'São Paulo',
  state = 'SP',
  lat = -23.5615,
  lng = -46.6559,
  rankingPosition = 1,
  keyword = 'Salão de Beleza',
  directionRequests = 0,
  rating = 4.9,
  totalReviews = 0,
  heightClass = 'h-[360px] md:h-[420px]'
}: GoogleBusinessMapProps) {
  const [openInfoWindow, setOpenInfoWindow] = useState<boolean>(true);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';

  const center = { lat, lng };

  const handleOpenGoogleMapsExternal = () => {
    const query = encodeURIComponent(`${businessName} ${address} ${city} ${state}`.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Header do Mapa com Status de Ranqueamento */}
      <div className="p-4 md:p-5 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 shadow-inner">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-white tracking-wide">
                Posicionamento no Google Maps
              </h4>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Top {rankingPosition} Local
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {businessName} • Palavra-chave: <span className="text-zinc-200 font-medium">"{keyword}"</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenGoogleMapsExternal}
            className="border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:text-white hover:border-[#D4AF37]/60 text-xs gap-1.5 h-8 px-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no Google Maps
          </Button>
        </div>
      </div>

      {/* Container do Mapa com altura explícita obrigatória */}
      <div className={`w-full ${heightClass} relative`}>
        {apiKey ? (
          <APIProvider apiKey={apiKey} language="pt-BR" region="BR">
            <Map
              defaultCenter={center}
              defaultZoom={15}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <AdvancedMarker
                position={center}
                title={businessName}
                onClick={() => setOpenInfoWindow(prev => !prev)}
              >
                <Pin 
                  background="#D4AF37"
                  glyphColor="#000000"
                  borderColor="#8C7322"
                  scale={1.15}
                />
              </AdvancedMarker>

              {openInfoWindow && (
                <InfoWindow
                  position={center}
                  onCloseClick={() => setOpenInfoWindow(false)}
                  headerContent={
                    <div className="font-semibold text-zinc-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {businessName}
                    </div>
                  }
                >
                  <div className="text-xs text-zinc-700 space-y-1.5 max-w-[240px] pt-1">
                    <p className="text-zinc-600 leading-snug">
                      {address}, {city} - {state}
                    </p>
                    <div className="flex items-center gap-3 pt-1 border-t border-zinc-200 text-[11px] text-zinc-800 font-medium">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Navigation className="w-3 h-3" />
                        {directionRequests} rotas solicitadas
                      </span>
                      {rating > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-700">
                          ★ {rating.toFixed(1)} {totalReviews > 0 ? `(${totalReviews})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900/60 p-6 text-center">
            <div className="max-w-md space-y-2">
              <MapPin className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-medium text-white">Visualização de Mapa Google Maps</p>
              <p className="text-xs text-zinc-400">
                A chave de API do Google Maps Platform está sendo sincronizada.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer com Metadados de Ranqueamento e Ações */}
      <div className="p-3 px-4 bg-zinc-900/90 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-zinc-300">
            <Navigation className="w-3.5 h-3.5 text-[#D4AF37]" />
            <strong className="text-white">{directionRequests}</strong> rotas traçadas até o salão
          </span>
          <span className="flex items-center gap-1 text-zinc-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Raio de alcance geolocalizado ativo
          </span>
        </div>
        <div className="text-[11px] text-zinc-400">
          Powered by Google Maps Platform
        </div>
      </div>
    </div>
  );
}
