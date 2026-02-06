/**
 * ATELIER KAMILLA REIS - SCRIPT DE GESTÃO
 * Refactored for Professional Use
 */

// --- CONFIGURAÇÃO E DADOS ---
const APP_CONFIG = {
    user: "adm",
    pass: "190396", // Em prod, isso viria do backend
    keys: {
        clients: 'atelier_clients',
        products: 'atelier_products',
        orders: 'atelier_orders'
    }
};

let clients = JSON.parse(localStorage.getItem(APP_CONFIG.keys.clients)) || [];
let products = JSON.parse(localStorage.getItem(APP_CONFIG.keys.products)) || [];
let orders = JSON.parse(localStorage.getItem(APP_CONFIG.keys.orders)) || [];
// let orders = JSON.parse(localStorage.getItem(APP_CONFIG.keys.orders)) || []; // Removed duplicate
let currentOrderItems = [];
let pendingPaymentId = null; // Store ID for modal action
let editingOrderId = null; // Store ID for order editing
let currentWhatsAppMessage = ""; // Store message for WhatsApp modal

// --- UTILITÁRIOS ---
const Utils = {
    formatCurrency: (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    },
    formatDate: (dateString) => {
        if (!dateString) return '-';
        return dateString.split('-').reverse().join('/');
    },
    toggleSpinner: (id, show) => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'inline-block' : 'none';
    },
    generateId: () => '_' + Math.random().toString(36).substr(2, 9)
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- AUTENTICAÇÃO ---
document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const userIn = document.getElementById('username')?.value.toLowerCase().trim();
    const passIn = document.getElementById('password')?.value;

    if (userIn === APP_CONFIG.user && passIn === APP_CONFIG.pass) {
        const remember = document.getElementById('remember-me').checked;
        if (remember) {
            localStorage.setItem('logado', 'true');
        } else {
            sessionStorage.setItem('logado', 'true');
        }
        showToast('Login realizado com sucesso!', 'success');
        iniciarApp();
    } else {
        showToast('Usuário ou senha incorretos.', 'error');
        document.getElementById('password').value = '';
    }
});

function iniciarApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    updateDashboard();
    renderClients();
    renderProducts();

    // Init Monthly Finance
    const picker = document.getElementById('finance-month-picker');
    if (picker) {
        picker.value = new Date().toISOString().slice(0, 7); // YYYY-MM
        picker.addEventListener('change', () => {
            updateMonthlyFinance();
            renderOrders();
        });
    }
    updateMonthlyFinance();
}

// --- NAVEGAÇÃO ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-target');

        // Esconde todas as seções
        document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');
        // Mostra a alvo
        document.getElementById(target).style.display = 'block';

        // Atualiza menu ativo
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Título dinâmico
        const pageTitle = link.querySelector('span')?.innerText || link.innerText;
        document.getElementById('main-title').innerText = pageTitle;

        // Hooks de navegação
        if (target === 'section-pedidos') { updateOrderSelects(); resetOrderForm(); }
        if (target === 'section-financeiro') renderOrders();
        if (target === 'section-dashboard') updateDashboard();

        // Mobile: Close sidebar after click
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('active');
            document.getElementById('sidebar-overlay').classList.remove('active');
        }
    });
});

document.getElementById('btn-sair').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Deseja realmente sair?')) {
        sessionStorage.removeItem('logado');
        localStorage.removeItem('logado');
        window.location.reload();
    }
});

// --- MOBILE MENU EVENTS ---
const mobileBtn = document.getElementById('mobile-menu-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.querySelector('.sidebar');

if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });
}

