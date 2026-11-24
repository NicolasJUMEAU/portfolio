/*
 * Swiply – « base de données » statique pour la démo du portfolio.
 *
 * Les tables (exportées depuis les seeders Laravel) sont des fichiers JSON
 * dans /swiply/data. Les écritures (swipes, wishlist, candidatures, notes)
 * sont simulées dans le localStorage du visiteur : rien n'est envoyé à un
 * serveur, et « Réinitialiser la démo » efface tout.
 */
const SwiplyDB = (() => {
    const TABLES = ['cities', 'categories', 'schools', 'tags', 'roles', 'users', 'offers', 'offer_tags', 'cvs'];
    const STORE_KEY = 'swiply-demo-v1';
    const CURRENT_USER_ID = 38; // compte de test « Test Etudiant »

    const SCRIPT_SRC = document.currentScript ? document.currentScript.src : location.href;
    let data = null;

    // ── État local (remplace les tables swipes, student_wishlists, applications, ratings) ──
    function readState() {
        try {
            const s = JSON.parse(localStorage.getItem(STORE_KEY));
            if (s && typeof s === 'object') return { swipes: [], wishlist: [], applications: [], ratings: {}, ...s };
        } catch (e) { /* stockage indisponible */ }
        return { swipes: [], wishlist: [], applications: [], ratings: {} };
    }
    let state = readState();
    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
    }

    async function load() {
        if (data) return data;
        const base = new URL('../data/', SCRIPT_SRC);
        const entries = await Promise.all(TABLES.map(async t => {
            const res = await fetch(new URL(t + '.json', base));
            return [t, await res.json()];
        }));
        data = Object.fromEntries(entries);
        return data;
    }

    const byId = (table, id) => data[table].find(r => r.id === Number(id));

    // Équivalent de Offer::with(['company', 'city', 'tags'])
    function hydrateOffer(o) {
        const company = byId('users', o.company_id) || {};
        const city = byId('cities', o.city_id) || {};
        const tags = data.offer_tags.filter(t => t.offer_id === o.id).map(t => byId('tags', t.tag_id)?.name).filter(Boolean);
        const isAlt = (o.contract_type || '').toLowerCase() === 'alternance';
        return {
            id: o.id,
            type: o.contract_type,
            title: o.title,
            company: company.company_name || '',
            company_id: o.company_id,
            location: [city.name, city.country].filter(Boolean).join(', '),
            city: city.name || '',
            city_id: o.city_id,
            description: o.description,
            contact: company.email || '',
            tags,
            tag_ids: data.offer_tags.filter(t => t.offer_id === o.id).map(t => t.tag_id),
            salary: o.salary || 'Non précisé',
            duration: o.duration || 'Non précisé',
            level: o.level || 'Non précisé',
            suit: (isAlt ? ['♠', '♣'] : ['♦', '♥'])[o.id % 2],
            suitClass: isAlt ? 'suit-black' : 'suit-red',
            badgeClass: isAlt ? 'badge-alternance' : 'badge-stage',
        };
    }

    return {
        load,
        currentUser: () => byId('users', CURRENT_USER_ID),
        cities: () => [...data.cities].sort((a, b) => a.name.localeCompare(b.name)),
        tags: () => [...data.tags].sort((a, b) => a.name.localeCompare(b.name)),
        city: id => byId('cities', id),
        school: id => byId('schools', id),
        tag: id => byId('tags', id),
        user: id => byId('users', id),
        offer: id => { const o = byId('offers', id); return o ? hydrateOffer(o) : null; },

        // GET /swipe : offres actives filtrées, sans celles déjà swipées
        swipeOffers({ type, cityId, tagIds = [] } = {}) {
            const swiped = new Set(state.swipes.map(s => s.offer_id));
            return data.offers
                .filter(o => o.is_active && !swiped.has(o.id))
                .filter(o => !type || o.contract_type === type)
                .filter(o => !cityId || o.city_id === Number(cityId))
                .map(hydrateOffer)
                .filter(o => !tagIds.length || o.tag_ids.some(id => tagIds.includes(id)))
                .reverse(); // ->latest()
        },

        // POST /swipe
        recordSwipe(offerId, direction) {
            if (state.swipes.some(s => s.offer_id === offerId)) return { matched: false };
            state.swipes.push({ offer_id: offerId, direction, at: Date.now() });
            if (direction === 'right' && !state.wishlist.some(w => w.offer_id === offerId)) {
                state.wishlist.push({ offer_id: offerId, at: Date.now() });
            }
            save();
            return { matched: direction === 'right' };
        },

        // Wishlist
        wishlist: () => [...state.wishlist].sort((a, b) => b.at - a.at).map(w => hydrateOffer(byId('offers', w.offer_id))),
        isWishlisted: id => state.wishlist.some(w => w.offer_id === id),
        addToWishlist(id) {
            if (!state.wishlist.some(w => w.offer_id === id)) state.wishlist.push({ offer_id: id, at: Date.now() });
            save();
        },
        removeFromWishlist(id) {
            state.wishlist = state.wishlist.filter(w => w.offer_id !== id);
            save();
        },

        // Candidatures (is_confirmed : null = en attente)
        cvs: () => data.cvs.filter(c => c.user_id === CURRENT_USER_ID),
        applications: () => [...state.applications].sort((a, b) => b.at - a.at).map(a => ({
            ...a, offer: hydrateOffer(byId('offers', a.offer_id)), cv: byId('cvs', a.cv_id),
        })),
        apply(offerId, cvId) {
            if (state.applications.some(a => a.offer_id === offerId)) return false;
            state.applications.push({ id: Date.now(), offer_id: offerId, cv_id: Number(cvId), is_confirmed: null, at: Date.now() });
            save();
            return true;
        },
        removeApplication(id) {
            state.applications = state.applications.filter(a => a.id !== id);
            save();
        },

        // Recherche (GET /recherche-affichage)
        search(query, type = 'company') {
            const q = (query || '').trim().toLowerCase();
            if (!q) return [];
            const role = { company: 4, student: 3, pilote: 2 }[type];
            return data.users.filter(u => u.role_id === role).filter(u => {
                const fields = role === 4 ? [u.company_name, u.company_description] : [u.first_name, u.last_name];
                return fields.some(f => (f || '').toLowerCase().includes(q));
            });
        },

        companyOffers: id => data.offers.filter(o => o.company_id === Number(id) && o.is_active).map(hydrateOffer).reverse(),

        // Notation d'une entreprise (moyenne simulée avec la note du visiteur)
        userRating: id => state.ratings[id] || null,
        rate(id, score) { state.ratings[id] = score; save(); },

        reset() {
            state = { swipes: [], wishlist: [], applications: [], ratings: {} };
            save();
        },
    };
})();
