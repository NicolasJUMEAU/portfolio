/*
 * Reproduit components/layout.blade.php (barre de navigation + pied de page)
 * pour un visiteur connecté en tant qu'étudiant de démonstration.
 */
(function () {
    const navBtn = (href, icon, label, size = 'w-9 h-9') => `
        <a href="${href}" class="flex flex-col items-center text-white group">
            <div class="nav-btn bg-white rounded-[18px] mb-1 mt-1 flex items-center justify-center w-12 h-12 shadow-[0_4px_0_0_rgba(0,0,0,0.2)]" data-label="${label}" title="${label}">
                <img src="images/icons/${icon}" alt="${label}" class="${size} object-contain">
            </div>
        </a>`;

    const header = document.createElement('header');
    header.className = 'relative z-[100]';
    header.innerHTML = `
        <nav class="fixed top-0 left-0 w-full h-16 bg-[#78AB88] px-6 py-3 flex items-center justify-between z-[100]">
            <div class="flex items-center">
                <a href="index.html" class="flex flex-col items-center text-white group">
                    <div class="nav-logo bg-transparent rounded-[20px] mb-1 flex items-center justify-center p-2">
                        <img src="images/logos/logo.png" alt="Swiply Logo" class="h-14 w-auto">
                        <img src="images/logos/logo_text.png" alt="Swiply" class="hidden md:block h-10 w-auto ml-2">
                    </div>
                </a>
            </div>
            <button id="burger-btn" class="md:hidden text-white focus:outline-none p-2" aria-label="Menu">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div class="hidden md:flex items-center gap-5">
                ${navBtn('recherche.html', 'search_icon.png', 'Recherche')}
                ${navBtn('swipe.html', 'swipe_icon.png', 'Swipe')}
                ${navBtn('wishlist.html', 'wishlist_icon.png', 'Wishlist')}
                ${navBtn('candidatures.html', 'account_icon.png', 'Profil', 'w-8 h-8')}
            </div>
        </nav>
        <div id="mobile-menu" class="hidden fixed top-16 left-0 w-full max-h-[calc(100vh-4rem)] overflow-y-auto bg-[#78AB88] flex-col py-4 shadow-lg md:hidden z-[90]">
            <a href="recherche.html" class="block px-6 py-3 text-white font-bold text-lg hover:bg-white/20">Recherche</a>
            <a href="swipe.html" class="block px-6 py-3 text-white font-bold text-lg hover:bg-white/20">Swipe</a>
            <a href="wishlist.html" class="block px-6 py-3 text-white font-bold text-lg hover:bg-white/20">Wishlist</a>
            <div class="w-full h-px bg-white/40 my-2"></div>
            <a href="candidatures.html" class="block px-6 py-3 text-white font-bold text-lg hover:bg-white/20">Mes candidatures</a>
            <div class="w-full h-px bg-white/40 my-2"></div>
            <div class="px-6 py-3">
                <button type="button" data-reset-demo class="w-full text-center bg-white text-[#ca3c4f] font-bold text-lg py-2 rounded-xl">Réinitialiser la démo</button>
            </div>
        </div>`;
    document.body.prepend(header);

    const footer = document.createElement('footer');
    footer.className = 'relative z-100 bg-[#323D52] mt-auto w-full';
    footer.innerHTML = `
        <div class="h-2 bg-[#252D3D] w-full"></div>
        <div class="container mx-auto text-center text-white text-sm py-4 px-4">
            <span>Démo statique de Swiply : connecté en tant que « Test Etudiant », données fictives, rien n'est enregistré en ligne.</span>
            <span class="mx-1">-</span>
            <a href="../#swiply" class="hover:underline">Retour au portfolio</a>
        </div>`;
    document.body.append(footer);

    document.getElementById('burger-btn').addEventListener('click', () => {
        const menu = document.getElementById('mobile-menu');
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
    });

    document.addEventListener('click', e => {
        if (e.target.closest('[data-reset-demo]')) {
            SwiplyDB.reset();
            location.href = 'index.html';
        }
    });
})();

