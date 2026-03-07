/* CONSOLIDATED RPG SCRIPT SYSTEM - REVISED */

const CONFIG = {
    categories: ['Character', 'Monster', 'Pet', 'Item', 'Magic', 'Area']
};

// ── AWAKENING: set ke true saat siap diluncurkan ──
const AWAKENING_ENABLED = false;

let rawData = [];
let _page2SeasonFlow = false; // flag: apakah lagi di flow season→category page 2
let _p2EntryFresh = false;    // flag: masuk page 2 dari home, belum pernah pilih season di sesi ini

let currentSeason = localStorage.getItem('currentSeason') || '1';
let currentCat = localStorage.getItem('currentCat') || 'Character';
let filters = { search: '', rarity: '', tags: [] };
let lastScrollY = 0;

const UI = {
    pages: document.querySelectorAll('.page'),
    themeToggle: document.getElementById('theme-toggle'),
    clock: document.getElementById('system-clock'),
    date: document.getElementById('system-date'),
    loading: document.getElementById('loading-screen'),
    progressBar: document.getElementById('progress-bar'),
    progressVal: document.getElementById('progress-val'),
    modal: document.getElementById('category-modal'),
    patchModal: document.getElementById('patch-modal'),
    viewer: document.getElementById('image-viewer'),
    viewerImg: document.getElementById('viewer-img'),
    refreshBtn: document.getElementById('refresh-btn'),
    calendarModal: document.getElementById('calendar-modal'),
    calendarDays: document.getElementById('calendar-days'),
    calendarMonthYear: document.getElementById('calendar-month-year'),
    
    showPage(pageId, save = true) {
        this.pages.forEach(p => {
            p.classList.remove('active');
            p.scrollTop = 0;
        });
        const target = document.getElementById(pageId);
        if (!target) return;
        target.classList.add('active');
        if (save) localStorage.setItem('lastPage', pageId);

        // Update visibility: jam/tanggal & tiktok & request button hanya di page-1
        const hud = document.getElementById('top-hud');
        const tiktok = document.getElementById('tiktok-text');
        const reqBtn = document.getElementById('request-btn');
        
        if (pageId === 'page-1') {
            const loadingEl = document.getElementById('loading-screen');
            const loadingDone = loadingEl && loadingEl.classList.contains('hidden');
            if (hud) hud.style.display = loadingDone ? 'flex' : 'none';
            if (tiktok) tiktok.style.display = 'block';
            if (reqBtn) reqBtn.style.display = 'flex';
        } else {
            if (hud) hud.style.display = 'none';
            if (tiktok) tiktok.style.display = 'none';
            if (reqBtn) reqBtn.style.display = 'none';
        }
        
        // Reset scroll nav state for page-4 (detail page)
        if (pageId === 'page-4') {
            // Show nav then auto-hide after 2 seconds
            setTimeout(() => {
                if (window._startPage4NavTimer) window._startPage4NavTimer();
            }, 100);
        }

        // Page 2: render stats/quote/spotlight, lalu auto-open season flow
        if (pageId === 'page-2') {
            // Zoom-in animation
            const p2el = document.getElementById('page-2');
            if (p2el) {
                p2el.classList.remove('p2-animate');
                void p2el.offsetWidth;
                p2el.classList.add('p2-animate');
            }
            // seasonChanged=true hanya jika fresh entry (season popup akan muncul & season mungkin ganti)
            renderPage2Content(_p2EntryFresh);
            if (_p2EntryFresh) {
                setTimeout(() => {
                    _page2SeasonFlow = true;
                    openSeasonChangeModal();
                }, 350);
            }
        }
    },

    updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        if (this.clock) this.clock.innerText = `${h}:${m}:${s}`;
        
        const d = String(now.getDate()).padStart(2, '0');
        const mon = now.toLocaleString('default', { month: 'short' }).toUpperCase();
        const y = now.getFullYear();
        if (this.date) this.date.innerText = `${d} ${mon} ${y}`;
    },

    handleRefresh() {
        if (this.refreshBtn) {
            this.refreshBtn.classList.add('spinning');
            if (this.loading) {
                this.loading.classList.remove('hidden');
                this.loading.style.opacity = '1';
                if (this.progressBar) this.progressBar.style.width = '0%';
                if (this.progressVal) this.progressVal.innerText = '0';
            }
            setTimeout(() => {
                location.reload();
            }, 800);
        }
    },

    renderCalendar(date) {
        if (!this.calendarDays || !this.calendarMonthYear) return;
        this.calendarDays.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        this.calendarMonthYear.innerText = date.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            this.calendarDays.appendChild(empty);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayEl.classList.add('today');
            }
            dayEl.innerText = d;
            this.calendarDays.appendChild(dayEl);
        }
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        if (this.themeToggle) this.themeToggle.innerHTML = next === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    }
};

async function loadRealmData() {
    try {
        const all = [
            ...(typeof DATA_CHARACTER !== 'undefined' ? DATA_CHARACTER : []),
            ...(typeof DATA_MONSTER   !== 'undefined' ? DATA_MONSTER   : []),
            ...(typeof DATA_PET       !== 'undefined' ? DATA_PET       : []),
            ...(typeof DATA_ITEM      !== 'undefined' ? DATA_ITEM      : []),
            ...(typeof DATA_MAGIC     !== 'undefined' ? DATA_MAGIC     : []),
            ...(typeof DATA_AREA      !== 'undefined' ? DATA_AREA      : [])
        ].filter(e => e.name && e.name.trim() !== '');

        rawData = all.length > 0 ? all : getMockArchive();
    } catch (e) {
        console.error('Data Load Failed:', e);
        rawData = getMockArchive();
    }
    return rawData;
}

function parseCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        const obj = {};
        headers.forEach((header, i) => { obj[header] = values[i] || ''; });
        return obj;
    });
}

function getMockArchive() {
    const data = [];
    const images = [
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=600&fit=crop'
    ];
    // Mock data tersebar di 3 season
    CONFIG.categories.forEach((cat, catIdx) => {
        for (let i = 1; i <= 3; i++) {
            // Season assignment: variasi per kategori agar tidak semua sama
            const seasonNum = ((catIdx + i - 1) % 3) + 1;
            data.push({
                season: String(seasonNum),
                category: cat,
                name: `${cat} Legend ${i}`,
                nickname: `Title of ${cat} ${i}`,
                rarity: ['S', 'A', 'B', 'C', 'D'][Math.floor(Math.random() * 5)],
                main_image_url: images[i-1] || images[0],
                extra_image_1: 'https://picsum.photos/400/400?random=1',
                extra_image_2: 'https://picsum.photos/400/400?random=2',
                extra_image_3: 'https://picsum.photos/400/400?random=3',
                tags: `${cat}, Power, Ancient`,
                story: `Born from the fragments of the old world, this ${cat} possesses power beyond mortal comprehension.`
            });
        }
    });
    return data;
}

