(() => {
  'use strict';

  function aplicarLayoutLogin() {
    const tela = document.getElementById('loginScreen');
    const card = tela?.querySelector('.login-card');
    const botaoOriginal = document.getElementById('btnLoginGoogle');
    const statusOriginal = document.getElementById('loginStatus');

    if (!tela || !card || !botaoOriginal || !statusOriginal) return;
    if (tela.dataset.layoutV2 === '1') return;

    tela.dataset.layoutV2 = '1';
    tela.classList.add('login-screen-v2');

    const estilo = document.createElement('style');
    estilo.id = 'login-layout-v2-style';
    estilo.textContent = `
      .login-screen-v2 {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px 14px;
        overflow-y: auto;
        background:
          radial-gradient(circle at 88% 8%, rgba(37, 99, 235, .13), transparent 30%),
          radial-gradient(circle at 8% 92%, rgba(6, 182, 212, .10), transparent 28%),
          linear-gradient(180deg, #f8fbff 0%, #ffffff 52%, #f6f9fd 100%);
      }

      .login-screen-v2.hidden { display: none; }

      .login-screen-v2 .login-card {
        width: 100%;
        max-width: 430px;
        margin: auto;
        padding: 24px 20px 20px;
        border: 1px solid rgba(219, 234, 254, .95);
        border-radius: 30px;
        background: rgba(255, 255, 255, .96);
        box-shadow: 0 24px 70px rgba(15, 23, 42, .14);
        text-align: center;
        backdrop-filter: blur(14px);
      }

      .login-screen-v2 .login-logo {
        width: 96px;
        height: 96px;
        margin: 0 auto 12px;
        border-radius: 26px;
        overflow: hidden;
        background: transparent;
        box-shadow: 0 14px 34px rgba(37, 99, 235, .20);
      }

      .login-screen-v2 .login-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 26px;
      }

      .login-screen-v2 .login-brand {
        margin: 0;
        color: #0f2142;
        font-size: 36px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -1.2px;
      }

      .login-screen-v2 .login-headline {
        margin: 16px auto 6px;
        max-width: 340px;
        color: #10244a;
        font-size: 24px;
        line-height: 1.15;
        font-weight: 900;
        letter-spacing: -.35px;
      }

      .login-screen-v2 .login-subtitle {
        margin: 0 auto 18px;
        max-width: 350px;
        color: #64748b;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 700;
      }

      .login-screen-v2 .login-benefits {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin: 0 0 14px;
      }

      .login-screen-v2 .login-benefit {
        min-width: 0;
        padding: 12px 7px 11px;
        border: 1px solid #e5edf8;
        border-radius: 18px;
        background: #fbfdff;
      }

      .login-screen-v2 .login-benefit-icon {
        width: 38px;
        height: 38px;
        margin: 0 auto 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 20px;
      }

      .login-screen-v2 .login-benefit strong {
        display: block;
        color: #14213d;
        font-size: 12px;
        line-height: 1.2;
        font-weight: 900;
      }

      .login-screen-v2 .login-security {
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 11px;
        align-items: center;
        margin: 0 0 14px;
        padding: 13px 14px;
        border: 1px solid #bfdbfe;
        border-radius: 18px;
        background: linear-gradient(135deg, #eff6ff, #f8fbff);
        text-align: left;
      }

      .login-screen-v2 .login-security-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 22px;
      }

      .login-screen-v2 .login-security strong {
        display: block;
        margin-bottom: 2px;
        color: #10244a;
        font-size: 14px;
        font-weight: 900;
      }

      .login-screen-v2 .login-security span {
        display: block;
        color: #52647f;
        font-size: 12px;
        line-height: 1.38;
        font-weight: 700;
      }

      .login-screen-v2 .login-security b {
        color: #10244a;
        font-weight: 900;
      }

      .login-screen-v2 .google-btn {
        width: 100%;
        min-height: 58px;
        border: 0;
        border-radius: 18px;
        background: linear-gradient(135deg, #2563eb, #0ea5e9);
        color: #fff;
        font-size: 17px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 11px;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(37, 99, 235, .23);
      }

      .login-screen-v2 .google-btn:active { transform: translateY(1px); }
      .login-screen-v2 .google-btn:disabled { opacity: .65; cursor: wait; }

      .login-screen-v2 .google-g {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        color: #2563eb;
        font-size: 20px;
        font-weight: 900;
      }

      .login-screen-v2 .login-trust {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 14px;
      }

      .login-screen-v2 .login-trust span {
        color: #52647f;
        font-size: 10.5px;
        line-height: 1.25;
        font-weight: 800;
      }

      .login-screen-v2 .login-trust b {
        display: block;
        margin-bottom: 3px;
        color: #16a34a;
        font-size: 16px;
      }

      .login-screen-v2 .login-status {
        min-height: 19px;
        margin: 10px 0 0;
        color: #52647f;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 800;
      }

      .login-screen-v2 .login-footnote {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #edf2f7;
        color: #94a3b8;
        font-size: 10.5px;
        font-weight: 700;
      }

      @media (max-height: 760px) {
        .login-screen-v2 { align-items: flex-start; }
        .login-screen-v2 .login-card { margin-top: 8px; margin-bottom: 8px; padding-top: 18px; }
        .login-screen-v2 .login-logo { width: 78px; height: 78px; margin-bottom: 9px; }
        .login-screen-v2 .login-brand { font-size: 31px; }
        .login-screen-v2 .login-headline { margin-top: 11px; font-size: 21px; }
        .login-screen-v2 .login-subtitle { margin-bottom: 12px; }
        .login-screen-v2 .login-benefit { padding-top: 9px; padding-bottom: 9px; }
        .login-screen-v2 .login-benefit-icon { width: 32px; height: 32px; margin-bottom: 5px; font-size: 17px; }
      }

      @media (max-width: 360px) {
        .login-screen-v2 { padding-left: 10px; padding-right: 10px; }
        .login-screen-v2 .login-card { padding-left: 14px; padding-right: 14px; }
        .login-screen-v2 .login-benefit strong { font-size: 11px; }
        .login-screen-v2 .login-security { grid-template-columns: 38px 1fr; padding-left: 11px; padding-right: 11px; }
        .login-screen-v2 .login-security-icon { width: 38px; height: 38px; }
        .login-screen-v2 .google-btn { font-size: 16px; }
      }
    `;

    if (!document.getElementById(estilo.id)) {
      document.head.appendChild(estilo);
    }

    card.innerHTML = `
      <div class="login-logo">
        <img src="./icon-192.png" alt="Logo ListaLar">
      </div>

      <h2 class="login-brand">ListaLar</h2>
      <div class="login-headline">Sua casa organizada, sem complicação.</div>
      <div class="login-subtitle">
        Lista compartilhada, estoque e histórico de compras em um só lugar.
      </div>

      <div class="login-benefits" aria-label="Principais recursos do ListaLar">
        <div class="login-benefit">
          <div class="login-benefit-icon">👥</div>
          <strong>Lista compartilhada</strong>
        </div>
        <div class="login-benefit">
          <div class="login-benefit-icon">📦</div>
          <strong>Controle de estoque</strong>
        </div>
        <div class="login-benefit">
          <div class="login-benefit-icon">📊</div>
          <strong>Histórico de compras</strong>
        </div>
      </div>

      <div class="login-security">
        <div class="login-security-icon">🔒</div>
        <div>
          <strong>Seu login é seguro</strong>
          <span>
            Usamos sua conta Google apenas para identificar você e sincronizar seus dados.
            <b>Não acessamos seu Gmail nem sua senha.</b>
          </span>
        </div>
      </div>

      <button id="btnLoginGoogle" class="google-btn" onclick="entrarComGoogle()" type="button">
        <span class="google-g">G</span>
        <span>Continuar com Google</span>
        <span aria-hidden="true">→</span>
      </button>

      <div class="login-trust" aria-label="Informações de confiança">
        <span><b>✓</b>Grátis durante o lançamento</span>
        <span><b>✓</b>Sem cartão de crédito</span>
        <span><b>✓</b>Login seguro pelo Google</span>
      </div>

      <div id="loginStatus" class="login-status"></div>
      <div class="login-footnote">ListaLar · Mais praticidade para o dia a dia.</div>
    `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarLayoutLogin, { once: true });
  } else {
    aplicarLayoutLogin();
  }
})();