// Échappe le texte injecté via innerHTML
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Contenu du panneau « Description » commun au swipe, à la wishlist et au profil entreprise
function offerDetailsHtml(job) {
    const suitColor = job.suitClass === 'suit-red' ? '#e74c3c' : '#1a1a1a';
    const row = (icon, label, value) => `
        <div class="detail-row"><span class="detail-icon">${icon}</span><div><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div></div>`;
    return `
        <div class="modal-body-header">
            <div class="modal-header-info">
                <div class="modal-job-title">${esc(job.title)}</div>
                <div class="modal-company-name"><a href="entreprise.html?id=${job.company_id}" style="color:inherit">${esc(job.company || 'Entreprise non précisée')}</a></div>
            </div>
            <span class="modal-suit-large" style="color:${suitColor};">${job.suit}</span>
        </div>
        ${row('📋', 'Contrat', `<span class="contract-badge ${job.badgeClass}">${esc(job.type)}</span>`)}
        ${row('📍', 'Lieu', esc(job.location || 'Non précisé'))}
        ${row('🎓', 'Niveau requis', esc(job.level))}
        ${row('⏱️', 'Durée', esc(job.duration))}
        ${row('💶', 'Rémunération', esc(job.salary))}
        ${row('✉️', 'Contact', `<span class="modal-contact-value">${esc(job.contact || 'Non précisé')}</span>`)}
        ${job.description ? `<div class="modal-section"><div class="modal-section-title">Description</div><p class="modal-description-text">${esc(job.description)}</p></div>` : ''}
        ${job.tags.length ? `<div class="modal-section"><div class="modal-section-title">Compétences</div><div class="job-card-tags-list">${job.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}`;
}

// Petite carte d'offre (wishlist, candidatures, profil entreprise)
function miniCardHtml(job, headerExtra = '') {
    return `
        <span class="suit-corner suit-tl ${job.suitClass}">${job.suit}</span>
        <span class="suit-corner suit-br ${job.suitClass}">${job.suit}</span>
        <div class="job-card-content">
            <div class="job-card-header">${headerExtra}<span class="contract-badge ${job.badgeClass}">${esc(job.type)}</span></div>
            <div class="job-card-body">
                <div class="job-card-row"><span class="job-card-icon">💼</span><span class="job-card-title">${esc(job.title)}</span></div>
                <div class="job-card-row"><span class="job-card-icon small">🏢</span><span class="job-card-company">${esc(job.company)}</span></div>
                <div class="job-card-row"><span class="job-card-icon small">📍</span><span class="job-card-location">${esc(job.city)}</span></div>
            </div>
            <div class="job-card-stats"><div class="job-card-stat-item"><span class="job-card-icon small">💶</span><span class="job-card-stat-value">${esc(job.salary)}</span></div></div>
            <div class="job-card-tags-section">
                <div class="job-card-tags-label">Tags :</div>
                <div class="job-card-tags-list">${job.tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
            </div>
        </div>`;
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = (t.classList.contains('toast') ? 'toast' : '') + (type ? ' ' + type : '');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// Reproduit components/student_profil_layout.blade.php (menu latéral de l'espace étudiant)
function studentSidebar(active) {
    const link = (href, label, key) => `
        <a href="${href}" class="block p-5 text-3xl group ${active === key ? 'bg-[#38425b] text-white font-semibold rounded-r-2xl w-[calc(100%+20px)] relative z-10' : 'text-[#38425b] w-full'}">
            <p class="pl-10">${label}</p>
        </a>`;
    return `
        <aside class="hidden md:flex w-1/4 min-w-[280px] max-w-[400px] fixed top-16 left-0 z-[60] bg-[#f7f7f7] shadow-md h-[calc(100vh-4rem)] flex-col">
            <nav class="flex flex-col pt-20 gap-8 flex-grow">
                ${link('candidatures.html', 'Mes candidatures', 'applications')}
                ${link('wishlist.html', 'Wishlist', 'wishlist')}
            </nav>
            <div class="pb-10">
                <button type="button" data-reset-demo class="block p-5 text-3xl group text-[#ca3c4f] w-full text-left transition-all hover:bg-[#ca3c4f] hover:text-white hover:font-semibold hover:rounded-r-2xl hover:w-[calc(100%+20px)] relative hover:z-10">
                    <p class="pl-10">Réinitialiser la démo</p>
                </button>
            </div>
        </aside>`;
}

// Fenêtre de détail d'une offre (wishlist, candidatures, profil entreprise)
function modalHtml(actionsHtml = '') {
    return `
        <div class="modal-overlay" id="modalOverlay" onclick="if (event.target === this) closeModal()">
            <div class="modal-panel" id="modalPanel">
                <button class="modal-close-icon" onclick="closeModal()" title="Fermer">&times;</button>
                <div class="panel-header">
                    <div class="panel-header-left">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#323D52" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;">
                            <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/><polyline points="13 17 15 19 19 15"/>
                        </svg>
                        <h2 class="panel-title">Description</h2>
                    </div>
                </div>
                <div class="panel-divider"></div>
                <div id="modalBody"></div>
                <div class="modal-actions-wrapper" id="modalActions">${actionsHtml}</div>
            </div>
        </div>`;
}
function openModalWith(job) {
    document.getElementById('modalBody').innerHTML = offerDetailsHtml(job);
    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    const m = document.getElementById('modalOverlay');
    if (m) m.classList.remove('open');
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