async function startLoadingAnimation() {
    let progress = 0;
    return new Promise(resolve => {
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 10) + 2;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(resolve, 500);
            }
            if (UI.progressBar) UI.progressBar.style.width = `${progress}%`;
            if (UI.progressVal) UI.progressVal.innerText = progress;
        }, 100);
    });
}

/* ═══════════════════════════════════════════════
   POPULATE SEASON GRID (PAGE 1)
   Derivasikan season dari rawData secara dinamis
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   SEASON COLORS & ICONS
═══════════════════════════════════════════════ */
const SEASON_COLORS = [
    '#9B5DE5','#FF6B9D','#00BBF9','#FEE440',
    '#00F5D4','#F15BB5','#5B86E5','#FF9800',
    '#4CAF50','#FF4DB8','#00BCD4','#E8B84B'
];
const SEASON_ICONS = ['✦','◈','✧','★','◆','✦','◈','✧','★','◆','✦','◈'];

function getAvailableSeasons() {
    return [...new Set(rawData.map(u => u.season).filter(s => s && s.trim() !== ''))]
        .sort((a, b) => Number(a) - Number(b));
}

function populateSeasonGrid() {
    // Populate season-select-modal grid (page 1)
    const seasons = getAvailableSeasons();
    const grid = document.getElementById('season-select-grid');
    if (!grid) return;

    const fallback = seasons.length === 0 ? ['1'] : seasons;
    grid.innerHTML = fallback.map((s, i) => `
        <div class="season-pick-card" data-season="${s}" style="--clr:${SEASON_COLORS[i % SEASON_COLORS.length]}" onclick="selectSeason('${s}')">
            <div class="s-icon">${SEASON_ICONS[i % SEASON_ICONS.length]}</div>
            <div class="s-num">${s}</div>
            <div class="s-label">SEASON</div>
        </div>
    `).join('');
}

/* ═══════════════════════════════════════════════
   SELECT SEASON — goes to page-2 (category pick)
═══════════════════════════════════════════════ */
function selectSeason(season, fromModal) {
    currentSeason = String(season);
    localStorage.setItem('currentSeason', currentSeason);

    // Close any season modal
    const selModal = document.getElementById('season-select-modal');
    if (selModal) selModal.classList.add('hidden');
    const chgModal = document.getElementById('season-change-modal');
    if (chgModal) chgModal.classList.add('hidden');

    // Update all season labels
    updateSeasonLabels();

    // Navigate to page-2 if coming from page-1
    if (!fromModal) {
        UI.showPage('page-2');
    }
}

/* ═══════════════════════════════════════════════
   SELECT SEASON (PAGE 2 FLOW)
   Pilih season → tutup modal → buka category modal
═══════════════════════════════════════════════ */
function selectSeasonPage2Flow(season) {
    currentSeason = String(season);
    localStorage.setItem('currentSeason', currentSeason);
    updateSeasonLabels();
    _p2EntryFresh = false; // season sudah dipilih, bukan fresh entry lagi

    // Tutup season modal
    const chgModal = document.getElementById('season-change-modal');
    if (chgModal) chgModal.classList.add('hidden');

    // Update page 2 content dengan season baru (seasonChanged = true → re-randomize spotlight)
    renderPage2Content(true);

    // Buka category modal setelah delay kecil (smooth transition)
    setTimeout(() => {
        const catModal = document.getElementById('category-select-modal');
        if (catModal) catModal.classList.remove('hidden');
    }, 250);
}

function updateSeasonLabels() {
    const label = document.getElementById('cat-season-label');
    if (label) label.innerText = `SEASON ${currentSeason}`;
    const p2num = document.getElementById('p2-season-num-display');
    if (p2num) p2num.innerText = `S${currentSeason}`;
    // Also update page-3 category title so season reflects immediately
    const titleEl = document.getElementById('category-title');
    if (titleEl && currentCat) {
        titleEl.innerText = `S${currentSeason} · ${currentCat.toUpperCase()}`;
    }
}

function openSeasonSelectModal() {
    // For page 1 - ENTER WORLD
    populateSeasonGrid();
    const modal = document.getElementById('season-select-modal');
    if (modal) modal.classList.remove('hidden');
}

