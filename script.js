document.addEventListener("DOMContentLoaded", () => {

    // =========================================================================
    // 1. MENU MOBILE (Hamburger Menu)
    // =========================================================================
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navMenu = document.getElementById("nav-menu");

    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener("click", () => {
            navMenu.classList.toggle("open");
            hamburgerBtn.classList.toggle("active");
        });

        // Cerrar menú al hacer clic en enlaces de navegación o en el logo
        const navLinks = document.querySelectorAll(".nav-link, .nav-btn-mobile, .logo-link");
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("open");
                hamburgerBtn.classList.remove("active");
            });
        });
    }

    // =========================================================================
    // 2. VIDEOS — HEADER, HERO (SECUENCIA), SONIDO Y CARGA ADAPTATIVA
    // =========================================================================

    // --- 2.1 Video 3 del header — arranca cuando termina el video 2 ---
    const headerLogoVideo = document.getElementById("header-logo-video");
    const headerLogoFinal = document.getElementById("header-logo-final");
    const headerBrandCapsule = document.querySelector(".header-brand-capsule");
    const mainHeader = document.getElementById("header");
    // cinematic-mode ya está en <body class="cinematic-mode"> desde el HTML — no hay parpadeo

    // --- 2.2 Constantes de la secuencia hero ---
    const TRIM_OFFSET = 0.6;          // Segundos de inicio del segundo video — ajustar si el empalme no queda natural
    const FLASH_DURATION = 650;       // ms — duración total del flash de transición
    const FLASH_PEAK = 130;           // ms — momento del corte real entre videos (debe ser < FLASH_DURATION)
    const AUDIO_CROSSFADE_MS = 2000;        // ms — crossfade de audio entre V1 y V2
    const V2_TO_V3_AUDIO_BRIDGE_MS = 2000;  // ms — duración del puente/crossfade V2 → V3
    const V2_AUDIO_BRIDGE_OFFSET = 2.0;     // seg antes del fin de V2 para pre-seekear el bridge
    const V3_AUDIO_START_VOL  = 0.15;  // V3 arranca al 15%
    const V3_AUDIO_MID_VOL   = 0.25;  // sube al 25% al llegar al segundo 3
    const V3_AUDIO_STAGE1_MS = 3000;  // seg 0 → 3: 0.15 a 0.25
    const V3_AUDIO_STAGE2_MS = 4000;  // seg 3 → 7: 0.25 a 1.0, luego se mantiene
    let crossfadeStarted = false;
    let v2BridgePreSeeked = false;          // evita doble pre-seek del bridge

    // --- 2.3 Referencias del hero ---
    const video1 = document.getElementById("hero-intro-video");
    const video2 = document.getElementById("hero-intro-video-2");
    const videoLayer = document.getElementById("video-layer");
    const heroDisplayContainer = document.getElementById("hero-display-container");
    const audioToggleBtn = document.getElementById("audio-toggle-btn");
    const v2Bridge = document.getElementById("v2-audio-bridge");

    // --- 2.4 Selección adaptativa de fuente (desktop / mobile) ---
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    function applyResponsiveSrc(videoEl) {
        if (!videoEl) return;
        const newSrc = isMobile ? videoEl.dataset.srcMobile : videoEl.dataset.srcDesktop;
        if (!newSrc) return;
        const fallback = videoEl.querySelector("source");
        const opt = document.createElement("source");
        opt.type = "video/mp4";
        opt.src = newSrc;
        if (fallback) {
            videoEl.insertBefore(opt, fallback);
        } else {
            videoEl.appendChild(opt);
        }
        videoEl.load();
    }

    applyResponsiveSrc(video1);
    applyResponsiveSrc(video2);

    // --- 2.4.1 Crossfade de audio: detectar últimos 2 segundos de V1 ---
    function startAudioCrossfade() {
        if (crossfadeStarted) return;
        crossfadeStarted = true;
        if (video1 && !video1.muted && video1.volume > 0) {
            fadeVolume(video1, video1.volume, 0, AUDIO_CROSSFADE_MS);
        }
        if (video2) {
            video2.muted = video1 ? video1.muted : true;
            video2.volume = 0;
            video2.currentTime = TRIM_OFFSET;
            video2.play()
                .then(() => {
                    if (!video2.muted) fadeVolume(video2, 0, 1, AUDIO_CROSSFADE_MS);
                    // Precargar el bridge ahora que V2 está corriendo
                    applyResponsiveSrc(v2Bridge);
                })
                .catch(() => {});
        }
    }

    if (video1) {
        video1.addEventListener("timeupdate", () => {
            if (crossfadeStarted || !video1.duration) return;
            if (video1.duration - video1.currentTime <= AUDIO_CROSSFADE_MS / 1000) {
                startAudioCrossfade();
            }
        });
    }

    // Pre-seek del bridge 4 segundos antes del fin de V2 para que el navegador bufferea
    // esa posición y v2Bridge.play() sea instantáneo cuando V2 termine visualmente.
    if (video2 && v2Bridge) {
        video2.addEventListener("timeupdate", () => {
            if (v2BridgePreSeeked || !video2.duration) return;
            const remaining = video2.duration - video2.currentTime;
            if (remaining <= V2_AUDIO_BRIDGE_OFFSET + 2) {
                v2BridgePreSeeked = true;
                const doSeek = () => {
                    if (!isFinite(v2Bridge.duration)) return;
                    v2Bridge.currentTime = Math.max(0, v2Bridge.duration - V2_AUDIO_BRIDGE_OFFSET);
                    console.log("v2 bridge metadata ready — pre-seeked to", v2Bridge.currentTime.toFixed(2));
                };
                if (v2Bridge.readyState >= 1) {
                    doSeek();
                } else {
                    v2Bridge.addEventListener("loadedmetadata", doSeek, { once: true });
                }
            }
        });
    }

    // --- 2.5 Helpers de control de audio ---
    const audioMutedIcon   = audioToggleBtn ? audioToggleBtn.querySelector(".audio-icon-muted-svg")   : null;
    const audioUnmutedIcon = audioToggleBtn ? audioToggleBtn.querySelector(".audio-icon-unmuted-svg") : null;

    function updateAudioUI(muted) {
        if (audioMutedIcon)   audioMutedIcon.style.display   = muted ? "block" : "none";
        if (audioUnmutedIcon) audioUnmutedIcon.style.display = muted ? "none"  : "block";
        if (audioToggleBtn) {
            audioToggleBtn.setAttribute("aria-label", muted ? "Activar sonido del video" : "Silenciar video");
            audioToggleBtn.classList.toggle("sound-cta", muted);
        }
    }

    // Centraliza el estado muted de todos los medios y corrige volúmenes huérfanos.
    // Necesario porque fadeVolume puede dejar un video con volume=0 si arrancó mientras
    // estaba muted — al desmutear, ese video quedaría en silencio sin esta corrección.
    function setGlobalMutedState(isMuted) {
        [video1, video2, v2Bridge, headerLogoVideo].forEach(el => {
            if (el) el.muted = isMuted;
        });
        if (!isMuted) {
            // Si V2 o V3 están corriendo con volume=0 (bug del crossfade mientras muted),
            // iniciar un fade-in rápido para que el audio sea inmediatamente audible
            [video2, headerLogoVideo].forEach(el => {
                if (el && !el.paused && !el.ended && el.volume < 0.05) {
                    fadeVolume(el, 0, 1, 400);
                }
            });
        }
        updateAudioUI(isMuted);
    }

    if (audioToggleBtn) {
        audioToggleBtn.addEventListener("click", () => {
            if (!video1) return;
            setGlobalMutedState(!video1.muted);
        });
    }

    // --- 2.6 Autoplay con sonido — fallback silenciado + pulso en botón ---
    if (video1) {
        video1.muted = false;
        video1.play()
            .then(() => {
                updateAudioUI(false);
            })
            .catch(() => {
                video1.muted = true;
                video1.play().catch(err => console.log("Autoplay bloqueado:", err));
                updateAudioUI(true); // Activa el pulso CTA en el botón de audio
            });
    }

    // --- 2.7 Revelación del contenido final + arranque del video 3 del header ---
    function revealHeroContent() {
        if (videoLayer) videoLayer.classList.remove("active");
        // Quitar cinematic-mode del body ya: el header empieza a transicionar a sus colores
        // normales y el capsule queda visible para recibir el video 3
        document.body.classList.remove("cinematic-mode");
        // Arrancar V3 inmediatamente — el audio entra sin esperar el delay visual
        playHeaderVideo();
        // El título aparece 520ms después (transición visual)
        setTimeout(() => {
            if (heroDisplayContainer) heroDisplayContainer.classList.add("content-revealed");
        }, 520);
    }

    function playHeaderVideo() {
        if (!headerLogoVideo || !headerLogoFinal) return;
        headerLogoVideo.muted = video1 ? video1.muted : true;
        headerLogoVideo.volume = V3_AUDIO_START_VOL; // arranca al 15%
        headerLogoVideo.play()
            .then(() => {
                console.log("video 3 audio start");
                if (headerBrandCapsule) headerBrandCapsule.classList.add("frame-active");
                headerLogoVideo.classList.add("playing");
                headerLogoVideo.classList.add("zoom-active");
                if (!headerLogoVideo.muted) {
                    // Stage 1: seg 0 → 3, sube de 15% a 25%
                    console.log("video 3 fade in stage 1");
                    fadeVolume(headerLogoVideo, V3_AUDIO_START_VOL, V3_AUDIO_MID_VOL, V3_AUDIO_STAGE1_MS);
                    // Stage 2: seg 3 → 7, sube de 25% a 100% y se mantiene
                    setTimeout(() => {
                        if (!headerLogoVideo.muted) {
                            console.log("video 3 fade in stage 2");
                            fadeVolume(headerLogoVideo, V3_AUDIO_MID_VOL, 1, V3_AUDIO_STAGE2_MS);
                        }
                    }, V3_AUDIO_STAGE1_MS);
                }
                setTimeout(() => headerLogoFinal.classList.remove("visible"), 80);
            })
            .catch(err => {
                console.log("video 3 play rejected:", err);
            });
        headerLogoVideo.addEventListener("ended", () => {
            headerLogoVideo.classList.add("fade-out");
            headerLogoFinal.classList.add("visible");
            document.body.classList.remove("intro-active");
        }, { once: true });
    }

    // --- 2.8 Flash de transición V1 → V2 con fade de audio ---
    const flashEl = document.getElementById("video-transition-flash");
    const heroAmbientFlashEl = document.getElementById("hero-ambient-flash");

    // WeakMap de generación por elemento — garantiza que un fade nuevo cancela el anterior
    // en el mismo elemento sin afectar fades en otros elementos.
    const fadeGenMap = new WeakMap();
    function fadeVolume(videoEl, fromVol, toVol, durationMs) {
        const gen = (fadeGenMap.get(videoEl) || 0) + 1;
        fadeGenMap.set(videoEl, gen);
        const start = performance.now();
        function tick(now) {
            if (fadeGenMap.get(videoEl) !== gen) return; // cancelado por fade más nuevo
            const t = Math.min((now - start) / durationMs, 1);
            try { videoEl.volume = fromVol + (toVol - fromVol) * t; } catch(e) {}
            if (t < 1) requestAnimationFrame(tick);
            else videoEl.volume = toVol;
        }
        requestAnimationFrame(tick);
    }

    function playTransitionToV2() {
        if (flashEl) {
            flashEl.classList.add("active");
            setTimeout(() => flashEl.classList.remove("active"), FLASH_DURATION);
        }
        if (heroAmbientFlashEl) {
            heroAmbientFlashEl.classList.add("active");
            setTimeout(() => heroAmbientFlashEl.classList.remove("active"), FLASH_DURATION);
        }
        // Si el crossfade de audio no arrancó (video muy corto), iniciarlo ahora
        startAudioCrossfade();
        setTimeout(() => {
            video1.style.display = "none";
            if (video2.paused) {
                // V2 no está corriendo (crossfade no se disparó) — arrancarlo
                video2.muted = video1.muted;
                video2.volume = video2.muted ? 1 : 0;
                video2.currentTime = TRIM_OFFSET;
                video2.play()
                    .then(() => { if (!video2.muted) fadeVolume(video2, 0, 1, 400); })
                    .catch(err => console.log("Error al iniciar video 2:", err));
            }
            video2.style.display = "block";
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { video2.style.transform = "scale(1)"; });
            });
        }, FLASH_PEAK);
    }

    // handleV2Ended: puente de audio V2→V3 + reveal visual
    function handleV2Ended() {
        console.log("v2 ended");

        // 1. Activar puente de audio — debe sonar sin demora gracias al pre-seek previo
        if (!video2.muted && v2Bridge) {
            v2Bridge.muted = false;
            v2Bridge.volume = 1;

            // Fallback de seek si el pre-seek no ocurrió (V2 muy corto o bridge sin metadata)
            if (!v2BridgePreSeeked && isFinite(v2Bridge.duration)) {
                v2Bridge.currentTime = Math.max(0, v2Bridge.duration - V2_AUDIO_BRIDGE_OFFSET);
            }

            v2Bridge.play()
                .then(() => {
                    console.log("v2 bridge play — cubriendo silencio");
                    fadeVolume(v2Bridge, 1, 0, V2_TO_V3_AUDIO_BRIDGE_MS);
                    console.log("v2 bridge fade out iniciado");
                })
                .catch(err => console.log("v2 bridge play rejected:", err));
        }

        // 2. Reveal visual (incluye arranque de V3 con fade-in de audio en paralelo)
        revealHeroContent();
    }

    if (video1 && video2) {
        video1.addEventListener("ended", playTransitionToV2);
        video2.addEventListener("ended", handleV2Ended);
    } else if (video1) {
        video1.addEventListener("ended", revealHeroContent);
    }

    // --- 2.9 Botón de repetir la presentación ---
    const replayBtn = document.getElementById("btn-replay-intro");
    if (replayBtn) {
        replayBtn.addEventListener("click", () => {
            crossfadeStarted = false;
            v2BridgePreSeeked = false;
            if (heroAmbientFlashEl) heroAmbientFlashEl.classList.remove("active");
            // Resetear video 3 del header — volver a imagen estática
            // Volver al modo cinematográfico para el replay
            document.body.classList.add("cinematic-mode");
            document.body.classList.add("intro-active");
            if (headerBrandCapsule) headerBrandCapsule.classList.remove("frame-active");
            if (headerLogoVideo) {
                headerLogoVideo.pause();
                headerLogoVideo.currentTime = 0;
                headerLogoVideo.classList.remove("fade-out");
                headerLogoVideo.classList.remove("zoom-active");
                headerLogoVideo.classList.remove("playing");
            }
            if (headerLogoFinal) headerLogoFinal.classList.remove("visible");
            if (heroDisplayContainer) heroDisplayContainer.classList.remove("content-revealed");
            // Resetear bridge de audio V2→V3
            if (v2Bridge) {
                v2Bridge.pause();
                v2Bridge.currentTime = 0;
                v2Bridge.volume = 1;
            }
            if (video2) {
                video2.pause();
                video2.currentTime = 0;
                video2.volume = 1;
                video2.style.display = "none";
                video2.style.transform = "scale(0.94)";
            }
            if (video1) {
                video1.style.display = "block";
                video1.currentTime = 0;
                video1.volume = 1;
            }
            setTimeout(() => {
                if (videoLayer) videoLayer.classList.add("active");
                if (video1) video1.play().catch(err => console.log("Error replay:", err));
            }, 50);
        });
    }

    // =========================================================================
    // 3. INTERACTIVIDAD MANUAL DE LA PIZARRA DE SOLUCIONES
    // =========================================================================
    const serviceNames = [
        "CONSULTAS Y SEGUIMIENTO COMERCIAL",
        "MONITOREO INTELIGENTE",
        "GESTIÓN Y FACTURACIÓN A MEDIDA",
        "AUTOMATIZACIÓN OPERATIVA CON IA"
    ];

    const boardPanelWrapper = document.getElementById("board-panel-wrapper");
    const statusText = document.getElementById("panel-status");

    function activateService(serviceNum) {
        if (boardPanelWrapper) {
            for (let i = 1; i <= 4; i++) {
                boardPanelWrapper.classList.remove(`service-active-${i}`);
            }
            boardPanelWrapper.classList.add(`service-active-${serviceNum}`);
        }

        for (let i = 1; i <= 4; i++) {
            const card = document.getElementById(`hud-card-${i}`);
            const panelInfo = document.querySelector(`[data-service-info="${i}"]`);
            if (card) card.classList.toggle("active", i === serviceNum);
            if (panelInfo) panelInfo.classList.toggle("active", i === serviceNum);
        }

        if (statusText) {
            statusText.textContent = `SISTEMA ACTIVO: ${serviceNames[serviceNum - 1]}`;
        }
    }

    // Arrancar con Consultas seleccionado
    activateService(1);

    // Listeners en los botones HUD
    for (let i = 1; i <= 4; i++) {
        const card = document.getElementById(`hud-card-${i}`);
        if (card) card.addEventListener("click", () => activateService(i));
    }

    // =========================================================================
    // 4. REVEAL ANIMATIONS (Intersection Observer)
    // =========================================================================
    const revealElements = document.querySelectorAll(".reveal-scroll");

    if (revealElements.length > 0 && "IntersectionObserver" in window) {
        const observerOptions = {
            root: null,
            rootMargin: "0px",
            threshold: 0.12 // Activa cuando el 12% del elemento entra en pantalla
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    observer.unobserve(entry.target); // Dejar de observar una vez revelado
                }
            });
        }, observerOptions);

        revealElements.forEach(el => {
            revealObserver.observe(el);
        });
    } else {
        // Fallback si el navegador no soporta IntersectionObserver (mostrar todo directo)
        revealElements.forEach(el => {
            el.classList.add("revealed");
        });
    }

    // =========================================================================
    // 5. ENVÍO DEL FORMULARIO DE CONSULTAS — webhook real de n8n
    // =========================================================================
    const N8N_WEBHOOK_URL = "https://formacion-n8n-1-n8n.mfu2xl.easypanel.host/webhook/rs-consulta";

    const consultationForm = document.getElementById("consultation-form");
    const formStatusMessage = document.getElementById("form-status-message");

    function showFormStatus(type, text) {
        if (!formStatusMessage) return;
        formStatusMessage.textContent = text;
        formStatusMessage.classList.remove("is-success", "is-error");
        formStatusMessage.classList.add(type === "success" ? "is-success" : "is-error");
    }

    if (consultationForm) {
        consultationForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const submitBtn = consultationForm.querySelector(".btn-submit");
            const originalText = submitBtn.textContent;
            const formData = new FormData(consultationForm);

            const payload = {
                name: formData.get("name") || "",
                company: formData.get("company") || "",
                email: formData.get("email") || "",
                phone: formData.get("phone") || "",
                website: formData.get("website") || "",
                process: formData.get("process") || "",
                message: formData.get("message") || "",
                contactPreference: formData.get("contactPreference") || "Cualquiera"
            };

            submitBtn.disabled = true;
            submitBtn.textContent = "Enviando consulta...";

            fetch(N8N_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then((res) => {
                    if (!res.ok) throw new Error("Respuesta no exitosa del webhook");
                    showFormStatus("success", "Consulta enviada correctamente. Nos comunicaremos a la brevedad.");
                    consultationForm.reset();
                })
                .catch(() => {
                    showFormStatus("error", "No pudimos enviar la consulta. Intentá nuevamente o comunicate por WhatsApp.");
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                });
        });
    }

    // =========================================================================
    // 6. CARRUSEL DE SOLUCIONES ESPECIALIZADAS (#servicios) — circular con clones
    // =========================================================================
    const servicesCarousel = document.getElementById("services-carousel");

    if (servicesCarousel) {
        const carousel = servicesCarousel;
        const shell = carousel.closest(".services-carousel-shell");
        const section = carousel.closest(".services-section");
        const prevBtn = document.getElementById("services-prev");
        const nextBtn = document.getElementById("services-next");
        const dotsContainer = document.getElementById("services-dots");

        const realCards = Array.from(carousel.children);
        const realCount = realCards.length;

        const AUTOPLAY_MS = 3000;
        const SETTLE_MS = 140;   // inactividad de scroll a partir de la cual damos el movimiento por terminado
        const RESIZE_MS = 150;
        const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        let slides = realCards;     // tras clonar incluye clones + tarjetas reales
        let firstRealIndex = 0;     // posición de la primera tarjeta real dentro de `slides`
        let autoplayTimer = null;
        let autoplayDisabled = false; // true en cuanto hay cualquier interacción humana — ya no se reactiva
        let sectionVisible = false;
        let isDragging = false;
        let dragStartX = 0;
        let dragScrollStart = 0;
        let settleTimer = null;
        let scrollRAF = null;
        let resizeTimer = null;

        function reduceMotion() {
            return reduceMotionQuery.matches;
        }

        // --- Clones de borde -------------------------------------------------
        // Se clona un juego COMPLETO a cada lado, no una sola tarjeta: con un único
        // clon el scroller vuelve a tocar su límite físico y el slide de destino no
        // llega a alinearse al inicio (es la misma causa por la que la tarjeta 4 no
        // podía centrarse). Un juego entero deja margen suficiente a ambos lados en
        // todos los breakpoints, sin recalcular nada al redimensionar.
        function makeClone(card) {
            const clone = card.cloneNode(true);
            clone.classList.add("service-card-clone");
            clone.setAttribute("aria-hidden", "true");
            clone.removeAttribute("id");
            // Barrido defensivo: ningún id duplicado sobrevive dentro del clon
            clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
            return clone;
        }

        function buildClones() {
            if (realCount < 2) return;

            const leading = document.createDocumentFragment();
            const trailing = document.createDocumentFragment();
            realCards.forEach((card) => {
                leading.appendChild(makeClone(card));
                trailing.appendChild(makeClone(card));
            });

            carousel.insertBefore(leading, carousel.firstChild);
            carousel.appendChild(trailing);

            slides = Array.from(carousel.children);
            firstRealIndex = realCount;

            // Mapa slide -> tarjeta real que representa (vale igual para clones y reales)
            slides.forEach((slide, i) => {
                const real = ((i - firstRealIndex) % realCount + realCount) % realCount;
                slide.dataset.realIndex = String(real);
            });
        }

        function isClone(slide) {
            return !!slide && slide.classList.contains("service-card-clone");
        }

        // --- Posicionamiento -------------------------------------------------
        // scrollLeft necesario para dejar un slide alineado al inicio. Se calcula por
        // diferencia de offsetLeft entre hermanos: es exacto y no depende del padding
        // del scroller ni de cómo el navegador resuelva el punto de snap.
        function scrollPosFor(slide) {
            return slide.offsetLeft - slides[0].offsetLeft;
        }

        function getCurrentSlideIndex() {
            const pos = carousel.scrollLeft;
            let closest = 0;
            let min = Infinity;
            slides.forEach((slide, i) => {
                const dist = Math.abs(scrollPosFor(slide) - pos);
                if (dist < min) {
                    min = dist;
                    closest = i;
                }
            });
            return closest;
        }

        function getRealIndex() {
            const slide = slides[getCurrentSlideIndex()];
            if (!slide) return 0;
            const real = Number(slide.dataset.realIndex);
            return Number.isNaN(real) ? 0 : real;
        }

        // Reposiciona sin animación y con el scroll-snap desactivado, para que el
        // navegador no reencauce ni anime el salto.
        function withoutAnimation(apply) {
            carousel.classList.add("no-animate");
            apply();
            void carousel.offsetWidth; // fuerza reflow: el salto queda aplicado ya
            requestAnimationFrame(() => carousel.classList.remove("no-animate"));
        }

        function goToSlide(index, { instant = false } = {}) {
            const target = slides[Math.max(0, Math.min(index, slides.length - 1))];
            if (!target) return;
            const left = scrollPosFor(target);

            if (instant || reduceMotion()) {
                withoutAnimation(() => { carousel.scrollLeft = left; });
                updateDots();
            } else {
                carousel.scrollTo({ left: left, behavior: "smooth" });
            }
        }

        // Salto invisible: si quedamos parados sobre un clon, saltamos a su tarjeta
        // real conservando exactamente la misma posición visual (se desplaza por la
        // distancia de layout entre ambos, así no se percibe ningún movimiento).
        function normalizeIfClone() {
            const slide = slides[getCurrentSlideIndex()];
            if (!isClone(slide)) return;

            const real = realCards[Number(slide.dataset.realIndex)];
            if (!real) return;

            const delta = slide.offsetLeft - real.offsetLeft;
            if (!delta) return;

            withoutAnimation(() => { carousel.scrollLeft -= delta; });
        }

        function scheduleSettle() {
            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(() => {
                settleTimer = null;
                if (isDragging) return; // en medio de un arrastre no normalizamos
                normalizeIfClone();
                updateDots();
            }, SETTLE_MS);
        }

        function updateDots() {
            if (!dotsContainer) return;
            const active = getRealIndex();
            Array.from(dotsContainer.children).forEach((dot, i) => {
                if (i === active) dot.setAttribute("aria-current", "true");
                else dot.removeAttribute("aria-current");
            });
        }

        // --- Autoplay: avanza un slide por vez; los clones + normalización hacen el ciclo ---
        function stopAutoplay() {
            if (autoplayTimer) {
                clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        }

        function startAutoplay() {
            stopAutoplay();
            if (autoplayDisabled || reduceMotion() || !sectionVisible || document.hidden) return;
            autoplayTimer = setInterval(() => {
                goToSlide(getCurrentSlideIndex() + 1);
            }, AUTOPLAY_MS);
        }

        // Se llama ante cualquier interacción humana. Es definitivo: no hay resume posterior.
        function disableAutoplay() {
            if (autoplayDisabled) return;
            autoplayDisabled = true;
            stopAutoplay();
        }

        // --- Navegación circular: misma ruta para flechas, teclado y autoplay ---
        function manualNav(direction) {
            goToSlide(getCurrentSlideIndex() + direction);
            disableAutoplay();
        }

        // --- Arranque: primero los clones, después los puntos y la posición inicial ---
        buildClones();

        // Puntos indicadores: uno por tarjeta REAL (los clones no suman puntos)
        if (dotsContainer) {
            realCards.forEach((_, i) => {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.className = "carousel-dot";
                dot.setAttribute("aria-label", `Ir a la solución ${i + 1}`);
                dot.addEventListener("click", () => {
                    goToSlide(firstRealIndex + i);
                    disableAutoplay();
                });
                dotsContainer.appendChild(dot);
            });
        }

        // Posición inicial sobre la primera tarjeta real. Se asigna scrollLeft directo
        // (no scrollIntoView) para no arrastrar el scroll vertical de la página.
        withoutAnimation(() => {
            carousel.scrollLeft = scrollPosFor(slides[firstRealIndex]);
        });
        updateDots();

        // --- Autoplay activo solo con la sección visible y la pestaña activa (hasta la primera interacción) ---
        if ("IntersectionObserver" in window) {
            const sectionObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    sectionVisible = entry.isIntersecting;
                    if (sectionVisible) startAutoplay();
                    else stopAutoplay();
                });
            }, { threshold: 0.3 });
            sectionObserver.observe(section || shell || carousel);
        } else {
            sectionVisible = true;
            startAutoplay();
        }

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) stopAutoplay();
            else if (sectionVisible) startAutoplay();
        });

        if (typeof reduceMotionQuery.addEventListener === "function") {
            reduceMotionQuery.addEventListener("change", () => {
                if (reduceMotion()) stopAutoplay();
                else if (sectionVisible) startAutoplay();
            });
        }

        // --- Sincroniza puntos y dispara la normalización, venga de donde venga el
        //     movimiento (autoplay, flechas, teclado, drag o swipe táctil) ---
        carousel.addEventListener("scroll", () => {
            if (!scrollRAF) {
                scrollRAF = requestAnimationFrame(() => {
                    updateDots();
                    scrollRAF = null;
                });
            }
            scheduleSettle();
        }, { passive: true });

        // --- Flechas anterior / siguiente (circular en ambos sentidos: 4→1 y 1→4) ---
        if (prevBtn) prevBtn.addEventListener("click", () => manualNav(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => manualNav(1));

        // --- Navegación por teclado (← →) cuando el carrusel tiene foco ---
        carousel.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); manualNav(1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); manualNav(-1); }
        });

        // --- Click/tap sobre una tarjeta: cuenta como interacción humana ---
        carousel.addEventListener("click", (e) => {
            if (e.target.closest(".service-card")) disableAutoplay();
        });

        // --- Swipe/touch: cuenta como interacción humana (el gesto en sí lo maneja el scroll-snap nativo) ---
        carousel.addEventListener("touchstart", disableAutoplay, { passive: true });

        // --- Drag con mouse en desktop, incluida la imagen (el touch usa el swipe nativo del navegador) ---
        carousel.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "mouse") return;
            isDragging = true;
            dragStartX = e.clientX;
            dragScrollStart = carousel.scrollLeft;
            carousel.classList.add("dragging");
            disableAutoplay();
            carousel.setPointerCapture(e.pointerId);
        });

        carousel.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            carousel.scrollLeft = dragScrollStart - (e.clientX - dragStartX);
        });

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            carousel.classList.remove("dragging");
            goToSlide(getCurrentSlideIndex()); // completa el snap donde el usuario soltó
            scheduleSettle();                  // y recién después normaliza si cayó sobre un clon
        }
        carousel.addEventListener("pointerup", endDrag);
        carousel.addEventListener("pointercancel", endDrag);

        // --- Reajuste tras cambio de tamaño: los slides cambian de ancho, así que se
        //     vuelve a anclar la tarjeta real actual sin animación ---
        window.addEventListener("resize", () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resizeTimer = null;
                goToSlide(firstRealIndex + getRealIndex(), { instant: true });
            }, RESIZE_MS);
        });
    }

});
