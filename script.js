// ================== FIREBASE REALTIME DATABASE ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 🔴 SANGAT PENTING: Ganti isi kotak di bawah ini dengan kode konfigurasi asli milik Anda!
const firebaseConfig = {
    // apiKey: "AIzaSy...",
    // authDomain: "...",
    // projectId: "...",
    // storageBucket: "...",
    // messagingSenderId: "...",
    // appId: "..."
};
// -----------------------------------------------------------

// ================== Data & penyimpanan ==================
const DEFAULT_START_DATE = new Date(2025, 11, 11, 0, 0, 0); // Pengaturan Tanggal Bawaan
const DEFAULT_PHOTOS = () => ([
    { id: 'p1', src: null },
    { id: 'p2', src: null },
    { id: 'p3', src: null }
]);
const STORAGE_KEY = 'ej_data';

let siteData = { startDate: null, photos: DEFAULT_PHOTOS() };
let startDate = DEFAULT_START_DATE;

// 1. Muat dari lokal dulu agar web langsung menyala (Anti-Blank)
try {
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (localData && localData.photos) {
        siteData = localData;
        startDate = siteData.startDate ? new Date(siteData.startDate) : DEFAULT_START_DATE;
    }
} catch(e) {}

let db = null;

// 2. Coba nyalakan Firebase (Jika gagal, web tetap hidup)
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);

    // Pemantau Data Utama dari Firebase
    onValue(ref(db, 'coupleData'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            siteData = data;
            startDate = siteData.startDate ? new Date(siteData.startDate) : DEFAULT_START_DATE;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
            renderGallery();
            updateCounter();
            updateNextAnniversary();
            renderAdminPhotoList();
        }
    });
} catch (error) {
    console.warn("Firebase belum terhubung. Berjalan dalam mode lokal.");
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
        if (db) set(ref(db, 'coupleData'), siteData); // Kirim ke Firebase jika aktif
        return true;
    } catch (err) { return false; }
}

// ================== Galeri (slider dinamis) ==================
const sliderTrack = document.getElementById('sliderTrack');
const sliderDots = document.getElementById('sliderDots');
const sliderPrev = document.getElementById('sliderPrev');
const sliderNext = document.getElementById('sliderNext');
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
        if(sliderPrev) sliderPrev.hidden = true;
        if(sliderNext) sliderNext.hidden = true;
        if(sliderDots) sliderDots.hidden = true;
        return;
    }
    siteData.photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.setAttribute('role', 'button');
        slide.innerHTML = photo.src ? `<img src="${photo.src}" alt="Foto ${index + 1}">` : `<div class="photo-placeholder">${heartIcon()}<span>Foto ${index + 1}</span></div>`;
        slide.addEventListener('click', () => openLightbox(slide));
        sliderTrack.appendChild(slide);
        const dot = document.createElement('button');
        dot.className = 'slider-dot';
        dot.addEventListener('click', () => { goToSlide(index); restartAutoplay(); });
        sliderDots.appendChild(dot);
    });
    const multiple = siteData.photos.length > 1;
    if(sliderPrev) sliderPrev.hidden = !multiple;
    if(sliderNext) sliderNext.hidden = !multiple;
    if(sliderDots) sliderDots.hidden = !multiple;
    goToSlide(0);
    startAutoplay();
}

function goToSlide(index) {
    const total = siteData.photos.length;
    if (total === 0) return;
    currentSlide = (index + total) % total;
    
    // Tambahkan efek animasi geser yang mulus di sini
    sliderTrack.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

    Array.from(sliderDots.children).forEach((dot, i) => dot.classList.toggle('is-active', i === currentSlide));
}
function nextSlide() { goToSlide(currentSlide + 1); }
function prevSlide() { goToSlide(currentSlide - 1); }
function startAutoplay() {
    stopAutoplay();
    if (siteData.photos.length <= 1) return;
    autoplayTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
}
function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
}
function restartAutoplay() { startAutoplay(); }
if(sliderNext) sliderNext.addEventListener('click', () => { nextSlide(); restartAutoplay(); });
if(sliderPrev) sliderPrev.addEventListener('click', () => { prevSlide(); restartAutoplay(); });