function openSeasonChangeModal() {
    // For page 2 & 3 - change season button
    const seasons = getAvailableSeasons();
    const fallback = seasons.length === 0 ? ['1'] : seasons;
    const listEl = document.getElementById('season-change-list');
    if (listEl) {
        listEl.innerHTML = fallback.map(s => {
            // Page 2 flow: setelah pilih season → auto buka category modal
            const clickFn = _page2SeasonFlow
                ? `selectSeasonPage2Flow('${s}')`
                : `selectSeason('${s}', true); if(document.getElementById('page-3').classList.contains('active')){renderArchive();}`;
            return `<div class="season-chip ${String(s) === String(currentSeason) ? 'active' : ''}" onclick="${clickFn}">SEASON ${s}</div>`;
        }).join('');
    }
    // Update modal title & subtitle based on context
    const titleEl = document.querySelector('#season-change-modal h3');
    if (titleEl) titleEl.innerText = _page2SeasonFlow ? 'SELECT SEASON' : 'CHANGE SEASON';
    const modal = document.getElementById('season-change-modal');
    if (modal) modal.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════
   PAGE 2 — RENDER ALL CONTENT
═══════════════════════════════════════════════ */
function renderPage2Content(seasonChanged = false) {
    renderPage2Stats();
    renderPage2Quote();
    // Spotlight hanya di-randomize ulang kalau season berubah atau belum pernah diset
    if (seasonChanged || !window._p2SpotlightUnit) {
        renderPage2Spotlight();
    } else {
        // Tampilkan kembali spotlight yang sudah ada tanpa re-randomize
        const spotEl = document.getElementById('p2-spotlight');
        if (spotEl && window._p2SpotlightUnit) spotEl.classList.remove('hidden');
    }
}

function renderPage2Stats() {
    const seasonData = rawData.filter(u =>
        u.name && u.name.trim() !== '' &&
        matchSeasonForCat(u.season, u.category)
    );
    const inSeason = seasonData.filter(u => {
        // untuk eksak (char/monster/pet) cek season sama, untuk kumulatif cek <=
        return matchSeasonForCat(u.season, u.category) &&
               String(u.season || '').trim() !== '';
    });
    // Total units di season aktif (char+monster+pet exact; item/magic/area cumulative)
    const totalUnits = rawData.filter(u =>
        u.name && u.name.trim() !== '' &&
        matchSeasonForCat(u.season, u.category)
    ).length;
    const sRankCount = rawData.filter(u =>
        u.name && u.name.trim() !== '' &&
        matchSeasonForCat(u.season, u.category) &&
        (u.rarity || '').toUpperCase() === 'S'
    ).length;
    const catsWithData = new Set(rawData.filter(u =>
        u.name && u.name.trim() !== '' &&
        matchSeasonForCat(u.season, u.category)
    ).map(u => u.category)).size;

    animateCount('p2-stat-units', totalUnits);
    animateCount('p2-stat-srank', sRankCount);
    animateCount('p2-stat-cats', catsWithData);
}

function animateCount(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    let start = 0;
    const duration = 800;
    const step = Math.ceil(target / (duration / 30));
    const timer = setInterval(() => {
        start += step;
        if (start >= target) { start = target; clearInterval(timer); }
        el.innerText = start;
    }, 30);
}

function renderPage2Quote() {
    // Ambil unit dari season aktif (prefer Character/Monster/Pet yang ada story)
    const pool = rawData.filter(u =>
        u.name && u.story && u.story.trim() !== '' &&
        String(u.season || '').trim() === String(currentSeason).trim() &&
        ['character','monster','pet'].includes((u.category||'').toLowerCase())
    );
    const fallback = rawData.filter(u =>
        u.name && u.story && u.story.trim() !== '' &&
        String(u.season || '').trim() === String(currentSeason).trim()
    );
    const source = pool.length > 0 ? pool : fallback;
    if (source.length === 0) return;
    const unit = source[Math.floor(Math.random() * source.length)];
    const quoteEl = document.getElementById('p2-quote-text');
    const sourceEl = document.getElementById('p2-quote-source');
    if (quoteEl) quoteEl.innerText = unit.story;
    if (sourceEl) sourceEl.innerText = `— ${unit.name}`;
}

function renderPage2Spotlight() {
    // Pilih unit random dari season aktif (char/monster/pet saja) yang punya main_image
    const pool = rawData.filter(u =>
        u.name && u.main_image_url && u.main_image_url.trim() !== 'data image/' &&
        u.main_image_url.trim() !== '' &&
        String(u.season || '').trim() === String(currentSeason).trim() &&
        ['character','monster','pet'].includes((u.category||'').toLowerCase())
    );
    const spotEl = document.getElementById('p2-spotlight');
    if (!spotEl) return;
    if (pool.length === 0) { spotEl.classList.add('hidden'); return; }
    const unit = pool[Math.floor(Math.random() * pool.length)];
    window._p2SpotlightUnit = unit; // simpan untuk onclick
    const imgEl = document.getElementById('p2-spotlight-img');
    const nameEl = document.getElementById('p2-spotlight-name');
    const catEl = document.getElementById('p2-spotlight-cat');
    const badgeEl = document.getElementById('p2-spotlight-rarity');
    if (imgEl) imgEl.src = unit.main_image_url;
    if (nameEl) nameEl.innerText = unit.name;
    if (catEl) catEl.innerText = (unit.category || '').toUpperCase();
    if (badgeEl) {
        badgeEl.innerText = unit.rarity || '';
        badgeEl.className = `p2-spotlight-badge rarity-${(unit.rarity||'').toLowerCase()}`;
    }
    spotEl.classList.remove('hidden');
}

function p2SpotlightClick() {
    const unit = window._p2SpotlightUnit;
    if (!unit) return;
    // Tutup semua modal, reset flag, pergi ke detail
    _page2SeasonFlow = false;
    const catModal = document.getElementById('category-select-modal');
    if (catModal) catModal.classList.add('hidden');
    selectRealm(unit.category, false);
    showLegendDetail(unit.name);
}

/* ═══════════════════════════════════════════════
   PAGE 2 — PARTICLES CANVAS ANIMATION
═══════════════════════════════════════════════ */
function initPage2Particles() {
    const canvas = document.getElementById('p2-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const runes = ['✦','◈','✧','★','◆','⬡','⬢','✴'];
    let particles = [];
    let animId = null;

    function resize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function spawnParticles() {
        particles = [];
        const count = Math.floor((canvas.width * canvas.height) / 14000);
        for (let i = 0; i < Math.max(count, 12); i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                rune: runes[Math.floor(Math.random() * runes.length)],
                size: Math.random() * 10 + 7,
                alpha: Math.random() * 0.18 + 0.04,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.6) * 0.4,
                alphaDir: Math.random() > 0.5 ? 1 : -1,
                alphaSpeed: Math.random() * 0.003 + 0.001
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha += p.alphaDir * p.alphaSpeed;
            if (p.alpha > 0.22 || p.alpha < 0.02) p.alphaDir *= -1;
            if (p.y < -20) p.y = canvas.height + 10;
            if (p.y > canvas.height + 20) p.y = -10;
            if (p.x < -20) p.x = canvas.width + 10;
            if (p.x > canvas.width + 20) p.x = -10;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.font = `${p.size}px serif`;
            ctx.fillStyle = 'rgba(200,160,255,1)';
            ctx.fillText(p.rune, p.x, p.y);
            ctx.restore();
        });
        animId = requestAnimationFrame(draw);
    }

    // Hanya jalankan saat page-2 aktif
    function start() {
        if (animId) return;
        resize();
        spawnParticles();
        draw();
    }
    function stop() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
    }

    window.addEventListener('resize', () => {
        resize();
        spawnParticles();
    });

    // Observer: mulai saat page-2 visible, stop saat tidak
    const page2 = document.getElementById('page-2');
    const obs = new MutationObserver(() => {
        if (page2 && page2.classList.contains('active')) start();
        else stop();
    });
    if (page2) obs.observe(page2, { attributes: true, attributeFilter: ['class'] });
    // Kalau sudah aktif saat init
    if (page2 && page2.classList.contains('active')) start();
}

/* ═══════════════════════════════════════════════
   AWAKENING — Show popup
═══════════════════════════════════════════════ */
function showAwakeningPopup(unit) {
    const aw = unit.awakening;
    if (!aw) return;

    const nameEl = document.getElementById('awakening-popup-unit-name');
    if (nameEl) nameEl.innerText = unit.name || '—';

    const imgEl = document.getElementById('awakening-popup-img');
    const imgWrap = document.getElementById('awakening-popup-img-wrap');
    const hasImg = aw.image && aw.image.trim() !== '' && aw.image.trim() !== 'data image/';
    if (imgEl) {
        if (hasImg) {
            imgEl.src = aw.image;
            imgEl.style.display = 'block';
            if (imgWrap) imgWrap.style.display = 'block';
        } else {
            imgEl.src = '';
            imgEl.style.display = 'none';
            if (imgWrap) imgWrap.style.display = 'none';
        }
    }

    const storyEl = document.getElementById('awakening-popup-story');
    const storyWrap = document.getElementById('awakening-popup-story-wrap');
    if (aw.story && aw.story.trim() !== '') {
        if (storyEl) storyEl.innerText = aw.story;
        if (storyWrap) storyWrap.style.display = 'block';
    } else {
        if (storyWrap) storyWrap.style.display = 'none';
    }

    // Simpan unit untuk fullscreen image
    window._awakeningUnit = unit;

    const popup = document.getElementById('awakening-popup');
    if (popup) popup.classList.remove('hidden');
}

