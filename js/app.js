const BAKIM_MODU = false;
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby3kd04k2u9XdVDD1-vdbQQAsHNW6WLIn8bNYxTlVCL3U1a0WqZo6oPp9zfBWIpwJEinQ/exec";

// --- OYUN DEĞİŞKENLERİ ---
let jokers = { call: 1, half: 1, double: 1 };
let doubleChanceUsed = false;
let firstAnswerIndex = -1;
let pScore = 0, pBalls = 10, pCurrentQ = null;

const VALID_CATEGORIES = ['Teknik', 'İkna', 'Kampanya', 'Bilgi'];
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// --- GLOBAL DEĞİŞKENLER ---
let database = [], newsData = [], sportsData = [], salesScripts = [], quizQuestions = [];
let currentUser = "";
let isAdminMode = false;
let isEditingActive = false;
let sessionTimeout;
let activeCards = [];
let currentCategory = 'all';
let adminUserList = [];
let allEvaluationsData = []; // Tüm veriyi burada tutacağız
let wizardStepsData = {};

// ... (Login, Oyun, Wizard, Slider fonksiyonları - DEĞİŞMEDİ - Aynı kalacak) ...
window.updateRowScore = function(index, max) {
    const slider = document.getElementById(`slider-${index}`);
    const badge = document.getElementById(`badge-${index}`);
    const noteInput = document.getElementById(`note-${index}`);
    const row = document.getElementById(`row-${index}`);
    if(!slider) return;
    const val = parseInt(slider.value);
    badge.innerText = val;
    if (val < max) {
        if(noteInput) noteInput.style.display = 'block';
        badge.style.background = '#d32f2f'; 
        if(row) { row.style.borderColor = '#ffcdd2'; row.style.background = '#fff5f5'; }
    } else {
        if(noteInput) { noteInput.style.display = 'none'; noteInput.value = ''; }
        badge.style.background = '#2e7d32'; 
        if(row) { row.style.borderColor = '#eee'; row.style.background = '#fff'; }
    }
    window.recalcTotalScore();
};

window.recalcTotalScore = function() {
    let currentTotal = 0;
    let maxTotal = 0;
    const sliders = document.querySelectorAll('.slider-input');
    sliders.forEach(s => {
        currentTotal += parseInt(s.value) || 0;
        maxTotal += parseInt(s.getAttribute('max')) || 0;
    });
    const liveScoreEl = document.getElementById('live-score');
    const ringEl = document.getElementById('score-ring');
    if(liveScoreEl) liveScoreEl.innerText = currentTotal;
    if(ringEl) {
        let color = '#2e7d32';
        let ratio = maxTotal > 0 ? (currentTotal / maxTotal) * 100 : 0;
        if(ratio < 50) color = '#d32f2f';
        else if(ratio < 85) color = '#ed6c02';
        else if(ratio < 95) color = '#fabb00';
        ringEl.style.background = `conic-gradient(${color} ${ratio}%, #444 ${ratio}%)`;
    }
};

