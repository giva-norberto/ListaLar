/**
 * ============================================================================
 * LISTALAR - SERVICE WORKER
 *
 * RESPONSABILIDADES:
 * - Controle de versão e cache da PWA.
 * - Atualização dos arquivos locais.
 * - Funcionamento offline básico.
 *
 * IMPORTANTE:
 * - As notificações administrativas não são carregadas neste service worker.
 * - A estrutura de notificações será separada para não interferir na
 *   velocidade e na atualização normal do ListaLar.
 * ============================================================================
 */

const parametros =
  new URL(self.location.href).searchParams;

const VERSAO =
  parametros.get('v') || '1.0.0';

const CACHE_NAME =
  `listalar-${VERSAO}`;

const ARQUIVOS_ESTATICOS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './unidades-produtos.js',
  './pwa-update.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(
          ARQUIVOS_ESTATICOS.map((arquivo) =>
            cache.add(
              `${arquivo}?v=${encodeURIComponent(VERSAO)}`
            )
          )
        );
      })
  );

  /*
   * Não ativa automaticamente.
   * Só assume o controle quando o usuário
   * clicar em "Atualizar agora".
   */
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) =>
            chave.startsWith('listalar-')
          )
          .filter((chave) =>
            chave !== CACHE_NAME
          )
          .map((chave) =>
            caches.delete(chave)
          )
      )
    )
  );

  self.clients.claim();
});

async function buscarNaRedeEAtualizarCache(
  request
) {
  const resposta = await fetch(request, {
    cache: 'no-store'
  });

  if (
    resposta &&
    resposta.ok &&
    request.method === 'GET' &&
    new URL(request.url).origin ===
      self.location.origin
  ) {
    const cache =
      await caches.open(CACHE_NAME);

    await cache.put(
      request,
      resposta.clone()
    );
  }

  return resposta;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /*
   * Firebase, Google Login e serviços externos
   * não são interceptados.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Navegação:
   * força a rede sem reutilizar o cache HTTP do navegador.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      buscarNaRedeEAtualizarCache(request)
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match('./index.html')
          );
        })
    );

    return;
  }

  /*
   * Arquivos locais:
   * rede primeiro e sem cache HTTP; Cache Storage é só contingência offline.
   */
  event.respondWith(
    buscarNaRedeEAtualizarCache(request)
      .catch(() =>
        caches.match(request)
      )
  );
});
