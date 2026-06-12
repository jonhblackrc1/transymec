// ===== Año en el footer =====
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Header con sombra al hacer scroll =====
const header = document.getElementById("header");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// ===== Menú móvil =====
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});
// Cerrar el menú al hacer clic en un enlace
nav.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

// ===== Animación de revelado al hacer scroll =====
const revealTargets = document.querySelectorAll(
  ".section__head, .card, .fleet__item, .chip, .about__text, .value, .contact__info, .contact__form"
);
revealTargets.forEach((el) => el.classList.add("reveal"));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

// ===== Contador animado en el hero =====
const counters = document.querySelectorAll(".stat strong[data-count]");
const animateCount = (el) => {
  const target = +el.dataset.count;
  const duration = 1400;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target) + (progress === 1 ? "+" : "");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
counters.forEach((el) => counterObserver.observe(el));

// ===== Formulario de contacto =====
const form = document.getElementById("contactForm");
const formMsg = document.getElementById("formMsg");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = form.nombre.value.trim();
  const email = form.email.value.trim();

  if (!nombre || !email) {
    formMsg.style.color = "#c0392b";
    formMsg.textContent = "Por favor completa tu nombre y correo.";
    return;
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    formMsg.style.color = "#c0392b";
    formMsg.textContent = "Ingresa un correo válido.";
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";
  formMsg.style.color = "";
  formMsg.textContent = "";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      formMsg.style.color = "";
      formMsg.textContent =
        "¡Gracias! Hemos recibido tu solicitud y te contactaremos pronto.";
      form.reset();
    } else {
      const data = await response.json().catch(() => ({}));
      const detail =
        data.errors && data.errors.length
          ? data.errors.map((er) => er.message).join(", ")
          : "No pudimos enviar tu solicitud. Intenta nuevamente.";
      formMsg.style.color = "#c0392b";
      formMsg.textContent = detail;
    }
  } catch (err) {
    formMsg.style.color = "#c0392b";
    formMsg.textContent =
      "Error de conexión. Revisa tu internet e intenta otra vez.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