// ... (Helper fonksiyonlar: getToken, getFavs, toggleFavorite, isFav, formatDate, isNew, getCategorySelectHtml, escapeForJsString) ...
function getToken() { return localStorage.getItem("sSportToken"); }
function getFavs() { return JSON.parse(localStorage.getItem('sSportFavs') || '[]'); }
function toggleFavorite(title) {
    event.stopPropagation();
    let favs = getFavs();
    if (favs.includes(title)) favs = favs.filter(t => t !== title); else favs.push(title);
    localStorage.setItem('sSportFavs', JSON.stringify(favs));
    if (currentCategory === 'fav') { const btn = document.querySelector('.btn-fav'); if(btn) filterCategory(btn, 'fav'); } else { renderCards(activeCards); }
}
function isFav(title) { return getFavs().includes(title); }
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return 'N/A';
    if (dateString.match(/^\d{2}\.\d{2}\.\d{4}/)) return dateString;
    try { const d = new Date(dateString); return isNaN(d) ? dateString : `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return dateString; }
}
function isNew(dateStr) { /* ... */ return false; } // Kısaltıldı
function getCategorySelectHtml(c,id) { /* ... */ return ''; } // Kısaltıldı
function escapeForJsString(t) { return t ? t.toString().replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/"/g, '\\"') : ""; }

document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) { if(e.keyCode == 123) return false; }
document.addEventListener('DOMContentLoaded', () => { checkSession(); });

// --- SESSION & LOGIN (Aynı) ---
function checkSession() {
    const savedUser = localStorage.getItem("sSportUser");
    const savedToken = localStorage.getItem("sSportToken");
    const savedRole = localStorage.getItem("sSportRole");
    if (savedUser && savedToken) {
        currentUser = savedUser;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("user-display").innerText = currentUser;
        checkAdmin(savedRole);
        startSessionTimer();
        if (BAKIM_MODU) document.getElementById("maintenance-screen").style.display = "flex";
        else { document.getElementById("main-app").style.display = "block"; loadContentData(); loadWizardData(); }
    }
}
function enterBas(e) { if (e.key === "Enter") girisYap(); }
function girisYap() {
    const uName = document.getElementById("usernameInput").value.trim();
    const uPass = document.getElementById("passInput").value.trim();
    if(!uName || !uPass) { document.getElementById("error-msg").style.display = "block"; return; }
    document.getElementById("loading-msg").style.display = "block";
    const hashedPass = CryptoJS.SHA256(uPass).toString();
    fetch(SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "login", username: uName, password: hashedPass }) })
    .then(r => r.json()).then(d => {
        if (d.result === "success") {
            currentUser = d.username;
            localStorage.setItem("sSportUser", currentUser);
            localStorage.setItem("sSportToken", d.token);
            localStorage.setItem("sSportRole", d.role);
            if (d.forceChange) changePasswordPopup(true);
            else { location.reload(); }
        } else { document.getElementById("error-msg").style.display = "block"; document.getElementById("loading-msg").style.display = "none"; }
    });
}
function checkAdmin(role) {
    isAdminMode = (role === "admin");
    const add = document.getElementById('dropdownAddCard');
    const edit = document.getElementById('dropdownQuickEdit');
    if(isAdminMode) { if(add) add.style.display='flex'; if(edit) edit.style.display='flex'; }
}
function logout() { localStorage.clear(); location.reload(); }
function startSessionTimer() { if (sessionTimeout) clearTimeout(sessionTimeout); sessionTimeout = setTimeout(() => { Swal.fire('Oturum doldu').then(()=>logout()); }, 3600000); }

// --- DATA FETCHING (Aynı) ---
function loadContentData() { /* ... Mevcut kodun aynısı ... */ 
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "fetchData" }) }).then(r=>r.json()).then(d=>{
        if(d.result==="success") {
            // Verileri parse et
            const raw = d.data;
            database = raw.filter(i => ['card','bilgi','teknik','kampanya','ikna'].includes(i.Type.toLowerCase())).map(i => ({ title: i.Title, category: i.Category, text: i.Text, script: i.Script, code: i.Code, link: i.Link, date: formatDateToDDMMYYYY(i.Date) }));
            newsData = raw.filter(i => i.Type.toLowerCase() === 'news');
            sportsData = raw.filter(i => i.Type.toLowerCase() === 'sport');
            salesScripts = raw.filter(i => i.Type.toLowerCase() === 'sales');
            quizQuestions = raw.filter(i => i.Type.toLowerCase() === 'quiz').map(i => ({ q: i.Text, opts: i.QuizOptions ? i.QuizOptions.split(',') : [], a: parseInt(i.QuizAnswer) }));
            activeCards = database;
            renderCards(database);
            startTicker();
        }
    });
}
function loadWizardData() { fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getWizardData" }) }).then(r=>r.json()).then(d => { if(d.result==="success") wizardStepsData = d.steps; }); }

// --- RENDER & FILTERING (Aynı) ---
function renderCards(data) { 
    const c = document.getElementById('cardGrid'); c.innerHTML = '';
    if(data.length===0) { c.innerHTML='<div style="color:#777;">Kayıt yok.</div>'; return; }
    data.forEach((item,i) => {
        // Kart HTML oluşturma kodu...
        c.innerHTML += `<div class="card ${item.category}"><div class="card-header"><h3>${item.title}</h3><span class="badge">${item.category}</span></div><div class="card-content" onclick="showCardDetail('${escapeForJsString(item.title)}','${escapeForJsString(item.text)}')">${item.text}</div><div class="script-box">${item.script||''}</div><div class="card-actions"><button class="btn btn-copy" onclick="copyText('${escapeForJsString(item.script)}')">Kopyala</button></div></div>`;
    });
}
function showCardDetail(t,x) { Swal.fire({title:t, html:x.replace(/\n/g,'<br>')}); }
function copyText(t) { navigator.clipboard.writeText(t); Swal.fire({toast:true, icon:'success', title:'Kopyalandı', timer:1000, showConfirmButton:false}); }
function filterCategory(btn, cat) { currentCategory=cat; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); filterContent(); }
function filterContent() { 
    const s = document.getElementById('searchInput').value.toLowerCase();
    let f = database.filter(i => (currentCategory==='all' || i.category===currentCategory) && (i.title.toLowerCase().includes(s) || i.text.toLowerCase().includes(s)));
    renderCards(f);
}

// --- YENİLENMİŞ KALİTE DASHBOARD ---

function openQualityArea() {
    document.getElementById('quality-modal').style.display = 'flex';
    document.getElementById('admin-quality-controls').style.display = isAdminMode ? 'flex' : 'none';
    
    // Ay Filtresi Doldur
    const selectEl = document.getElementById('month-select-filter');
    selectEl.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        let val = `${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
        let txt = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        selectEl.add(new Option(txt, val));
    }
    
    // Grup Filtresi Doldur (Sadece Admin)
    const groupSelect = document.getElementById('group-select-filter');
    if(groupSelect) {
        groupSelect.innerHTML = '<option value="all">Tüm Gruplar</option>';
        groupSelect.style.display = isAdminMode ? 'block' : 'none';
    }

    if (isAdminMode) {
        fetchUserListForAdmin().then(users => {
            // 1. Grupları doldur
            const groups = [...new Set(users.map(u => u.group).filter(g => g))];
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = g;
                groupSelect.appendChild(opt);
            });

            // 2. İlk başta "Tüm Temsilciler"i doldur
            populateAgentSelect(users);
            
            // 3. TÜM VERİYİ ÇEK (Admin için 'all') - Kritik Nokta Burası
            fetchEvaluationsForAgent('all');
        });
    } else {
        // Normal kullanıcı sadece kendi verisi
        fetchEvaluationsForAgent(currentUser);
    }
}

function populateAgentSelect(users) {
    const selectEl = document.getElementById('agent-select-admin');
    selectEl.innerHTML = `<option value="all">-- Tüm Temsilciler --</option>` +
        users.map(u => `<option value="${u.name}" data-group="${u.group}">${u.name} (${u.group})</option>`).join('');
}

function filterAgentsByGroup() {
    const selectedGroup = document.getElementById('group-select-filter').value;
    let filteredUsers = adminUserList;
    
    if (selectedGroup !== 'all') {
        filteredUsers = adminUserList.filter(u => u.group === selectedGroup);
    }
    
    populateAgentSelect(filteredUsers);
    // Grubu değiştirdiğinde, UI'ı o gruba göre güncelle (API çağrısı yapmadan, çünkü tüm veri zaten var)
    updateDashboardUI();
}

function fetchEvaluationsForAgent(forcedName) {
    const listEl = document.getElementById('evaluations-list-dashboard');
    listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-circle-notch fa-spin"></i> Veriler yükleniyor...</div>';
    
    // Admin ise HER ZAMAN 'all' çekiyoruz ki sıralama yapabilelim. Filtrelemeyi JS tarafında yapacağız.
    // Normal kullanıcı ise sadece kendi ismini gönderiyoruz.
    let targetRequest = isAdminMode ? 'all' : currentUser;
    
    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "fetchEvaluations", targetAgent: targetRequest, username: currentUser, token: getToken() })
    }).then(r => r.json()).then(data => {
        if (data.result === "success") {
            allEvaluationsData = data.evaluations;
            // Veri geldi, şimdi seçili filtrelere göre ekranı güncelle
            updateDashboardUI();
        } else {
            listEl.innerHTML = '<div style="text-align:center; color:red;">Veri alınamadı.</div>';
        }
    }).catch(err => {
        listEl.innerHTML = '<div style="text-align:center; color:red;">Bağlantı hatası.</div>';
    });
}