// --- GESTÃO DE CLIENTES ---
document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const data = document.getElementById('data_cadastro').value;

    if (!nome || !telefone) return;

    const idx = document.getElementById('client-index').value;

    if (idx) {
        // Edit Mode
        clients[idx] = { ...clients[idx], nome, telefone, data };
        showToast('Cliente atualizado!');
        document.getElementById('client-index').value = ''; // Clear edit mode
    } else {
        // New Mode
        clients.push({ id: Utils.generateId(), nome, telefone, data });
        showToast('Cliente cadastrado!');
    }

    localStorage.setItem(APP_CONFIG.keys.clients, JSON.stringify(clients));
    e.target.reset();
    renderClients();
    updateOrderSelects(); // Refresh dropdown
});

function renderClients() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = clients.map((c, i) => `
        <tr>
            <td><strong>${c.nome}</strong></td>
            <td>${c.telefone}</td>
            <td>
                <button onclick="editClient(${i})" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="deleteClient(${i})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.editClient = (i) => {
    const c = clients[i];
    document.getElementById('nome').value = c.nome;
    document.getElementById('telefone').value = c.telefone;
    document.getElementById('data_cadastro').value = c.data;
    document.getElementById('client-index').value = i;

    // Highlight form
    document.querySelector('.card-form').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('nome').focus();
    showToast('Editando cliente: ' + c.nome, 'info');
};

window.deleteClient = (i) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        clients.splice(i, 1);
        localStorage.setItem(APP_CONFIG.keys.clients, JSON.stringify(clients));
        renderClients();
        updateOrderSelects();
        showToast('Cliente removido.', 'success');
    }
};

// --- GESTÃO DE PRODUTOS/SERVIÇOS ---
document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('product-name').value.trim();
    const valor = parseFloat(document.getElementById('product-value').value);

    products.push({ id: Utils.generateId(), nome, valor });
    localStorage.setItem(APP_CONFIG.keys.products, JSON.stringify(products));

    showToast('Serviço adicionado!');
    e.target.reset();
    renderProducts();
});

function renderProducts() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = products.map((p, i) => `
        <tr>
            <td>${p.nome}</td>
            <td>${Utils.formatCurrency(p.valor)}</td>
            <td>
                <button onclick="deleteProduct(${i})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteProduct = (i) => {
    if (confirm('Excluir este serviço?')) {
        products.splice(i, 1);
        localStorage.setItem(APP_CONFIG.keys.products, JSON.stringify(products));
        renderProducts();
    }
};

// --- PEDIDOS ---
function updateOrderSelects() {
    const clientSelect = document.getElementById('order-client');
    const serviceSelect = document.getElementById('order-service-select');

    clientSelect.innerHTML = '<option value="" disabled selected>Selecione um cliente...</option>';
    clients.forEach((c, i) => {
        clientSelect.innerHTML += `<option value="${i}">${c.nome}</option>`;
    });

    serviceSelect.innerHTML = '<option value="" disabled selected>Escolha...</option>';
    products.forEach((p) => {
        serviceSelect.innerHTML += `<option value="${p.nome}|${p.valor}">${p.nome} - ${Utils.formatCurrency(p.valor)}</option>`;
    });
}

document.getElementById('add-service-btn').addEventListener('click', () => {
    const select = document.getElementById('order-service-select');
    const descInput = document.getElementById('order-service-desc');

    if (!select.value) {
        showToast('Selecione um serviço primeiro.', 'error');
        return;
    }

    const [nome, valor] = select.value.split('|');
    const desc = descInput.value.trim();
    const finalName = desc ? `${nome} (${desc})` : nome;

    currentOrderItems.push({ nome: finalName, valor: parseFloat(valor) });
    descInput.value = ''; // Limpa descrição, mantêm o serviço selecionado se quiser adicionar outro igual
    renderOrderItems();
});

