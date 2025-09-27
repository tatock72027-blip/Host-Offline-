// === BLOQUEIO IMEDIATO POR INTERNET ===
function safeSetDisplay(elementId, displayValue) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = displayValue;
  }
}

function checkAndBlockInternet() {
  if (navigator.onLine) {
    safeSetDisplay('internetBlockedScreen', 'flex');
    safeSetDisplay('passwordScreen', 'none');
    safeSetDisplay('partnerEntryScreen', 'none');
    safeSetDisplay('mainScreen', 'none');
    safeSetDisplay('internetWarning', 'block');
    return true;
  } else {
    safeSetDisplay('internetBlockedScreen', 'none');
    safeSetDisplay('internetWarning', 'none');
    return false;
  }
}

// Verifica imediatamente
if (!checkAndBlockInternet()) {
  const app = new SecureMiniNet();
}

setInterval(checkAndBlockInternet, 1000);
window.addEventListener('online', checkAndBlockInternet);
window.addEventListener('offline', checkAndBlockInternet);

// === SEU CÓDIGO ORIGINAL ===
class SecureMiniNet {
  constructor() {
    this.HOST_PASSWORD = '#$7*7$#';
    this.isHost = false;
    this.hostActive = false;
    this.authorizedBackups = new Set();
    this.pc = null;
    this.dataChannel = null;
    this.encryptionKey = null;
    this.assumedByBackup = false;
    this.hostOffer = null;
    this.privateSessionActive = false;
    
    this.init();
  }

  async init() {
    if (navigator.onLine) return;
    await this.setupCrypto();
    this.bindEvents();
  }