// *** ANA MANTIK BURADA ***
function updateDashboardUI() {
    const monthFilter = document.getElementById('month-select-filter').value;
    const selectedGroup = isAdminMode ? document.getElementById('group-select-filter').value : null;
    const selectedAgent = isAdminMode ? document.getElementById('agent-select-admin').value : currentUser;
    
    // 1. ADIM: Önce AY'a ve GRUBA göre filtrele (Sıralama Tablosu için)
    // Bu veri seti, o gruptaki HERKESİ içermeli.
    const groupData = allEvaluationsData.filter(item => {
        if(!item.date) return false;
        const parts = item.date.split('.'); 
        const isMonthMatch = (parts.length >= 3 && `${parts[1]}.${parts[2]}` === monthFilter);
        if (!isMonthMatch) return false;

        // Grup Kontrolü
        if (isAdminMode && selectedGroup && selectedGroup !== 'all') {
            let itemGroup = item.group;
            // Veride grup yoksa listeden bul
            if (!itemGroup && adminUserList.length > 0) {
                const u = adminUserList.find(u => u.name === (item.agent || item.agentName));
                if(u) itemGroup = u.group;
            }
            return itemGroup === selectedGroup;
        }
        return true;
    });

    // 2. ADIM: Sıralama Tablosunu Oluştur (groupData kullanarak)
    updateRankingTable(groupData, selectedAgent);

    // 3. ADIM: Şimdi SEÇİLİ TEMSİLCİYE göre filtrele (Sol Liste ve Kartlar için)
    let displayedData = groupData;
    if (selectedAgent && selectedAgent !== 'all') {
        displayedData = groupData.filter(item => (item.agent === selectedAgent || item.agentName === selectedAgent));
    }

    // 4. ADIM: Kartları ve Sol Listeyi Güncelle
    updateKPIsAndList(displayedData, displayedData.length);
}