function viewAwakeningImage() {
    const unit = window._awakeningUnit;
    if (!unit || !unit.awakening || !unit.awakening.image) return;
    const popup = document.getElementById('awakening-popup');
    if (popup) popup.classList.add('hidden');
    viewCostumeImage(unit.awakening.image, `${unit.name} — AWAKENING`);
}

async function init() {
    // Force dark mode only
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");

    // Sembunyikan HUD selama loading
    const hud = document.getElementById('top-hud');
    if (hud) hud.style.display = 'none';
    
    const dataPromise = loadRealmData();
    await startLoadingAnimation();
    await dataPromise;

    // Populate season grid setelah data siap
    populateSeasonGrid();
    
    if (UI.loading) {
        UI.loading.style.opacity = '0';
        setTimeout(() => {
            UI.loading.classList.add('hidden');
            const activePage = document.querySelector('.page.active');
            if (activePage && activePage.id === 'page-1') {
                const hudEl = document.getElementById('top-hud');
                if (hudEl) hudEl.style.display = 'flex';
            }
        }, 500);
    }

    // ── Restore halaman terakhir ──
    const lastPage = localStorage.getItem('lastPage') || 'page-1';
    const lastUnit = localStorage.getItem('lastUnit');

    // Update all season labels
    updateSeasonLabels();

    if (lastPage === 'page-4' && lastUnit) {
        selectRealm(currentCat, false);
        showLegendDetail(lastUnit);
    } else if (lastPage === 'page-3') {
        selectRealm(currentCat, false);
        UI.showPage('page-3');
    } else if (lastPage === 'page-2') {
        // Restore page 2 tanpa auto-open season popup (_p2EntryFresh tetap false)
        _p2EntryFresh = false;
        UI.showPage('page-2');
    } else {
        UI.showPage('page-1');
    }

    // ── START BUTTON: langsung ke page-2, auto-buka season popup ──
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            _p2EntryFresh = true;  // tandai sebagai fresh entry dari home
            UI.showPage('page-2');
        };
    }

    // ── CLOSE SEASON SELECT MODAL ──
    const closeSeasonSelect = document.getElementById('close-season-select');
    if (closeSeasonSelect) {
        closeSeasonSelect.onclick = () => {
            const modal = document.getElementById('season-select-modal');
            if (modal) modal.classList.add('hidden');
        };
    }
    const seasonSelectBackdrop = document.getElementById('season-select-backdrop');
    if (seasonSelectBackdrop) {
        seasonSelectBackdrop.onclick = () => {
            const modal = document.getElementById('season-select-modal');
            if (modal) modal.classList.add('hidden');
        };
    }

    // ── SEASON CHANGE MODAL (page 2 & 3) ──
    const p2SeasonBtn = document.getElementById('p2-season-btn');
    if (p2SeasonBtn) p2SeasonBtn.onclick = () => {
        _page2SeasonFlow = true; // re-open flow dari page 2 manual
        openSeasonChangeModal();
    };
    const p3SeasonBtn = document.getElementById('p3-season-btn');
    if (p3SeasonBtn) p3SeasonBtn.onclick = () => openSeasonChangeModal();

    // ── CATEGORY SELECT BUTTON (PAGE 2) ──
    const p2CatBtn = document.getElementById('p2-category-btn');
    if (p2CatBtn) {
        p2CatBtn.onclick = () => {
            const modal = document.getElementById('category-select-modal');
            if (modal) modal.classList.remove('hidden');
        };
    }
    const closeCatSelect = document.getElementById('close-category-select');
    if (closeCatSelect) {
        closeCatSelect.onclick = () => {
            const modal = document.getElementById('category-select-modal');
            if (modal) modal.classList.add('hidden');
            _page2SeasonFlow = false;
        };
    }
    const catSelectBackdrop = document.getElementById('category-select-backdrop');
    if (catSelectBackdrop) {
        catSelectBackdrop.onclick = () => {
            const modal = document.getElementById('category-select-modal');
            if (modal) modal.classList.add('hidden');
            _page2SeasonFlow = false;
        };
    }
    // ── CATSEL BACK BUTTON → kembali ke season modal ──
    const catselBackBtn = document.getElementById('catsel-back-btn');
    if (catselBackBtn) {
        catselBackBtn.onclick = () => {
            const catModal = document.getElementById('category-select-modal');
            if (catModal) catModal.classList.add('hidden');
            _page2SeasonFlow = true;
            openSeasonChangeModal();
        };
    }

    const closeSeasonChange = document.getElementById('close-season-change');
    if (closeSeasonChange) {
        closeSeasonChange.onclick = () => {
            const modal = document.getElementById('season-change-modal');
            if (modal) modal.classList.add('hidden');
            _page2SeasonFlow = false;
            if (_p2EntryFresh) {
                _p2EntryFresh = false;
                UI.showPage('page-1');
            }
        };
    }
    const seasonChangeBackdrop = document.getElementById('season-change-backdrop');
    if (seasonChangeBackdrop) {
        seasonChangeBackdrop.onclick = () => {
            const modal = document.getElementById('season-change-modal');
            if (modal) modal.classList.add('hidden');
            _page2SeasonFlow = false;
            if (_p2EntryFresh) {
                _p2EntryFresh = false;
                UI.showPage('page-1');
            }
        };
    }

    // ── PATCH NOTES BUTTON ──
    const patchBtn = document.getElementById('patch-btn');
    if (patchBtn) {
        patchBtn.onclick = () => {
            const patchTextEl = document.getElementById('patch-text');
            if (patchTextEl) {
                patchTextEl.innerHTML = `
                    <strong>UPDATE v1.0.8 - REVISED</strong><br><br>
                    - Wallpaper unik baru untuk setiap kategori.<br>
                    - Animasi loading modern (0-100%).<br>
                    - Navigasi otomatis tersembunyi saat scroll ke bawah.<br>
                    - Status halaman tetap tersimpan saat refresh.<br>
                    - Perbaikan kontras teks subtitle dan versi.<br>
                    - Semua efek cahaya dihapus untuk tampilan lebih bersih.<br>
                    - Sistem Season: pilih season sebelum kategori.<br>
                    - Gallery diganti Season Button di halaman detail.<br><br>
                    <em>Sistem telah dioptimalkan sepenuhnya.</em>
                `;
            }
            if (UI.patchModal) UI.patchModal.classList.remove('hidden');
        };
    }

    // ── CATEGORY CARDS di PAGE-2 ──
    document.querySelectorAll('.cat-card').forEach(card => {
        card.onclick = () => selectRealm(card.dataset.category);
    });

    // ── BACK NAVIGATION ──
    document.querySelectorAll('.back-to-1').forEach(btn => btn.onclick = () => UI.showPage('page-1'));
    document.querySelectorAll('.back-to-2').forEach(btn => btn.onclick = () => UI.showPage('page-2'));
    document.querySelectorAll('.back-to-3').forEach(btn => btn.onclick = () => UI.showPage('page-3'));

    // ── FILTER BUTTON (PAGE 3) ──
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
        filterBtn.onclick = () => {
            const panel = document.getElementById('filter-panel');
            if (panel) panel.classList.toggle('hidden');
        };
    }

    // ── QUICK CHANGE CATEGORY (PAGE 3) ──
    const CAT_META = {
        Character: { clr:'#FF5252', icon:'fa-shield-halved' },
        Monster:   { clr:'#9C6FE4', icon:'fa-dragon' },
        Pet:       { clr:'#FF4DB8', icon:'fa-paw' },
        Item:      { clr:'#4CAF50', icon:'fa-gem' },
        Magic:     { clr:'#5B86E5', icon:'fa-wand-sparkles' },
        Area:      { clr:'#E8B84B', icon:'fa-map-location-dot' }
    };
    const quickBtn = document.getElementById('quick-change-btn');
    if (quickBtn) {
        quickBtn.onclick = () => {
            const modalList = document.getElementById('mini-cat-list');
            if (!modalList) return;
            modalList.innerHTML = CONFIG.categories
                .filter(c => c !== currentCat)
                .map(c => {
                    const m = CAT_META[c] || { clr:"#9C6FE4", icon:"fa-star" };
                    return `<div class="m-cat" style="--mclr:${m.clr}" onclick="selectRealm('${c}')"><span class="m-cat-icon"><i class="fas ${m.icon}"></i></span><span class="m-cat-name">${c.toUpperCase()}</span></div>`;
                }).join('');
            if (UI.modal) UI.modal.classList.remove('hidden');
        };
    }

    // ── SEARCH INPUT (PAGE 3) ──
    const unitSearch = document.getElementById('unit-search');
    if (unitSearch) {
        unitSearch.oninput = (e) => {
            filters.search = e.target.value.toLowerCase();
            renderArchive();
        };
    }

    // ── RARITY CHIPS (PAGE 3) ──
    document.querySelectorAll('.r-chip').forEach(chip => {
        chip.onclick = () => {
            if (chip.classList.contains('active')) { chip.classList.remove('active'); filters.rarity = ''; }
            else {
                document.querySelectorAll('.r-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active'); filters.rarity = chip.dataset.rarity;
            }
            renderArchive();
        };
    });

    // ── RESET FILTERS — clear active states only, panel stays open ──
    const resetFilters = document.getElementById('reset-filters');
    if (resetFilters) {
        resetFilters.onclick = () => {
            filters = { search: '', rarity: '', tags: [] };
            const unitSearch2 = document.getElementById('unit-search');
            if (unitSearch2) unitSearch2.value = '';
            document.querySelectorAll('.r-chip, .t-chip').forEach(c => c.classList.remove('active'));
            renderArchive();
        };
    }

    // ── MODAL CLOSE BUTTONS ──
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.onclick = () => UI.modal.classList.add('hidden');
    const closePatchBtn = document.getElementById('close-patch');
    if (closePatchBtn) closePatchBtn.onclick = () => UI.patchModal.classList.add('hidden');
    const closeViewerBtn = document.querySelector('.close-viewer');
    if (closeViewerBtn) closeViewerBtn.onclick = () => {
        UI.viewer.classList.add('hidden');
        const viewerLabel = document.getElementById('viewer-label');
        if (viewerLabel) viewerLabel.style.display = 'none';
    };

    // ── SEASON POPUP CLOSE ──
    const closeSeasonPopup = document.getElementById('close-season-popup');
    if (closeSeasonPopup) closeSeasonPopup.onclick = () => {
        const popup = document.getElementById('season-popup');
        if (popup) popup.classList.add('hidden');
    };
    const seasonPopupBackdrop = document.getElementById('season-popup-backdrop');
    if (seasonPopupBackdrop) seasonPopupBackdrop.onclick = () => {
        const popup = document.getElementById('season-popup');
        if (popup) popup.classList.add('hidden');
    };

    // ── COSTUME POPUP CLOSE ──
    const closeCostumePopup = document.getElementById('close-costume-popup');
    if (closeCostumePopup) closeCostumePopup.onclick = () => {
        const popup = document.getElementById('costume-popup');
        if (popup) popup.classList.add('hidden');
    };
    const costumePopupBackdrop = document.getElementById('costume-popup-backdrop');
    if (costumePopupBackdrop) costumePopupBackdrop.onclick = () => {
        const popup = document.getElementById('costume-popup');
        if (popup) popup.classList.add('hidden');
    };

    // ── AWAKENING POPUP CLOSE ──
    const closeAwakeningPopup = document.getElementById('close-awakening-popup');
    if (closeAwakeningPopup) closeAwakeningPopup.onclick = () => {
        const popup = document.getElementById('awakening-popup');
        if (popup) popup.classList.add('hidden');
    };
    const awakeningPopupBackdrop = document.getElementById('awakening-popup-backdrop');
    if (awakeningPopupBackdrop) awakeningPopupBackdrop.onclick = () => {
        const popup = document.getElementById('awakening-popup');
        if (popup) popup.classList.add('hidden');
    };

    // ── PAGE 2 PARTICLES ──
    initPage2Particles();

    // ── SEASON APPEARANCES BUTTON (PAGE 4) ──
    // (onclick di-set ulang setiap showLegendDetail dipanggil)

    // ── REFRESH BUTTON ──
    if (UI.refreshBtn) UI.refreshBtn.onclick = () => UI.handleRefresh();

    // ── CALENDAR ──
    let calendarDate = new Date();
    if (UI.date) {
        UI.date.onclick = () => {
            calendarDate = new Date();
            UI.renderCalendar(calendarDate);
            if (UI.calendarModal) UI.calendarModal.classList.remove('hidden');
        };
    }
    const closeCal = document.getElementById('close-calendar');
    if (closeCal) closeCal.onclick = () => UI.calendarModal.classList.add('hidden');
    const prevMonth = document.getElementById('prev-month');
    if (prevMonth) prevMonth.onclick = () => { calendarDate.setMonth(calendarDate.getMonth() - 1); UI.renderCalendar(calendarDate); };
    const nextMonth = document.getElementById('next-month');
    if (nextMonth) nextMonth.onclick = () => { calendarDate.setMonth(calendarDate.getMonth() + 1); UI.renderCalendar(calendarDate); };

    setInterval(() => UI.updateClock(), 1000);
    UI.updateClock();

    // ── PAGE 4 NAV: Auto-hide after 2s, show on tap ──
    (function setupPage4Nav() {
        let navHideTimer = null;

        function showPage4Nav() {
            const nav = document.querySelector('.detail-nav-static');
            if (!nav) return;
            nav.classList.remove('nav-hidden');
            clearTimeout(navHideTimer);
            navHideTimer = setTimeout(() => {
                nav.classList.add('nav-hidden');
            }, 5000);
        }

        function hidePage4Nav() {
            const nav = document.querySelector('.detail-nav-static');
            if (nav) nav.classList.add('nav-hidden');
            clearTimeout(navHideTimer);
        }

        // Tap / click anywhere on page-4 to show nav
        const page4 = document.getElementById('page-4');
        if (page4) {
            page4.addEventListener('click', showPage4Nav, { passive: true });
            page4.addEventListener('touchstart', showPage4Nav, { passive: true });
        }

        // Auto-start hide timer when page-4 is shown (exposed via global)
        window._startPage4NavTimer = showPage4Nav;
        window._stopPage4NavTimer = hidePage4Nav;
    })();

    // ── ANTI SCREENSHOT / SCREEN RECORD ──
    const getBlocker = () => document.getElementById('ss-blocker');

    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('').catch(() => {});
            }
            const blocker = getBlocker();
            if (blocker) {
                blocker.style.display = 'block';
                setTimeout(() => { blocker.style.display = 'none'; }, 700);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
            e.preventDefault(); e.stopPropagation();
        }
        if (e.key === 'PrintScreen') e.preventDefault();
    });

    window.addEventListener('blur', () => {
        const blocker = getBlocker();
        if (blocker) {
            blocker.style.display = 'block';
            blocker.style.opacity = '1';
        }
    });
    window.addEventListener('focus', () => {
        const blocker = getBlocker();
        if (blocker) {
            setTimeout(() => { blocker.style.display = 'none'; }, 500);
        }
    });

    document.addEventListener('visibilitychange', () => {
        const blocker = getBlocker();
        if (!blocker) return;
        if (document.hidden) {
            blocker.style.display = 'block';
            blocker.style.opacity = '1';
        } else {
            setTimeout(() => { blocker.style.display = 'none'; }, 500);
        }
    });

    window.addEventListener('pagehide', () => {
        const blocker = getBlocker();
        if (blocker) blocker.style.display = 'block';
    });
    window.addEventListener('pageshow', () => {
        const blocker = getBlocker();
        if (blocker) setTimeout(() => { blocker.style.display = 'none'; }, 500);
    });

    let _lastW = window.innerWidth, _lastH = window.innerHeight;
    window.addEventListener('resize', () => {
        const dw = Math.abs(window.innerWidth - _lastW);
        const dh = Math.abs(window.innerHeight - _lastH);
        _lastW = window.innerWidth; _lastH = window.innerHeight;
        if (dw < 50 && dh < 50 && dw + dh > 0) {
            const blocker = getBlocker();
            if (blocker) {
                blocker.style.display = 'block';
                setTimeout(() => { blocker.style.display = 'none'; }, 600);
            }
        }
    });
}