// Sensor geser (swipe) untuk layar sentuh HP
let touchStartX = null;

if (sliderTrack) {
    // Saat jari mulai menyentuh foto
    sliderTrack.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        stopAutoplay(); // Hentikan auto-geser sebentar
    }, { passive: true });

    // Saat jari dilepas dari layar
    sliderTrack.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        
        // Jarak minimal usapan jari 40px agar responsif
        if (Math.abs(deltaX) > 40) {
            if (deltaX < 0) nextSlide(); // Geser ke kiri (foto selanjutnya)
            else prevSlide(); // Geser ke kanan (foto sebelumnya)
        }
        touchStartX = null;
        restartAutoplay(); // Lanjutkan auto-geser
    });
}

// Panggil render saat pertama kali dimuat
renderGallery();

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
    if (nextAnniv < now) nextAnniv.setFullYear(startDate.getFullYear() + years + 1);
    const milestoneNumber = nextAnniv.getFullYear() - startDate.getFullYear();
    const daysLeft = Math.ceil((nextAnniv - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) el.innerHTML = `Selamat merayakan hari jadi ke-<strong>${milestoneNumber}</strong>! 🎉`;
    else el.innerHTML = `<strong>${daysLeft} hari</strong> menuju hari jadi ke-${milestoneNumber}`;
}
setInterval(updateCounter, 1000);
setInterval(updateNextAnniversary, 1000 * 60 * 60);
updateCounter();
updateNextAnniversary();

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
if(lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

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
    else {
        adminLock.hidden = false;
        adminContent.hidden = true;
        adminLockHint.textContent = 'Masukkan PIN (Bawaan: 1111)';
    }
}
function closeAdmin() { if(adminOverlay) adminOverlay.classList.remove('is-open'); }
function showAdminContent() {
    adminLock.hidden = true;
    adminContent.hidden = false;
    const pad = n => String(n).padStart(2, '0');
    if(startDateInput) startDateInput.value = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
    renderAdminPhotoList();
}

if(pinSubmit) pinSubmit.addEventListener('click', () => {
    if (pinInput.value === '1111') {
        isAuthenticated = true;
        showAdminContent();
    } else {
        adminLockHint.textContent = 'PIN salah, coba lagi.';
    }
});

function resizeImage(file, maxDim = 900, quality = 0.82) {
    return new Promise((resolve) => {
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
            renderGallery();
            renderAdminPhotoList();
        });
        row.appendChild(replaceBtn);
        row.appendChild(removeBtn);
        adminPhotoList.appendChild(row);
    });
}

if(addPhotoBtn) addPhotoBtn.addEventListener('click', () => { pendingReplaceId = null; photoFileInput.click(); });

if(photoFileInput) photoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showStatus('photoStatus', 'Memproses...');
    try {
        const dataUrl = await resizeImage(file);
        if (pendingReplaceId) {
            const photo = siteData.photos.find(p => p.id === pendingReplaceId);
            if (photo) photo.src = dataUrl;
        } else {
            siteData.photos.push({ id: 'p_' + Date.now(), src: dataUrl });
        }
        saveData();
        renderGallery();
        renderAdminPhotoList();
        showStatus('photoStatus', 'Tersimpan!');
    } catch (err) { showStatus('photoStatus', 'Gagal.'); }
    photoFileInput.value = '';
});

if(saveDateBtn) saveDateBtn.addEventListener('click', () => {
    const newDate = new Date(startDateInput.value);
    if (!isNaN(newDate.getTime())) {
        siteData.startDate = newDate.toISOString();
        startDate = newDate;
        saveData();
        updateCounter();
        updateNextAnniversary();
        showStatus('dateStatus', 'Tanggal diperbarui!');
    }
});