  async setupCrypto() {
    this.encryptionKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  bindEvents() {
    document.getElementById('submitPassword').onclick = () => this.verifyPassword();
    document.getElementById('hostPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.verifyPassword();
    });

    document.getElementById('connectPartnerBtn').onclick = () => this.connectAsPartner();
    document.getElementById('partnerCode').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) this.connectAsPartner();
    });

    document.getElementById('addBackup').onclick = () => this.addBackup();
    document.getElementById('sendBtn').onclick = () => this.sendMessage();
    document.getElementById('message').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('backBtn').onclick = () => {
      document.getElementById('mainScreen').style.display = 'none';
      if (this.isHost || this.assumedByBackup) {
        document.getElementById('passwordScreen').style.display = 'flex';
      } else {
        document.getElementById('partnerEntryScreen').style.display = 'flex';
      }
      document.getElementById('hostPassword').value = '';
      document.getElementById('partnerCode').value = '';
    };

    document.getElementById('privateSessionBtn').onclick = () => {
      this.createPrivateSession();
    };
  }

  verifyPassword() {
    const password = document.getElementById('hostPassword').value;
    if (password === this.HOST_PASSWORD) {
      document.getElementById('hostPassword').value = '';
      this.becomeHost();
    } else {
      document.getElementById('passwordError').textContent = 'Senha incorreta!';
      setTimeout(() => { document.getElementById('passwordError').textContent = ''; }, 3000);
    }
  }

  becomeHost() {
    this.isHost = true;
    this.hostActive = true;
    this.showHostInterface();
    this.startHostConnection();
  }

  showHostInterface() {
    document.getElementById('passwordScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
    document.getElementById('backBtn').style.display = 'flex';
    document.getElementById('mainTitle').textContent = 'HostException';
    document.getElementById('hostControls').style.display = 'block';
    document.getElementById('privateSessionBtn').style.display = 'none';
  }

  startHostConnection() {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.dataChannel = this.pc.createDataChannel("mininet");
    this.setupDataChannel();
    
    this.pc.createOffer().then(offer => {
      this.hostOffer = offer;
      return this.pc.setLocalDescription(offer);
    }).then(() => {
      this.updateStatus("✅ Host Principal Ativo");
      this.displayHostCode();
    });
  }

  displayHostCode() {
    if (this.hostOffer) {
      const code = JSON.stringify(this.hostOffer);
      this.showMessage(
        `🔐 <b>Código do Host Principal</b><br>` +
        `<code style="color:#00f7ff; font-size:0.85rem; word-break:break-all;">${code}</code><br>` +
        `<small>📲 Compartilhe este código com parceiros</small>`,
        'system'
      );
    }
  }

  addBackup() {
    const ip = document.getElementById('backupIp').value.trim();
    if (!ip || this.authorizedBackups.size >= 3) {
      alert("Máximo de 3 Parceiros GM atingido.");
      return;
    }
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      alert('IP inválido!');
      return;
    }
    this.authorizedBackups.add(ip);
    this.updateBackupList();
    document.getElementById('backupIp').value = '';
    this.showMessage(`🛡️ Parceiro GM autorizado: ${ip}`, 'system');
  }

  updateBackupList() {
    const listEl = document.getElementById('backupList');
    listEl.innerHTML = '';
    let index = 1;
    this.authorizedBackups.forEach(ip => {
      const div = document.createElement('div');
      div.className = 'backup-item';
      div.innerHTML = `<span>Parceiro GM ${index}: ${ip}</span><span>🛡️</span>`;
      listEl.appendChild(div);
      index++;
    });
  }

  setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => {
      this.updateStatus("✅ Conectado ao Host Principal");
      document.getElementById('sendBtn').disabled = false;
    };
    this.dataChannel.onclose = () => {
      this.handleHostFailure();
    };
    this.dataChannel.onmessage = async (e) => {
      try {
        const decrypted = await this.decrypt(e.data);
        this.showMessage(decrypted, 'peer');
      } catch (e) {
        console.error("Erro ao descriptografar:", e);
      }
    };
  }

  handleHostFailure() {
    if (!this.isHost && this.authorizedBackups.size > 0) {
      this.assumedByBackup = true;
      this.isHost = true;
      this.showHostInterface();
      this.startHostConnection();
      this.showMessage("🔄 Assumido como novo Host", 'system');
    }
  }

  async sendMessage() {
    const input = document.getElementById('message');
    const msg = input.value.trim();
    if (!msg || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    try {
      const encrypted = await this.encrypt(msg);
      this.dataChannel.send(encrypted);
      this.showMessage(msg, 'you');
      input.value = "";
    } catch (e) {
      console.error("Erro ao enviar:", e);
    }
  }

  createPrivateSession() {
    if (this.privateSessionActive) {
      alert("Já existe uma sessão privada ativa.");
      return;
    }
    
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch (e) {
      alert("Seu navegador não suporta conexões P2P.");
      return;
    }
    
    const codeId = 'private-code-' + Date.now();
    
    const channel = pc.createDataChannel("private-chat");
    channel.onopen = () => {
      const codeEl = document.getElementById(codeId);
      if (codeEl) codeEl.closest('.message').remove();
      this.setupPrivateChannel(channel, pc);
    };

    pc.createOffer().then(offer => {
      return pc.setLocalDescription(offer);
    }).then(() => {
      const code = JSON.stringify(pc.localDescription);
      this.showMessage(
        `🔐 <b>Código da Sessão Privada</b><br>` +
        `<code id="${codeId}" style="color:#ff00f7; font-size:0.85rem; word-break:break-all;">${code}</code><br>` +
        `<small>Cole em outro parceiro com: joinSession(codigo)</small>`,
        'system'
      );
    }).catch(e => {
      console.error("Erro na sessão privada:", e);
      alert("Falha ao criar sessão privada.");
    });
  }

  setupPrivateChannel(channel, pc) {
    this.privateSessionActive = true;
    document.getElementById('sendBtn').disabled = false;
    const originalOnclick = document.getElementById('sendBtn').onclick;
    
    document.getElementById('sendBtn').onclick = () => {
      const msg = document.getElementById('message').value.trim();
      if (msg) {
        channel.send(msg);
        this.showMessage(msg, 'you');
        document.getElementById('message').value = "";
      }
    };

    channel.onmessage = (e) => {
      this.showMessage(e.data, 'peer');
    };
    
    channel.onclose = () => {
      this.privateSessionActive = false;
      document.getElementById('sendBtn').onclick = originalOnclick;
      document.getElementById('sendBtn').disabled = !this.dataChannel || this.dataChannel.readyState !== 'open';
      if (pc) pc.close();
    };
  }

  async encrypt(message) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.encryptionKey,
      encoded
    );
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode.apply(null, result));
  }

  async decrypt(encryptedB64) {
    const encrypted = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
    const iv = encrypted.slice(0, 12);
    const data = encrypted.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.encryptionKey,
      data
    );
    return new TextDecoder().decode(decrypted);
  }

  showMessage(text, type) {
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (type === 'system') {
      div.innerHTML = text;
    } else {
      div.textContent = text;
    }
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  updateStatus(text) {
    document.getElementById('status').textContent = text;
  }

  connectAsPartner() {
    const code = document.getElementById('partnerCode').value.trim();
    if (!code) {
      document.getElementById('partnerError').textContent = 'Código vazio!';
      setTimeout(() => { document.getElementById('partnerError').textContent = ''; }, 3000);
      return;
    }
    try {
      const offer = JSON.parse(code);
      this.joinAsPartner(offer);
    } catch (e) {
      document.getElementById('partnerError').textContent = 'Código inválido!';
      setTimeout(() => { document.getElementById('partnerError').textContent = ''; }, 3000);
    }
  }
}

// === CORREÇÃO: Função global simples ===
function joinSession(code) {
  try {
    const offer = JSON.parse(code);
    if (typeof app !== 'undefined' && app.joinAsPartner) {
      app.joinAsPartner(offer);
    } else {
      alert("App não inicializado. Ative o modo avião e recarregue.");
    }
  } catch (e) {
    alert("Código inválido!");
  }
}

SecureMiniNet.prototype.joinAsPartner = function(offer) {
  document.getElementById('partnerEntryScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'flex';
  document.getElementById('backBtn').style.display = 'flex';
  document.getElementById('mainTitle').textContent = 'Parceiro';
  document.getElementById('hostControls').style.display = 'none';
  document.getElementById('privateSessionBtn').style.display = 'block';
  
  if (this.pc) {
    this.pc.close();
  }
  this.dataChannel = null;
  
  try {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel();
    };
    
    this.pc.setRemoteDescription(offer)
      .then(() => this.pc.createAnswer())
      .then(answer => this.pc.setLocalDescription(answer))
      .then(() => {
        const answerStr = JSON.stringify(this.pc.localDescription);
        alert("Envie este código de resposta para o host:\n" + answerStr);
      });
  } catch (e) {
    console.error("Erro ao conectar como parceiro:", e);
    alert("Falha ao conectar. Código inválido?");
  }
};