/* ═══════════════════════════════════════════════
   SELECT REALM (CATEGORY) — goes to page-3
═══════════════════════════════════════════════ */
function selectRealm(cat, show = true) {
    currentCat = cat;
    localStorage.setItem('currentCat', cat);
    document.body.className = `theme-${cat.toLowerCase()}`;
    _page2SeasonFlow = false; // reset flow flag

    // Title: "S1 · CHARACTER"
    const titleEl = document.getElementById('category-title');
    if (titleEl) titleEl.innerText = `S${currentSeason} · ${cat.toUpperCase()}`;

    if (UI.modal) UI.modal.classList.add('hidden');
    const catSelModal = document.getElementById('category-select-modal');
    if (catSelModal) catSelModal.classList.add('hidden');
    filters = { search: '', rarity: '', tags: [] };
    const unitSearch = document.getElementById('unit-search');
    if (unitSearch) unitSearch.value = '';
    document.querySelectorAll('.r-chip').forEach(c => c.classList.remove('active'));
    populateTags();
    renderArchive();
    if (show) UI.showPage('page-3');
}

/* ═══════════════════════════════════════════════
   HELPER — cek apakah kategori pakai logic kumulatif
   (Area, Item, Magic: muncul di season X → tampil di season X ke atas)
═══════════════════════════════════════════════ */
const CUMULATIVE_CATS = ['area', 'item', 'magic'];
function isCumulativeCat(cat) {
    return CUMULATIVE_CATS.includes((cat || '').trim().toLowerCase());
}

