/* =============================================
   CIVIC SOCIAL — SCRIPT
   ============================================= */

// ─── NAV SCROLL ───────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ─── MOBILE NAV ───────────────────────────────
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
navToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
});
mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ─── PARTICLE CANVAS ──────────────────────────
(function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let width, height, particles;
    const COUNT = 80;

    function resize() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    }

    function Particle() {
        this.reset();
    }
    Particle.prototype.reset = function () {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - .5) * .35;
        this.vy = (Math.random() - .5) * .35;
        this.r = Math.random() * 1.8 + .4;
        this.alpha = Math.random() * .5 + .1;
        this.color = Math.random() > .6 ? '59,130,246' : '45,212,191';
    };
    Particle.prototype.update = function () {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    };

    function initParticleArray() {
        particles = Array.from({ length: COUNT }, () => new Particle());
    }

    function drawLine(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 140) return;
        const alpha = (1 - dist / 140) * .15;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
        ctx.lineWidth = .8;
        ctx.stroke();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.update();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
            ctx.fill();
            for (let j = i + 1; j < particles.length; j++) {
                drawLine(p, particles[j]);
            }
        }
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => { resize(); initParticleArray(); });
    resize();
    initParticleArray();
    draw();
})();

// ─── SCROLL REVEAL ────────────────────────────
(function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
            if (entry.isIntersecting) {
                // stagger siblings
                const siblings = entry.target.parentElement.querySelectorAll('.reveal');
                let delay = 0;
                siblings.forEach((s, i) => { if (s === entry.target) delay = i * 80; });
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, delay);
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    reveals.forEach(el => io.observe(el));
})();

// ─── HERO PARALLAX ────────────────────────────
const heroVisual = document.querySelector('.hero-visual');
if (heroVisual) {
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        heroVisual.style.transform = `translateY(${y * 0.08}px)`;
    }, { passive: true });
}

// ─── WAITLIST FORM ────────────────────────────
const form = document.getElementById('waitlistForm');
const successMsg = document.getElementById('formSuccess');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.style.display = 'none';
        successMsg.style.display = 'block';
    });
}

// ─── BUTTON HOVER RIPPLE ──────────────────────
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        btn.style.setProperty('--mx', `${x}%`);
        btn.style.setProperty('--my', `${y}%`);
    });
});

// ─── SMOOTH ACTIVE NAV ────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(link => {
                link.style.color = link.getAttribute('href') === `#${id}` ? '#f8fafc' : '';
            });
        }
    });
}, { threshold: .4 });
sections.forEach(s => sectionObserver.observe(s));

// ─── CARD GLOW ON HOVER ───────────────────────
document.querySelectorAll('.feat-card, .trust-card, .pricing-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--gx', `${x}px`);
        card.style.setProperty('--gy', `${y}px`);
    });
});

// ─── TYPING TICKER (proof strip) ─────────────
// slight shimmer animation on proof icons
document.querySelectorAll('.proof-icon').forEach((icon, i) => {
    icon.style.animationDelay = `${i * 0.3}s`;
    icon.style.animation = `pulse 3s ease-in-out infinite`;
    icon.style.animationDelay = `${i * 0.4}s`;
    icon.style.display = 'inline-block';
});
