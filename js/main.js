/* =========================================================
   Portfolio de Ada Silva · interacciones
   GSAP + ScrollTrigger + SplitText (archivos locales en vendor/gsap)

   Cómo está armado:
   - Los bloques apilados y las secciones fijas usan position: sticky (CSS).
   - GSAP solo anima atado al scroll (scrub): no fija nada con pin.
   - Las posiciones se miden con los bloques "despegados" (clase .midiendo),
     así no importa en qué punto de la página se recalcule.
   - gsap.matchMedia separa computadora, celular y "reducir movimiento".
   ========================================================= */
(function () {
  "use strict";

  var raiz = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function alto() { return window.innerHeight; }

  var el = {
    caja: $(".portada__titulo-caja"),
    titulo: $(".portada__titulo"),
    roles: $(".portada__roles"),
    rolesCaja: $(".portada__roles-caja"),
    ranura: $(".bio__ranura"),
    ranuraTitulo: $(".ranura__titulo"),
    ranuraRoles: $(".ranura__roles"),
    bio: $(".bio"),
    bioMarco: $(".bio__foto .marco"),
    bioImg: $(".bio__foto img"),
    revela: $$(".revela"),
    trabajos: $(".trabajos"),
    barra: $(".trabajos__barra"),
    fichas: $$(".ficha"),
    obras: $$(".obra"),
    habilidades: $(".habilidades"),
    habPista: $(".habilidades__pista"),
    habItems: $$(".habilidad"),
    main: $("main"),
    pie: $(".pie"),
    pieContenido: $(".pie__contenido"),
    palabra: $(".pie__palabra"),
    bloques: $$(".bloque")
  };

  var reducir = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Contenido derivado ---------- */

  // Numeración de obras: cuenta cada obra, esté en una ficha propia o en la grilla de otras obras.
  var total = String(el.obras.length).padStart(2, "0");
  el.obras.forEach(function (f, i) {
    var n = $(".ficha__n", f), t = $(".ficha__total", f);
    if (n) n.textContent = String(i + 1).padStart(2, "0");
    if (t) t.textContent = " / " + total;
  });

  // Habilidades es opcional: sin tarjetas o con data-activa="false" no se muestra.
  var habilidadesActiva = !!el.habilidades && el.habilidades.dataset.activa !== "false" && el.habItems.length > 0;
  if (!habilidadesActiva) {
    if (el.habilidades) el.habilidades.dataset.activa = "false";
    var itemMenu = $('.menu [data-seccion="habilidades"]');
    if (itemMenu) itemMenu.hidden = true;
  }

  // Videos: el ID de YouTube va en data-youtube.
  $$(".video[data-youtube]").forEach(function (v) {
    var id = (v.dataset.youtube || "").trim();
    if (!id) return;
    var ficha = v.closest(".ficha");
    var nombre = ficha && $(".ficha__titulo", ficha) ? $(".ficha__titulo", ficha).textContent.trim() : "un trabajo";
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id);
    f.title = "Video de " + nombre;
    f.loading = "lazy";
    f.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    f.referrerPolicy = "strict-origin-when-cross-origin";
    v.replaceChildren(f);
  });

  /* ---------- Carruseles: la galería (tres filas) y el carrete de cada obra (una fila) ---------- */
  /* Cada fila avanza sola (JS, no CSS) para poder arrastrarla: con el mouse, con el dedo
     o con el desliz lateral del trackpad. Se frena al pasar el mouse o al enfocarla.
     Tocar una foto la abre en grande; tocar de nuevo la cierra y la fila sigue corriendo. */

  var VELOCIDADES = [42, 54, 36]; // px por segundo, una por fila de la galería
  var filas = [];
  var cajas = [];
  var estadoCarrusel = { visor: false };

  // Las fotos vienen en una sola lista y se reparten en bloques, en orden:
  // con 19 fotos y tres filas, la fila 1 lleva de la 1 a la 7; la 2, de la 8 a la 13; la 3, de la 14 a la 19.
  $$(".carrusel").forEach(function (cont) {
    var fuente = $(".carrusel__fotos", cont);
    if (!fuente) return;
    var caja = { el: cont, hover: false, foco: false, filas: [] };
    cajas.push(caja);
    var fotos = Array.prototype.slice.call(fuente.children);
    var cantidad = Math.max(1, Math.min(parseInt(cont.dataset.filas, 10) || 1, fotos.length));
    var velocidadPropia = parseFloat(cont.dataset.velocidad);
    for (var k = 0; k < cantidad; k++) {
      var fila = document.createElement("div");
      fila.className = "carrusel__fila";
      var pista = document.createElement("ul");
      pista.className = "carrusel__pista";
      fila.appendChild(pista);
      cont.appendChild(fila);
      var f = { caja: caja, fila: fila, pista: pista, originales: [],
                velocidad: velocidadPropia || VELOCIDADES[k % VELOCIDADES.length],
                x: 0, periodo: 0, inercia: 0, arrastre: null };
      caja.filas.push(f);
      filas.push(f);
    }
    var porFila = Math.floor(fotos.length / cantidad), sobran = fotos.length % cantidad, i = 0;
    caja.filas.forEach(function (f, k) {
      var cuantas = porFila + (k < sobran ? 1 : 0);
      fotos.slice(i, i + cuantas).forEach(function (li) {
        f.originales.push(li);
        f.pista.appendChild(li);
      });
      i += cuantas;
    });
    fuente.remove();
  });

  function copiar(li) {
    var c = li.cloneNode(true);
    c.classList.add("copia");
    c.setAttribute("aria-hidden", "true");
    $$("button", c).forEach(function (bt) { bt.tabIndex = -1; });
    $$("img", c).forEach(function (img) { img.alt = ""; });
    return c;
  }

  function envolver(f) {
    if (!f.periodo) return;
    f.x = f.x % f.periodo;
    if (f.x > 0) f.x -= f.periodo;
  }

  function carrusel() {
    filas.forEach(function (f) {
      $$(".copia", f.pista).forEach(function (n) { n.remove(); });
      f.pista.style.transform = "";
      f.periodo = 0;
      if (reducir.matches) return; // quieto: la fila se recorre a mano con su barra
      // Media tira: las fotos de la fila, repetidas hasta pasar el ancho de la pantalla.
      var vueltas = 0;
      while (f.pista.offsetWidth < window.innerWidth + 240 && vueltas++ < 30) {
        f.originales.forEach(function (li) { f.pista.appendChild(copiar(li)); });
      }
      // Tira completa: la media tira dos veces. Al pasar la mitad vuelve a empezar sin salto.
      Array.prototype.slice.call(f.pista.children).forEach(function (li) { f.pista.appendChild(copiar(li)); });
      var hueco = parseFloat(getComputedStyle(f.pista).columnGap) || 0;
      f.periodo = (f.pista.offsetWidth + hueco) / 2;
      envolver(f);
      f.pista.style.transform = "translate3d(" + f.x.toFixed(2) + "px,0,0)";
    });
  }

  var ultimoCuadro = 0;
  function avanzar(t) {
    var dt = ultimoCuadro ? Math.min(0.05, (t - ultimoCuadro) / 1000) : 0;
    ultimoCuadro = t;
    filas.forEach(function (f) {
      if (!f.periodo || f.arrastre) return;
      var quieto = f.caja.hover || f.caja.foco || estadoCarrusel.visor;
      if (Math.abs(f.inercia) > 4) {
        f.x += f.inercia * dt;
        f.inercia *= Math.pow(0.04, dt); // la inercia se apaga en menos de un segundo
      } else {
        f.inercia = 0;
        if (!quieto) f.x -= f.velocidad * dt;
      }
      envolver(f);
      f.pista.style.transform = "translate3d(" + f.x.toFixed(2) + "px,0,0)";
    });
    requestAnimationFrame(avanzar);
  }
  if (filas.length) requestAnimationFrame(avanzar);

  var ignorarClick = false;
  cajas.forEach(function (caja) {
    var cont = caja.el;
    // Frenar al pasar el mouse o al enfocar con teclado.
    cont.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") caja.hover = true; });
    cont.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") caja.hover = false; });
    // Solo frena el foco de teclado: el que vuelve a la foto al cerrar el visor con el mouse no la frena.
    cont.addEventListener("focusin", function (e) {
      var teclado = true;
      try { teclado = e.target.matches(":focus-visible"); } catch (err) { /* navegador viejo */ }
      caja.foco = teclado;
    });
    cont.addEventListener("focusout", function (e) {
      if (!cont.contains(e.relatedTarget)) caja.foco = false;
    });
    // Desliz lateral del trackpad (o rueda horizontal): mueve la fila que está debajo del cursor.
    cont.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // el desliz vertical sigue bajando la página
      var filaEl = e.target.closest(".carrusel__fila");
      var f = caja.filas.filter(function (x) { return x.fila === filaEl; })[0];
      if (!f || !f.periodo) return;
      e.preventDefault();
      f.inercia = 0;
      f.x -= e.deltaX;
      envolver(f);
      f.pista.style.transform = "translate3d(" + f.x.toFixed(2) + "px,0,0)";
    }, { passive: false });
    // Tocar una foto la abre en grande.
    cont.addEventListener("click", function (e) {
      var boton = e.target.closest(".carrusel__boton");
      if (!boton || ignorarClick) return;
      abrirVisor(boton);
    });
  });

  // Arrastrar una fila: con el mouse o con el dedo. Un toque sin arrastre abre la foto.
  filas.forEach(function (f) {
    f.fila.addEventListener("pointerdown", function (e) {
      if (!f.periodo || (e.pointerType === "mouse" && e.button !== 0)) return;
      f.arrastre = { id: e.pointerId, x0: e.clientX, xIni: f.x, movio: false, ultX: e.clientX, ultT: e.timeStamp, vel: 0 };
      f.inercia = 0;
    });
    f.fila.addEventListener("pointermove", function (e) {
      var d = f.arrastre;
      if (!d || d.id !== e.pointerId) return;
      var dx = e.clientX - d.x0;
      if (!d.movio && Math.abs(dx) > 6) {
        d.movio = true;
        f.fila.classList.add("arrastrando");
        try { f.fila.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      }
      if (!d.movio) return;
      f.x = d.xIni + dx;
      var dtm = Math.max(1, e.timeStamp - d.ultT);
      d.vel = 0.8 * ((e.clientX - d.ultX) / dtm * 1000) + 0.2 * d.vel;
      d.ultX = e.clientX; d.ultT = e.timeStamp;
      envolver(f);
      f.pista.style.transform = "translate3d(" + f.x.toFixed(2) + "px,0,0)";
    });
    function soltar(e) {
      var d = f.arrastre;
      if (!d || d.id !== e.pointerId) return;
      if (d.movio) {
        f.inercia = Math.max(-2500, Math.min(2500, d.vel));
        ignorarClick = true;
        setTimeout(function () { ignorarClick = false; }, 0);
      }
      f.arrastre = null;
      f.fila.classList.remove("arrastrando");
    }
    f.fila.addEventListener("pointerup", soltar);
    f.fila.addEventListener("pointercancel", soltar);
  });

  /* ---------- Visor: la foto en grande ---------- */

  var visor = document.createElement("div");
  visor.className = "visor";
  visor.hidden = true;
  visor.setAttribute("role", "dialog");
  visor.setAttribute("aria-modal", "true");
  visor.setAttribute("aria-label", "Foto en grande");
  visor.innerHTML = '<img class="visor__foto" alt=""><button class="visor__cerrar" type="button">Cerrar</button>';
  document.body.appendChild(visor);
  var visorFoto = $(".visor__foto", visor), visorCerrar = $(".visor__cerrar", visor);
  var origen = null, cerrando = false;

  function medidaFinal(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var maxW = window.innerWidth * 0.92, maxH = window.innerHeight * 0.86;
    var k = Math.min(maxW / w, maxH / h);
    var fw = w * k, fh = h * k;
    return { left: (window.innerWidth - fw) / 2, top: (window.innerHeight - fh) / 2, width: fw, height: fh };
  }

  function abrirVisor(boton) {
    var img = $("img", boton);
    if (!img || !visor.hidden) return;
    origen = boton;
    estadoCarrusel.visor = true;
    visorFoto.src = img.currentSrc || img.src;
    visorFoto.alt = img.alt || $("img", boton).getAttribute("alt") || "";
    var fin = medidaFinal(img);
    Object.assign(visorFoto.style, { left: fin.left + "px", top: fin.top + "px", width: fin.width + "px", height: fin.height + "px" });
    visor.hidden = false;
    visorCerrar.focus({ preventScroll: true });
    if (window.gsap && !reducir.matches) {
      var r = img.getBoundingClientRect();
      gsap.fromTo(visor, { "--velo": 0 }, { "--velo": 1, duration: 0.35, ease: "power2.out" });
      gsap.fromTo(visorFoto,
        { x: r.left - fin.left, y: r.top - fin.top, scaleX: r.width / fin.width, scaleY: r.height / fin.height },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.5, ease: "power3.out" });
    } else {
      visor.style.setProperty("--velo", 1);
    }
  }

  function cerrarVisor() {
    if (visor.hidden || cerrando) return;
    var terminar = function () {
      visor.hidden = true;
      cerrando = false;
      estadoCarrusel.visor = false;
      if (window.gsap) gsap.set(visorFoto, { clearProps: "transform" });
      if (origen && document.contains(origen)) {
        var vuelta = origen.closest(".copia") ? null : origen; // a una copia no se le puede devolver el foco
        if (vuelta) vuelta.focus({ preventScroll: true });
      }
    };
    var img = origen && $("img", origen);
    if (window.gsap && !reducir.matches && img) {
      cerrando = true;
      var r = img.getBoundingClientRect(), fin = visorFoto.getBoundingClientRect();
      gsap.to(visor, { "--velo": 0, duration: 0.3, ease: "power2.in" });
      gsap.to(visorFoto, {
        x: r.left - fin.left, y: r.top - fin.top, scaleX: r.width / fin.width, scaleY: r.height / fin.height,
        duration: 0.4, ease: "power3.inOut", onComplete: terminar
      });
    } else {
      terminar();
    }
  }

  visor.addEventListener("click", cerrarVisor); // tocar en cualquier lado cierra
  document.addEventListener("keydown", function (e) {
    if (visor.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); cerrarVisor(); }
    if (e.key === "Tab") { e.preventDefault(); visorCerrar.focus(); } // el foco no sale del visor
  });
  // Con el visor abierto la página no se mueve debajo.
  ["wheel", "touchmove"].forEach(function (tipo) {
    visor.addEventListener(tipo, function (e) { e.preventDefault(); }, { passive: false });
  });
  window.addEventListener("resize", function () {
    if (visor.hidden || cerrando) return;
    var fin = medidaFinal(visorFoto);
    Object.assign(visorFoto.style, { left: fin.left + "px", top: fin.top + "px", width: fin.width + "px", height: fin.height + "px" });
  });

  /* ---------- Medidas ---------- */

  function medir(fn) {
    raiz.classList.add("midiendo");
    try { return fn(); } finally { raiz.classList.remove("midiendo"); }
  }
  function arriba(n) { return n.getBoundingClientRect().top + window.scrollY; }

  function ajustarAncho(nodo, ancho) {
    if (!nodo || !ancho) return;
    nodo.style.fontSize = "100px";
    var w = nodo.offsetWidth;
    if (w) nodo.style.fontSize = (100 * ancho / w).toFixed(2) + "px";
  }

  function anchoUtil(n) {
    var cs = getComputedStyle(n);
    return n.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  // Tramo de scroll del acordeón de habilidades: casi una pantalla por cada cambio.
  function recorridoHabilidades() {
    if (!raiz.classList.contains("habilidades-scrub")) return 0;
    return Math.max(0, el.habItems.length - 1) * alto() * 0.9;
  }

  function preparar() {
    // El nombre de la portada y la palabra del footer tienen tamaño fijo por CSS.

    // Los roles van siempre en una sola línea y nunca más anchos que la pantalla:
    // si no entran, se achica la letra. Lo mismo al aterrizar en la bio.
    el.roles.style.fontSize = "";
    el.ranuraRoles.style.fontSize = "";
    var fsRoles = parseFloat(getComputedStyle(el.roles).fontSize);
    var sep = fsRoles * 1.82; // el cuadradito del primer rol queda recortado
    var anchoRoles = el.roles.scrollWidth - sep;
    var disponible = el.rolesCaja.clientWidth;
    if (anchoRoles > disponible) {
      fsRoles = fsRoles * disponible / anchoRoles * 0.99;
      el.roles.style.fontSize = fsRoles.toFixed(2) + "px";
      anchoRoles = el.roles.scrollWidth - fsRoles * 1.82;
    }
    if (el.ranuraRoles.clientWidth) {
      var fsRanura = parseFloat(getComputedStyle(el.ranuraRoles).fontSize);
      var anchoAterriza = anchoRoles * fsRanura / fsRoles;
      if (anchoAterriza > el.ranuraRoles.clientWidth) {
        el.ranuraRoles.style.fontSize = (fsRanura * el.ranuraRoles.clientWidth / anchoAterriza * 0.99).toFixed(2) + "px";
      }
    }

    // La ranura de los roles mide lo mismo que los roles ya achicados.
    var escalaRoles = parseFloat(getComputedStyle(el.ranuraRoles).fontSize) / parseFloat(getComputedStyle(el.roles).fontSize);
    el.ranuraRoles.style.height = (el.roles.offsetHeight * escalaRoles).toFixed(1) + "px";

    if (habilidadesActiva) {
      el.habilidades.style.height = "";
      if (raiz.classList.contains("apilado")) {
        el.habilidades.style.height = (alto() + recorridoHabilidades()) + "px";
      }
    }

    // El footer se superpone al último bloque: comparten el mismo tramo de scroll.
    // Al final, el footer tapa toda la galería y deja ver solo el título "Fotos", como una solapa.
    el.pie.style.minHeight = "";
    if (raiz.classList.contains("apilado")) {
      var fotos = $("#fotos"), cabezaFotos = $(".fotos__cabeza", fotos);
      var topeFotos = Math.min(0, alto() - fotos.offsetHeight);
      var bordeCabeza = topeFotos + cabezaFotos.getBoundingClientRect().bottom - fotos.getBoundingClientRect().top;
      var tapa = Math.min(alto(), Math.round(alto() - bordeCabeza - (parseFloat(getComputedStyle(fotos).rowGap) || 0) / 2));
      if (tapa > el.pie.offsetHeight) el.pie.style.minHeight = tapa + "px";
      raiz.style.setProperty("--alto-pie", el.pie.offsetHeight + "px");
    } else {
      raiz.style.removeProperty("--alto-pie");
    }

    // Fichas con carrete (Desafío a la noche y Teoría del derrumbe).
    // En computadora la página entra entera, sin scroll: foto grande y datos arriba, carrete abajo.
    // El carrete arranca en su alto máximo y se achica hasta su mínimo si hace falta lugar para los datos.
    // Si ni así entran los datos al lado de la foto (o la foto quedaría demasiado chica), la disposición
    // pasa a una columna: foto, datos y carrete, con la foto lo más grande que permita la pantalla.
    $$(".ficha--mosaico").forEach(function (f) {
      var cuerpo = $(".mosaico__cuerpo", f), foto = $(".mosaico__vertical", f),
          info = $(".ficha__info", f), carr = $(".carrusel--obra", f);
      if (!cuerpo || !foto || !info) return;
      f.classList.remove("ficha--en-columna");
      f.style.removeProperty("--alto-foto-obra");
      f.style.removeProperty("--alto-carrete");
      if (window.innerWidth < 768) return; // en celular la disposición la resuelve el CSS
      var cs = getComputedStyle(f);
      var hueco = parseFloat(cs.rowGap) || 0;
      var util = alto() - el.barra.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - hueco - f.clientTop;
      var ratio = parseFloat(getComputedStyle(foto).getPropertyValue("--ratio")) || 0.66;
      var maxC = Math.min(184, Math.max(96, alto() * 0.17)), minC = 84;
      var MIN_FOTO = 300, MIN_LADO = 360;
      var colGap = parseFloat(getComputedStyle(cuerpo).columnGap) || 0;
      var elegido = null;
      function probar(p, hc) {
        if (cuerpo.clientWidth - p * ratio - colGap < MIN_LADO) return false;
        f.style.setProperty("--alto-foto-obra", Math.floor(p) + "px");
        f.style.setProperty("--alto-carrete", Math.floor(hc) + "px");
        return info.offsetHeight <= util - hc;
      }
      // 1 · La foto a todo el alto; el carrete se achica si los datos necesitan lugar.
      for (var hc = maxC; hc >= minC && elegido === null; hc -= 6) {
        var p = util - hc;
        if (p < MIN_FOTO) break;
        if (probar(p, hc) && info.offsetHeight <= Math.floor(p)) elegido = hc;
      }
      // 2 · Si no alcanza, la foto se achica un poco (nunca por debajo del mínimo) para dar más ancho a los datos.
      for (var p2 = util - minC; p2 >= MIN_FOTO && elegido === null; p2 -= 12) {
        for (var hc2 = Math.min(maxC, util - p2); hc2 >= minC; hc2 -= 6) {
          if (probar(p2, hc2)) { elegido = hc2; break; }
        }
      }
      if (elegido !== null) return;
      // Una columna: foto arriba, datos y carrete abajo. La foto se achica para que todo entre,
      // pero nunca por debajo de un mínimo; si no entra, la página se recorre con scroll.
      f.classList.add("ficha--en-columna");
      f.style.setProperty("--alto-carrete", maxC.toFixed(1) + "px");
      f.style.removeProperty("--alto-foto-obra");
      var huecoCol = parseFloat(getComputedStyle(cuerpo).rowGap) || 0;
      var resto = util - maxC - info.offsetHeight - huecoCol;
      var tope = Math.min(26 * 16 / ratio, cuerpo.clientWidth / ratio);
      f.style.setProperty("--alto-foto-obra", Math.max(260, Math.min(tope, resto)).toFixed(1) + "px");
    });

    // Fichas de obras: si una no entra en la pantalla, se pega recién cuando se terminó de ver.
    var barraAlto = el.barra.offsetHeight;
    el.fichas.forEach(function (f) {
      if (raiz.classList.contains("apilado")) {
        f.style.setProperty("--tope-ficha", Math.min(barraAlto, alto() - f.offsetHeight) + "px");
      } else {
        f.style.removeProperty("--tope-ficha");
      }
    });

    // Bloques más altos que la pantalla se pegan recién cuando se terminan de ver.
    el.bloques.forEach(function (b) {
      b.style.setProperty("--tope", Math.min(0, alto() - b.offsetHeight) + "px");
    });
  }

  // Título y roles viajan juntos desde la portada hasta su lugar en la bio.
  var flip = { t: { x: 0, y: 0, s: 1 }, r: { x: 0, y: 0, s: 1 }, fin: 1 };
  function calcularFlip() {
    flip = medir(function () {
      var c = el.caja.getBoundingClientRect(), rc = el.rolesCaja.getBoundingClientRect();
      var t = el.ranuraTitulo.getBoundingClientRect(), r = el.ranuraRoles.getBoundingClientRect();
      var fs = function (n) { return parseFloat(getComputedStyle(n).fontSize); };
      return {
        t: { x: t.left - c.left, y: t.top - c.top, s: fs(el.ranuraTitulo) / fs(el.titulo) },
        r: { x: r.left - rc.left, y: r.top - rc.top, s: fs(el.ranuraRoles) / fs(el.roles) },
        fin: Math.max(1, t.top + window.scrollY - alto() * 0.14) // se asientan al 14 % de la pantalla
      };
    });
  }

  var pos = {};
  function calcularPosiciones() {
    pos = medir(function () {
      return {
        bioTop: arriba(el.bio),
        bioAlto: el.bio.offsetHeight,
        bioFotoTop: arriba(el.bioMarco),
        revela: el.revela.map(function (n) { return { top: arriba(n), alto: n.offsetHeight }; }),
        trabajosTop: arriba(el.trabajos),
        barra: el.barra.offsetHeight,
        fichas: el.fichas.map(function (f) { return { top: arriba(f), alto: f.offsetHeight }; }),
        habTop: habilidadesActiva ? arriba(el.habilidades) : 0
      };
    });
  }

  function actualizar() {
    preparar();
    carrusel();
    calcularFlip();
    calcularPosiciones();
  }

  /* ---------- Links internos ---------- */

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    var destino = id ? document.getElementById(id) : null;
    if (!destino) return;
    e.preventDefault();
    var y = id === "inicio" ? 0 : medir(function () { return arriba(destino); });
    window.scrollTo({ top: y, behavior: reducir.matches ? "auto" : "smooth" });
    if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
    destino.focus({ preventScroll: true });
    try { history.replaceState(null, "", "#" + id); } catch (err) { /* sin historial disponible */ }
  });

  /* ---------- Foco con teclado: que nunca quede tapado por un bloque apilado ---------- */

  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (!raiz.classList.contains("apilado") || !t.closest || !t.closest(".bloque")) return;
    // Las secciones reciben foco al usar el menú: ahí manda el desplazamiento del link, no este ajuste.
    if (t.getAttribute("tabindex") === "-1" || t.matches("section, footer, .bloque")) return;
    requestAnimationFrame(function () {
      var r = t.getBoundingClientRect();
      var x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
      var y = Math.min(Math.max(r.top + r.height / 2, 1), alto() - 1);
      if (r.height > alto() * 0.8) return; // un elemento casi tan alto como la pantalla no se acomoda
      var visible = r.bottom > 0 && r.top < alto();
      var encima = document.elementFromPoint(x, y);
      if (visible && encima && (encima === t || t.contains(encima))) return;
      // Se lleva el elemento cerca del borde inferior, en su posición real: ahí nada lo tapa.
      var abajo = medir(function () { var rr = t.getBoundingClientRect(); return rr.bottom + window.scrollY; });
      window.scrollTo({ top: Math.max(0, abajo - alto() + 32), behavior: "auto" });
    });
  });

  /* ---------- Sin GSAP: la página funciona igual, sin animaciones ---------- */

  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) {
    preparar();
    carrusel();
    window.addEventListener("resize", preparar);
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.addEventListener("refreshInit", actualizar);

  var mm = gsap.matchMedia();

  mm.add({
    compu: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
    celu: "(max-width: 767.98px) and (prefers-reduced-motion: no-preference)",
    quieto: "(prefers-reduced-motion: reduce)"
  }, function (ctx) {
    var c = ctx.conditions;

    if (c.quieto) {
      // Reducir movimiento: nada se anima, nada se apila, el carrusel queda quieto.
      actualizar();
      return;
    }

    raiz.classList.add("titulo-viaja");
    if (c.compu) raiz.classList.add("apilado", "habilidades-scrub");

    // Texto que se revela: se divide antes de medir.
    var splits = el.revela.map(function (p) {
      return SplitText.create(p, { type: "words", wordsClass: "palabra" });
    });

    actualizar();

    /* 1 · Portada → bio: título y roles se achican juntos y aterrizan en la bio */
    [["t", el.titulo], ["r", el.roles]].forEach(function (par) {
      var k = par[0];
      gsap.fromTo(par[1], { x: 0, y: 0, scale: 1 }, {
        x: function () { return flip[k].x; },
        y: function () { return flip[k].y; },
        scale: function () { return flip[k].s; },
        ease: "none",
        scrollTrigger: { start: 0, end: function () { return flip.fin; }, scrub: true, invalidateOnRefresh: true }
      });
    });

    /* La foto entra junto con la bio: se descubre de arriba hacia abajo mientras sube */
    var tramoFoto = {
      start: function () { return pos.bioFotoTop - alto() * 0.92; },
      end: function () { return pos.bioFotoTop - alto() * 0.3; },
      scrub: true
    };
    gsap.fromTo(el.bioMarco, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: tramoFoto });
    gsap.fromTo(el.bioImg, { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: tramoFoto });

    /* Parallax de la foto de la bio */
    if (c.compu) {
      gsap.fromTo(el.bioImg, { yPercent: 0 }, {
        yPercent: -4, ease: "none",
        scrollTrigger: {
          start: function () { return flip.fin; },
          end: function () { return pos.bioTop + pos.bioAlto; },
          scrub: true
        }
      });
    }

    /* 2 · Texto de la bio: las palabras pasan de tenues a plenas */
    splits.forEach(function (s, i) {
      gsap.fromTo(s.words, { opacity: 0.16 }, {
        opacity: 1, ease: "none", stagger: 0.1,
        scrollTrigger: {
          start: function () { return pos.revela[i].top - alto() * 0.85; },
          end: function () { return pos.revela[i].top + pos.revela[i].alto - alto() * 0.45; },
          scrub: true
        }
      });
    });

    /* 3 · Trabajos */
    el.fichas.forEach(function (f, i) {
      var titulos = $$(".mascara > span", f);
      var imgs = $$(".parallax", f);

      if (c.compu) {
        // Tramo de scroll en el que la ficha i sube y tapa a la anterior:
        // desde que asoma por abajo hasta que se pega arriba.
        var ini = function () { return pos.fichas[i].top - alto(); };
        var fin = function () { return pos.fichas[i].top - Math.min(pos.barra, alto() - pos.fichas[i].alto); };
        var tramo = function (a, b) {
          return {
            start: function () { return ini() + (fin() - ini()) * a; },
            end: function () { return ini() + (fin() - ini()) * b; },
            scrub: true
          };
        };

        // El título cambia deslizándose dentro de su máscara.
        gsap.fromTo(titulos, { yPercent: 110 }, { yPercent: 0, ease: "none", stagger: 0.08, scrollTrigger: tramo(0.45, 1) });
        // La foto sube más lento que la ficha (parallax).
        if (imgs.length) gsap.fromTo(imgs, { yPercent: 4 }, { yPercent: 0, ease: "none", scrollTrigger: tramo(0, 1) });
        // La ficha anterior se apaga mientras la nueva le pasa por delante.
        if (i > 0) {
          var previa = el.fichas[i - 1];
          gsap.fromTo(Array.prototype.slice.call(previa.children), { opacity: 1 }, {
            opacity: 0.3, ease: "none", scrollTrigger: tramo(0, 1)
          });
        }
      } else {
        // Celular: el título entra con su máscara cuando la ficha aparece.
        gsap.from(titulos, {
          yPercent: 110, duration: 0.9, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: f, start: "top 80%", once: true }
        });
      }
    });

    /* 5 · Habilidades: el texto activo se achica, la foto siguiente ocupa su lugar
       y aparece el texto nuevo. Las tres fotos quedan siempre a la vista. */
    if (c.compu && habilidadesActiva && el.habItems.length > 1) {
      var textos = el.habItems.map(function (h) { return $(".habilidad__texto", h); });
      var interiores = el.habItems.map(function (h) { return $(".habilidad__interior", h); });
      gsap.set(textos, { "--abierto": 0 });
      gsap.set(textos[0], { "--abierto": 1 });
      gsap.set(interiores, { opacity: 0 });
      gsap.set(interiores[0], { opacity: 1 });

      var acordeon = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          start: function () { return pos.habTop; },
          end: function () { return pos.habTop + Math.max(1, recorridoHabilidades()); },
          scrub: true
        }
      });
      for (var k = 0; k < el.habItems.length - 1; k++) {
        acordeon
          .to(interiores[k], { scale: 0.82, opacity: 0, duration: 0.45 }, k)
          .to(textos[k], { "--abierto": 0, duration: 1 }, k)
          .fromTo(textos[k + 1], { "--abierto": 0 }, { "--abierto": 1, duration: 1 }, k)
          .fromTo(interiores[k + 1], { opacity: 0, y: 16, scale: 1 }, { opacity: 1, y: 0, duration: 0.45 }, k + 0.55);
      }
    }

    return function () {
      raiz.classList.remove("titulo-viaja", "apilado", "habilidades-scrub");
      splits.forEach(function (s) { s.revert(); });
      if (el.habilidades) el.habilidades.style.height = "";
      raiz.style.removeProperty("--alto-pie");
    };
  });

  // Cuando terminan de cargar las tipografías, se vuelve a medir todo.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  if (reducir.addEventListener) reducir.addEventListener("change", carrusel);
})();
