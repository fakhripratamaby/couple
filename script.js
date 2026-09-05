// ================== Data & penyimpanan ==================
// Nilai ini dipakai kalau belum ada perubahan tersimpan di browser.
// Format tanggal: new Date(TAHUN, BULAN-1, TANGGAL, JAM, MENIT)
const DEFAULT_START_DATE = new Date(2025, 11, 11, 0, 0, 0);
const DEFAULT_PHOTOS = () => ([
    { id: 'p1', src: null },
    { id: 'p2', src: null },
    { id: 'p3', src: null }
]);
const STORAGE_KEY = 'ej_data';
const MAX_PHOTOS = 12;

function loadSiteData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            startDate: parsed.startDate || null,
            photos: Array.isArray(parsed.photos) && parsed.photos.length ? parsed.photos : DEFAULT_PHOTOS()
        };
    } catch (err) {
        return null;
    }
}

let siteData = loadSiteData() || { startDate: null, photos: DEFAULT_PHOTOS() };
let startDate = siteData.startDate ? new Date(siteData.startDate) : DEFAULT_START_DATE;
if (isNaN(startDate.getTime())) startDate = DEFAULT_START_DATE;

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
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
        slide.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(slide);
            }
        });
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

    Array.from(sliderTrack.children).forEach((slide, i) => {
        const active = i === currentSlide;
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        slide.tabIndex = active ? 0 : -1;
    });
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

sliderNext.addEventListener('click', () => { nextSlide(); restartAutoplay(); });
sliderPrev.addEventListener('click', () => { prevSlide(); restartAutoplay(); });

gallerySlider.addEventListener('mouseenter', stopAutoplay);
gallerySlider.addEventListener('mouseleave', startAutoplay);
gallerySlider.addEventListener('focusin', stopAutoplay);
gallerySlider.addEventListener('focusout', startAutoplay);
gallerySlider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { nextSlide(); restartAutoplay(); }
    else if (e.key === 'ArrowLeft') { prevSlide(); restartAutoplay(); }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
});

// Swipe gesture (mobile)
let touchStartX = null;
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

renderGallery();