function matchSeasonForCat(unitSeason, cat) {
    if (isCumulativeCat(cat)) {
        // Kumulatif: tampilkan unit yang season-nya <= currentSeason
        return Number(unitSeason || 0) <= Number(currentSeason);
    }
    // Eksak: hanya season yang sama persis
    return String(unitSeason || '').trim() === String(currentSeason).trim();
}

/* ═══════════════════════════════════════════════
   POPULATE TAGS — filter by season + category
═══════════════════════════════════════════════ */
function populateTags() {
    const tags = new Set();
    rawData.filter(u =>
        (u.category || '').trim().toLowerCase() === currentCat.trim().toLowerCase() &&
        matchSeasonForCat(u.season, currentCat)
    ).forEach(u => {
        if (u.tags) u.tags.split(',').forEach(t => tags.add(t.trim()));
    });

    const container = document.getElementById('dynamic-tags');
    if (!container) return;
    container.innerHTML = '';

    const rawTagArr = Array.from(tags);
    rawTagArr.forEach((tag) => {
        const span = document.createElement('span');
        span.className = 't-chip';
        span.innerText = tag;
        span.dataset.rawTag = tag;
        span.onclick = () => {
            if (span.classList.contains('active')) {
                span.classList.remove('active');
                filters.tags = filters.tags.filter(t => t !== tag);
            } else {
                span.classList.add('active');
                filters.tags.push(tag);
            }
            renderArchive();
        };
        container.appendChild(span);
    });
}

