/**
 * ==========================================================
 * GAK WARAS SKYBLOCK - FRONTEND CORE LOGIC
 * ==========================================================
 * Implementation: Vanilla JavaScript (ES6+)
 * Deskripsi: Menangani interaktivitas UI, Scrollspy, 
 *            Copy IP, dan Fetching Data (Live Status & Leaderboard).
 * ==========================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi Fitur UI
    initNavbarScrollspy();
    applyLinks(); // Ambil dan terapkan link dinamis
    initExclusiveAccordion(); // Fitur baru: Accordion premium
    initTerminalAnimation(); // Fitur baru: Boot animation
    initPreloader(); // Handle pre-loader removal
    
    // Inisialisasi Data Fetching saat Load Pertama
    fetchLeaderboard();
    fetchServerStats();    // Ambil data kosmetik awal
    fetchRealPlayerCount(); // Ambil data real player awal

    // --- MANAJEMEN INTERVAL (CRITICAL) ---
    
    // 1. Refresh Status Kosmetik (TPS/Ping/Load) - Setiap 5 detik
    // Mengambil data dari backend internal kita.
    setInterval(fetchServerStats, 5000);

    // 2. Refresh Real Player Count - Setiap 60 detik (1 Menit)
    // WAJIB 60 detik untuk menghindari Rate Limit dari public API mcstatus.io.
    setInterval(fetchRealPlayerCount, 60000);
});

// --- 0. DYNAMIC LINKS MANAGEMENT ---
/**
 * Mengambil link dari backend dan memperbarui elemen UI secara dinamis.
 */
let CURRENT_LINKS = {
    display_ip: 'play.gakwaras.my.id',
    port: '23100'
};

async function applyLinks() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Gagal mengambil konfigurasi link');
        
        const data = await response.json();
        const links = data.links;
        
        if (links) {
            CURRENT_LINKS = links;
            
            // Update Discord Links
            const discordLinks = document.querySelectorAll('#discord-link, #discord-banner-link');
            discordLinks.forEach(el => el.href = links.discord_url);
            
            // Update Play Buttons
            const playButtons = document.querySelectorAll('#hero-play-button, #nav-play-button');
            const deepLink = `minecraft://?addExternalServer=GAK%20WARAS%20SKYBLOCK|${links.direct_play_ip}|${links.port}`;
            playButtons.forEach(el => el.href = deepLink);
            
            // Update Display IP Text
            const displayIpText = document.getElementById('display-ip-text');
            if (displayIpText) {
                displayIpText.textContent = `${links.display_ip}:${links.port}`;
            }

            // Re-initialize Copy IP to use new values
            initCopyIP();
        }
    } catch (error) {
        console.error('Error applying links:', error);
    }
}

// --- 1. NAVBAR SCROLLSPY & ACTIVE STATE ---
/**
 * Fungsi untuk mendeteksi posisi scroll dan memperbarui menu aktif
 * serta menangani smooth scroll saat link diklik.
 */
function initNavbarScrollspy() {
    const navLinks = document.querySelectorAll('nav .hidden.md\\:flex a');
    const sections = document.querySelectorAll('section[id]');
    
    // Smooth Scrolling untuk navigasi internal
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1) || 'home';
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80, // Offset untuk sticky navbar
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Class Tailwind untuk state Aktif/Non-aktif
    const activeClasses = ['text-[#cc97ff]', 'font-bold', 'border-b-2', 'border-[#cc97ff]', 'pb-1'];
    const inactiveClasses = ['text-slate-300', 'hover:text-[#6bff8f]'];

    function updateActiveNav(id) {
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            const isHome = id === 'home' && (href === '#' || href === '');
            const isMatch = isHome || href === `#${id}`;

            if (isMatch) {
                link.classList.add(...activeClasses);
                link.classList.remove(...inactiveClasses);
            } else {
                link.classList.remove(...activeClasses);
                link.classList.add(...inactiveClasses);
            }
        });
    }

    // Intersection Observer untuk mendeteksi section yang terlihat di layar
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                updateActiveNav(entry.target.id);
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' });

    sections.forEach(section => observer.observe(section));
}

// --- 2. ONE-CLICK COPY IP ---
/**
 * Fungsi untuk menyalin IP Server ke clipboard
 * Memberikan feedback visual sementara kepada user.
 */
