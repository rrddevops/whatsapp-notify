const API_BASE = '/api';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkStatus();
    loadScheduledMessages();
    loadAIConfig();
    loadWhatsAppConfig();
    
    // Adicionar listener ao botão de cadastrar número
    const savePhoneBtn = document.getElementById('save-phone-btn');
    if (savePhoneBtn) {
        savePhoneBtn.addEventListener('click', (e) => {
            e.preventDefault();
            savePhoneNumber();
        });
    }
    
    // Listener para mostrar/ocultar campo de URL do wiki
    const aiUseWikiCheckbox = document.getElementById('ai-use-wiki');
    if (aiUseWikiCheckbox) {
        aiUseWikiCheckbox.addEventListener('change', () => {
            const wikiUrlGroup = document.getElementById('wiki-url-group');
            if (aiUseWikiCheckbox.checked) {
                wikiUrlGroup.style.display = 'block';
            } else {
                wikiUrlGroup.style.display = 'none';
            }
        });
    }
});

// Tabs
function showTab(tabName) {
    // Esconder todas as tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar tab selecionada
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');

    // Carregar dados específicos da tab
    if (tabName === 'qrcode') {
        loadWhatsAppConfig();
        // Carregar QR Code quando a aba for aberta
        setTimeout(() => {
            loadQRCode();
        }, 500);
    } else if (tabName === 'scheduled') {
        // Carregar mensagens agendadas quando a aba for aberta
        loadScheduledMessages();
    }
}

// Status
async function checkStatus() {
    try {
        const [whatsappRes, aiRes, healthRes] = await Promise.all([
            fetch(`${API_BASE}/whatsapp/status`),
            fetch(`${API_BASE}/ai/status`),
            fetch(`${API_BASE}/health`)
        ]);

        const whatsappData = await whatsappRes.json();
        const aiData = await aiRes.json();
        const healthData = await healthRes.json();

        // WhatsApp Status
        const whatsappStatus = document.getElementById('whatsapp-status');
        if (whatsappData.success && whatsappData.connected) {
            whatsappStatus.textContent = 'Conectado';
            whatsappStatus.className = 'status-badge connected';
        } else {
            whatsappStatus.textContent = 'Desconectado';
            whatsappStatus.className = 'status-badge disconnected';
        }

        // DB Status
        const dbStatus = document.getElementById('db-status');
        if (healthData.status === 'ok') {
            dbStatus.textContent = 'Conectado';
            dbStatus.className = 'status-badge connected';
        } else {
            dbStatus.textContent = 'Desconectado';
            dbStatus.className = 'status-badge disconnected';
        }

        // AI Status
        const aiStatus = document.getElementById('ai-status');
        if (aiData.success && aiData.data?.enabled) {
            aiStatus.textContent = 'Ativada';
            aiStatus.className = 'status-badge connected';
        } else {
            aiStatus.textContent = 'Desativada';
            aiStatus.className = 'status-badge disconnected';
        }
    } catch (error) {
        showNotification('Erro ao verificar status', 'error');
        console.error('Erro:', error);
    }
}

// Auto-refresh do QR Code
let qrCodeRefreshInterval = null;

function startAutoRefresh() {
    if (qrCodeRefreshInterval) return;
    
    qrCodeRefreshInterval = setInterval(() => {
        loadQRCode();
    }, 3000); // Atualizar a cada 3 segundos
    
    document.getElementById('auto-refresh-btn').style.display = 'none';
    document.getElementById('stop-refresh-btn').style.display = 'inline-block';
    showNotification('Atualização automática ativada', 'info');
}

function stopAutoRefresh() {
    if (qrCodeRefreshInterval) {
        clearInterval(qrCodeRefreshInterval);
        qrCodeRefreshInterval = null;
    }
    document.getElementById('auto-refresh-btn').style.display = 'inline-block';
    document.getElementById('stop-refresh-btn').style.display = 'none';
    showNotification('Atualização automática desativada', 'info');
}