/* ═══════════════════════════════════════════════
   RENDER ARCHIVE — filter by season + category + search/rarity/tags
═══════════════════════════════════════════════ */
function renderArchive() {
    const grid = document.getElementById('unit-grid');
    if (!grid) return;

    const filtered = rawData.filter(u => {
        const matchSeason = matchSeasonForCat(u.season, currentCat);
        const matchCat    = (u.category || '').trim().toLowerCase() === currentCat.trim().toLowerCase();
        const matchSearch = (u.name || '').toLowerCase().includes(filters.search || '');
        const matchRarity = filters.rarity ? (u.rarity || '').trim().toUpperCase() === filters.rarity.toUpperCase() : true;
        const matchTags   = filters.tags && filters.tags.length > 0 ? filters.tags.every(t => u.tags && u.tags.includes(t)) : true;
        return matchSeason && matchCat && matchSearch && matchRarity && matchTags;
    });

    // Update count bar
    const countEl = document.getElementById('p2-count-text');
    if (countEl) {
        const totalInCat = rawData.filter(u =>
            (u.category || '').trim().toLowerCase() === currentCat.trim().toLowerCase() &&
            matchSeasonForCat(u.season, currentCat)
        ).length;
        const showing = filtered.length;
        const isFiltered = showing < totalInCat;
        countEl.textContent = isFiltered
            ? `${showing} / ${totalInCat} ${currentCat}`
            : `${totalInCat} ${currentCat}`;
    }

    grid.innerHTML = filtered.map((u, idx) => `
        <div class="unit-card" style="--i:${idx}" onclick="showLegendDetail('${u.name.replace(/'/g, "\\'")}')">
            <div class="card-img-wrap">
                <img src="${u.main_image_url || ''}" alt="${u.name || ''}">
                <div class="unit-rarity rarity-${(u.rarity||'').toLowerCase()}">${u.rarity || ''}</div>
            </div>
            <div class="unit-info"><div class="name">${u.name || ''}</div></div>
        </div>
    `).join('');

    /* Aktifkan scroll page-3 hanya jika konten melebihi layar */
    (function adjustPage3Scroll() {
        try {
            const page3 = document.getElementById('page-3');
            if (!page3) return;
            requestAnimationFrame(() => {
                const container = page3.querySelector('.page-container');
                const contentH = container ? container.scrollHeight : grid.scrollHeight;
                const viewH = page3.clientHeight || window.innerHeight;
                if (contentH > viewH - 20) {
                    page3.classList.remove('no-scroll');
                    page3.style.overflowY = 'auto';
                } else {
                    page3.classList.add('no-scroll');
                    page3.style.overflowY = 'hidden';
                }
            });
        } catch (e) { /* silent */ }
    })();
}

/* ═══════════════════════════════════════════════
   SHOW LEGEND DETAIL — goes to page-4
   Cari unit berdasarkan name + currentSeason
═══════════════════════════════════════════════ */
function showLegendDetail(name) {
    // Cari unit di season saat ini; fallback ke entry pertama dengan nama sama
    const unit = rawData.find(u => u.name === name && String(u.season || '').trim() === String(currentSeason).trim())
              || rawData.find(u => u.name === name);
    if (!unit) return;

    localStorage.setItem('lastUnit', name);

    const detailImg = document.getElementById('detail-img');
    if (detailImg) detailImg.src = unit.main_image_url || '';

    const rarityBadge = document.getElementById('detail-rarity-badge');
    if (rarityBadge) rarityBadge.innerText = unit.rarity || '';

    const detailName = document.getElementById('detail-name');
    if (detailName) detailName.innerText = unit.name || '';

    const detailNick = document.getElementById('detail-nickname');
    const detailStory = document.getElementById('detail-story');
    const tagContainer = document.getElementById('detail-tags-container');

    // Pindah ke page-4 dulu (no delay)
    UI.showPage('page-4');

    if (detailNick) detailNick.innerText = unit.nickname ? `"${unit.nickname}"` : '';
    if (detailStory) detailStory.innerText = unit.story || '';

    const rawTags = unit.tags ? unit.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (tagContainer) {
        tagContainer.innerHTML = rawTags.map(t =>
            `<span class="tag" onclick="jumpToTag('${t.replace(/'/g, "\\'")}')">${t}</span>`
        ).join('');
    }

    // ── Set up Season Button ──
    const seasonBtn = document.getElementById('season-appearances-btn');
    if (seasonBtn) {
        seasonBtn.onclick = () => showSeasonPopup(unit.name);
    }

    // ── Set up Costume Button ──
    // Hanya muncul untuk kategori Character, Monster, Pet yang punya data costumes
    const costumeBtn = document.getElementById('costume-btn');
    const costumeCategories = ['character', 'monster', 'pet'];
    const hasCostume = unit.costumes && Array.isArray(unit.costumes) && unit.costumes.length > 0;
    const isCostumeCategory = costumeCategories.includes((unit.category || '').toLowerCase());

    if (costumeBtn) {
        if (hasCostume && isCostumeCategory) {
            costumeBtn.classList.remove('hidden');
            costumeBtn.onclick = () => showCostumePopup(unit);
        } else {
            costumeBtn.classList.add('hidden');
            costumeBtn.onclick = null;
        }
    }

    // ── Set up Awakening Button ──
    // Hanya muncul jika AWAKENING_ENABLED = true DAN unit punya data awakening
    const awakeningBtn = document.getElementById('awakening-btn');
    const hasAwakening = AWAKENING_ENABLED && unit.awakening && unit.awakening.image;
    if (awakeningBtn) {
        if (hasAwakening) {
            awakeningBtn.classList.remove('hidden');
            awakeningBtn.onclick = () => showAwakeningPopup(unit);
        } else {
            awakeningBtn.classList.add('hidden');
            awakeningBtn.onclick = null;
        }
    }
}