function initCopyIP() {
    const copyElement = document.querySelector('.copy-ip-text');
    const IP_SERVER = `${CURRENT_LINKS.display_ip}:${CURRENT_LINKS.port}`;
    
    if (!copyElement) return;

    // Remove existing event listeners to avoid duplicates if re-called
    const newElement = copyElement.cloneNode(true);
    copyElement.parentNode.replaceChild(newElement, copyElement);

    const originalHTML = newElement.innerHTML;

    newElement.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(IP_SERVER);
            
            // Feedback Berhasil
            newElement.innerHTML = `Atau klik untuk copy IP: <span class="text-[#6bff8f] font-mono font-bold animate-pulse">✅ IP & Port Berhasil Disalin!</span>`;
            
            // Kembalikan ke teks semula setelah 2.5 detik
            setTimeout(() => {
                newElement.innerHTML = originalHTML;
            }, 2500);
        } catch (err) {
            console.error('Gagal menyalin teks:', err);
        }
    });
}

// --- 3. FETCH LEADERBOARD ---
/**
 * Mengambil data Sultan (Pemain Terkaya) dari API Backend
 * Dan memperbarui tampilan podium secara dinamis.
 */
async function fetchLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error('Gagal memuat leaderboard');
        
        const data = await response.json();
        
        // Pemetaan Rank ke UI Container
        data.forEach(player => {
            let container;
            if (player.rank === 1) {
                container = document.querySelector('.leaderboard-podium-gold')?.parentElement;
            } else if (player.rank === 2) {
                container = document.querySelector('.order-2.md\\:order-1');
            } else if (player.rank === 3) {
                container = document.querySelector('.order-3');
            }

            if (container) {
                const img = container.querySelector('img');
                const name = container.querySelector('.font-bold:not(.text-secondary)');
                const money = container.querySelector('.text-secondary');

                if (img) img.src = player.imgur_link || player.avatar;
                if (name) name.textContent = player.username;
                if (money) money.textContent = `$${player.money}`;
            }
        });
    } catch (error) {
        console.error('Error Leaderboard:', error);
    }
}

// --- 4. FETCH SERVER STATS (Hacker Terminal) ---
/**
 * Mengambil data status teknis (TPS, Ping, Load) dari backend internal.
 * Data ini bersifat kosmetik/acak untuk memberikan nuansa "Live".
 */
async function fetchServerStats() {
    const statsGrid = document.querySelector('#stats .grid');
    
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Backend status tidak merespon');
        
        const data = await response.json();
        
        if (statsGrid) {
            const divs = statsGrid.querySelectorAll('div');
            // Urutan: 0:TPS, 1:Ping, 2:Load, 3:Uptime
            if (divs[0]) divs[0].innerHTML = `<span class="opacity-70">TPS:</span> ${data.tps}`;
            if (divs[1]) divs[1].innerHTML = `<span class="opacity-70">Ping:</span> ${data.ping}`;
            if (divs[2]) divs[2].innerHTML = `<span class="opacity-70">Server Load:</span> ${data.serverLoad}`;
            if (divs[3]) divs[3].innerHTML = `<span class="opacity-70">Uptime:</span> ${data.uptime}`;
        }
    } catch (error) {
        console.error('Error Status Backend:', error);
    }
}

// --- 5. FETCH REAL PLAYER COUNT (mcstatus.io) ---
/**
 * Mengambil data jumlah pemain asli dari API mcstatus.io.
 * Menggunakan Bedrock status untuk IP alstore.space:23100.
 */
async function fetchRealPlayerCount() {
    const badgeText = document.querySelector('.hero-badge span.text-sm');
    const badgeDot = document.querySelector('.hero-badge span.w-2');
    
    try {
        const response = await fetch('https://api.mcstatus.io/v2/status/bedrock/basic-8.alstore.space:23100');
        if (!response.ok) throw new Error('API mcstatus.io bermasalah');
        
        const data = await response.json();
        
        if (data.online) {
            // Update teks jumlah player
            if (badgeText) {
                badgeText.textContent = `Live: ${data.players.online} Players Online`;
            }
            // Pastikan dot berwarna hijau (bg-secondary)
            if (badgeDot) {
                badgeDot.classList.remove('bg-error');
                badgeDot.classList.add('bg-secondary');
            }
        } else {
            // Server Offline di API
            handleOfflineState(badgeText, badgeDot);
        }
    } catch (error) {
        console.error('Error Real Player Count:', error);
        handleOfflineState(badgeText, badgeDot);
    }
}

