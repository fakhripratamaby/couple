// ================== FIREBASE REALTIME DATABASE ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// --- TEMPEL KODE CONFIG FIREBASE ANDA DI DALAM KOTAK INI ---
const firebaseConfig = {
  // apiKey: "AIzaSy...",
  // authDomain: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "..."
};
// -----------------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ================== Data & penyimpanan ==================
const DEFAULT_START_DATE = new Date(2025, 11, 11, 0, 0, 0);
const DEFAULT_PHOTOS = () => ([
    { id: 'p1', src: null },
    { id: 'p2', src: null },
    { id: 'p3', src: null }
]);
const STORAGE_KEY = 'ej_data';
const MAX_PHOTOS = 12;

let siteData = { startDate: null, photos: DEFAULT_PHOTOS() };
let startDate = DEFAULT_START_DATE;

// PEMANTAU FIREBASE: Otomatis menerima data foto & tanggal dari HP lain
onValue(ref(db, 'coupleData'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        siteData = data;
        startDate = siteData.startDate ? new Date(siteData.startDate) : DEFAULT_START_DATE;
        if (isNaN(startDate.getTime())) startDate = DEFAULT_START_DATE;
        
        // Simpan cadangan di lokal lalu perbarui layar
        localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
        renderGallery();
        updateCounter();
        updateNextAnniversary();
        renderAdminPhotoList();
    }
});

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
        set(ref(db, 'coupleData'), siteData); // Mengirim ke HP lain
        return true;
    } catch (err) {
        return false;
    }
}

// ================== Galeri (slider dinamis) ==================
const gallerySlider = document.getElementById('gallerySlider');
const sliderTrack = document.getElementById('sliderTrack');
const sliderDots = document.getElementById('sliderDots');
const sliderPrev = document.getElementById('sliderPrev');
const sliderNext = document.getElementById('sliderNext');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentSlide = 0;
let autoplayTimer = null;

function heartIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
}

function renderGallery() {
    if(!sliderTrack) return;
    sliderTrack.innerHTML = '';
    sliderDots.innerHTML = '';
    currentSlide = 0;
    stopAutoplay();

    if (siteData.photos.length === 0) {
        sliderTrack.innerHTML = '<div class="slide-empty">Belum ada foto. Tambahkan lewat panel admin.</div>';
        sliderPrev.hidden = true;
        sliderNext.hidden = true;
        sliderDots.hidden = true;
        return;
    }

    siteData.photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.setAttribute('role', 'button');
        slide.setAttribute('aria-label', `Perbesar Foto ${index + 1}`);
        slide.innerHTML = photo.src
            ? `<img src="${photo.src}" alt="Foto kenangan ${index + 1}">`
            : `<div class="photo-placeholder">${heartIcon()}<span>Foto ${index + 1}</span></div>`;

        slide.addEventListener('click', () => openLightbox(slide));
        sliderTrack.appendChild(slide);

        const dot = document.createElement('button');
        dot.className = 'slider-dot';
        dot.setAttribute('aria-label', `Ke foto ${index + 1}`);
        dot.addEventListener('click', () => { goToSlide(index); restartAutoplay(); });
        sliderDots.appendChild(dot);
    });

    const multiple = siteData.photos.length > 1;
    sliderPrev.hidden = !multiple;
    sliderNext.hidden = !multiple;
    sliderDots.hidden = !multiple;

    goToSlide(0);
    startAutoplay();
}

function goToSlide(index) {
    const total = siteData.photos.length;
    if (total === 0) return;
    currentSlide = (index + total) % total;
    sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

    Array.from(sliderDots.children).forEach((dot, i) => {
        dot.classList.toggle('is-active', i === currentSlide);
    });
}

function nextSlide() { goToSlide(currentSlide + 1); }
function prevSlide() { goToSlide(currentSlide - 1); }

function startAutoplay() {
    stopAutoplay();
    if (prefersReducedMotion || siteData.photos.length <= 1) return;
    autoplayTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
}

function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
}
function restartAutoplay() { startAutoplay(); }

if(sliderNext) sliderNext.addEventListener('click', () => { nextSlide(); restartAutoplay(); });
if(sliderPrev) sliderPrev.addEventListener('click', () => { prevSlide(); restartAutoplay(); });

let touchStartX = null;
if(sliderTrack) {
    sliderTrack.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        stopAutoplay();
    }, { passive: true });

    sliderTrack.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 40) {
            if (deltaX < 0) nextSlide(); else prevSlide();
        }
        touchStartX = null;
        restartAutoplay();
    });
}

// ================== Countdown ==================
function setValue(id, value) {
    const el = document.getElementById(id);
    if(!el) return;
    const formatted = String(value).padStart(2, '0');
    if (el.textContent !== formatted) {
        el.textContent = formatted;
        el.classList.remove('tick');
        void el.offsetWidth; 
        el.classList.add('tick');
    }
}

function updateCounter() {
    const now = new Date();
    const difference = now - startDate;
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    setValue('days', Math.max(days, 0));
    setValue('hours', Math.max(hours, 0));
    setValue('minutes', Math.max(minutes, 0));
    setValue('seconds', Math.max(seconds, 0));
}