if(adminToggle) adminToggle.addEventListener('click', openAdmin);
if(adminPanelClose) adminPanelClose.addEventListener('click', closeAdmin);

// ================== Fitur Musik & Tema ==================
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const musicFileInput = document.getElementById('musicFileInput'); 
const saveMusicBtn = document.getElementById('saveMusicBtn');

// Load lagu cadangan lokal
const savedMusic = localStorage.getItem('savedMusic') || 'lagu.mp3';
if (bgMusic) bgMusic.src = savedMusic;

if (db) {
    onValue(ref(db, 'musicState'), (snapshot) => {
        const state = snapshot.val();
        if (state && bgMusic) {
            if (state.play) {
                bgMusic.play().then(() => {
                    if(musicBtn) musicBtn.classList.add('playing');
                }).catch(() => console.log("Menunggu interaksi pengguna..."));
            } else {
                bgMusic.pause();
                if(musicBtn) musicBtn.classList.remove('playing');
            }
        }
    });

    onValue(ref(db, 'musicFile'), (snapshot) => {
        const base64Audio = snapshot.val();
        if (base64Audio && bgMusic) {
            bgMusic.src = base64Audio;
            localStorage.setItem('savedMusic', base64Audio);
        }
    });
}

if (musicBtn && bgMusic) {
    musicBtn.addEventListener('click', () => {
        const willPlay = bgMusic.paused;
        if(db) set(ref(db, 'musicState'), { play: willPlay, timestamp: Date.now() });
        else {
            // Mode Lokal jika Firebase mati
            if (willPlay) { bgMusic.play(); musicBtn.classList.add('playing'); } 
            else { bgMusic.pause(); musicBtn.classList.remove('playing'); }
        }
    });
}

if (saveMusicBtn && musicFileInput) {
    saveMusicBtn.addEventListener('click', () => {
        const file = musicFileInput.files[0];
        if (!file) return;
        showStatus('musicStatus', 'Memproses...');
        const reader = new FileReader();
        reader.onload = function(e) {
            const result = e.target.result;
            localStorage.setItem('savedMusic', result);
            if(bgMusic) bgMusic.src = result;
            if (db) {
                set(ref(db, 'musicFile'), result).then(() => {
                    showStatus('musicStatus', 'Lagu tersinkron!');
                    set(ref(db, 'musicState'), { play: false, timestamp: Date.now() });
                });
            } else {
                showStatus('musicStatus', 'Disimpan di lokal.');
            }
        };
        reader.readAsDataURL(file);
    });
}

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

// Load tema lokal terlebih dahulu
const currentTheme = localStorage.getItem('savedTheme') || 'dark';
applyTheme(currentTheme);
if (themeSelect) themeSelect.value = currentTheme;

if (db) {
    onValue(ref(db, 'themeState'), (snapshot) => {
        const val = snapshot.val();
        if(val) {
            applyTheme(val);
            localStorage.setItem('savedTheme', val);
            if (themeSelect) themeSelect.value = val;
        }
    });
}

if (themeSelect) themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
    localStorage.setItem('savedTheme', e.target.value);
    if(db) set(ref(db, 'themeState'), e.target.value);
});

function createFloatingSymbol() {
    const symbol = document.createElement('div');
    symbol.classList.add('floating-symbol');
    symbol.innerText = '•';
    symbol.style.left = Math.random() * 100 + 'vw';
    symbol.style.fontSize = Math.random() * 1 + 0.5 + 'rem'; 
    symbol.style.setProperty('--wind-drift', `${Math.random() * 120 * (Math.random() > 0.5 ? 1 : -1)}px`);
    const dur = Math.random() * 5 + 6;
    symbol.style.animationDuration = dur + 's';
    document.body.appendChild(symbol);
    setTimeout(() => symbol.remove(), dur * 1000);
}
setInterval(createFloatingSymbol, 1000);
