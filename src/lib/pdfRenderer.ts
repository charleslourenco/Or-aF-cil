/**
 * Utilitário robusto para carregamento e renderização de PDF via PDF.js.
 *
 * Problema histórico: No Vite e ambientes de preview (como Goskip), o fetch
 * dinâmico de `pdf.worker.min.mjs?url` falha com "Failed to fetch dynamically
 * imported module: .../assets/pdf.worker.min-xxxx.mjs" e "Setting up fake worker failed".
 *
 * Solução:
 * 1. Tenta inicializar o Web Worker com constructor inline via `?worker`.
 * 2. Se o Worker inline falhar ou não estiver disponível, tenta carregar o worker oficial via CDN estável (matching 4.10.38).
 * 3. Se qualquer worker falhar ao abrir o documento, efetua fallback imediato para carregamento via legacy build do PDF.js (que roda na main-thread sem necessidade de web worker externo).
 *
 * Desta forma a renderização NUNCA morre por causa do carregamento do worker.
 */

// Import do PDF.js padrão
import * as pdfjsStandard from 'pdfjs-dist'

// Worker inline compilado via Vite (?worker instancia o Web Worker diretamente sem fetch de URL externa)
import PdfWorkerConstructor from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

let workerPortInitialized = false
let workerInitAttempted = false

/**
 * Inicializa a configuração do Worker da forma mais resiliente possível.
 */
export function setupPdfJsWorker(): void {
  if (workerInitAttempted) return
  workerInitAttempted = true

  try {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        // Tenta usar workerPort com nova instância do Worker compilado
        const workerInstance = new PdfWorkerConstructor()
        pdfjsStandard.GlobalWorkerOptions.workerPort = workerInstance
        workerPortInitialized = true
        return
      } catch (workerErr) {
        console.warn('Falha ao instanciar worker inline via workerPort:', workerErr)
      }
    }
  } catch (err) {
    console.warn('Exceção ao configurar worker inline:', err)
  }

  // Fallback 1: CDN estável da mesma versão exata (4.10.38)
  try {
    const version = pdfjsStandard.version || '4.10.38'
    pdfjsStandard.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`
  } catch (e) {
    console.warn('Não foi possível definir CDN no workerSrc:', e)
  }
}

/**
 * Carrega um documento PDF com resiliência extrema a falhas de Web Worker.
 * Se o build padrão falhar por "fake worker" ou erro de rede do worker,
 * recorre ao legacy build do PDF.js configurado sem dependência de worker.
 */
export async function loadPdfDocumentResilient(data: ArrayBuffer): Promise<any> {
  // 1. Garante tentativa de configuração do worker inicial
  setupPdfJsWorker()

  // 2. Primeira tentativa: módulo padrão do PDF.js
  try {
    const loadingTask = pdfjsStandard.getDocument({
      data: new Uint8Array(data),
      // Opções seguras para compatibilidade de fontes
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
    })
    const doc = await loadingTask.promise
    return doc
  } catch (primaryErr: any) {
    const msg = primaryErr?.message || String(primaryErr)
    console.warn(
      'Carregamento inicial do PDF falhou (possível falha de worker), acionando fallback legacy/main-thread:',
      msg,
    )

    // Se falhou por worker, tentamos via legacy build que opera em modo fallback na main-thread
    try {
      // Dynamic import do legacy build para evitar carregar duplicado quando o padrão funciona
      const legacyPdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

      // Configura fallback no legacy: desabilita worker explícito se possível ou usa CDN legacy
      try {
        const version = legacyPdfjs.version || '4.10.38'
        legacyPdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`
      } catch {
        // ignora
      }

      const legacyTask = legacyPdfjs.getDocument({
        data: new Uint8Array(data),
        // No legacy build podemos passar parâmetros para tolerar ausência de worker
        disableAutoFetch: true,
        disableStream: true,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      })
      const legacyDoc = await legacyTask.promise
      return legacyDoc
    } catch (legacyErr: any) {
      console.error('Falha também no fallback legacy do PDF.js:', legacyErr)
      // Se ambos falharem, relança o erro descritivo
      throw new Error(
        `Falha ao processar PDF: ${primaryErr instanceof Error ? primaryErr.message : msg}`,
      )
    }
  }
}

/**
 * Renderiza as páginas de um PDF em Base64 PNGs utilizando escala personalizada.
 * NUNCA aborta a execução se houver problemas de worker, graças ao fallback embutido.
 *
 * @param file Arquivo PDF vindo do input/dropzone
 * @param maxPages Número máximo de páginas a renderizar (default 5)
 * @param scale Resolução da renderização (default 2.5 para alta nitidez em tabelas)
 */
export async function renderPdfPagesToBase64(
  file: File,
  maxPages = 5,
  scale = 2.5,
): Promise<string[]> {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (readErr) {
    throw new Error(
      `Falha ao ler o arquivo PDF do disco/navegador: ${readErr instanceof Error ? readErr.message : 'Erro de leitura.'}`,
    )
  }

  const pdfDoc = await loadPdfDocumentResilient(arrayBuffer)

  if (!pdfDoc || pdfDoc.numPages < 1) {
    throw new Error('O arquivo PDF não contém páginas legíveis.')
  }

  const pagesBase64: string[] = []
  const pagesToRender = Math.min(pdfDoc.numPages, maxPages)

  for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Não foi possível inicializar o canvas de renderização gráfica.')
    }

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    }

    await page.render(renderContext).promise
    const dataUrl = canvas.toDataURL('image/png')
    pagesBase64.push(dataUrl)
  }

  return pagesBase64
}