function updateNextAnniversary() {
    const el = document.getElementById('nextAnniversary');
    if (!el) return;
    const now = new Date();
    const years = now.getFullYear() - startDate.getFullYear();
    let nextAnniv = new Date(startDate);
    nextAnniv.setFullYear(startDate.getFullYear() + years);
    if (nextAnniv < now) {
        nextAnniv.setFullYear(startDate.getFullYear() + years + 1);
    }
    const milestoneNumber = nextAnniv.getFullYear() - startDate.getFullYear();
    const daysLeft = Math.ceil((nextAnniv - now) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
        el.innerHTML = `Selamat merayakan hari jadi ke-<strong>${milestoneNumber}</strong> hari ini! 🎉`;
    } else {
        el.innerHTML = `<strong>${daysLeft} hari</strong> menuju hari jadi ke-${milestoneNumber}`;
    }
}

setInterval(updateCounter, 1000);
setInterval(updateNextAnniversary, 1000 * 60 * 60);

// ================== Scroll reveal ==================
const revealTargets = Array.from(document.querySelectorAll('.reveal'));
if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    revealTargets.forEach(target => revealObserver.observe(target));
}

// ================== Lightbox ==================
const lightbox = document.getElementById('lightbox');
const lightboxFrame = document.getElementById('lightboxFrame');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(card) {
    if(!lightbox) return;
    lightboxFrame.innerHTML = card.innerHTML;
    lightbox.classList.add('is-open');
}
function closeLightbox() {
    if(!lightbox) return;
    lightbox.classList.remove('is-open');
    lightboxFrame.innerHTML = '';
}
if(lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if(lightbox) lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

// ================== Panel Admin ==================
const adminToggle = document.getElementById('adminToggle');
const adminOverlay = document.getElementById('adminOverlay');
const adminPanelClose = document.getElementById('adminPanelClose');
const adminLock = document.getElementById('adminLock');
const adminLockHint = document.getElementById('adminLockHint');
const adminContent = document.getElementById('adminContent');
const pinInput = document.getElementById('pinInput');
const pinSubmit = document.getElementById('pinSubmit');
const startDateInput = document.getElementById('startDateInput');
const saveDateBtn = document.getElementById('saveDateBtn');
const adminPhotoList = document.getElementById('adminPhotoList');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const photoFileInput = document.getElementById('photoFileInput');

let isAuthenticated = false;
let pendingReplaceId = null;

function showStatus(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    setTimeout(() => { el.textContent = ''; }, 3000);
}

function openAdmin() {
    if(!adminOverlay) return;
    adminOverlay.classList.add('is-open');
    if (isAuthenticated) showAdminContent();
    else showLockScreen();
}
function closeAdmin() {
    if(adminOverlay) adminOverlay.classList.remove('is-open');
}
function showLockScreen() {
    adminLock.hidden = false;
    adminContent.hidden = true;
    adminLockHint.textContent = 'Masukkan PIN untuk mengedit situs.';
}
function showAdminContent() {
    adminLock.hidden = true;
    adminContent.hidden = false;
    const pad = n => String(n).padStart(2, '0');
    const d = startDate;
    if(startDateInput) startDateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    renderAdminPhotoList();
}

if(pinSubmit) pinSubmit.addEventListener('click', () => {
    const existingPin = localStorage.getItem('ej_pin') || '1111'; // PIN Bawaan jika belum ada
    if (pinInput.value === existingPin) {
        isAuthenticated = true;
        showAdminContent();
    } else {
        adminLockHint.textContent = 'PIN salah, coba lagi.';
    }
});

function resizeImage(file, maxDim = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; } 
                    else { width = Math.round(width * (maxDim / height)); height = maxDim; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderAdminPhotoList() {
    if(!adminPhotoList) return;
    adminPhotoList.innerHTML = '';
    siteData.photos.forEach((photo, index) => {
        const row = document.createElement('div');
        row.className = 'admin-photo-row';
        const thumb = photo.src ? `<img class="admin-photo-thumb" src="${photo.src}" alt="">` : `<div class="admin-photo-thumb" style="display:flex;align-items:center;justify-content:center;">🤍</div>`;
        row.innerHTML = `${thumb}<span>Foto ${index + 1}</span>`;

        const replaceBtn = document.createElement('button');
        replaceBtn.textContent = 'Ganti';
        replaceBtn.addEventListener('click', () => { pendingReplaceId = photo.id; photoFileInput.click(); });
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Hapus';
        removeBtn.addEventListener('click', () => {
            siteData.photos = siteData.photos.filter(p => p.id !== photo.id);
            saveData();
        });

        row.appendChild(replaceBtn);
        row.appendChild(removeBtn);
        adminPhotoList.appendChild(row);
    });
}

if(addPhotoBtn) addPhotoBtn.addEventListener('click', () => {
    pendingReplaceId = null;
    photoFileInput.click();
});

if(photoFileInput) photoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showStatus('photoStatus', 'Mengunggah ke semua HP...');
    try {
        const dataUrl = await resizeImage(file);
        if (pendingReplaceId) {
            const photo = siteData.photos.find(p => p.id === pendingReplaceId);
            if (photo) photo.src = dataUrl;
        } else {
            siteData.photos.push({ id: 'p_' + Date.now(), src: dataUrl });
        }
        saveData();
        showStatus('photoStatus', 'Berhasil tersinkron!');
    } catch (err) {
        showStatus('photoStatus', 'Gagal memuat foto.');
    } finally {
        photoFileInput.value = '';
    }
});

