(() => {
  'use strict';

  const CHAVE_VERSAO = 'listalar_versao_instalada';
  const URL_VERSAO = './version.json';
  const INTERVALO_VERIFICACAO = 60 * 60 * 1000;

  let registroAtual = null;
  let versaoDisponivel = null;
  let atualizando = false;
  let modalCriado = false;

  function criarModal() {
    if (modalCriado) return;

    modalCriado = true;

    const estilo = document.createElement('style');

    estilo.textContent = `
      .pwa-update-bg {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 23, 42, .62);
        backdrop-filter: blur(4px);
      }

      .pwa-update-bg.active {
        display: flex;
      }

      .pwa-update-card {
        width: 100%;
        max-width: 390px;
        padding: 22px 20px 18px;
        border-radius: 24px;
        background: #fff;
        text-align: center;
        box-shadow: 0 24px 60px rgba(15, 23, 42, .30);
        animation: pwaUpdateEntrada .18s ease-out;
        font-family: Arial, Helvetica, sans-serif;
      }

      @keyframes pwaUpdateEntrada {
        from {
          opacity: 0;
          transform: translateY(10px) scale(.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .pwa-update-icon {
        width: 60px;
        height: 60px;
        margin: 0 auto 12px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 31px;
      }

      .pwa-update-card h3 {
        margin: 0 0 8px;
        color: #172033;
        font-size: 22px;
        font-weight: 900;
      }

      .pwa-update-card p {
        margin: 0;
        color: #64748b;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.45;
      }

      .pwa-update-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px;
        margin-top: 18px;
      }

      .pwa-update-btn {
        min-height: 48px;
        border: 0;
        border-radius: 15px;
        padding: 12px 10px;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .pwa-update-btn.later {
        background: #eef2f7;
        color: #172033;
      }

      .pwa-update-btn.now {
        color: #fff;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
      }

      .pwa-update-btn:disabled {
        opacity: .65;
        cursor: wait;
      }
    `;

    const modal = document.createElement('div');

    modal.id = 'pwaUpdateModal';
    modal.className = 'pwa-update-bg';

    modal.innerHTML = `
      <div
        class="pwa-update-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwaUpdateTitulo"
      >
        <div class="pwa-update-icon">✨</div>

        <h3 id="pwaUpdateTitulo">
          Nova versão disponível
        </h3>

        <p>
          O ListaLar recebeu melhorias.<br>
          Atualize agora sem desinstalar o aplicativo.
        </p>

        <div class="pwa-update-actions">
          <button
            id="pwaUpdateDepois"
            class="pwa-update-btn later"
          >
            Depois
          </button>

          <button
            id="pwaUpdateAgora"
            class="pwa-update-btn now"
          >
            Atualizar agora
          </button>
        </div>
      </div>
    `;

    document.head.appendChild(estilo);
    document.body.appendChild(modal);

    document
      .getElementById('pwaUpdateDepois')
      .addEventListener('click', esconderModal);

    document
      .getElementById('pwaUpdateAgora')
      .addEventListener('click', atualizarAgora);
  }

  function mostrarModal() {
    criarModal();

    document
      .getElementById('pwaUpdateModal')
      .classList.add('active');
  }

  function esconderModal() {
    const modal = document.getElementById('pwaUpdateModal');

    if (modal) {
      modal.classList.remove('active');
    }
  }

  async function buscarVersao() {
    const resposta = await fetch(
      `${URL_VERSAO}?t=${Date.now()}`,
      {
        cache: 'no-store'
      }
    );

    if (!resposta.ok) {
      throw new Error(
        `Falha ao consultar versão: ${resposta.status}`
      );
    }

    const dados = await resposta.json();

    return String(dados.version || '').trim();
  }

  function observarInstalacao(registro) {
    registro.addEventListener('updatefound', () => {
      const novoWorker = registro.installing;

      if (!novoWorker) return;

      novoWorker.addEventListener('statechange', () => {
        if (
          novoWorker.state === 'installed' &&
          navigator.serviceWorker.controller &&
          versaoDisponivel
        ) {
          mostrarModal();
        }
      });
    });
  }

  async function registrarWorker(versao) {
    const urlWorker =
      `./service-worker.js?v=${encodeURIComponent(versao)}`;

    const registro =
      await navigator.serviceWorker.register(
        urlWorker,
        {
          updateViaCache: 'none'
        }
      );

    registroAtual = registro;

    observarInstalacao(registro);

    await registro.update();

    if (
      registro.waiting &&
      navigator.serviceWorker.controller
    ) {
      mostrarModal();
    }

    return registro;
  }

  async function verificarAtualizacao() {
    if (
      atualizando ||
      !('serviceWorker' in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    try {
      const versaoRemota = await buscarVersao();

      if (!versaoRemota) return;

      const versaoLocal =
        localStorage.getItem(CHAVE_VERSAO);

      /*
       * Primeira implantação:
       * - usuário novo: instala silenciosamente;
       * - usuário que já possuía o app: oferece atualização.
       */
      if (!versaoLocal) {
        const jaEraControlado =
          Boolean(navigator.serviceWorker.controller);

        versaoDisponivel = versaoRemota;

        await registrarWorker(versaoRemota);

        if (!jaEraControlado) {
          localStorage.setItem(
            CHAVE_VERSAO,
            versaoRemota
          );
        } else if (registroAtual?.waiting) {
          mostrarModal();
        }

        return;
      }

      if (versaoRemota === versaoLocal) {
        if (!registroAtual) {
          versaoDisponivel = versaoRemota;

          await registrarWorker(versaoRemota);
        }

        return;
      }

      versaoDisponivel = versaoRemota;

      await registrarWorker(versaoRemota);

      if (registroAtual?.waiting) {
        mostrarModal();
      }
    } catch (erro) {
      console.warn(
        'Verificação de atualização indisponível:',
        erro
      );
    }
  }

  async function atualizarAgora() {
    if (atualizando) return;

    atualizando = true;

    const botao =
      document.getElementById('pwaUpdateAgora');

    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Atualizando...';
    }

    try {
      if (!registroAtual && versaoDisponivel) {
        await registrarWorker(versaoDisponivel);
      }

      const worker =
        registroAtual?.waiting ||
        registroAtual?.installing;

      if (worker?.state === 'installed') {
        worker.postMessage({
          type: 'SKIP_WAITING'
        });

        return;
      }

      if (worker) {
        worker.addEventListener(
          'statechange',
          () => {
            if (worker.state === 'installed') {
              worker.postMessage({
                type: 'SKIP_WAITING'
              });
            }
          },
          {
            once: true
          }
        );

        return;
      }

      if (versaoDisponivel) {
        localStorage.setItem(
          CHAVE_VERSAO,
          versaoDisponivel
        );
      }

      window.location.reload();
    } catch (erro) {
      atualizando = false;

      if (botao) {
        botao.disabled = false;
        botao.textContent = 'Atualizar agora';
      }

      console.error(
        'Não foi possível atualizar o ListaLar:',
        erro
      );
    }
  }

  let recarregou = false;

  navigator.serviceWorker?.addEventListener(
    'controllerchange',
    () => {
      if (recarregou) return;

      recarregou = true;

      if (versaoDisponivel) {
        localStorage.setItem(
          CHAVE_VERSAO,
          versaoDisponivel
        );
      }

      window.location.reload();
    }
  );

  window.addEventListener(
    'load',
    verificarAtualizacao
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'visible') {
        verificarAtualizacao();
      }
    }
  );

  window.addEventListener(
    'focus',
    verificarAtualizacao
  );

  window.setInterval(
    verificarAtualizacao,
    INTERVALO_VERIFICACAO
  );

  // O carregador de atualização já é servido com revalidação obrigatória.
  // O Comercial continua isolado dos módulos domésticos. Primeiro carregamos
  // o núcleo e, em seguida, a navegação 1.0.1 que separa Negócio e Liberações.
  import('./comercial.js?v=1.0.0')
    .then(() => import('./comercial-ui.js?v=1.0.1'))
    .catch((erro) => {
      console.warn('Módulo Comercial indisponível:', erro);
    });
})();
