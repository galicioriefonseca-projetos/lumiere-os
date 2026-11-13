/**
 * Utilitário de compressão e manipulação de fotos/avatares para o LumièreOS.
 * Redimensiona imagens no cliente e gera Data URLs otimizadas para armazenamento
 * leve e instantâneo no perfil do usuário e profissionais.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

/**
 * Converte e comprime um arquivo de imagem em uma Data URL (base64) compacta.
 */
export async function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.82,
    format = 'image/jpeg'
  } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida.');
  }

  // Se o arquivo for muito grande (ex: > 10MB), avisa
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('A imagem selecionada é muito pesada (máx 12MB).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // Manter proporção e recortar em quadrado centralizado para avatares
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const targetSize = Math.min(minDim, Math.max(maxWidth, maxHeight));

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Falha ao processar canvas de imagem.'));
            return;
          }

          // Qualidade de renderização alta
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Desenha corte quadrado centralizado
          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          // Tenta exportar em webp, com fallback para jpeg
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL(format, quality);
          } catch (e) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Erro ao decodificar arquivo de imagem.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo do dispositivo.'));
    };

    reader.readAsDataURL(file);
  });
}