// ================== Countdown ==================
function setValue(id, value) {
    const el = document.getElementById(id);
    const formatted = String(value).padStart(2, '0');
    if (el.textContent !== formatted) {
        el.textContent = formatted;
        el.classList.remove('tick');
        void el.offsetWidth; // reflow supaya animasi bisa retrigger
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
updateCounter();
updateNextAnniversary();
setInterval(updateNextAnniversary, 1000 * 60 * 60);

// ================== Scroll reveal (di luar galeri) ==================
const revealTargets = Array.from(document.querySelectorAll('.reveal'));
const timelineTrack = document.querySelector('.timeline');

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

    if (timelineTrack) {
        const timelineObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        timelineObserver.observe(timelineTrack);
    }
} else {
    revealTargets.forEach(target => target.classList.add('is-visible'));
    if (timelineTrack) timelineTrack.classList.add('is-visible');
}

// ================== Lightbox ==================
const lightbox = document.getElementById('lightbox');
const lightboxFrame = document.getElementById('lightboxFrame');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(card) {
    lightboxFrame.innerHTML = card.innerHTML;
    lightbox.classList.add('is-open');
    lightboxClose.focus();
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightboxFrame.innerHTML = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
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
const resetSiteBtn = document.getElementById('resetSiteBtn');

let isAuthenticated = false;
let pendingReplaceId = null;
const statusTimers = {};

function showStatus(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    clearTimeout(statusTimers[id]);
    statusTimers[id] = setTimeout(() => { el.textContent = ''; }, 3000);
}

function getStoredPin() {
    return localStorage.getItem('ej_pin');
}

function openAdmin() {
    adminOverlay.classList.add('is-open');
    if (isAuthenticated) showAdminContent();
    else showLockScreen();
}

function closeAdmin() {
    adminOverlay.classList.remove('is-open');
    pinInput.value = '';
}

function showLockScreen() {
    adminLock.hidden = false;
    adminContent.hidden = true;
    const existingPin = getStoredPin();
    adminLockHint.textContent = existingPin
        ? 'Masukkan PIN untuk mengedit situs.'
        : 'Buat PIN baru (minimal 4 digit) untuk melindungi panel ini.';
    pinInput.value = '';
    pinInput.focus();
}

function showAdminContent() {
    adminLock.hidden = true;
    adminContent.hidden = false;
    prefillDateInput();
    renderAdminPhotoList();
}

function submitPin() {
    const value = pinInput.value.trim();
    const existingPin = getStoredPin();

    if (!existingPin) {
        if (value.length < 4) {
            adminLockHint.textContent = 'PIN minimal 4 digit.';
            return;
        }
        localStorage.setItem('ej_pin', value);
        isAuthenticated = true;
        showAdminContent();
        return;
    }

    if (value === existingPin) {
        isAuthenticated = true;
        showAdminContent();
    } else {
        adminLockHint.textContent = 'PIN salah, coba lagi.';
        pinInput.value = '';
        pinInput.focus();
    }
}

function prefillDateInput() {
    const pad = n => String(n).padStart(2, '0');
    const d = startDate;
    startDateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resizeImage(file, maxDim = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Gagal memuat gambar'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function generatePhotoId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function renderAdminPhotoList() {
    adminPhotoList.innerHTML = '';

    siteData.photos.forEach((photo, index) => {
        const row = document.createElement('div');
        row.className = 'admin-photo-row';

        const thumb = photo.src
            ? `<img class="admin-photo-thumb" src="${photo.src}" alt="">`
            : `<div class="admin-photo-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🤍</div>`;

        row.innerHTML = `${thumb}<span>Foto ${index + 1}</span>`;

        const replaceBtn = document.createElement('button');
        replaceBtn.textContent = 'Ganti';
        replaceBtn.addEventListener('click', () => {
            pendingReplaceId = photo.id;
            photoFileInput.click();
        });

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Hapus';
        removeBtn.className = 'admin-remove';
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

addPhotoBtn.addEventListener('click', () => {
    if (siteData.photos.length >= MAX_PHOTOS) {
        showStatus('photoStatus', `Maksimal ${MAX_PHOTOS} foto tersimpan di browser ini.`);
        return;
    }
    pendingReplaceId = null;
    photoFileInput.click();
});

photoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const dataUrl = await resizeImage(file);
        if (pendingReplaceId) {
            const photo = siteData.photos.find(p => p.id === pendingReplaceId);
            if (photo) photo.src = dataUrl;
        } else {
            siteData.photos.push({ id: generatePhotoId(), src: dataUrl });
        }
        const ok = saveData();
        renderGallery();
        renderAdminPhotoList();
        showStatus('photoStatus', ok ? 'Foto tersimpan.' : 'Penyimpanan browser penuh — hapus beberapa foto lama.');
    } catch (err) {
        showStatus('photoStatus', 'Gagal memuat foto, coba file lain.');
    } finally {
        photoFileInput.value = '';
        pendingReplaceId = null;
    }
});

saveDateBtn.addEventListener('click', () => {
    const value = startDateInput.value;
    if (!value) return;
    const newDate = new Date(value);
    if (isNaN(newDate.getTime())) {
        showStatus('dateStatus', 'Tanggal tidak valid.');
        return;
    }
    startDate = newDate;
    siteData.startDate = newDate.toISOString();
    const ok = saveData();
    updateCounter();
    updateNextAnniversary();
    showStatus('dateStatus', ok ? 'Tersimpan!' : 'Gagal menyimpan ke browser.');
});

resetSiteBtn.addEventListener('click', () => {
    const confirmed = confirm('Yakin ingin mengembalikan tanggal & foto ke tampilan awal? Perubahan di perangkat ini akan dihapus.');
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    siteData = { startDate: null, photos: DEFAULT_PHOTOS() };
    startDate = DEFAULT_START_DATE;

    renderGallery();
    renderAdminPhotoList();
    prefillDateInput();
    updateCounter();
    updateNextAnniversary();
    showStatus('photoStatus', 'Dikembalikan ke tampilan awal.');
});

adminToggle.addEventListener('click', openAdmin);
adminPanelClose.addEventListener('click', closeAdmin);
adminOverlay.addEventListener('click', (e) => {
    if (e.target === adminOverlay) closeAdmin();
});
pinSubmit.addEventListener('click', submitPin);
pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
});

// ================== Escape key: tutup overlay yang sedang terbuka ==================
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (lightbox.classList.contains('is-open')) closeLightbox();
    else if (adminOverlay.classList.contains('is-open')) closeAdmin();
});