// Configuração do WhatsApp
async function loadWhatsAppConfig() {
    try {
        const response = await fetch(`${API_BASE}/whatsapp/config`);
        const data = await response.json();

        if (data.success && data.data?.phoneNumber) {
            // Número já cadastrado
            document.getElementById('phone-number-form').style.display = 'none';
            document.getElementById('phone-number-info').style.display = 'block';
            document.getElementById('qrcode-section').style.display = 'block';
            document.getElementById('phone-number-display').textContent = formatPhoneNumber(data.data.phoneNumber);
            
            // Carregar QR Code automaticamente quando número estiver cadastrado
            // Aguardar um pouco para garantir que o container está visível
            setTimeout(() => {
                loadQRCode();
            }, 500);
        } else {
            // Número não cadastrado
            document.getElementById('phone-number-form').style.display = 'block';
            document.getElementById('phone-number-info').style.display = 'none';
            document.getElementById('qrcode-section').style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        // Em caso de erro (tabela não existe ainda), mostrar formulário
        document.getElementById('phone-number-form').style.display = 'block';
        document.getElementById('phone-number-info').style.display = 'none';
        document.getElementById('qrcode-section').style.display = 'none';
    }
}

async function savePhoneNumber() {
    const phoneNumber = document.getElementById('phone-number-input').value.trim();
    
    if (!phoneNumber) {
        showNotification('Por favor, informe o número do celular', 'error');
        return;
    }

    // Validação básica
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
        showNotification('Número inválido. Use o formato: 5511999999999', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/whatsapp/config/phone`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Número cadastrado com sucesso!', 'success');
            loadWhatsAppConfig();
            
            // Aguardar um pouco e tentar carregar QR Code
            setTimeout(() => {
                loadQRCode();
                // Iniciar auto-refresh após 3 segundos se QR Code não estiver disponível
                setTimeout(() => {
                    const placeholder = document.getElementById('qrcode-placeholder');
                    if (placeholder && placeholder.textContent.includes('não disponível')) {
                        startAutoRefresh();
                    }
                }, 3000);
            }, 2000);
        } else {
            showNotification(data.error || 'Erro ao cadastrar número', 'error');
        }
    } catch (error) {
        showNotification('Erro ao cadastrar número. Verifique se a tabela foi criada.', 'error');
        console.error('Erro:', error);
    }
}

function changePhoneNumber() {
    document.getElementById('phone-number-form').style.display = 'block';
    document.getElementById('phone-number-info').style.display = 'none';
    document.getElementById('phone-number-input').value = '';
}

function formatPhoneNumber(phone) {
    // Formatar número para exibição: +55 (11) 99999-9999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) {
        const country = cleaned.substring(0, 2);
        const area = cleaned.substring(2, 4);
        const number = cleaned.substring(4);
        return `+${country} (${area}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }
    return phone;
}

// QR Code
async function loadQRCode() {
    const container = document.getElementById('qrcode-container');
    if (!container) {
        console.error('Container de QR Code não encontrado');
        return;
    }
    
    container.innerHTML = '<div id="qrcode-placeholder">Carregando QR Code...</div>';

    try {
        const response = await fetch(`${API_BASE}/whatsapp/qrcode`);
        const data = await response.json();
        
        console.log('Resposta da API QR Code:', data);

        if (data.success && data.qrCode) {
            // Parar auto-refresh quando QR Code for gerado
            stopAutoRefresh();
            
            console.log('QR Code recebido, gerando visualização...');
            
            // Usar biblioteca QRCode.js via CDN
            if (!window.QRCode) {
                const script = document.createElement('script');
                // Usar URL correta do unpkg (mais confiável)
                script.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
                script.crossOrigin = 'anonymous';
                script.onload = () => {
                    console.log('Biblioteca QRCode carregada do unpkg, gerando QR Code...');
                    if (window.QRCode) {
                        generateQRCode(data.qrCode);
                    } else {
                        console.error('QRCode não está disponível após carregar script');
                        renderQRCodeAsImage(data.qrCode, container);
                    }
                };
                script.onerror = () => {
                    console.error('Erro ao carregar biblioteca QRCode, usando API externa...');
                    renderQRCodeAsImage(data.qrCode, container);
                };
                document.head.appendChild(script);
            } else {
                generateQRCode(data.qrCode);
            }
        } else if (data.connected) {
            container.innerHTML = '<div id="qrcode-placeholder" style="color: #4caf50; font-weight: bold;">✅ WhatsApp já está conectado! Não é necessário QR Code.</div>';
            showNotification('WhatsApp já está conectado!', 'success');
        } else if (data.requiresPhoneNumber) {
            container.innerHTML = '<div id="qrcode-placeholder">Por favor, cadastre o número do celular primeiro.</div>';
            showNotification('Cadastre o número do celular antes de gerar o QR Code', 'error');
            document.getElementById('phone-number-form').style.display = 'block';
        } else {
            container.innerHTML = `
                <div id="qrcode-placeholder">
                    <p>⏳ QR Code ainda não disponível.</p>
                    <p>O WhatsApp está sendo inicializado. Isso pode levar alguns segundos.</p>
                    <p><small>Dica: O QR Code será gerado automaticamente quando o WhatsApp estiver pronto.</small></p>
                </div>
            `;
            showNotification('QR Code ainda não disponível. Aguarde alguns segundos.', 'info');
            
            // Tentar novamente após 5 segundos
            setTimeout(() => {
                loadQRCode();
            }, 5000);
        }
    } catch (error) {
        container.innerHTML = '<div id="qrcode-placeholder">Erro ao carregar QR Code. Verifique se o servidor está rodando.</div>';
        showNotification('Erro ao carregar QR Code', 'error');
        console.error('Erro:', error);
    }
}

function generateQRCode(qrData) {
    const container = document.getElementById('qrcode-container');
    if (!container) {
        console.error('Container não encontrado ao gerar QR Code');
        return;
    }
    
    if (!window.QRCode) {
        console.error('QRCode não está disponível');
        renderQRCodeAsImage(qrData, container);
        return;
    }
    
    container.innerHTML = '<canvas id="qrcode-canvas"></canvas>';
    
    const canvas = document.getElementById('qrcode-canvas');
    if (!canvas) {
        console.error('Canvas não encontrado');
        return;
    }
    
    console.log('Gerando QR Code no canvas...', qrData.substring(0, 50) + '...');
    
    QRCode.toCanvas(canvas, qrData, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, (error) => {
        if (error) {
            console.error('Erro ao gerar QR Code:', error);
            renderQRCodeAsImage(qrData, container);
        } else {
            console.log('QR Code gerado com sucesso!');
        }
    });
}

// Função alternativa para renderizar QR Code usando API externa (fallback)
function renderQRCodeAsImage(qrData, container) {
    console.log('Renderizando QR Code usando API externa (fallback)...');
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
    
    container.innerHTML = `
        <div id="qrcode-placeholder" style="text-align: center; padding: 20px;">
            <h3>QR Code Gerado</h3>
            <img src="${qrImageUrl}" 
                 alt="QR Code" 
                 style="border: 2px solid #ddd; border-radius: 5px; padding: 10px; background: white; max-width: 100%;"
                 onerror="this.parentElement.innerHTML='<p>Erro ao carregar QR Code. Use o link abaixo.</p><a href=\'${qrImageUrl}\' target=\'_blank\'>Abrir QR Code</a>'">
            <p style="margin-top: 15px;">
                <small>Escaneie o QR Code acima com seu WhatsApp</small>
            </p>
            <p style="margin-top: 10px;">
                <a href="${qrImageUrl}" 
                   target="_blank" 
                   class="btn btn-secondary btn-sm">
                    Abrir QR Code em Nova Aba
                </a>
            </p>
        </div>
    `;
}

// Mensagens Agendadas
async function loadScheduledMessages() {
    try {
        const response = await fetch(`${API_BASE}/scheduled-messages`);
        const data = await response.json();

        const listContainer = document.getElementById('scheduled-list');
        
        if (data.success && data.data && data.data.length > 0) {
            listContainer.innerHTML = data.data.map(msg => `
                <div class="scheduled-item">
                    <h3>Mensagem para ${msg.groupId}</h3>
                    <p><strong>Mensagem:</strong> ${msg.message}</p>
                    <p><strong>Agendada para:</strong> ${new Date(msg.scheduledAt).toLocaleString('pt-BR')}</p>
                    <p><strong>Status:</strong> <span class="status ${msg.status}">${msg.status}</span></p>
                    ${msg.status === 'pending' ? `<button onclick="cancelScheduledMessage('${msg.id}')" class="btn btn-danger btn-sm">Cancelar</button>` : ''}
                </div>
            `).join('');
        } else {
            listContainer.innerHTML = '<p>Nenhuma mensagem agendada.</p>';
        }
    } catch (error) {
        document.getElementById('scheduled-list').innerHTML = '<p>Erro ao carregar mensagens agendadas.</p>';
        console.error('Erro:', error);
    }
}

function showScheduleForm() {
    document.getElementById('schedule-modal').style.display = 'block';
    // Definir data mínima como agora
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('schedule-datetime').min = now.toISOString().slice(0, 16);
}

function closeScheduleForm() {
    document.getElementById('schedule-modal').style.display = 'none';
    document.getElementById('schedule-form').reset();
}

async function createScheduledMessage(event) {
    event.preventDefault();
    
    const groupId = document.getElementById('schedule-group-id').value;
    const message = document.getElementById('schedule-message').value;
    const datetime = document.getElementById('schedule-datetime').value;
    
    const scheduledAt = new Date(datetime).toISOString();

    try {
        const response = await fetch(`${API_BASE}/scheduled-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ groupId, message, scheduledAt })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Mensagem agendada com sucesso!', 'success');
            closeScheduleForm();
            loadScheduledMessages();
        } else {
            showNotification(data.error || 'Erro ao agendar mensagem', 'error');
        }
    } catch (error) {
        showNotification('Erro ao agendar mensagem', 'error');
        console.error('Erro:', error);
    }
}

async function cancelScheduledMessage(id) {
    if (!confirm('Tem certeza que deseja cancelar esta mensagem agendada?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/scheduled-messages/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Mensagem cancelada com sucesso!', 'success');
            loadScheduledMessages();
        } else {
            showNotification(data.error || 'Erro ao cancelar mensagem', 'error');
        }
    } catch (error) {
        showNotification('Erro ao cancelar mensagem', 'error');
        console.error('Erro:', error);
    }
}

// Configuração IA
async function loadAIConfig() {
    try {
        const response = await fetch(`${API_BASE}/ai/status`);
        const data = await response.json();

        if (data.success && data.data) {
            document.getElementById('ai-enabled').checked = data.data.enabled || false;
            document.getElementById('ai-respond-groups').checked = data.data.respondToGroups !== false;
            document.getElementById('ai-respond-dms').checked = data.data.respondToDMs !== false;
            document.getElementById('ai-prompt').value = data.data.systemPrompt || '';
            document.getElementById('ai-allowed-groups').value = data.data.allowedGroupIds?.join(', ') || '';
            document.getElementById('ai-use-wiki').checked = data.data.useWikiContext || false;
            document.getElementById('ai-wiki-url').value = data.data.wikiUrl || '';
            
            // Mostrar/ocultar campo de URL do wiki
            const wikiUrlGroup = document.getElementById('wiki-url-group');
            if (data.data.useWikiContext) {
                wikiUrlGroup.style.display = 'block';
            } else {
                wikiUrlGroup.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configuração da IA:', error);
    }
}

async function updateAIConfig() {
    const enabled = document.getElementById('ai-enabled').checked;
    const respondToGroups = document.getElementById('ai-respond-groups').checked;
    const respondToDMs = document.getElementById('ai-respond-dms').checked;
    const systemPrompt = document.getElementById('ai-prompt').value;
    const allowedGroupsInput = document.getElementById('ai-allowed-groups').value;
    const useWiki = document.getElementById('ai-use-wiki').checked;
    const wikiUrl = document.getElementById('ai-wiki-url').value;
    
    // Processar grupos permitidos
    const allowedGroupIds = allowedGroupsInput
        ? allowedGroupsInput.split(',').map(id => id.trim()).filter(id => id.length > 0)
        : undefined;
    
    // Mostrar/ocultar campo de URL do wiki
    const wikiUrlGroup = document.getElementById('wiki-url-group');
    if (useWiki) {
        wikiUrlGroup.style.display = 'block';
    } else {
        wikiUrlGroup.style.display = 'none';
    }

    try {
        const response = await fetch(`${API_BASE}/ai/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled,
                respondToGroups,
                respondToDMs,
                systemPrompt: systemPrompt || undefined,
                allowedGroupIds: allowedGroupIds,
                wikiUrl: wikiUrl || undefined,
                useWikiContext: useWiki
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Configuração da IA atualizada!', 'success');
            checkStatus();
        } else {
            showNotification(data.error || 'Erro ao atualizar configuração', 'error');
        }
    } catch (error) {
        showNotification('Erro ao atualizar configuração', 'error');
        console.error('Erro:', error);
    }
}

async function saveAIConfig() {
    await updateAIConfig();
}

async function toggleAI() {
    try {
        const response = await fetch(`${API_BASE}/ai/toggle`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`IA ${data.data.enabled ? 'ativada' : 'desativada'}!`, 'success');
            loadAIConfig();
            checkStatus();
        } else {
            showNotification(data.error || 'Erro ao alternar IA', 'error');
        }
    } catch (error) {
        showNotification('Erro ao alternar IA', 'error');
        console.error('Erro:', error);
    }
}

// Enviar Mensagem
async function sendMessage(event) {
    event.preventDefault();

    const to = document.getElementById('message-to').value;
    const message = document.getElementById('message-text').value;

    try {
        const response = await fetch(`${API_BASE}/whatsapp/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to, message })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Mensagem enviada com sucesso!', 'success');
            document.getElementById('send-message-form').reset();
        } else {
            showNotification(data.error || 'Erro ao enviar mensagem', 'error');
        }
    } catch (error) {
        showNotification('Erro ao enviar mensagem', 'error');
        console.error('Erro:', error);
    }
}

// Notificações
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('schedule-modal');
    if (event.target === modal) {
        closeScheduleForm();
    }
}