/* ═══════════════════════════════════════════════
   SHOW SEASON POPUP
   Tampilkan season mana saja unit ini muncul
═══════════════════════════════════════════════ */
function showSeasonPopup(unitName) {
    // Kumpulkan semua season yang mengandung unit ini (nama sama)
    const appearances = rawData
        .filter(u => u.name === unitName && u.season && u.season.trim() !== '')
        .map(u => u.season.trim());
    const uniqueSeasons = [...new Set(appearances)].sort((a, b) => Number(a) - Number(b));

    // Update subtitle (nama unit)
    const subtitleEl = document.getElementById('season-popup-unit-name');
    if (subtitleEl) subtitleEl.innerText = unitName;

    // Render chips season
    const listEl = document.getElementById('season-popup-list');
    if (listEl) {
        if (uniqueSeasons.length === 0) {
            listEl.innerHTML = `<p style="opacity:.5;font-size:.75rem;letter-spacing:.08em;">DATA SEASON TIDAK TERSEDIA</p>`;
        } else {
            listEl.innerHTML = uniqueSeasons.map(s => `
                <div class="season-chip ${String(s) === String(currentSeason) ? 'active' : ''}"
                     onclick="navigateToSeason('${s}', '${unitName.replace(/'/g, "\\'")}')">
                    SEASON ${s}
                </div>
            `).join('');
        }
    }

    const popup = document.getElementById('season-popup');
    if (popup) popup.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════
   SHOW COSTUME POPUP
   Tampilkan daftar costume yang dimiliki unit ini
═══════════════════════════════════════════════ */
function showCostumePopup(unit) {
    const subtitleEl = document.getElementById('costume-popup-unit-name');
    if (subtitleEl) subtitleEl.innerText = unit.name || '—';

    const listEl = document.getElementById('costume-popup-list');
    if (listEl) {
        if (!unit.costumes || unit.costumes.length === 0) {
            listEl.innerHTML = `<p style="opacity:.5;font-size:.75rem;letter-spacing:.08em;">DATA COSTUME TIDAK TERSEDIA</p>`;
        } else {
            listEl.innerHTML = unit.costumes.map((c, idx) => {
                // Cek apakah image sudah diisi (bukan path kosong / dummy)
                const hasImage = c.image && c.image.trim() !== '' && c.image.trim() !== 'data image/';
                const clickAttr = hasImage
                    ? `onclick="viewCostumeImage('${c.image.replace(/'/g, "\\'")}', '${(c.name || '').replace(/'/g, "\\'")}')"`
                    : '';
                const chipClass = hasImage ? 'costume-chip costume-chip-clickable' : 'costume-chip costume-chip-no-img';
                return `
                <div class="${chipClass}" ${clickAttr}>
                    <i class="fas fa-shirt"></i>
                    <span class="costume-chip-name">${c.name || 'Unknown Costume'}</span>
                    ${hasImage
                        ? `<i class="fas fa-eye costume-chip-eye"></i>`
                        : `<span class="costume-chip-soon">SOON</span>`
                    }
                </div>`;
            }).join('');
        }
    }

    const popup = document.getElementById('costume-popup');
    if (popup) popup.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════
   VIEW COSTUME IMAGE — buka gambar costume di viewer
═══════════════════════════════════════════════ */
function viewCostumeImage(imgSrc, costumeName) {
    // Tutup costume popup dulu
    const popup = document.getElementById('costume-popup');
    if (popup) popup.classList.add('hidden');

    // Set judul viewer (pakai element yang ada atau buat overlay label)
    const viewerImg = document.getElementById('viewer-img');
    if (viewerImg) {
        viewerImg.src = imgSrc;
        viewerImg.alt = costumeName || 'Costume';
    }

    // Set label nama costume di atas viewer kalau ada element-nya
    const viewerLabel = document.getElementById('viewer-label');
    if (viewerLabel) {
        viewerLabel.innerText = costumeName || '';
        viewerLabel.style.display = 'block';
    }

    const viewer = document.getElementById('image-viewer');
    if (viewer) viewer.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════
   NAVIGATE TO SEASON (dari dalam Season Popup)
   Pindah ke versi unit di season lain
═══════════════════════════════════════════════ */
function navigateToSeason(season, unitName) {
    currentSeason = String(season);
    localStorage.setItem('currentSeason', currentSeason);

    // Update all labels
    updateSeasonLabels();

    // Tutup popup
    const popup = document.getElementById('season-popup');
    if (popup) popup.classList.add('hidden');

    // Tampilkan versi unit di season baru
    showLegendDetail(unitName);
}

/* ═══════════════════════════════════════════════
   JUMP TO TAG — kembali ke archive (page-3) dengan tag aktif
═══════════════════════════════════════════════ */
function jumpToTag(tag) {
    UI.showPage('page-3');
    const panel = document.getElementById('filter-panel');
    if (panel) panel.classList.remove('hidden');
    filters.tags = [tag];
    renderArchive();
    document.querySelectorAll('.t-chip').forEach(c => {
        const rawTag = c.dataset.rawTag || c.innerText;
        if (rawTag === tag) c.classList.add('active');
        else c.classList.remove('active');
    });
}

init();

/* WATERMARK — PROPERLY SPACED, NO TEXT OVERLAP */
function addWatermarkToImage(canvas, ctx) {
    const mainText  = 'TikTok : ainime.id';
    const shortText = 'ainime.id';
    const w = canvas.width;
    const h = canvas.height;

    function measure(font, text) {
        ctx.font = font;
        return ctx.measureText(text).width;
    }

    ctx.save();

    const fs1   = Math.max(Math.min(w / 20, 20), 9);
    const font1 = `bold ${fs1}px Orbitron, Arial, sans-serif`;
    const tw1   = measure(font1, mainText);
    const gapX1  = tw1 * 1.5;
    const stepX1 = tw1 + gapX1;
    const stepY1 = fs1 * 3.5;

    ctx.font          = font1;
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'middle';
    ctx.rotate(-30 * Math.PI / 180);

    for (let x = -w * 1.5; x < w * 2.5; x += stepX1) {
        for (let y = -h; y < h * 2.5; y += stepY1) {
            ctx.globalAlpha = 0.20;
            ctx.fillStyle   = '#ffffff';
            ctx.fillText(mainText, x, y);
            ctx.globalAlpha = 0.07;
            ctx.fillStyle   = '#000000';
            ctx.fillText(mainText, x + 1.5, y + 1.5);
        }
    }
    ctx.restore();
    ctx.save();

    const fs2   = Math.max(Math.min(w / 28, 13), 7);
    const font2 = `${fs2}px Arial, sans-serif`;
    const tw2   = measure(font2, shortText);
    const stepX2 = (tw2 + tw2 * 2.0);
    const stepY2 = fs2 * 5;

    ctx.font         = font2;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.rotate(-15 * Math.PI / 180);

    for (let row = 0; row * stepY2 - h < h * 2.5; row++) {
        const offsetX = (row % 2 === 0) ? 0 : stepX2 * 0.5;
        const y = row * stepY2 - h * 0.5;
        for (let x = -w * 1.2 + offsetX; x < w * 2.2; x += stepX2) {
            ctx.globalAlpha = 0.12;
            ctx.fillStyle   = '#ffffff';
            ctx.fillText(shortText, x, y);
        }
    }
    ctx.restore();
    ctx.save();

    const fs3   = Math.max(Math.min(w / 32, 11), 6);
    const font3 = `${fs3}px Orbitron, Arial`;
    const tw3   = measure(font3, mainText);
    const stepX3 = tw3 + tw3 * 0.6;

    ctx.font         = font3;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    for (let x = 4; x < w; x += stepX3) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle   = '#ffffff';
        ctx.fillText(mainText, x, fs3 + 4);
        ctx.fillText(mainText, x, h - fs3 - 4);
    }
    ctx.restore();

    const dots = Math.floor(w * h * 0.006);
    for (let i = 0; i < dots; i++) {
        ctx.globalAlpha = 0.05 + Math.random() * 0.07;
        ctx.fillStyle   = Math.random() > 0.5 ? '#ffffff' : '#b0b0ff';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1.0;
}

/* INTERCEPT IMAGE DOWNLOADS - RIGHT CLICK CONTEXT MENU */
document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
        const img = e.target;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = function() {
            canvas.width = tempImg.width;
            canvas.height = tempImg.height;
            ctx.drawImage(tempImg, 0, 0);
            addWatermarkToImage(canvas, ctx);
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'ainime-' + Date.now() + '.png';
            link.click();
        };
        tempImg.src = img.src;
    }
}, true);
