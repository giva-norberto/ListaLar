(() => {
  'use strict';

  const SELETOR_BOTAO_GOOGLE = '#btnLoginGoogle';
  const MENSAGEM_CURTA = 'Para entrar com Google, abra o ListaLar no Safari ou Chrome.';

  function estaEmPwaInstalado() {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      window.navigator.standalone === true
    );
  }

  function sessionStorageDisponivel() {
    try {
      const chave = '__listalar_teste_session__';
      sessionStorage.setItem(chave, '1');
      sessionStorage.removeItem(chave);
      return true;
    } catch {
      return false;
    }
  }

  function navegadorInternoIncompativel() {
    if (estaEmPwaInstalado()) return false;

    const ua = String(navigator.userAgent || '');
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const appInternoConhecido = /Teams|TeamsMobile|FBAN|FBAV|Instagram|WhatsApp|LinkedInApp|Line\/|MicroMessenger|Snapchat/i.test(ua);
    const androidWebView = /;\s*wv\)|\bwv\b/i.test(ua);
    const navegadorIosExterno = /Safari|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    const iosWebViewGenerico = ios && /AppleWebKit/i.test(ua) && !navegadorIosExterno;

    return appInternoConhecido || androidWebView || iosWebViewGenerico;
  }

  function ambienteLoginIncompativel() {
    return navegadorInternoIncompativel() || !sessionStorageDisponivel();
  }

  function textoOrientacao() {
    const ios = /iPhone|iPad|iPod/i.test(String(navigator.userAgent || ''));

    if (ios) {
      return 'O login do Google não funciona com segurança dentro do navegador interno deste aplicativo. Toque no botão Compartilhar e escolha “Abrir no Safari”. Depois entre com Google normalmente.';
    }

    return 'O login do Google não funciona com segurança dentro do navegador interno deste aplicativo. Abra o menu e escolha “Abrir no Chrome” ou “Abrir no navegador”. Depois entre com Google normalmente.';
  }

  async function mostrarOrientacao() {
    const status = document.getElementById('loginStatus');
    const texto = textoOrientacao();

    if (status) status.textContent = MENSAGEM_CURTA;

    if (typeof window.mostrarMensagem === 'function') {
      await window.mostrarMensagem({
        titulo: 'Abra no navegador',
        texto,
        tipo: 'warning',
        botaoTexto: 'Entendi'
      });
      return;
    }

    window.alert(texto);
  }

  function atualizarAvisoInicial() {
    if (!ambienteLoginIncompativel()) return;

    const login = document.getElementById('loginScreen');
    const status = document.getElementById('loginStatus');

    if (!login || login.classList.contains('hidden') || !status) return;
    status.textContent = MENSAGEM_CURTA;
  }

  document.addEventListener(
    'click',
    (evento) => {
      const alvo = evento.target instanceof Element
        ? evento.target.closest(SELETOR_BOTAO_GOOGLE)
        : null;

      if (!alvo || !ambienteLoginIncompativel()) return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();

      void mostrarOrientacao();
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', atualizarAvisoInicial, { once: true });
  } else {
    queueMicrotask(atualizarAvisoInicial);
  }

  window.addEventListener('pageshow', atualizarAvisoInicial);

  console.log('✅ ListaLar: proteção do login Google em navegadores internos ativa');
})();