function updateRankingTable(data, activeAgentName) {
    const rankBody = document.getElementById('group-ranking-body');
    rankBody.innerHTML = '';
    const groupNameEl = document.getElementById('ranking-group-name');
    
    if (isAdminMode) {
        const grp = document.getElementById('group-select-filter').value;
        groupNameEl.innerText = grp === 'all' ? '(Tümü)' : `(${grp})`;
    } else {
        // Normal kullanıcı için kendi grubunu bul
        const myRec = data.find(d => d.agent === currentUser || d.agentName === currentUser);
        groupNameEl.innerText = myRec ? `(${myRec.group})` : '';
    }

    if (data.length === 0) {
        rankBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">Veri yok.</td></tr>';
        return;
    }

    // Kişi bazlı grupla
    let stats = {};
    data.forEach(d => {
        let name = d.agent || d.agentName;
        if (!stats[name]) stats[name] = { total: 0, count: 0 };
        stats[name].total += (parseInt(d.score) || 0);
        stats[name].count++;
    });

    // Ortalamaya göre sırala
    let ranking = Object.keys(stats).map(key => ({
        name: key,
        avg: (stats[key].total / stats[key].count).toFixed(1)
    })).sort((a, b) => b.avg - a.avg);

    // Tabloyu yaz
    ranking.forEach((r, idx) => {
        let icon = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx+1}`));
        // Eğer listedeki isim şu an seçili olan temsilciyse sarı yap
        let style = (r.name === activeAgentName) ? 'background-color:#fff9c4; font-weight:bold;' : '';
        
        rankBody.innerHTML += `
            <tr style="border-bottom:1px solid #eee; ${style}">
                <td style="padding:8px;">${icon}</td>
                <td style="padding:8px;">${r.name}</td>
                <td style="padding:8px; text-align:right;">${r.avg}</td>
            </tr>
        `;
    });
}

function updateKPIsAndList(data, totalCount) {
    // İstatistikler
    let totalScore = 0;
    let scores = data.map(i => parseInt(i.score) || 0);
    if (totalCount > 0) totalScore = scores.reduce((a, b) => a + b, 0);

    const avg = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : 0;
    const targetRate = totalCount > 0 ? ((scores.filter(s => s >= 90).length / totalCount) * 100).toFixed(0) : 0;

    document.getElementById('dash-total-score').innerText = avg;
    document.getElementById('dash-total-score').style.color = avg >= 90 ? 'var(--success)' : (avg >= 80 ? 'var(--warning)' : 'var(--accent)');
    document.getElementById('dash-total-count').innerText = totalCount;
    document.getElementById('dash-target-rate').innerText = `%${targetRate}`;

    // Sol Liste (Detaylı)
    const listEl = document.getElementById('evaluations-list-dashboard');
    listEl.innerHTML = '';

    if (totalCount === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#ccc;">Kayıt bulunamadı.</div>';
    } else {
        // Yeniden eskiye
        data.slice().reverse().forEach(item => {
            let badgeClass = item.score >= 90 ? 'score-green' : (item.score >= 70 ? 'score-yellow' : 'score-red');
            let agentName = item.agent || item.agentName;
            let callDate = item.callDate || item.date; // Call date varsa onu kullan

            let html = `
                <div class="dash-list-item" onclick="showEvaluationDetail('${item.callId}')">
                    <div style="display:flex; align-items:center; gap:10px; width:50%;">
                        <div style="width:35px; height:35px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#64748b; font-weight:bold;">
                            ${agentName.charAt(0)}
                        </div>
                        <div>
                            <div style="font-weight:bold; color:#334155; font-size:0.9rem;">${agentName}</div>
                            <div style="font-size:0.75rem; color:#94a3b8;">ID: ${item.callId || '-'}</div>
                        </div>
                    </div>
                    <div style="font-size:0.8rem; color:#64748b;">${callDate}</div>
                    <div>
                        <span class="dash-score-badge ${badgeClass}">${item.score}</span>
                    </div>
                </div>`;
            listEl.innerHTML += html;
        });
    }
    

// --- GÜZELLEŞTİRİLMİŞ DETAY POPUP ---
function showEvaluationDetail(callId) {
    const item = allEvaluationsData.find(i => i.callId == callId);
    if (!item) return;

    let detailHtml = '';
    try {
        const details = JSON.parse(item.details);
        detailHtml = '<div style="margin-top:10px; border-top:1px solid #eee;">';
        details.forEach(d => {
            let scoreColor = d.score < d.max ? '#dc2626' : '#16a34a'; // Kırmızı / Yeşil
            let noteHtml = d.note ? `<div style="font-size:0.75rem; color:#dc2626; margin-top:2px; font-style:italic;">⚠️ ${d.note}</div>` : '';
            
            detailHtml += `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                    <div style="width:85%; font-size:0.9rem; color:#334155;">
                        ${d.q}
                        ${noteHtml}
                    </div>
                    <div style="font-weight:800; font-size:0.95rem; color:${scoreColor}; white-space:nowrap;">
                        ${d.score} / ${d.max}
                    </div>
                </div>
            `;
        });
        detailHtml += '</div>';
    } catch(e) {
        detailHtml = `<p>${item.details}</p>`;
    }

    let editBtn = isAdminMode ? `<button onclick="editEvaluation('${item.callId}')" class="swal2-confirm swal2-styled" style="background-color:#0e1b42; margin-top:10px;">Düzenle</button>` : '';

    Swal.fire({
        title: `<strong>Detaylar (ID: ${item.callId})</strong>`,
        html: `
            <div style="text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:10px;">
                    <div>
                        <span style="font-size:0.8rem; color:#64748b; display:block;">Değerlendirme Tarihi</span>
                        <strong style="color:#0f172a;">${item.date}</strong>
                    </div>
                    <div>
                        <span style="font-size:0.8rem; color:#64748b; display:block;">Çağrı Tarihi</span>
                        <strong style="color:#0f172a;">${item.callDate || '-'}</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.5rem; font-weight:900; color:${item.score>=90?'#16a34a':(item.score>=70?'#ca8a04':'#dc2626')}">${item.score} Puan</span>
                    </div>
                </div>
                
                ${detailHtml}
                
                <div style="margin-top:15px; background:#eff6ff; padding:12px; border-radius:8px; border-left:4px solid #3b82f6;">
                    <strong style="color:#1e40af; font-size:0.85rem;">Geri Bildirim:</strong>
                    <p style="margin:5px 0 0 0; font-size:0.9rem; color:#334155;">${item.feedback || 'Geri bildirim girilmemiş.'}</p>
                </div>
                <div style="text-align:right; margin-top:10px;">${editBtn}</div>
            </div>
        `,
        width: '700px',
        showConfirmButton: false,
        showCloseButton: true
    });
}

function fetchUserListForAdmin() {
    return new Promise((resolve) => {
        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getUserList", username: currentUser, token: getToken() })
        }).then(r => r.json()).then(data => {
            if (data.result === "success") {
                const filteredUsers = data.users.filter(u => u.group !== 'Yönetim');
                adminUserList = filteredUsers;
                resolve(filteredUsers);
            } else resolve([]);
        }).catch(() => resolve([]));
    });
}

function fetchCriteria(groupName) {
    return new Promise((resolve) => {
        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getCriteria", group: groupName, username: currentUser, token: getToken() })
        }).then(r => r.json()).then(data => resolve(data.result==="success" ? data.criteria : [])).catch(() => resolve([]));
    });
}

// --- LOG EVALUATION & EDIT ---
async function logEvaluationPopup() {
    const selectEl = document.getElementById('agent-select-admin');
    const agentName = selectEl.value;
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    let agentGroup = selectedOption.getAttribute('data-group') || 'Genel';
    
    if (agentGroup === 'Chat') {
        const { value: selectedChatType } = await Swal.fire({
            title: 'Chat Form Tipi Seçin',
            input: 'radio',
            inputOptions: {'Chat-Normal': 'Chat - Normal İşlem', 'Chat-Teknik': 'Chat - Teknik Destek'},
            inputValidator: (value) => !value && 'Bir form tipi seçmelisiniz!',
            showCancelButton: true
        });
        if (!selectedChatType) return;
        agentGroup = selectedChatType;
    }
    
    Swal.fire({ title: 'Form Hazırlanıyor...', didOpen: () => Swal.showLoading() });
    
    let criteriaList = [];
    if(['Telesatış', 'Chat-Normal', 'Chat-Teknik'].includes(agentGroup)) { 
        criteriaList = await fetchCriteria(agentGroup);
    } 
    Swal.close();
    
    const isCriteriaBased = criteriaList.length > 0;
    
    let criteriaFieldsHtml = '';
    if (isCriteriaBased) {
        criteriaFieldsHtml += `<div class="criteria-container">`;
        criteriaList.forEach((c,i) => {
            let pts = parseInt(c.points) || 0;
            criteriaFieldsHtml += `
            <div class="criteria-row" id="row-${i}">
                <div class="criteria-header"><span>${i+1}. ${c.text}</span><span style="font-size:0.8rem; color:#999;">Max: ${pts}</span></div>
                <div class="criteria-controls">
                    <input type="range" class="custom-range slider-input" id="slider-${i}" min="0" max="${pts}" value="${pts}" data-index="${i}" oninput="updateRowScore(${i}, ${pts})">
                    <span class="score-badge" id="badge-${i}">${pts}</span>
                </div>
                <input type="text" id="note-${i}" class="note-input" placeholder="Kırılım nedeni..." style="display:none; margin-top:5px;">
            </div>`;
        });
        criteriaFieldsHtml += `</div>`;
    } else {
        criteriaFieldsHtml = `
        <div style="padding:15px; border:1px dashed #ccc; background:#fff; margin-bottom:15px; text-align:center;">
            <p style="color:#e65100; font-size:0.9rem;">(Otomatik kriter bulunamadı, manuel puanlama aktif)</p>
            <label style="font-weight:bold;">Puan</label><br>
            <input id="eval-manual-score" type="number" class="swal2-input" value="100" min="0" max="100" style="width:100px; text-align:center; font-size:1.5rem; font-weight:bold;">
        </div>
        <textarea id="eval-details" class="swal2-textarea" placeholder="Değerlendirme detayları..." style="margin-bottom:15px;"></textarea>`;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Değerlendirme',
        html: `
        <div class="eval-modal-wrapper">
            <div class="score-dashboard" style="margin-bottom:10px;">
                 <div>
                    <div style="font-size:0.9rem; opacity:0.8;">Değerlendirilen</div>
                    <div style="font-size:1.2rem; font-weight:bold; color:#fabb00;">${agentName}</div>
                    <div style="font-size:0.8rem; opacity:0.7;">${agentGroup}</div>
                 </div>
                 <div class="score-circle-outer" id="score-ring"><div class="score-circle-inner" id="live-score">${isCriteriaBased?'100':'100'}</div></div>
            </div>
            <div class="eval-header-card">
                <div><label style="font-size:0.8rem; font-weight:bold;">Call ID</label><input id="eval-callid" class="swal2-input" style="height:35px; margin:0; width:100%;" placeholder="ID"></div>
                <div><label style="font-size:0.8rem; font-weight:bold;">Tarih</label><input type="date" id="eval-calldate" class="swal2-input" style="height:35px; margin:0; width:100%;" value="${new Date().toISOString().split('T')[0]}"></div>
            </div>
            ${criteriaFieldsHtml}
            <div style="margin-top:15px; background:#fafafa; padding:10px; border:1px solid #eee;">
                <label style="font-size:0.85rem; font-weight:bold;">Geri Bildirim Tipi</label>
                <select id="feedback-type" class="swal2-input" style="width:100%; height:35px; margin-top:5px;"><option value="Yok">Geri Bildirim Yok</option><option value="Sözlü">Sözlü</option><option value="Mail">Mail</option></select>
            </div>
            <textarea id="eval-feedback" class="swal2-textarea" style="margin-top:10px; height:80px;" placeholder="Genel yorum..."></textarea>
        </div>`,
        width: '650px',
        showCancelButton: true,
        confirmButtonText: 'Kaydet',
        cancelButtonText: 'İptal',
        didOpen: () => { if(isCriteriaBased) window.recalcTotalScore(); },
        preConfirm: () => {
             const callId = document.getElementById('eval-callid').value;
             const callDateRaw = document.getElementById('eval-calldate').value;
             const feedback = document.getElementById('eval-feedback').value;
             const feedbackType = document.getElementById('feedback-type').value;
             if (!callId || !callDateRaw) { Swal.showValidationMessage('Call ID ve Tarih zorunludur.'); return false; }
             
             const dateParts = callDateRaw.split('-');
             const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
             
             if (isCriteriaBased) {
                 let total = 0, detailsArr = [];
                 criteriaList.forEach((c, i) => {
                     let val = parseInt(document.getElementById(`slider-${i}`).value)||0;
                     let note = document.getElementById(`note-${i}`).value;
                     total += val;
                     detailsArr.push({ q: c.text, max: parseInt(c.points), score: val, note: note });
                 });
                 return { agentName, agentGroup, callId, callDate: formattedDate, score: total, details: JSON.stringify(detailsArr), feedback, feedbackType };
             } else {
                 const score = parseInt(document.getElementById('eval-manual-score').value);
                 const details = document.getElementById('eval-details').value;
                 return { agentName, agentGroup, callId, callDate: formattedDate, score, details, feedback, feedbackType };
             }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Kaydediliyor...', didOpen: () => Swal.showLoading() });
        fetch(SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "logEvaluation", username: currentUser, token: getToken(), ...formValues })
        }).then(r=>r.json()).then(d => {
            if (d.result === "success") {
                Swal.fire({ icon: 'success', title: 'Kaydedildi', timer: 1500, showConfirmButton: false });
                fetchEvaluationsForAgent(agentName);
            } else Swal.fire('Hata', d.message, 'error');
        });
    }
}

// YENİ: DÜZENLEME FONKSİYONU (ESKİ MANTIK İLE)
async function editEvaluation(targetCallId) {
    const item = allEvaluationsData.find(i => i.callId == targetCallId);
    if (!item) return;
    
    // Admin yetkisi ve grup kontrolü
    const selectEl = document.getElementById('agent-select-admin');
    const agentName = item.agent || item.agentName || selectEl.value;
    
    let agentGroup = 'Genel'; // Varsayılan
    // Gruptan kriter çekmeye çalış (item içinde grup yoksa select'ten al)
    const selectedOption = Array.from(selectEl.options).find(opt => opt.value === agentName);
    if(selectedOption) agentGroup = selectedOption.getAttribute('data-group');
    
    Swal.fire({ title: 'Veriler Alınıyor...', didOpen: () => Swal.showLoading() });
    
    let criteriaList = [];
    if(['Telesatış', 'Chat-Normal', 'Chat-Teknik'].includes(agentGroup)) { 
        criteriaList = await fetchCriteria(agentGroup);
    }
    Swal.close();
    
    const isCriteriaBased = criteriaList.length > 0;
    let oldDetails = [];
    try { oldDetails = JSON.parse(item.details); } catch(e) {}

    let criteriaFieldsHtml = '';
    if (isCriteriaBased) {
        criteriaFieldsHtml += `<div class="criteria-container">`;
        criteriaList.forEach((c,i) => {
            let pts = parseInt(c.points) || 0;
            // Eski puanı bul
            let oldScore = pts; 
            let oldNote = '';
            let detailMatch = oldDetails.find(d => d.q === c.text);
            if(detailMatch) { oldScore = detailMatch.score; oldNote = detailMatch.note || ''; }
            
            criteriaFieldsHtml += `
            <div class="criteria-row" id="row-${i}">
                <div class="criteria-header"><span>${c.text}</span><span style="font-size:0.8rem; color:#999;">Max: ${pts}</span></div>
                <div class="criteria-controls">
                    <input type="range" class="custom-range slider-input" id="slider-${i}" min="0" max="${pts}" value="${oldScore}" data-index="${i}" oninput="updateRowScore(${i}, ${pts})">
                    <span class="score-badge" id="badge-${i}" style="${oldScore<pts?'background:#d32f2f':''}">${oldScore}</span>
                </div>
                <input type="text" id="note-${i}" class="note-input" value="${oldNote}" placeholder="Kırılım nedeni..." style="display:${oldScore<pts?'block':'none'}; margin-top:5px;">
            </div>`;
        });
        criteriaFieldsHtml += `</div>`;
    } else {
        criteriaFieldsHtml = `
        <div style="padding:15px; border:1px dashed #ccc; background:#fff; margin-bottom:15px; text-align:center;">
            <label style="font-weight:bold;">Manuel Puan</label><br>
            <input id="eval-manual-score" type="number" class="swal2-input" value="${item.score}" min="0" max="100" style="width:100px; text-align:center; font-size:1.5rem; font-weight:bold;">
        </div>
        <textarea id="eval-details" class="swal2-textarea">${item.details}</textarea>`;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Düzenle: ' + item.callId,
        html: `
        <div class="eval-modal-wrapper">
             <div class="score-dashboard" style="margin-bottom:10px;">
                 <div>
                    <div style="font-size:0.9rem; opacity:0.8;">DÜZENLENİYOR</div>
                    <div style="font-size:1.2rem; font-weight:bold; color:#fabb00;">${agentName}</div>
                 </div>
                 <div class="score-circle-outer" id="score-ring"><div class="score-circle-inner" id="live-score">${item.score}</div></div>
            </div>
            <input id="eval-callid" class="swal2-input" value="${item.callId}" disabled style="background:#eee;">
            ${criteriaFieldsHtml}
            <textarea id="eval-feedback" class="swal2-textarea" style="margin-top:10px; height:80px;">${item.feedback || ''}</textarea>
        </div>`,
        width: '650px',
        showCancelButton: true,
        confirmButtonText: 'Güncelle',
        didOpen: () => { if(isCriteriaBased) window.recalcTotalScore(); },
        preConfirm: () => {
             if (isCriteriaBased) {
                 let total = 0, detailsArr = [];
                 criteriaList.forEach((c, i) => {
                     let val = parseInt(document.getElementById(`slider-${i}`).value)||0;
                     let note = document.getElementById(`note-${i}`).value;
                     total += val;
                     detailsArr.push({ q: c.text, max: parseInt(c.points), score: val, note: note });
                 });
                 return { callId: item.callId, score: total, details: JSON.stringify(detailsArr), feedback: document.getElementById('eval-feedback').value };
             } else {
                 const score = parseInt(document.getElementById('eval-manual-score').value);
                 const details = document.getElementById('eval-details').value;
                 return { callId: item.callId, score, details, feedback: document.getElementById('eval-feedback').value };
             }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Güncelleniyor...', didOpen: () => Swal.showLoading() });
        fetch(SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "updateEvaluation", username: currentUser, token: getToken(), agentName, ...formValues })
        }).then(r=>r.json()).then(d => {
            if (d.result === "success") {
                Swal.fire({ icon: 'success', title: 'Güncellendi', timer: 1500, showConfirmButton: false });
                fetchEvaluationsForAgent(agentName);
            } else Swal.fire('Hata', d.message, 'error');
        });
    }
}

async function exportEvaluations() {
    if (!isAdminMode) return;
    const targetAgent = document.getElementById('agent-select-admin').value;
    Swal.fire({ title: 'Rapor Hazırlanıyor...', didOpen: () => Swal.showLoading() });
    fetch(SCRIPT_URL, {
        method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "exportEvaluations", targetAgent, username: currentUser, token: getToken() })
    }).then(r=>r.json()).then(data => {
        if (data.result === "success" && data.csvData) {
            const blob = new Blob(["\ufeff" + data.csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = data.fileName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            Swal.close();
        } else Swal.fire('Hata', 'Rapor alınamadı.', 'error');
    });
}

// --- PENALTY GAME FUNCTIONS (Orijinal Koddan Korundu) ---
function updateJokerButtons() {
    document.getElementById('joker-call').disabled = jokers.call === 0;
    document.getElementById('joker-half').disabled = jokers.half === 0;
    document.getElementById('joker-double').disabled = jokers.double === 0 || firstAnswerIndex !== -1;
    if (firstAnswerIndex !== -1) {
        document.getElementById('joker-call').disabled = true;
        document.getElementById('joker-half').disabled = true;
        document.getElementById('joker-double').disabled = true;
    }
}

function useJoker(type) {
    if (jokers[type] === 0 || (firstAnswerIndex !== -1 && type !== 'double')) return;
    jokers[type] = 0;
    updateJokerButtons();
    const currentQ = pCurrentQ, correctAns = currentQ.a, btns = document.querySelectorAll('.penalty-btn');
    
    if (type === 'call') {
        const experts = ["Umut Bey", "Doğuş Bey", "Deniz Bey", "Esra Hanım"];
        const expert = experts[Math.floor(Math.random() * experts.length)];
        let guess = correctAns;
        if (Math.random() > 0.8 && currentQ.opts.length > 1) {
            let incorrectOpts = currentQ.opts.map((_, i) => i).filter(i => i !== correctAns);
            guess = incorrectOpts[Math.floor(Math.random() * incorrectOpts.length)] || correctAns;
        }
        Swal.fire({ icon: 'info', title: '📞 Telefon Jokeri', html: `${expert} soruyu cevaplıyor...<br><br>"Benim tahminim kesinlikle **${String.fromCharCode(65 + guess)}** şıkkı. Bundan ${Math.random() < 0.8 ? "çok eminim" : "emin değilim"}."`, confirmButtonText: 'Kapat' });
    } else if (type === 'half') {
        let incorrectOpts = currentQ.opts.map((_, i) => i).filter(i => i !== correctAns).sort(() => Math.random() - 0.5).slice(0, 2);
        incorrectOpts.forEach(idx => {
            btns[idx].disabled = true;
            btns[idx].style.textDecoration = 'line-through';
            btns[idx].style.opacity = '0.4';
        });
        Swal.fire({ icon: 'success', title: '✂️ Yarı Yarıya Kullanıldı', text: 'İki yanlış şık elendi!', toast: true, position: 'top', showConfirmButton: false, timer: 1500 });
    } else if (type === 'double') {
        doubleChanceUsed = true;
        Swal.fire({ icon: 'warning', title: '2️⃣ Çift Cevap', text: 'Bu soruda bir kez yanlış cevap verme hakkınız var. İlk cevabınız yanlışsa, ikinci kez deneyebilirsiniz.', toast: true, position: 'top', showConfirmButton: false, timer: 2500 });
    }
}

function openPenaltyGame() {
    document.getElementById('penalty-modal').style.display = 'flex';
    showLobby();
}

function showLobby() {
    document.getElementById('penalty-lobby').style.display = 'flex';
    document.getElementById('penalty-game-area').style.display = 'none';
    fetchLeaderboard();
}

function startGameFromLobby() {
    document.getElementById('penalty-lobby').style.display = 'none';
    document.getElementById('penalty-game-area').style.display = 'block';
    startPenaltySession();
}

function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboard-body'),
    loader = document.getElementById('leaderboard-loader'),
    table = document.getElementById('leaderboard-table');
    tbody.innerHTML = '';
    loader.style.display = 'block';
    table.style.display = 'none';
    
    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getLeaderboard" })
    }).then(response => response.json())
    .then(data => {
        loader.style.display = 'none';
        if (data.result === "success") {
            table.style.display = 'table';
            let html = '';
            if(data.leaderboard.length === 0) {
                html = '<tr><td colspan="4" style="text-align:center; color:#666;">Henüz maç yapılmadı.</td></tr>';
            } else {
                data.leaderboard.forEach((u, i) => {
                    let medal = i===0 ? '🥇' : (i===1 ? '🥈' : (i===2 ? '🥉' : `<span class="rank-badge">${i+1}</span>`));
                    let bgStyle = (u.username === currentUser) ? 'background:rgba(250, 187, 0, 0.1);' : '';
                    html += `<tr style="${bgStyle}"><td>${medal}</td><td style="text-align:left;">${u.username}</td><td>${u.games}</td><td>${u.average}</td></tr>`;
                });
            }
            tbody.innerHTML = html;
        } else {
            loader.innerText = "Yüklenemedi.";
            loader.style.display = 'block';
        }
    }).catch(err => {
        loader.innerText = "Bağlantı hatası.";
    });
}

function startPenaltySession() {
    pScore = 0;
    pBalls = 10;
    jokers = { call: 1, half: 1, double: 1 };
    doubleChanceUsed = false;
    firstAnswerIndex = -1;
    updateJokerButtons();
    document.getElementById('p-score').innerText = pScore;
    document.getElementById('p-balls').innerText = pBalls;
    document.getElementById('p-restart-btn').style.display = 'none';
    document.getElementById('p-options').style.display = 'grid';
    resetField();
    loadPenaltyQuestion();
}

function loadPenaltyQuestion() {
    if (pBalls <= 0) {
        finishPenaltyGame();
        return;
    }
    if (quizQuestions.length === 0) {
        Swal.fire('Hata', 'Soru yok!', 'warning');
        return;
    }
    pCurrentQ = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    document.getElementById('p-question-text').innerText = pCurrentQ.q;
    doubleChanceUsed = false;
    firstAnswerIndex = -1;
    updateJokerButtons();
    let html = '';
    pCurrentQ.opts.forEach((opt, index) => {
        const letter = String.fromCharCode(65 + index);
        html += `<button class="penalty-btn" onclick="shootBall(${index})">${letter}: ${opt}</button>`;
    });
    document.getElementById('p-options').innerHTML = html;
}

function shootBall(idx) {
    const btns = document.querySelectorAll('.penalty-btn'),
    isCorrect = (idx === pCurrentQ.a);
    if (!isCorrect && doubleChanceUsed && firstAnswerIndex === -1) {
        firstAnswerIndex = idx;
        btns[idx].classList.add('wrong-first-try');
        btns[idx].disabled = true;
        Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'İlk Hata! Kalan Hakkınız: 1', showConfirmButton: false, timer: 1500, background: '#ffc107' });
        updateJokerButtons();
        return;
    }
    btns.forEach(b => b.disabled = true);
    
    const ballWrap = document.getElementById('ball-wrap'),
    keeperWrap = document.getElementById('keeper-wrap'),
    shooterWrap = document.getElementById('shooter-wrap'),
    goalMsg = document.getElementById('goal-msg');
    
    const shotDir = Math.floor(Math.random() * 4);
    shooterWrap.classList.add('shooter-run');
    
    setTimeout(() => {
        if(isCorrect) {
            if(shotDir === 0 || shotDir === 2) keeperWrap.classList.add('keeper-dive-right');
            else keeperWrap.classList.add('keeper-dive-left');
        } else {
            if(shotDir === 0 || shotDir === 2) keeperWrap.classList.add('keeper-dive-left');
            else keeperWrap.classList.add('keeper-dive-right');
        }
        
        if (isCorrect) {
            if(shotDir === 0) ballWrap.classList.add('ball-shoot-left-top');
            else if(shotDir === 1) ballWrap.classList.add('ball-shoot-right-top');
            else if(shotDir === 2) ballWrap.classList.add('ball-shoot-left-low');
            else ballWrap.classList.add('ball-shoot-right-low');
            
            setTimeout(() => {
                goalMsg.innerText = "GOL!!!";
                goalMsg.style.color = "#fabb00";
                goalMsg.classList.add('show');
                pScore++;
                document.getElementById('p-score').innerText = pScore;
                Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Mükemmel Şut!', showConfirmButton: false, timer: 1000, background: '#a5d6a7' });
            }, 500);
        } else {
            if(Math.random() > 0.5) {
                ballWrap.style.bottom = "160px";
                ballWrap.style.left = (shotDir === 0 || shotDir === 2) ? "40%" : "60%";
                ballWrap.style.transform = "scale(0.6)";
                setTimeout(() => {
                    goalMsg.innerText = "KURTARDI!";
                    goalMsg.style.color = "#ef5350";
                    goalMsg.classList.add('show');
                    Swal.fire({ icon: 'error', title: 'Kaçırdın!', text: `Doğru cevap: ${String.fromCharCode(65 + pCurrentQ.a)}. ${pCurrentQ.opts[pCurrentQ.a]}`, showConfirmButton: true, timer: 2500, background: '#ef9a9a' });
                }, 500);
            } else {
                ballWrap.classList.add(Math.random() > 0.5 ? 'ball-miss-left' : 'ball-miss-right');
                setTimeout(() => {
                    goalMsg.innerText = "DIŞARI!";
                    goalMsg.style.color = "#ef5350";
                    goalMsg.classList.add('show');
                    Swal.fire({ icon: 'error', title: 'Kaçırdın!', text: `Doğru cevap: ${String.fromCharCode(65 + pCurrentQ.a)}. ${pCurrentQ.opts[pCurrentQ.a]}`, showConfirmButton: true, timer: 2500, background: '#ef9a9a' });
                }, 500);
            }
        }
    }, 300);
    pBalls--;
    document.getElementById('p-balls').innerText = pBalls;
    setTimeout(() => {
        resetField();
        loadPenaltyQuestion();
    }, 2500);
}

function resetField() {
    const ballWrap = document.getElementById('ball-wrap'),
    keeperWrap = document.getElementById('keeper-wrap'),
    shooterWrap = document.getElementById('shooter-wrap'),
    goalMsg = document.getElementById('goal-msg');
    
    ballWrap.className = 'ball-wrapper';
    ballWrap.style = "";
    keeperWrap.className = 'keeper-wrapper';
    shooterWrap.className = 'shooter-wrapper';
    goalMsg.classList.remove('show');
    
    document.querySelectorAll('.penalty-btn').forEach(b => {
        b.classList.remove('wrong-first-try');
        b.style.textDecoration = '';
        b.style.opacity = '';
        b.style.background = '#fabb00';
        b.style.color = '#0e1b42';
        b.style.borderColor = '#f0b500';
        b.disabled = false;
    });
}

function finishPenaltyGame() {
    let title = pScore >= 8 ? "EFSANE! 🏆" : (pScore >= 5 ? "İyi Maçtı! 👏" : "Antrenman Lazım 🤕");
    document.getElementById('p-question-text').innerHTML = `<span style="font-size:1.5rem; color:#fabb00;">MAÇ BİTTİ!</span><br>${title}<br>Toplam Skor: ${pScore}/10`;
    document.getElementById('p-options').style.display = 'none';
    document.getElementById('p-restart-btn').style.display = 'block';
    
    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "logQuiz", username: currentUser, token: getToken(), score: pScore * 10, total: 100 })
    });
}

// --- WIZARD FONKSİYONLARI (Orijinal - Korumalı) ---
function openWizard(){
    document.getElementById('wizard-modal').style.display='flex';
    if (Object.keys(wizardStepsData).length === 0) {
        Swal.fire({ title: 'İade Asistanı Verisi Yükleniyor...', didOpen: () => Swal.showLoading() });
        loadWizardData().then(() => {
            Swal.close();
            if (wizardStepsData && wizardStepsData['start']) {
                renderStep('start');
            } else {
                document.getElementById('wizard-body').innerHTML = '<h2 style="color:red;">Asistan verisi eksik veya hatalı.</h2>';
            }
        }).catch(() => {
            Swal.close();
            document.getElementById('wizard-body').innerHTML = '<h2 style="color:red;">Sunucudan veri çekme hatası.</h2>';
        });
    } else {
        renderStep('start');
    }
}

function renderStep(k){
    const s = wizardStepsData[k];
    if (!s) {
        document.getElementById('wizard-body').innerHTML = `<h2 style="color:red;">HATA: Adım ID'si (${k}) bulunamadı.</h2>`;
        return;
    }
    const b = document.getElementById('wizard-body');
    let h = `<h2 style="color:var(--primary);">${s.title || ''}</h2>`;
    
    if(s.result) {
        let i = s.result === 'red' ? '🛑' : (s.result === 'green' ? '✅' : '⚠️');
        let c = s.result === 'red' ? 'res-red' : (s.result === 'green' ? 'res-green' : 'res-yellow');
        h += `<div class="result-box ${c}"><div style="font-size:3rem;margin-bottom:10px;">${i}</div><h3>${s.title}</h3><p>${s.text}</p>${s.script ? `<div class="script-box">${s.script}</div>` : ''}</div><button class="restart-btn" onclick="renderStep('start')"><i class="fas fa-redo"></i> Başa Dön</button>`;
    } else {
        h += `<p>${s.text}</p><div class="wizard-options">`;
        s.options.forEach(o => {
            h += `<button class="option-btn" onclick="renderStep('${o.next}')"><i class="fas fa-chevron-right"></i> ${o.text}</button>`;
        });
        h += `</div>`;
        if(k !== 'start')
            h += `<button class="restart-btn" onclick="renderStep('start')" style="background:#eee;color:#333;margin-top:15px;">Başa Dön</button>`;
    }
    b.innerHTML = h;
}

// --- BOŞ YER TUTUCULAR (Hata önlemek için) ---
function changePasswordPopup(force) { 
    Swal.fire({
        title: 'Şifre Değiştir',
        html: '<input id="swal-old-pass" type="password" class="swal2-input" placeholder="Eski Şifre"><input id="swal-new-pass" type="password" class="swal2-input" placeholder="Yeni Şifre">',
        showCancelButton: !force,
        confirmButtonText: 'Değiştir',
        preConfirm: () => {
            const o = document.getElementById('swal-old-pass').value;
            const n = document.getElementById('swal-new-pass').value;
            if(!o || !n) Swal.showValidationMessage('Eksik alan!');
            return {o, n};
        }
    }).then(res => {
        if(res.isConfirmed) {
            Swal.showLoading();
            fetch(SCRIPT_URL, {
                method: 'POST', body: JSON.stringify({ action: "changePassword", username: currentUser, oldPass: CryptoJS.SHA256(res.value.o).toString(), newPass: CryptoJS.SHA256(res.value.n).toString(), token: getToken() })
            }).then(r=>r.json()).then(d=>{
                if(d.result==="success") Swal.fire('Başarılı').then(()=>logout());
                else Swal.fire('Hata', d.message, 'error');
            });
        }
    });
}