if(saveDateBtn) saveDateBtn.addEventListener('click', () => {
    const newDate = new Date(startDateInput.value);
    if (!isNaN(newDate.getTime())) {
        siteData.startDate = newDate.toISOString();
        saveData();
        showStatus('dateStatus', 'Tanggal berhasil diperbarui!');
    }
});

if(adminToggle) adminToggle.addEventListener('click', openAdmin);
if(adminPanelClose) adminPanelClose.addEventListener('click', closeAdmin);

// ================== Fitur Musik Sinkron (Firebase) ==================
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const musicFileInput = document.getElementById('musicFileInput'); 
const saveMusicBtn = document.getElementById('saveMusicBtn');
const musicStatus = document.getElementById('musicStatus');

// 1. Pemantau Pemutar Musik (Play/Pause)
onValue(ref(db, 'musicState'), (snapshot) => {
    const state = snapshot.val();
    if (state && bgMusic) {
        if (state.play) {
            bgMusic.play().then(() => {
                if(musicBtn) musicBtn.classList.add('playing');
            }).catch(() => {
                console.log("Menunggu sentuhan Ketryn untuk memutar lagu...");
            });
        } else {
            bgMusic.pause();
            if(musicBtn) musicBtn.classList.remove('playing');
        }
    }
});

// 2. Tombol Musik Lokal (Kirim sinyal)
if (musicBtn && bgMusic) {
    musicBtn.addEventListener('click', () => {
        const willPlay = bgMusic.paused;
        set(ref(db, 'musicState'), { play: willPlay, timestamp: Date.now() });
    });
}

// 3. Pemantau File Lagu Baru
onValue(ref(db, 'musicFile'), (snapshot) => {
    const base64Audio = snapshot.val();
    if (base64Audio && bgMusic) {
        bgMusic.src = base64Audio;
        localStorage.setItem('savedMusic', base64Audio);
    }
});

// 4. Unggah File Lagu Baru
if (saveMusicBtn && musicFileInput) {
    saveMusicBtn.addEventListener('click', () => {
        const file = musicFileInput.files[0];
        if (!file || file.size > 3145728) {
            showStatus('musicStatus', 'Gagal! Pilih file maksimal 3MB.');
            return;
        }
        showStatus('musicStatus', 'Menyinkronkan lagu ke Ketryn...');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            set(ref(db, 'musicFile'), e.target.result).then(() => {
                showStatus('musicStatus', 'Lagu baru berhasil dikirim!');
                set(ref(db, 'musicState'), { play: false, timestamp: Date.now() });
            }).catch(() => showStatus('musicStatus', 'Gagal mengirim lagu.'));
        };
        reader.readAsDataURL(file);
    });
}

// ================== Fitur Tema Sinkron ==================
const themeSelect = document.getElementById('themeSelect');
const themes = {
    dark: { bg: '#121212', text: '#ffffff' },
    pink: { bg: '#ffe4e1', text: '#4a0e2e' },
    blue: { bg: '#0f172a', text: '#f8fafc' },
    coffee: { bg: '#3e2723', text: '#d7ccc8' }
};

function applyTheme(themeName) {
    const theme = themes[themeName];
    if (theme) {
        document.documentElement.style.setProperty('--bg-color', theme.bg);
        document.documentElement.style.setProperty('--text-color', theme.text);
    }
}

onValue(ref(db, 'themeState'), (snapshot) => {
    const val = snapshot.val() || 'dark';
    applyTheme(val);
    if (themeSelect) themeSelect.value = val;
});

if (themeSelect) {
    themeSelect.addEventListener('change', function(e) {
        set(ref(db, 'themeState'), e.target.value);
    });
}

// Animasi Partikel
function createFloatingSymbol() {
    const symbol = document.createElement('div');
    symbol.classList.add('floating-symbol');
    symbol.innerText = '•';
    symbol.style.left = Math.random() * 100 + 'vw';
    symbol.style.fontSize = Math.random() * 1 + 0.5 + 'rem'; 
    const windDirection = Math.random() > 0.5 ? 1 : -1; 
    symbol.style.setProperty('--wind-drift', `${Math.random() * 120 * windDirection}px`);
    const animationDuration = Math.random() * 5 + 6;
    symbol.style.animationDuration = animationDuration + 's';
    document.body.appendChild(symbol);
    setTimeout(() => symbol.remove(), animationDuration * 1000);
}
setInterval(createFloatingSymbol, 1000);