function renderOrderItems() {
    const tbody = document.getElementById('order-items-table');
    const emptyMsg = document.getElementById('empty-cart-msg');

    if (currentOrderItems.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        document.getElementById('order-subtotal').innerText = Utils.formatCurrency(0);
        document.getElementById('order-total').innerText = Utils.formatCurrency(0);
        return;
    }

    emptyMsg.style.display = 'none';
    let sub = 0;

    tbody.innerHTML = currentOrderItems.map((item, i) => {
        sub += item.valor;
        return `
            <tr>
                <td>${item.nome}</td>
                <td style="text-align: right;">${Utils.formatCurrency(item.valor)}</td>
                <td><button onclick="removeOrderItem(${i})" style="color:var(--danger)"><i class="fas fa-times"></i></button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('order-subtotal').innerText = Utils.formatCurrency(sub);
    calculateTotal(sub);
}

window.removeOrderItem = (i) => {
    currentOrderItems.splice(i, 1);
    renderOrderItems();
};

document.getElementById('order-discount')?.addEventListener('input', () => {
    // Recalcula total sem re-renderizar tabela
    let sub = currentOrderItems.reduce((acc, item) => acc + item.valor, 0);
    calculateTotal(sub);
});

function calculateTotal(subtotal) {
    const discount = parseFloat(document.getElementById('order-discount').value) || 0;
    const total = Math.max(0, subtotal - discount);
    document.getElementById('order-total').innerText = Utils.formatCurrency(total);
    return total;
}

document.getElementById('order-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentOrderItems.length === 0) {
        showToast('Adicione pelo menos um serviço ao pedido.', 'error');
        return;
    }

    const clientIdx = document.getElementById('order-client').value;
    if (!clientIdx) { showToast('Selecione um cliente.', 'error'); return; }

    const client = clients[clientIdx];
    const subtotal = currentOrderItems.reduce((acc, item) => acc + item.valor, 0);
    const total = calculateTotal(subtotal);

    if (editingOrderId) {
        // Update Existing
        const orderIndex = orders.findIndex(o => o.id === editingOrderId);
        if (orderIndex > -1) {
            orders[orderIndex] = {
                ...orders[orderIndex],
                clientName: client.nome,
                clientPhone: client.telefone,
                entryDate: document.getElementById('order-entry-date').value,
                exitDate: document.getElementById('order-exit-date').value,
                items: [...currentOrderItems],
                total: total
            };
            showToast('Pedido atualizado!', 'success');
            editingOrderId = null;
        }
    } else {
        // Create New
        const newOrder = {
            id: Utils.generateId(),
            clientName: client.nome,
            clientPhone: client.telefone,
            entryDate: document.getElementById('order-entry-date').value,
            exitDate: document.getElementById('order-exit-date').value,
            items: [...currentOrderItems],
            total: total,
            status: 'Pendente',
            createdAt: new Date().toISOString()
        };
        orders.push(newOrder);
        showToast('Pedido finalizado com sucesso!', 'success');
        printReceipt(newOrder);
    }

    localStorage.setItem(APP_CONFIG.keys.orders, JSON.stringify(orders));
    resetOrderForm();
    updateDashboard(); // Refresh all
});

function resetOrderForm() {
    document.getElementById('order-form').reset();
    currentOrderItems = [];
    editingOrderId = null; // Clear edit state
    renderOrderItems();
}

// --- IMPRESSÃO / COMPROVANTE ---
function printReceipt(order) {
    document.getElementById('rec-client-name').innerText = order.clientName;
    document.getElementById('rec-entry').innerText = Utils.formatDate(order.entryDate);
    document.getElementById('rec-exit').innerText = Utils.formatDate(order.exitDate);

    const tbody = document.getElementById('rec-items');
    tbody.innerHTML = order.items.map(i => `
        <tr><td>${i.nome}</td><td>${Utils.formatCurrency(i.valor)}</td></tr>
    `).join('');

    document.getElementById('rec-total').innerText = Utils.formatCurrency(order.total);

    if (confirm('Deseja imprimir o comprovante agora?')) {
        window.print();
    }
}

// --- FINANCEIRO & DASHBOARD ---
function renderOrders() {
    const tbody = document.getElementById('history-table-body');
    let pendente = 0, pago = 0;

    // Sort by date (newest first)
    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Filter by Month Selection if active
    const picker = document.getElementById('finance-month-picker');
    if (picker && picker.value && document.getElementById('section-financeiro').style.display !== 'none') {
        const [year, month] = picker.value.split('-').map(Number);
        const filtered = sortedOrders.filter(o => {
            const d = new Date(o.exitDate + "T12:00:00");
            return d.getFullYear() === year && (d.getMonth() + 1) === month;
        });
        // Override sortedOrders with filtered version for display and calc
        // Only if we are strictly in "Finance" view context where this makes sense
        sortedOrders.length = 0;
        sortedOrders.push(...filtered);
    }

    tbody.innerHTML = sortedOrders.map((o, i) => {
        const isPago = o.status === 'Pago';
        if (isPago) pago += o.total; else pendente += o.total; // Restored logic

        const isPronto = o.status === 'Pronto';

        let statusColor = '#FEF2F2'; // Default Pend
        let statusText = '#991B1B';
        let statusLabel = 'PENDENTE';

        if (isPago) {
            statusColor = '#DCFCE7'; statusText = '#166534'; statusLabel = 'PAGO';
        } else if (isPronto) {
            statusColor = '#FEF9C3'; statusText = '#854D0E'; statusLabel = 'PRONTO';
        }

        let fone = o.clientPhone.replace(/\D/g, "");
        // If it starts with 55, assume it is DDI. Any other case, add 55.
        if (!fone.startsWith('55')) {
            fone = '55' + fone;
        }

        // Generate Message with Items
        const itemsList = o.items.map(i => `- ${i.nome} (${Utils.formatCurrency(i.valor)})`).join('%0A');
        const defaultMsg = `Olá *${o.clientName}*! Segue o resumo do seu pedido:%0A${itemsList}%0A%0A*Total: ${Utils.formatCurrency(o.total)}*`;
        // Simple escape for single quotes to avoid breaking HTML attribute
        const safeMsg = defaultMsg.replace(/'/g, "\\'");

        return `
            <tr>
                <td style="font-size:0.8rem; color:#999">#${o.id.substr(1, 6).toUpperCase()}</td>
                <td>
                    <div>${o.clientName}</div>
                    <div style="font-size:0.75rem; color:#888">${o.clientPhone}</div>
                </td>
                <td>${Utils.formatDate(o.exitDate)}</td>
                <td>
                    <span style="
                        background: ${statusColor}; 
                        color: ${statusText};
                        padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight:700;">
                        ${statusLabel}
                    </span>
                </td>
                <td style="font-size: 0.9rem; color: var(--text-muted);">${isPago ? (o.paymentMethod || '-') : '-'}</td>
                <td><strong>${Utils.formatCurrency(o.total)}</strong></td>
                <td>
                    <button onclick="editOrder('${o.id}')" title="Editar Pedido"><i class="fas fa-edit" style="color:#64748B;"></i></button>
                    ${!isPago && !isPronto ? `<button onclick="markAsReady('${o.id}')" title="Avisar que está Pronto" style="color: #F59E0B;"><i class="fas fa-bell"></i></button>` : ''}
                    <a href="javascript:void(0)" onclick="openWhatsAppModal('${o.clientPhone}', '${safeMsg}')" title="WhatsApp" style="margin-left:5px; text-decoration: none;">
                        <i class="fab fa-whatsapp" style="color:#25D366; font-size:1.2rem;"></i>
                    </a>
                    ${!isPago ? `<button onclick="markAsPaid('${o.id}')" title="Receber"><i class="fas fa-check" style="color:#10B981"></i></button>` : ''}
                    <button onclick="deleteOrder('${o.id}')" title="Excluir"><i class="fas fa-trash" style="color:var(--danger)"></i></button>
                </td>
            </tr>`;
    }).join('');

    document.getElementById('fin-total-pendente').innerText = Utils.formatCurrency(pendente);
    document.getElementById('fin-total-pago').innerText = Utils.formatCurrency(pago);
}

window.markAsPaid = (id) => {
    pendingPaymentId = id;
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset select to default or previous value if desired
        document.getElementById('payment-method-select').value = 'Pix';
    }
};

window.closePaymentModal = () => {
    document.getElementById('payment-modal').style.display = 'none';
    pendingPaymentId = null;
};

window.confirmPayment = () => {
    if (!pendingPaymentId) return;

    const order = orders.find(o => o.id === pendingPaymentId);
    const method = document.getElementById('payment-method-select').value;

    if (order) {
        order.status = 'Pago';
        order.paidAt = new Date().toISOString();
        order.paymentMethod = method; // Save method

        localStorage.setItem(APP_CONFIG.keys.orders, JSON.stringify(orders));
        renderOrders();
        updateDashboard();
        updateMonthlyFinance();

        showToast(`Pagamento via ${method} confirmado!`, 'success');
    }
    closePaymentModal();
};

window.deleteOrder = (id) => {
    if (confirm("Essa ação não pode ser desfeita. Excluir pedido?")) {
        orders = orders.filter(o => o.id !== id);
        localStorage.setItem(APP_CONFIG.keys.orders, JSON.stringify(orders));
        renderOrders();
        updateDashboard();
        updateMonthlyFinance(); // Update summary
        showToast('Pedido excluído.', 'success');
    }
};

window.editOrder = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Load Data
    document.getElementById('order-entry-date').value = order.entryDate;
    document.getElementById('order-exit-date').value = order.exitDate;

    // Find Client Index
    const clientIdx = clients.findIndex(c => c.nome === order.clientName); // Simple match
    if (clientIdx > -1) document.getElementById('order-client').value = clientIdx;

    currentOrderItems = [...order.items];
    editingOrderId = id;

    // UI Switch
    document.querySelector('[data-target="section-pedidos"]').click();
    renderOrderItems();
    showToast('Editando pedido #' + id.substr(1, 6).toUpperCase(), 'info');
};

window.markAsReady = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    order.status = 'Pronto';
    localStorage.setItem(APP_CONFIG.keys.orders, JSON.stringify(orders));

    renderOrders();
    updateDashboard();

    // Generate WhatsApp Message
    const itemsList = order.items.map(i => `- ${i.nome} (${Utils.formatCurrency(i.valor)})`).join('%0A');
    const msg = `Olá *${order.clientName}*! 👋%0A%0ASeu pedido no Atelier está *PRONTO*! 🧵 ✨%0A%0AServiços:%0A${itemsList}%0A%0A*Total: ${Utils.formatCurrency(order.total)}*%0A%0AEstamos aguardando você! 🥰`;

    let fone = order.clientPhone.replace(/\D/g, "");
    if (!fone.startsWith('55')) {
        fone = '55' + fone;
    }

    const url = `https://wa.me/${fone}?text=${msg}`;
    // window.open(url, '_blank'); // Replaced by Modal

    openWhatsAppModal(fone, msg); // Open Modal instead of direct link

    showToast('Pedido marcado como Pronto!', 'success');
};

// --- WHATSAPP MODAL LOGIC ---
window.openWhatsAppModal = (phone, msg) => {
    const modal = document.getElementById('whatsapp-modal');
    if (!modal) return;

    // Clean phone first
    let cleanPhone = phone.replace(/\D/g, "");

    // SMART DISPLAY LOGIC:
    // User wants to see "11 99999-9999", not "55 11 99999-9999"
    // Heuristic: If starts with 55 AND length is >= 12 (55 + 10 digits), we STRIP the 55 for display.
    // If user saved "55 55 9999..." -> It becomes "55 9999..." (DDD 55).

    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        cleanPhone = cleanPhone.substring(2);
    }

    document.getElementById('whatsapp-number-input').value = cleanPhone;
    currentWhatsAppMessage = msg || "";

    modal.style.display = 'flex';
    document.getElementById('whatsapp-number-input').focus();
};

window.closeWhatsAppModal = () => {
    document.getElementById('whatsapp-modal').style.display = 'none';
    currentWhatsAppMessage = "";
};

window.confirmWhatsApp = () => {
    const input = document.getElementById('whatsapp-number-input');
    let phone = input.value.replace(/\D/g, "");

    if (phone.length < 10) {
        alert("Número parece inválido (curto demais). Verifique DDD + Número.");
        return;
    }

    // ON SEND LOGIC:
    // If user typed "11999999999" (11 chars), we Add 55.
    // If user typed "551199999..." (13 chars), we Leave it.

    if (!phone.startsWith('55') || phone.length <= 11) {
        // Assume missing country code if it doesn't start with 55 OR if it is short (DDD+Num only)
        // Wait, if phone is "5599999999" (DDD 55), length is 10. Starts with 55.
        // If we strictly rely on length:
        // Length 10 or 11 = DDD + Number -> ADD 55.
        // Length 12 or 13 = 55 + DDD + Number -> KEEP.

        if (phone.length <= 11) {
            phone = "55" + phone;
        }
    }

    let url = `https://wa.me/${phone}`;
    if (currentWhatsAppMessage) {
        url += `?text=${currentWhatsAppMessage}`;
    }

    window.open(url, '_blank');
    closeWhatsAppModal();
};

// --- RESUMO MENSAL ---
function updateMonthlyFinance() {
    const picker = document.getElementById('finance-month-picker');
    if (!picker || !picker.value) return;

    const [year, month] = picker.value.split('-').map(Number);

    // Filter based on Exit Date (Competence)
    const monthlyOrders = orders.filter(o => {
        const d = new Date(o.exitDate + "T12:00:00"); // Avoid timezone issues
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    let qtd = 0;
    let received = 0;
    let pending = 0;

    monthlyOrders.forEach(o => {
        qtd++;
        if (o.status === 'Pago') {
            received += o.total;
        } else {
            pending += o.total;
        }
    });

    document.getElementById('month-qtd').innerText = qtd;
    document.getElementById('month-received').innerText = Utils.formatCurrency(received);
    document.getElementById('month-pending').innerText = Utils.formatCurrency(pending);
}

function updateDashboard() {
    // document.getElementById('dash-total-clientes').innerText = clients.length; // Element removed from HTML

    // --- DASHBOARD LOGIC (V2) ---
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const mesAtual = new Date().getMonth();

    // 1. Entregas Hoje (Blue Card) / Pedidos Hoje
    let urgentes = 0;
    let pedidosHoje = 0;

    // Calculate logic
    orders.forEach(o => {
        if (o.status === 'Pendente') {
            const dataEntrega = new Date(o.exitDate + "T00:00:00");
            const diffDias = Math.ceil((dataEntrega - hoje) / (1000 * 60 * 60 * 24));
            if (diffDias <= 2 && diffDias >= 0) urgentes++;
        }
        const dataPedido = new Date(o.createdAt);
        if (dataPedido.toDateString() === new Date().toDateString()) pedidosHoje++;
    });

    const entregasHoje = orders.filter(o => o.status === 'Pendente' && new Date(o.exitDate + "T00:00:00").toDateString() === hoje.toDateString()).length;
    // We use the same ID 'dash-pedidos-hoje' but context is 'Entregas Hoje' now
    document.getElementById('dash-pedidos-hoje').innerText = entregasHoje;

    // 2. Concluídos este mês (Grey 1)
    // Counts orders Paid where payment date is in current month (or created in current month if paid date missing)
    const concluidosMes = orders.filter(o => {
        if (o.status !== 'Pago') return false;
        const dateToCheck = o.paidAt ? new Date(o.paidAt) : new Date(o.createdAt);
        return dateToCheck.getMonth() === mesAtual && dateToCheck.getFullYear() === hoje.getFullYear();
    }).length;
    document.getElementById('dash-concluidos-mes').innerText = concluidosMes;

    // 3. Aguardando Retirada (Grey 2) - Pendentes + Pronto
    const totalPend = orders.filter(o => o.status === 'Pendente' || o.status === 'Pronto').length;
    document.getElementById('dash-pendentes').innerText = totalPend;

    // 4. Previstas Semana (Grey 3)
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(hoje.getDate() + 7);
    const previstasSemana = orders.filter(o => {
        if (o.status !== 'Pendente') return false;
        const d = new Date(o.exitDate + "T00:00:00");
        return d >= hoje && d <= oneWeekFromNow;
    }).length;
    document.getElementById('dash-previsao-semana').innerText = previstasSemana;

    // --- LISTA PEDIDOS EM ANDAMENTO ---
    const recentList = document.getElementById('dashboard-recent-list');
    const activeOrders = orders.filter(o => o.status === 'Pendente').sort((a, b) => new Date(a.exitDate) - new Date(b.exitDate));

    if (activeOrders.length === 0) {
        recentList.innerHTML = '<div style="padding:20px; text-align:center; color:#94A3B8;">Nenhum pedido em andamento.</div>';
    } else {
        recentList.innerHTML = activeOrders.slice(0, 5).map((o, i) => {
            const entryDate = Utils.formatDate(o.entryDate).slice(0, 5); // dd/mm
            const diffDays = Math.ceil((new Date(o.exitDate + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24));
            const badgeColor = diffDays < 0 ? '#DC2626' : (diffDays <= 2 ? '#EA580C' : '#3B82F6'); // Red (Late), Orange (Soon), Blue (Safe)

            return `
            <div class="recent-item">
                <div class="item-icon"><i class="fas fa-file-alt"></i></div>
                <div class="item-index">${i + 1}</div>
                <div class="item-name">${o.clientName}</div>
                
                <div class="item-badges">
                    <div class="date-badge" style="background:${badgeColor}">
                         <i class="far fa-calendar-alt"></i> ${Utils.formatDate(o.exitDate).slice(0, 5)}
                    </div>
                </div>

                <div class="action-check" onclick="markAsPaid('${o.id}')" title="Concluir/Receber">
                    <i class="fas fa-check"></i>
                </div>
                <!-- Removed Flag Action for Cleaner Look -->
            </div>`;
        }).join('');
    }

    // Alerta Sirene
    const alertBox = document.getElementById('dashboard-alerts');
    if (urgentes > 0) {
        alertBox.innerHTML = `
            <div class="alert-box">
                <i class="fas fa-exclamation-triangle"></i> 
                ATENÇÃO: ${urgentes} entregas para Hoje ou Amanhã!
            </div>`;
    } else {
        alertBox.innerHTML = '';
    }
}

// --- BUSCA ---
// Generic Filter Function
function setupFilter(inputId, tableBodyId) {
    document.getElementById(inputId)?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll(`#${tableBodyId} tr`);

        Utils.toggleSpinner(inputId.replace('search', 'spinner'), true);

        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
            Utils.toggleSpinner(inputId.replace('search', 'spinner'), false);
        }, 300);
    });
}

// --- BACKUP ---
window.exportData = () => {
    const data = {
        clients: localStorage.getItem(APP_CONFIG.keys.clients),
        products: localStorage.getItem(APP_CONFIG.keys.products),
        orders: localStorage.getItem(APP_CONFIG.keys.orders)
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_atelier_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
};

window.importData = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.clients) localStorage.setItem(APP_CONFIG.keys.clients, data.clients);
            if (data.products) localStorage.setItem(APP_CONFIG.keys.products, data.products);
            if (data.orders) localStorage.setItem(APP_CONFIG.keys.orders, data.orders);

            alert('Dados restaurados! A página será recarregada.');
            window.location.reload();
        } catch (err) {
            alert('Erro ao ler arquivo de backup.');
        }
    };
    reader.readAsText(file);
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('logado') === 'true' || localStorage.getItem('logado') === 'true') {
        iniciarApp();
    }
    setupFilter('search-client', 'table-body');
    setupFilter('search-order', 'history-table-body');
});