// --- FITUR PARTIKEL ANGIN (PASTIKAN KODE INI ADA) ---
function createFloatingSymbol() {
    const symbol = document.createElement('div');
    symbol.classList.add('floating-symbol');
    symbol.innerText = '•';
    
    // Posisi awal acak
    symbol.style.left = Math.random() * 100 + 'vw';
    symbol.style.fontSize = Math.random() * 1 + 0.5 + 'rem'; 
    
    // Arah angin acak
    const windDirection = Math.random() > 0.5 ? 1 : -1; 
    const windDrift = Math.random() * 120 * windDirection; 
    symbol.style.setProperty('--wind-drift', `${windDrift}px`);
    
    // Durasi animasi (antara 6 sampai 11 detik)
    const animationDuration = Math.random() * 5 + 6;
    symbol.style.animationDuration = animationDuration + 's';
    
    document.body.appendChild(symbol);
    
    // Hapus setelah selesai
    setTimeout(() => {
        symbol.remove();
    }, animationDuration * 1000);
}

// Munculkan partikel baru setiap 0.3 detik
setInterval(createFloatingSymbol, 300);

// --- Fitur Pemutar Musik & Admin (Versi Upload File) ---
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const musicFileInput = document.getElementById('musicFileInput'); 
const saveMusicBtn = document.getElementById('saveMusicBtn');
const musicStatus = document.getElementById('musicStatus');

// 1. Muat musik yang terakhir kali disimpan
const savedMusic = localStorage.getItem('savedMusic') || 'lagu.mp3';
if (bgMusic) bgMusic.src = savedMusic;

// 2. Kontrol Play/Pause 
if (musicBtn && bgMusic) {
    musicBtn.addEventListener('click', () => {
        if (bgMusic.paused) {
            bgMusic.play();
            musicBtn.classList.add('playing');
        } else {
            bgMusic.pause();
            musicBtn.classList.remove('playing');
        }
    });
}

// 3. Proses Upload File Lagu
if (saveMusicBtn && musicFileInput) {
    saveMusicBtn.addEventListener('click', () => {
        const file = musicFileInput.files[0];
        
        if (!file) {
            musicStatus.innerText = "Pilih file lagu terlebih dahulu!";
            musicStatus.style.color = "#ff4d4d";
            setTimeout(() => { musicStatus.innerText = ""; }, 3000);
            return;
        }

        // Batasi ukuran maksimal 3MB (3 * 1024 * 1024 bytes)
        if (file.size > 3145728) {
            musicStatus.innerText = "Ukuran file terlalu besar! Maksimal 3MB.";
            musicStatus.style.color = "#ff4d4d";
            setTimeout(() => { musicStatus.innerText = ""; }, 3000);
            return;
        }

        musicStatus.innerText = "Menyimpan... Mohon tunggu.";
        musicStatus.style.color = "#fbbf24";

        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const base64Audio = e.target.result;
                localStorage.setItem('savedMusic', base64Audio);
                bgMusic.src = base64Audio;
                musicBtn.classList.remove('playing'); 
                
                musicStatus.innerText = "Lagu berhasil disimpan!";
                musicStatus.style.color = "#4ade80";
            } catch (error) {
                // Jika memori browser melebihi batas 5MB
                musicStatus.innerText = "Gagal! Memori browser penuh.";
                musicStatus.style.color = "#ff4d4d";
            }
            setTimeout(() => { musicStatus.innerText = ""; }, 3000);
        };

        // Membaca file lagu untuk disimpan
        reader.readAsDataURL(file);
    });
}

// Menjalankan fungsi createFloatingSymbol setiap 1 detik (1000 milidetik)
// Ubah angka 1000 jika ingin simbol muncul lebih cepat/lambat
setInterval(createFloatingSymbol, 1000);

// --- Fitur Ubah Tema UI Admin ---
const themeSelect = document.getElementById('themeSelect');

// Daftar warna berdasarkan tema
const themes = {
    dark: { bg: '#121212', text: '#ffffff' },
    pink: { bg: '#ffe4e1', text: '#4a0e2e' },
    blue: { bg: '#0f172a', text: '#f8fafc' },
    coffee: { bg: '#3e2723', text: '#d7ccc8' }
};

// Fungsi untuk menerapkan dan menyimpan tema
function applyTheme(themeName) {
    const theme = themes[themeName];
    if (theme) {
        document.documentElement.style.setProperty('--bg-color', theme.bg);
        document.documentElement.style.setProperty('--text-color', theme.text);
        localStorage.setItem('savedTheme', themeName);
    }
}

// Mendeteksi perubahan pada menu dropdown
if (themeSelect) {
    themeSelect.addEventListener('change', function(e) {
        applyTheme(e.target.value);
    });
}

// Memuat tema yang terakhir kali dipilih agar tidak hilang saat di-refresh
const currentTheme = localStorage.getItem('savedTheme') || 'dark';
applyTheme(currentTheme);

if (themeSelect) {
    themeSelect.value = currentTheme;
}