/**
 * Helper untuk mengubah status badge menjadi Offline
 */
function handleOfflineState(textEl, dotEl) {
    if (textEl) textEl.textContent = `🔴 Server Offline`;
    if (dotEl) {
        dotEl.classList.remove('bg-secondary');
        dotEl.classList.add('bg-error');
    }
}

// --- 6. EXCLUSIVE ACCORDION (WIKI) ---
/**
 * Memastikan hanya satu kartu Wiki yang terbuka dalam satu waktu.
 * Memberikan nuansa UI premium yang bersih.
 */
function initExclusiveAccordion() {
    const details = document.querySelectorAll('#wiki details');
    
    details.forEach(targetDetail => {
        targetDetail.addEventListener('toggle', () => {
            if (targetDetail.open) {
                details.forEach(detail => {
                    if (detail !== targetDetail) {
                        detail.removeAttribute('open');
                    }
                });
            }
        });
    });
}

// --- 7. TERMINAL BOOT ANIMATION ---
/**
 * Helper untuk efek mengetik (Typewriter)
 */
async function typeWriter(element, text, speed = 25) {
    element.textContent = '';
    for (let i = 0; i < text.length; i++) {
        element.textContent += text.charAt(i);
        await new Promise(r => setTimeout(r, speed));
    }
}

/**
 * Mengatur urutan boot up terminal saat section terlihat di layar.
 */
function initTerminalAnimation() {
    const section = document.querySelector('#stats');
    const line1 = document.getElementById('terminal-line-1');
    const line2 = document.getElementById('terminal-line-2');
    const statsGrid = document.getElementById('terminal-stats');
    const finalLine = document.getElementById('terminal-final-line');
    const typeTarget = document.getElementById('terminal-type-cursor-target');

    if (!section || !line1) return;

    // Reset State Awal (Sembunyikan konten)
    const text1 = `> Connecting to ${CURRENT_LINKS.display_ip}...`;
    const text2 = `> Connection established.`;
    const textFinal = `> Awaiting command`;
    
    line1.textContent = '';
    line2.textContent = '';
    if (typeTarget) typeTarget.textContent = '';
    
    if (statsGrid) {
        statsGrid.style.opacity = '0';
        statsGrid.style.transform = 'translateY(10px)';
        statsGrid.style.transition = 'all 0.8s ease-out';
    }
    
    if (finalLine) finalLine.style.opacity = '0';

    // Intersection Observer untuk memicu animasi saat scroll
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            runSequence();
            observer.unobserve(section);
        }
    }, { threshold: 0.5 });

    async function runSequence() {
        // Line 1: Typing
        await typeWriter(line1, text1);
        await new Promise(r => setTimeout(r, 400));
        
        // Line 2: Typing
        await typeWriter(line2, text2);
        await new Promise(r => setTimeout(r, 600));
        
        // Stats: Smooth Fade-in
        if (statsGrid) {
            statsGrid.style.opacity = '1';
            statsGrid.style.transform = 'translateY(0)';
        }
        
        await new Promise(r => setTimeout(r, 800));
        
        // Final Line: Type command
        if (finalLine) {
            finalLine.style.opacity = '1';
            if (typeTarget) await typeWriter(typeTarget, textFinal);
        }
    }

    observer.observe(section);
}

// --- 8. PRELOADER HANDLER ---
/**
 * Mengelola transisi keluar preloader setelah halaman selesai dimuat.
 * Memberikan jeda minimal 1.5 detik untuk pengalaman visual.
 */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;

    window.addEventListener('load', () => {
        // Jeda minimal 1.5 detik agar animasi terlihat
        setTimeout(() => {
            // Fade out
            preloader.style.opacity = '0';
            
            // Tunggu transisi CSS selesai (700ms)
            setTimeout(() => {
                preloader.style.display = 'none';
                // Kembalikan scroll body
                document.body.classList.remove('overflow-hidden');
            }, 700);
        }, 1500);
    });
}
