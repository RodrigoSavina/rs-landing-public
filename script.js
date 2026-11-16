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

    // --- 2.5.1 Control de audio disponible mientras suena V3 ---
    // La capa de video (donde vive el botón) se oculta al revelar el contenido,
    // pero V3 sigue sonando: durante V3 el mismo botón pasa a posición fija.
    const audioBtnHome = audioToggleBtn
        ? { parent: audioToggleBtn.parentNode, next: audioToggleBtn.nextSibling }
        : null;

    function moveAudioButton(parent, before) {
        const hadFocus = document.activeElement === audioToggleBtn;
        parent.insertBefore(audioToggleBtn, before || null);
        if (hadFocus) audioToggleBtn.focus({ preventScroll: true });
    }

    function floatAudioControl() {
        if (!audioToggleBtn || audioToggleBtn.classList.contains("audio-toggle-btn--floating")) return;
        moveAudioButton(document.body, null);
        audioToggleBtn.classList.add("audio-toggle-btn--floating");
    }

    function dockAudioControl() {
        if (!audioToggleBtn || !audioToggleBtn.classList.contains("audio-toggle-btn--floating")) return;
        audioToggleBtn.classList.remove("audio-toggle-btn--floating");
        moveAudioButton(audioBtnHome.parent, audioBtnHome.next);
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
        // El control de audio sigue visible mientras suenan el puente y V3
        floatAudioControl();
        // Arrancar V3 inmediatamente — el audio entra sin esperar el delay visual
        playHeaderVideo();
        // El título aparece 520ms después (transición visual)
        setTimeout(() => {
            if (heroDisplayContainer) heroDisplayContainer.classList.add("content-revealed");
            releaseHeroSpace();
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
                dockAudioControl();
            });
        headerLogoVideo.addEventListener("ended", () => {
            headerLogoVideo.classList.add("fade-out");
            headerLogoFinal.classList.add("visible");
            document.body.classList.remove("intro-active");
            dockAudioControl();
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
            dockAudioControl();
            // Mantener la altura actual del hero para que el replay no desplace la página
            reserveHeroSpace();
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

    // --- 2.10 Reserva de altura del hero en mobile ---
    // En mobile el contenido final es mucho más alto que el recuadro 16:9 de la intro:
    // sin reserva, el revelado empuja toda la página hacia abajo (layout shift).
    const heroSection = document.getElementById("inicio");
    const heroContentLayer = document.getElementById("hero-content-layer");
    const mobileHeroQuery = window.matchMedia("(max-width: 768px)");

    function isHeroRevealed() {
        return !!heroDisplayContainer && heroDisplayContainer.classList.contains("content-revealed");
    }

    // hero-mobile-reserved: solo mientras la intro mobile corre con la altura reservada;
    // centra el video en ese espacio (ver styles.css) y se quita en el revelado.
    function reserveHeroSpace() {
        if (!heroSection || !heroDisplayContainer || !heroContentLayer) return;
        heroSection.style.minHeight = "";
        heroSection.classList.remove("hero-mobile-reserved");
        if (!mobileHeroQuery.matches) return;
        if (isHeroRevealed()) {
            // Replay: se conserva la altura final y la intro vuelve a arrancar centrada
            heroSection.style.minHeight = heroSection.offsetHeight + "px";
            heroSection.classList.add("hero-mobile-reserved");
            return;
        }
        // Altura natural del contenido final, medida sin pintar (la capa sigue oculta)
        const previousHeight = heroContentLayer.style.height;
        heroContentLayer.style.height = "auto";
        const borders = heroDisplayContainer.offsetHeight - heroDisplayContainer.clientHeight;
        const finalContainerHeight = heroContentLayer.offsetHeight + borders;
        heroContentLayer.style.height = previousHeight;
        const growth = finalContainerHeight - heroDisplayContainer.offsetHeight;
        if (growth > 0) {
            heroSection.style.minHeight = (heroSection.offsetHeight + growth) + "px";
            heroSection.classList.add("hero-mobile-reserved");
        }
    }

    function releaseHeroSpace() {
        if (!heroSection) return;
        heroSection.style.minHeight = "";
        heroSection.classList.remove("hero-mobile-reserved");
    }

    reserveHeroSpace();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (!isHeroRevealed()) reserveHeroSpace(); });
    }
    window.addEventListener("resize", () => { if (!isHeroRevealed()) reserveHeroSpace(); });

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

    // =========================================================================
    // 7. SELECTOR ORBITAL DE SOLUCIONES (#soluciones)
    // =========================================================================
    const solutionsOrbit = document.getElementById("solutions-orbit");

    if (solutionsOrbit) {
        const nodes = Array.from(solutionsOrbit.querySelectorAll(".orbit-node"));
        const panels = Array.from(solutionsOrbit.querySelectorAll(".orbit-panel"));
        const nodesContainer = document.getElementById("orbit-nodes");
        const prevBtn = document.getElementById("orbit-prev");
        const nextBtn = document.getElementById("orbit-next");
        const counterEl = document.getElementById("orbit-counter");
        const soundBtn = document.getElementById("orbit-sound");
        const total = nodes.length;

        let activeIndex = 0;
        let audioCtx = null;
        let soundOn = true;

        // Preferencia de sonido recordada en la sesión (sessionStorage puede fallar
        // en navegación privada — nunca debe romper la interfaz por eso).
        try {
            if (sessionStorage.getItem("rs-orbit-sound") === "off") soundOn = false;
        } catch (e) {}

        function updateSoundButton() {
            if (!soundBtn) return;
            soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
            soundBtn.setAttribute(
                "aria-label",
                soundOn ? "Silenciar sonido de interacción" : "Activar sonido de interacción"
            );
        }
        updateSoundButton();

        // --- Tono corto vía Web Audio API — nunca en la carga, solo tras interacción ---
        function playTick() {
            if (!soundOn) return;
            try {
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === "suspended") audioCtx.resume();
                const t = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, t);
                osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.13);
            } catch (e) {
                // Cualquier fallo de Web Audio degrada en silencio, sin afectar la UI
            }
        }

        if (soundBtn) {
            soundBtn.addEventListener("click", () => {
                soundOn = !soundOn;
                updateSoundButton();
                try { sessionStorage.setItem("rs-orbit-sound", soundOn ? "on" : "off"); } catch (e) {}
            });
        }

        // Centra el nodo activo en la tira horizontal de mobile. En desktop
        // .orbit-nodes no tiene overflow real, así que esto no hace nada allí.
        function centerActiveNode() {
            if (!nodesContainer) return;
            if (nodesContainer.scrollWidth <= nodesContainer.clientWidth) return;
            const node = nodes[activeIndex];
            if (!node) return;
            const target = node.offsetLeft - (nodesContainer.clientWidth - node.clientWidth) / 2;
            nodesContainer.scrollTo({ left: target, behavior: "smooth" });
        }

        // Cambia la solución activa. sound=true solo debe pasarse ante interacción deliberada.
        function setActive(index, { sound = false, focus = false } = {}) {
            activeIndex = ((index % total) + total) % total;
            nodes.forEach((n, k) => {
                const on = k === activeIndex;
                n.classList.toggle("is-active", on);
                n.setAttribute("aria-selected", on ? "true" : "false");
                n.tabIndex = on ? 0 : -1; // roving tabindex
            });
            panels.forEach((p, k) => p.classList.toggle("is-active", k === activeIndex));
            if (counterEl) counterEl.textContent = String(activeIndex + 1).padStart(2, "0");
            if (focus) nodes[activeIndex].focus();
            if (sound) playTick();
            centerActiveNode();
        }

        // --- Click / tap en un nodo orbital ---
        nodes.forEach((node, i) => {
            node.addEventListener("click", () => setActive(i, { sound: true }));
        });

        // --- Flechas anterior / siguiente — circular en ambos sentidos (8→1 y 1→8) ---
        if (prevBtn) prevBtn.addEventListener("click", () => setActive(activeIndex - 1, { sound: true }));
        if (nextBtn) nextBtn.addEventListener("click", () => setActive(activeIndex + 1, { sound: true }));

        // --- Teclado sobre el tablist: flechas, Home/End. Enter/Espacio los maneja
        //     el navegador solo por tratarse de <button> reales. ---
        if (nodesContainer) {
            nodesContainer.addEventListener("keydown", (e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); setActive(activeIndex + 1, { sound: true, focus: true }); }
                else if (e.key === "ArrowLeft") { e.preventDefault(); setActive(activeIndex - 1, { sound: true, focus: true }); }
                else if (e.key === "Home") { e.preventDefault(); setActive(0, { sound: true, focus: true }); }
                else if (e.key === "End") { e.preventDefault(); setActive(total - 1, { sound: true, focus: true }); }
            });
        }

        // Estado inicial: sin sonido y sin robar foco — no es interacción del usuario
        setActive(0);
    }

    // =========================================================================
    // 8. EQUIPO (#nosotros) — datos, tarjetas, carrusel circular y perfil ampliado
    //    8A. Carga y validación de datos: la única parte que cambia al pasar a una API
    //    8B. Tarjetas · 8C. Carrusel · 8D. Perfil ampliado · 8E. Enlaces #perfil-{slug}
    // =========================================================================

    // --- 8A. Carga y validación ---------------------------------------------
    const TEAM_DATA_URL = "data/equipo.json";
    const TEAM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const TEAM_RESENA_MAX = 260;
    const TEAM_HASH_PREFIX = "#perfil-";

    const teamLog = (level, message, detail) => {
        if (detail === undefined) console[level](`[equipo] ${message}`);
        else console[level](`[equipo] ${message}`, detail);
    };

    // Fuente actual: JSON estático. Para migrar a una API o base de datos se reemplaza esta función.
    async function fetchTeamSource() {
        const response = await fetch(TEAM_DATA_URL, { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status} al leer ${TEAM_DATA_URL}`);
        return response.json();
    }

    /**
     * Contrato estable para el resto de la sección, venga de donde venga el dato:
     *   { integrantes: [{ id, slug, nombre, rol, resena_corta, imagen, imagen_alt, perfil_completo }],
     *     inicial: índice del integrante destacado }
     * Solo incluye integrantes activos y válidos, ordenados por `orden`. Nunca corrige ni guarda datos de origen.
     */
    async function loadTeamMembers(source = fetchTeamSource) {
        return normalizeTeamData(await source());
    }

    const teamText = (value) => (typeof value === "string" ? value.trim() : "");

    // Imagen: ruta relativa del sitio o https. Otros esquemas (javascript:, data:, http:) se rechazan.
    function teamSafeImage(value) {
        const v = teamText(value);
        if (!v || v.startsWith("//")) return "";
        if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return /^https:\/\//i.test(v) ? v : "";
        return v;
    }

    // Enlaces externos del perfil ampliado: solo https
    function teamSafeUrl(value) {
        const v = teamText(value);
        if (!v) return "";
        try { return new URL(v).protocol === "https:" ? v : ""; } catch { return ""; }
    }

    // perfil_completo: null, o un objeto con al menos una sección con contenido.
    // Todo es texto plano; nunca se interpreta HTML.
    function normalizeTeamProfile(raw, slug) {
        if (raw === null || raw === undefined) return null;
        if (typeof raw !== "object" || Array.isArray(raw)) {
            teamLog("error", `"${slug}": perfil_completo no es un objeto; se ignora`);
            return null;
        }
        const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
        const strings = (v) => (Array.isArray(v) ? v.map(teamText).filter(Boolean) : []);
        const perfil = {
            bio: (Array.isArray(raw.bio) ? strings(raw.bio) : teamText(raw.bio).split(/\n\s*\n/).map(teamText).filter(Boolean)),
            especialidades: strings(raw.especialidades),
            experiencia: list(raw.experiencia)
                .map((e) => ({ cargo: teamText(e.cargo), organizacion: teamText(e.organizacion), periodo: teamText(e.periodo), descripcion: teamText(e.descripcion) }))
                .filter((e) => e.cargo || e.organizacion),
            formacion: list(raw.formacion)
                .map((e) => ({ titulo: teamText(e.titulo), institucion: teamText(e.institucion), periodo: teamText(e.periodo) }))
                .filter((e) => e.titulo || e.institucion),
            certificaciones: list(raw.certificaciones)
                .map((e) => ({ nombre: teamText(e.nombre), emisor: teamText(e.emisor), anio: e.anio == null ? "" : String(e.anio).trim(), url: teamSafeUrl(e.url) }))
                .filter((e) => e.nombre),
        };
        if (!Object.values(perfil).some((section) => section.length)) {
            teamLog("warn", `"${slug}": perfil_completo no tiene contenido; no se muestra «Ver perfil»`);
            return null;
        }
        return perfil;
    }

    function normalizeTeamData(raw) {
        const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.integrantes) ? raw.integrantes : null);
        if (!list) throw new Error("los datos no contienen una lista de integrantes");

        const ids = new Set();
        const slugs = new Set();
        const active = [];
        list.forEach((item, pos) => {
            const where = `integrante #${pos + 1}`;
            if (!item || typeof item !== "object") {
                teamLog("error", `${where}: no es un objeto; se omite`);
                return;
            }
            const m = {
                id: teamText(item.id), slug: teamText(item.slug), nombre: teamText(item.nombre), rol: teamText(item.rol),
                resena_corta: teamText(item.resena_corta), imagen: teamSafeImage(item.imagen), imagen_alt: teamText(item.imagen_alt),
            };
            const problems = [];
            if (!m.id) problems.push("falta id");
            if (!TEAM_SLUG_RE.test(m.slug)) problems.push("slug ausente o inválido");
            if (!m.nombre) problems.push("falta nombre");
            if (!m.rol) problems.push("falta rol");
            if (!m.resena_corta) problems.push("falta resena_corta");
            if (typeof item.orden !== "number" || !Number.isFinite(item.orden)) problems.push("orden no numérico");
            if (typeof item.activo !== "boolean") problems.push("activo no es booleano");
            if (problems.length) {
                teamLog("error", `${where} (${m.slug || m.id || "sin identificar"}) se omite: ${problems.join(", ")}`);
                return;
            }
            if (ids.has(m.id) || slugs.has(m.slug)) {
                teamLog("error", `${where}: id o slug repetido ("${m.id}" / "${m.slug}"); se omite`);
                return;
            }
            ids.add(m.id);
            slugs.add(m.slug);
            if (!item.activo) return;

            const length = [...m.resena_corta].length;
            if (length > TEAM_RESENA_MAX) teamLog("warn", `"${m.slug}": la reseña corta tiene ${length} caracteres (máximo ${TEAM_RESENA_MAX}); se muestra sin recortar`);
            if (teamText(item.imagen) && !m.imagen) teamLog("error", `"${m.slug}": ruta de imagen no permitida; se muestra sin foto`);
            if (m.imagen && !m.imagen_alt) teamLog("warn", `"${m.slug}": falta imagen_alt`);
            m.perfil_completo = normalizeTeamProfile(item.perfil_completo, m.slug);
            active.push({ member: m, orden: item.orden, destacado: item.destacado === true });
        });

        if (!active.length) throw new Error("no hay integrantes activos válidos");
        active.sort((a, b) => a.orden - b.orden); // estable: a igual orden se respeta el del archivo

        // Debe haber exactamente un destacado. Si hay más, se elige el de menor orden solo para que la
        // interfaz funcione; el error queda informado y los datos no se tocan.
        const featured = active.filter((e) => e.destacado);
        let inicial = 0;
        if (!featured.length) {
            teamLog("error", "no hay ningún integrante activo con destacado = true; se muestra primero el de menor orden");
        } else {
            if (featured.length > 1) {
                teamLog("error", `hay ${featured.length} integrantes destacados (${featured.map((e) => e.member.slug).join(", ")}); debe haber uno solo. Se usa "${featured[0].member.slug}"`);
            }
            inicial = active.indexOf(featured[0]);
        }
        return { integrantes: active.map((e) => e.member), inicial };
    }

    // --- 8B. Tarjetas ---------------------------------------------------------
    function renderTeamCards(stage, template, integrantes) {
        const total = integrantes.length;
        const slides = integrantes.map((m, i) => {
            const slide = template.content.firstElementChild.cloneNode(true);
            slide.dataset.slug = m.slug;
            slide.setAttribute("aria-label", total > 1 ? `${i + 1} de ${total}: ${m.nombre}` : m.nombre);

            const photo = slide.querySelector(".partner-photo-placeholder");
            const img = photo.querySelector("img");
            const withoutPhoto = () => { img.remove(); photo.classList.remove("has-photo"); };
            if (m.imagen) {
                img.setAttribute("src", m.imagen);
                img.setAttribute("alt", m.imagen_alt);
                img.addEventListener("error", () => {
                    teamLog("error", `"${m.slug}": no se pudo cargar la imagen ${m.imagen}`);
                    withoutPhoto();
                }, { once: true });
            } else {
                withoutPhoto();
            }

            slide.querySelector(".partner-name").textContent = m.nombre;
            slide.querySelector(".partner-brand").textContent = m.rol;
            slide.querySelector(".partner-role").textContent = m.resena_corta;

            const button = slide.querySelector(".team-profile-btn");
            if (m.perfil_completo) {
                button.hidden = false;
                button.setAttribute("aria-label", `Ver perfil de ${m.nombre}`);
            } else {
                button.remove(); // sin contenido ampliado aprobado no hay botón
            }
            return slide;
        });
        stage.replaceChildren(...slides);
        return slides;
    }

    // --- 8C. Carrusel ---------------------------------------------------------
    // Rueda de N tarjetas reales, sin clones. 1 tarjeta: estática. 2: recorrido lineal (las flechas alternan).
    // 3 o más: rueda circular; solo la activa y sus vecinas se ven, el resto queda detrás, oculto.
    function createTeamCarousel({ root, stage, slides, names, controls, dotsWrap, counter, prevBtn, nextBtn, statusEl, startIndex }) {
        const total = slides.length;
        const interactive = total > 1;
        const linear = total === 2;           // con dos, envolver haría saltar la lateral de lado al arrastrar
        const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        const DURATION_MS = 480;
        const ARC_DEG = 50;             // ángulo de la rueda entre tarjetas vecinas
        const TILT_RATIO = 0.25;        // giro visible de la tarjeta: 1/4 del ángulo (≈12°)
        const DEPTH_SCALE = 0.45;       // reducción de escala con la profundidad (≈0,84 en las laterales)
        const SNAP_THRESHOLD = 0.18;    // fracción del paso que hay que arrastrar para cambiar de perfil
        const FLICK_SPEED = 0.45;       // px/ms: un gesto rápido cambia aunque no llegue al umbral
        const MAX_DOTS = 7;             // desde 8 integrantes, contador «03 / 10»

        // position: índice continuo que está al frente; target: índice entero hacia el que se anima
        let position = startIndex;
        let target = startIndex;
        let step = 1;                   // px entre la tarjeta central y una lateral
        let frame = null;
        let drag = null;
        let suppressClickUntil = 0;

        const mod = (n) => ((n % total) + total) % total;
        const reduceMotion = () => reduceMotionQuery.matches;
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const activeIndex = () => mod(Math.round(target));
        const digits = Math.max(2, String(total).length);
        const pad = (n) => String(n).padStart(digits, "0");

        // --- Controles según la cantidad ---
        let dots = [];
        if (!interactive) {
            // Una sola tarjeta: no es un carrusel ni recibe foco; sin flechas ni indicadores
            root.removeAttribute("aria-roledescription");
            root.removeAttribute("tabindex");
            controls.hidden = true;
        } else {
            controls.hidden = false;
            if (total <= MAX_DOTS) {
                dots = names.map((name, i) => {
                    const dot = document.createElement("button");
                    dot.type = "button";
                    dot.className = "team-dot";
                    dot.setAttribute("aria-label", `Ir a la tarjeta de ${name}`);
                    dot.addEventListener("click", () => goTo(i));
                    return dot;
                });
                dotsWrap.replaceChildren(...dots);
                dotsWrap.hidden = false;
                counter.hidden = true;
            } else {
                dotsWrap.replaceChildren();
                dotsWrap.hidden = true;
                counter.hidden = false;
            }
        }

        function measure() {
            step = slides[0].offsetWidth * 0.78;
        }

        // Posición relativa al frente. En la rueda se envuelve a [-N/2, N/2]: la tarjeta que da la vuelta
        // lo hace por detrás, ya invisible. Con dos tarjetas no se envuelve.
        function relativeOf(i) {
            let rel = i - position;
            if (!linear) rel -= total * Math.round(rel / total);
            return rel;
        }

        // Cada tarjeta se ubica sobre un arco: x = R·sen(θ), escala según cos(θ).
        // Desde 1,5 posiciones del frente la tarjeta queda detrás, invisible y fuera del árbol de accesibilidad.
        function render() {
            if (!interactive) return;
            const radius = step / Math.sin(ARC_DEG * Math.PI / 180);
            slides.forEach((slide, i) => {
                const rel = relativeOf(i);
                const dist = Math.min(Math.abs(rel), 1.5);
                const theta = Math.sign(rel) * dist * ARC_DEG * Math.PI / 180;
                const x = radius * Math.sin(theta);
                const scale = 1 - DEPTH_SCALE * (1 - Math.cos(theta));
                const tilt = reduceMotion() ? 0 : (theta * 180 / Math.PI) * TILT_RATIO; // el borde exterior se aleja
                const opacity = dist <= 1 ? 1 - 0.18 * dist : Math.max(0, 0.82 * (1 - (dist - 1) / 0.5));
                slide.style.transform = `translateX(${x.toFixed(1)}px) rotateY(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
                slide.style.opacity = opacity.toFixed(3);
                slide.style.zIndex = String(Math.round(100 - dist * 40));
                slide.style.visibility = dist >= 1.5 ? "hidden" : "";
                // Visibilidad del texto: 1 al frente, 0 desde media tarjeta de distancia (la usa solo el CSS de móvil pequeño)
                slide.style.setProperty("--team-text", Math.max(0, 1 - dist / 0.5).toFixed(3));
            });
        }

        function updateState(announce) {
            const active = activeIndex();
            slides.forEach((slide, i) => {
                const isActive = i === active;
                slide.classList.toggle("is-active", isActive);
                if (isActive) slide.setAttribute("aria-current", "true");
                else slide.removeAttribute("aria-current");
                // Solo el botón «Ver perfil» de la tarjeta activa entra en el orden de Tab
                const button = slide.querySelector(".team-profile-btn");
                if (button) button.tabIndex = isActive ? 0 : -1;
            });
            dots.forEach((dot, i) => {
                if (i === active) dot.setAttribute("aria-current", "true");
                else dot.removeAttribute("aria-current");
            });
            if (!counter.hidden) counter.textContent = `${pad(active + 1)} / ${pad(total)}`;
            if (announce && statusEl) statusEl.textContent = `Perfil ${active + 1} de ${total}: ${names[active]}`;
        }

        // Al terminar, se lleva el índice al rango 0…N-1; la vista no cambia porque rel es circular
        function settle() {
            const n = activeIndex();
            position = n;
            target = n;
            render();
        }

        function animateTo(newTarget, { instant = false } = {}) {
            target = newTarget;
            updateState(true);
            if (frame) cancelAnimationFrame(frame);
            const from = position;
            const distance = Math.abs(target - from);
            const duration = instant || reduceMotion() ? 0 : DURATION_MS * Math.min(1.5, Math.max(0.6, distance));
            if (!duration || !distance) { frame = null; settle(); return; }
            const start = performance.now();
            const tick = (now) => {
                const t = Math.min(1, (now - start) / duration);
                position = from + (target - from) * easeOutCubic(t);
                render();
                if (t < 1) frame = requestAnimationFrame(tick);
                else { frame = null; settle(); }
            };
            frame = requestAnimationFrame(tick);
        }

        // API del carrusel (también sirve de base para un autoplay futuro)
        function go(delta) {
            if (!interactive) return;
            animateTo(linear ? mod(activeIndex() + delta) : Math.round(target) + delta);
        }

        function goTo(index, options) {
            if (!interactive) return;
            const destination = mod(index);
            if (linear) { animateTo(destination, options); return; }
            let diff = mod(destination - activeIndex()); // camino más corto alrededor de la rueda
            if (diff > total / 2) diff -= total;
            animateTo(Math.round(target) + diff, options);
        }

        if (interactive) {
            // --- Flechas ---
            prevBtn.addEventListener("click", () => go(-1));
            nextBtn.addEventListener("click", () => go(1));

            // --- Teclado: con foco en el carrusel o en sus controles ---
            root.addEventListener("keydown", (e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                if (e.key === "ArrowRight") go(1);
                else if (e.key === "ArrowLeft") go(-1);
                else if (e.key === "Home") goTo(0);
                else if (e.key === "End") goTo(total - 1);
                else return;
                e.preventDefault();
                // El foco acompaña al perfil activo cuando estaba en un indicador o en «Ver perfil»
                const active = activeIndex();
                if (e.target.classList.contains("team-dot") && dots[active]) dots[active].focus();
                else if (e.target.classList.contains("team-profile-btn")) {
                    const button = slides[active].querySelector(".team-profile-btn");
                    (button || root).focus();
                }
            });

            // --- Arrastre con mouse y swipe táctil (pointer events) ---
            // touch-action: pan-y en CSS deja el scroll vertical al navegador; solo el gesto horizontal mueve la rueda.
            stage.addEventListener("pointerdown", (e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                if (e.pointerType === "mouse") e.preventDefault(); // evita selección de texto al arrastrar
                if (frame) { cancelAnimationFrame(frame); frame = null; }
                suppressClickUntil = 0;
                drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: position, moved: false, lastX: e.clientX, lastT: e.timeStamp, speed: 0,
                    slide: e.target.closest(".team-slide") };
            });

            stage.addEventListener("pointermove", (e) => {
                if (!drag || e.pointerId !== drag.id) return;
                const dx = e.clientX - drag.x0;
                const dy = e.clientY - drag.y0;
                if (!drag.moved) {
                    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                    if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // gesto vertical: es scroll
                    drag.moved = true;
                    stage.setPointerCapture(e.pointerId);
                    stage.classList.add("is-dragging");
                }
                const dt = e.timeStamp - drag.lastT;
                if (dt > 0) drag.speed = (e.clientX - drag.lastX) / dt;
                drag.lastX = e.clientX;
                drag.lastT = e.timeStamp;
                position = drag.p0 - dx / step;
                if (linear) {
                    // Con dos tarjetas, más allá de los extremos el arrastre ofrece resistencia
                    if (position < 0) position *= 0.35;
                    else if (position > 1) position = 1 + (position - 1) * 0.35;
                }
                render();
            });

            const endDrag = (e, cancelled) => {
                if (!drag || e.pointerId !== drag.id) return;
                const d = drag;
                drag = null;
                stage.classList.remove("is-dragging");
                const base = Math.round(d.p0);
                if (!d.moved) {
                    // Toque o clic sin arrastre: una tarjeta lateral pasa al frente (y ese clic no abre nada)
                    if (!cancelled && d.slide && !d.slide.classList.contains("is-active")) {
                        suppressClickUntil = performance.now() + 500;
                        goTo(slides.indexOf(d.slide));
                    } else if (position !== base) animateTo(base);
                    return;
                }
                suppressClickUntil = performance.now() + 500;
                if (cancelled) { animateTo(base); return; }
                const moved = position - d.p0;
                let steps = Math.round(moved);
                const recent = e.timeStamp - d.lastT < 100;
                if (steps === 0 && (Math.abs(moved) > SNAP_THRESHOLD || (recent && Math.abs(d.speed) > FLICK_SPEED && Math.abs(moved) > 0.04))) {
                    steps = Math.sign(moved);
                }
                if (linear) animateTo(Math.max(0, Math.min(1, base + steps)));
                else animateTo(base + Math.max(-(total - 1), Math.min(total - 1, steps)));
            };

            stage.addEventListener("pointerup", (e) => endDrag(e, false));
            stage.addEventListener("pointercancel", (e) => endDrag(e, true));
            stage.addEventListener("dragstart", (e) => e.preventDefault());
            // Un arrastre o el toque que trae una lateral al frente no deben activar botones de la tarjeta.
            // Los clics de teclado (detail = 0) nunca se bloquean.
            stage.addEventListener("click", (e) => {
                if (e.detail !== 0 && performance.now() < suppressClickUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            // --- Tamaño y preferencias ---
            if ("ResizeObserver" in window) {
                new ResizeObserver(() => { measure(); render(); }).observe(stage);
            } else {
                window.addEventListener("resize", () => { measure(); render(); });
            }
            if (typeof reduceMotionQuery.addEventListener === "function") {
                reduceMotionQuery.addEventListener("change", render);
            }
        }

        measure();
        updateState(false);
        render();

        return { go, goTo, get activeIndex() { return activeIndex(); } };
    }

    // --- 8D. Perfil ampliado (<dialog> nativo) -------------------------------
    // showModal() vuelve inerte el resto de la página y Escape cierra de forma nativa.
    function createTeamProfileDialog({ dialog, sheet, closeBtn, nameEl, roleEl, photoWrap, photoImg, contentEl, fallbackFocus, onClosed }) {
        const supportsModal = typeof dialog.showModal === "function";
        let current = null;
        let opener = null;

        const make = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text) node.textContent = text;
            return node;
        };
        const section = (title, body) => {
            const block = make("section", "team-profile-section");
            block.append(make("h3", "team-profile-heading", title), body);
            return block;
        };
        const meta = (...parts) => make("span", "team-profile-meta", parts.filter(Boolean).join(" · "));

        function fill(member) {
            const p = member.perfil_completo;
            nameEl.textContent = member.nombre;
            roleEl.textContent = member.rol;
            if (member.imagen) {
                photoImg.setAttribute("src", member.imagen);
                photoImg.setAttribute("alt", member.imagen_alt);
                photoWrap.hidden = false;
            } else {
                photoImg.removeAttribute("src");
                photoWrap.hidden = true;
            }

            const parts = [];
            if (p.bio.length) {
                const body = make("div", "team-profile-bio");
                p.bio.forEach((text) => body.append(make("p", null, text)));
                parts.push(section("Presentación", body));
            }
            if (p.especialidades.length) {
                const ul = make("ul", "team-profile-tags");
                p.especialidades.forEach((text) => ul.append(make("li", null, text)));
                parts.push(section("Especialidades", ul));
            }
            const itemList = (items, build) => {
                const ul = make("ul", "team-profile-list");
                items.forEach((item) => { const li = make("li"); build(li, item); ul.append(li); });
                return ul;
            };
            if (p.experiencia.length) {
                parts.push(section("Experiencia", itemList(p.experiencia, (li, e) => {
                    li.append(make("strong", null, e.cargo || e.organizacion), meta(e.cargo ? e.organizacion : "", e.periodo));
                    if (e.descripcion) li.append(make("p", null, e.descripcion));
                })));
            }
            if (p.formacion.length) {
                parts.push(section("Formación", itemList(p.formacion, (li, e) => {
                    li.append(make("strong", null, e.titulo || e.institucion), meta(e.titulo ? e.institucion : "", e.periodo));
                })));
            }
            if (p.certificaciones.length) {
                parts.push(section("Certificaciones", itemList(p.certificaciones, (li, e) => {
                    if (e.url) {
                        const link = make("a", null, e.nombre);
                        link.href = e.url;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        const strong = make("strong");
                        strong.append(link);
                        li.append(strong);
                    } else {
                        li.append(make("strong", null, e.nombre));
                    }
                    li.append(meta(e.emisor, e.anio));
                })));
            }
            contentEl.replaceChildren(...parts);
        }

        function open(member, from) {
            current = member;
            opener = from || null;
            fill(member);
            if (!dialog.open) {
                document.documentElement.classList.add("team-profile-open");
                if (supportsModal) dialog.showModal();
                else dialog.setAttribute("open", "");
            }
            sheet.scrollTop = 0;
            nameEl.focus({ preventScroll: true });
        }

        function close() {
            if (!dialog.open) return;
            if (supportsModal) dialog.close();
            else { dialog.removeAttribute("open"); handleClose(); }
        }

        function handleClose() {
            document.documentElement.classList.remove("team-profile-open");
            const target = opener && opener.isConnected ? opener : fallbackFocus;
            current = null;
            opener = null;
            if (target) target.focus({ preventScroll: true });
            onClosed();
        }

        dialog.addEventListener("close", handleClose);
        closeBtn.addEventListener("click", close);
        // Clic fuera de la hoja (sobre el fondo oscurecido): cierra
        dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });

        return { open, close, isOpen: () => dialog.open, currentSlug: () => (current ? current.slug : null) };
    }

    // --- 8E. Enlaces #perfil-{slug} e historial ------------------------------
    // Abrir desde «Ver perfil» agrega una entrada (#perfil-slug); cerrar la quita con history.back().
    // Atrás/Adelante y los cambios de hash pasan por applyHash(), que es idempotente: no hay bucles.
    function parseProfileHash(hash) {
        if (!hash || !hash.startsWith(TEAM_HASH_PREFIX)) return null;
        try { return decodeURIComponent(hash.slice(TEAM_HASH_PREFIX.length)); } catch { return ""; }
    }

    function initTeamProfileLinks({ root, stage, slides, integrantes, carousel, profile }) {
        const buttonOf = (index) => slides[index].querySelector(".team-profile-btn");

        function applyHash(onLoad) {
            const slug = parseProfileHash(location.hash);
            if (slug === null) {
                if (profile.isOpen()) profile.close();
                return;
            }
            const index = integrantes.findIndex((m) => m.slug === slug);
            if (index < 0 || !integrantes[index].perfil_completo) {
                teamLog("warn", `${location.hash} no corresponde a un perfil ampliado disponible; se ignora`);
                if (profile.isOpen()) profile.close();
                return;
            }
            if (profile.isOpen() && profile.currentSlug() === slug) return;
            carousel.goTo(index, { instant: true });
            if (onLoad || !profile.isOpen()) {
                // Al cerrar, el visitante queda frente a la tarjeta de ese perfil
                try { root.scrollIntoView({ block: "center", behavior: "instant" }); } catch { root.scrollIntoView({ block: "center" }); }
            }
            profile.open(integrantes[index], buttonOf(index));
        }

        stage.addEventListener("click", (e) => {
            const button = e.target.closest(".team-profile-btn");
            if (!button) return;
            const index = slides.indexOf(button.closest(".team-slide"));
            const member = integrantes[index];
            if (!member || !member.perfil_completo) return;
            const hash = TEAM_HASH_PREFIX + member.slug;
            if (location.hash !== hash) history.pushState({ teamProfile: member.slug }, "", hash);
            profile.open(member, button);
        });

        window.addEventListener("popstate", () => applyHash(false));
        window.addEventListener("hashchange", () => applyHash(false));
        applyHash(true);
    }

    // Al cerrar el perfil se restaura una URL coherente: si la entrada la agregó «Ver perfil», se vuelve atrás;
    // si llegó por enlace directo, se quita el hash sin crear entradas nuevas.
    function clearProfileHash() {
        if (parseProfileHash(location.hash) === null) return;
        if (history.state && history.state.teamProfile) history.back();
        else history.replaceState(history.state, "", location.pathname + location.search);
    }

    // --- Inicio de la sección -------------------------------------------------
    async function initTeamSection(root) {
        const stage = document.getElementById("team-stage");
        const controls = document.getElementById("team-controls");
        const fallback = document.getElementById("team-fallback");
        if (fallback) fallback.hidden = true;
        root.setAttribute("aria-busy", "true");
        root.classList.add("is-loading");
        const doneLoading = () => { root.removeAttribute("aria-busy"); root.classList.remove("is-loading"); };

        const showFallback = (error) => {
            teamLog("error", "no se pudo mostrar el equipo; se muestra el mensaje de respaldo", error);
            doneLoading();
            root.removeAttribute("aria-roledescription");
            root.removeAttribute("tabindex");
            stage.replaceChildren();
            stage.hidden = true;
            controls.hidden = true;
            if (fallback) fallback.hidden = false;
        };

        let data;
        try {
            data = await loadTeamMembers();
        } catch (error) {
            showFallback(error);
            return;
        }

        try {
            const slides = renderTeamCards(stage, document.getElementById("team-card-template"), data.integrantes);
            doneLoading();
            const carousel = createTeamCarousel({
                root, stage, slides, controls,
                names: data.integrantes.map((m) => m.nombre),
                dotsWrap: document.getElementById("team-dots"),
                counter: document.getElementById("team-counter"),
                prevBtn: document.getElementById("team-prev"),
                nextBtn: document.getElementById("team-next"),
                statusEl: document.getElementById("team-status"),
                startIndex: data.inicial,
            });
            const dialog = document.getElementById("team-profile");
            const profile = createTeamProfileDialog({
                dialog,
                sheet: document.getElementById("team-profile-sheet"),
                closeBtn: document.getElementById("team-profile-close"),
                nameEl: document.getElementById("team-profile-name"),
                roleEl: document.getElementById("team-profile-role"),
                photoWrap: document.getElementById("team-profile-photo"),
                photoImg: document.getElementById("team-profile-img"),
                contentEl: document.getElementById("team-profile-content"),
                fallbackFocus: root.hasAttribute("tabindex") ? root : null,
                onClosed: clearProfileHash,
            });
            initTeamProfileLinks({ root, stage, slides, integrantes: data.integrantes, carousel, profile });
        } catch (error) {
            showFallback(error);
        }
    }

    const teamCarousel = document.getElementById("team-carousel");
    if (teamCarousel) initTeamSection(teamCarousel);

});
