/**
 * Mixin de sincronizacion TEST -> PRODUCCION para los apartados estado-pedidos-*-test.
 *
 * Dos acciones explicitas:
 *   - INSERTAR NUEVO PEDIDO: crea el pedido en produccion (contadores de NetAgro).
 *   - MODIFICAR PEDIDO:      actualiza un pedido de produccion con los datos de test.
 *                            Si el pedido de test casa con uno, pregunta "¿modificar el
 *                            pedido XXXX?"; si no casa, pide el nº de pedido (o el
 *                            PED_idpedido) con el ejercicio ya prerellenado.
 *
 * Antes de ejecutar cualquiera de las dos se hace un dry-run que muestra lo que va a
 * pasar (nº que se asignaria, o diferencias campo a campo) y la traza del backend.
 *
 * Se mezcla en los managers (todos tienen `_endpoint`, `pedidoDetail`, `pedidoLineas`,
 * `pedidoDetailProd` y `prodNotFound`), asi que la logica vive en un solo sitio.
 */
export default function traspasoProduccion() {
    return {
        // ── estado ──
        traspasoEnCurso: false,
        traspasoAnalisis: null,        // respuesta de /analizar
        traspasoPaso: '',              // '' | 'confirmarInsertar' | 'pedirObjetivo' | 'confirmarModificar'
        traspasoResultado: null,       // resultado de la ejecucion real
        traspasoPlan: null,            // resultado del dry-run
        traspasoError: null,
        traspasoValidaciones: [],
        traspasoAvisos: [],
        traspasoTraza: [],
        traspasoSentencias: [],
        traspasoMostrarTraza: false,
        traspasoPrevio: null,          // ultimo traspaso registrado para este pedido
        traspasoObjetivo: null,        // pedido de produccion elegido a mano
        traspasoForm: { numeroPedido: '', ejercicio: '', idPedido: '', buscando: false, error: '' },
        traspasoAnularSobrantes: false,
        _traspasoItem: null,

        _resetTraspaso(item = null) {
            this.traspasoEnCurso = false;
            this.traspasoAnalisis = null;
            this.traspasoPaso = '';
            this.traspasoResultado = null;
            this.traspasoPlan = null;
            this.traspasoError = null;
            this.traspasoValidaciones = [];
            this.traspasoAvisos = [];
            this.traspasoTraza = [];
            this.traspasoSentencias = [];
            this.traspasoMostrarTraza = false;
            this.traspasoPrevio = null;
            this.traspasoObjetivo = null;
            this.traspasoForm = { numeroPedido: '', ejercicio: '', idPedido: '', buscando: false, error: '' };
            this.traspasoAnularSobrantes = false;
            this._traspasoItem = item;
        },

        _traspasoUrl(ruta) { return `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/${ruta}`; },
        _traspasoEmail() {
            try { return (window.Alpine && window.Alpine.store('global')?.userEmail) || ''; } catch (e) { return ''; }
        },
        _traspasoAplicarRespuesta(data) {
            this.traspasoTraza = Array.isArray(data.traza) ? data.traza : [];
            this.traspasoValidaciones = Array.isArray(data.validaciones) ? data.validaciones : [];
            this.traspasoAvisos = Array.isArray(data.avisos) ? data.avisos : [];
            this.traspasoSentencias = Array.isArray(data.sentencias) ? data.sentencias : [];
        },

        // ── 1. Analisis al abrir el pedido: ¿casa con alguno de produccion? ──
        async traspasoCargarPrevio() {
            const id = this.pedidoDetail?.PED_idpedido;
            if (!id) return;
            try {
                const res = await fetch(this._traspasoUrl(`traspasos?idPedidoTest=${id}`));
                if (res.ok) {
                    const data = await res.json();
                    this.traspasoPrevio = data.ultimoOk || null;
                }
            } catch (e) { console.warn('[traspaso] no se pudo consultar el historico', e); }

            try {
                const res = await fetch(this._traspasoUrl(`analizar?idPedidoTest=${id}`));
                const data = await res.json();
                if (!res.ok || !data.ok) {
                    console.warn('[traspaso] analizar fallo', data);
                    return;
                }
                this.traspasoAnalisis = data;
                this.traspasoForm.ejercicio = String(data.ejercicioDestino ?? '');
                console.log(`[traspaso] analisis: modo=${data.modo} candidatos=${data.candidatos?.length} destino=${data.motorDestino}`);

                // Si casa con uno y el panel de PRODUCCION no lo encontro (la busqueda del
                // panel usa PED_NumeroPedido, que en muchos pedidos viene vacio), se pinta
                // aqui para que la comparacion y los diffs sean utiles.
                if (data.modo === 'MODIFICAR' && data.prod?.PED_idpedido && !this.pedidoDetailProd) {
                    const r2 = await fetch(this._traspasoUrl(`pedido-prod-id/${data.prod.PED_idpedido}`));
                    if (r2.ok) {
                        const p = await r2.json();
                        this.pedidoDetailProd = p.header;
                        this.pedidoLineasProd = p.lineas;
                        this.prodNotFound = false;
                        console.log(`[traspaso] panel PRODUCCION rellenado desde analizar (idpedido ${data.prod.PED_idpedido})`);
                    }
                }
            } catch (e) { console.warn('[traspaso] error analizando', e); }
        },

        traspasoCasa() { return this.traspasoAnalisis?.modo === 'MODIFICAR'; },
        traspasoAmbiguo() { return this.traspasoAnalisis?.modo === 'AMBIGUO'; },
        traspasoListo() { return !!this.pedidoDetail?.PED_idpedido && !this.traspasoEnCurso; },
        traspasoPedidoProdCasa() { return this.traspasoAnalisis?.prod || null; },

        // ── 2. Insertar nuevo pedido ──
        traspasoPedirConfirmInsertar() {
            this.traspasoError = null;
            this.traspasoPlan = null;
            this.traspasoPaso = 'confirmarInsertar';
        },

        async traspasoInsertar({ dryRun = false, forzar = false } = {}) {
            await this._traspasoEjecutar({
                modo: 'INSERTAR', dryRun, forzarInsertar: forzar
            });
            if (!dryRun && this.traspasoResultado) this.traspasoPaso = '';
        },

        // ── 3. Modificar pedido ──
        async traspasoIniciarModificar() {
            this.traspasoError = null;
            this.traspasoPlan = null;
            if (this.traspasoCasa()) {
                // Casa con uno: se simula para ver el diff y se pide confirmacion
                this.traspasoObjetivo = {
                    PED_idpedido: this.traspasoAnalisis.prod.PED_idpedido,
                    PED_pedido: this.traspasoAnalisis.prod.PED_pedido,
                    PED_ejercicio: this.traspasoAnalisis.prod.ejercicio
                };
                this.traspasoPaso = 'confirmarModificar';
                await this._traspasoEjecutar({ modo: 'MODIFICAR', dryRun: true });
            } else {
                this.traspasoObjetivo = null;
                this.traspasoForm.error = '';
                this.traspasoPaso = 'pedirObjetivo';
            }
        },

        /** Busca en produccion el pedido que el comercial ha tecleado. */
        async traspasoBuscarObjetivo() {
            this.traspasoForm.error = '';
            this.traspasoObjetivo = null;
            const idPedido = String(this.traspasoForm.idPedido || '').trim();
            const num = String(this.traspasoForm.numeroPedido || '').trim();
            const ejer = String(this.traspasoForm.ejercicio || '').trim();
            if (!idPedido && !num) { this.traspasoForm.error = 'Indica el nº de pedido o el PED_idpedido'; return; }
            if (!idPedido && !ejer) { this.traspasoForm.error = 'Falta el ejercicio'; return; }

            this.traspasoForm.buscando = true;
            try {
                const qs = idPedido ? `idPedido=${encodeURIComponent(idPedido)}`
                    : `numeroPedido=${encodeURIComponent(num)}&ejercicio=${encodeURIComponent(ejer)}`;
                const res = await fetch(this._traspasoUrl(`buscar-prod?${qs}`));
                const data = await res.json();
                if (!res.ok) { this.traspasoForm.error = data.message || `Error ${res.status}`; return; }
                const filas = data.resultados || [];
                if (filas.length === 0) { this.traspasoForm.error = 'No existe ese pedido en produccion'; return; }
                if (filas.length > 1) { this.traspasoForm.error = `Hay ${filas.length} pedidos con ese numero: indica el PED_idpedido`; return; }
                this.traspasoObjetivo = filas[0];
                console.log('[traspaso] objetivo manual', JSON.stringify(this.traspasoObjetivo));
                // Se simula ya para que vea el diff antes de confirmar
                this.traspasoPaso = 'confirmarModificar';
                await this._traspasoEjecutar({ modo: 'MODIFICAR', dryRun: true });
            } catch (e) {
                this.traspasoForm.error = e.message || 'Error de red';
            } finally {
                this.traspasoForm.buscando = false;
            }
        },

        async traspasoModificar({ dryRun = false } = {}) {
            await this._traspasoEjecutar({ modo: 'MODIFICAR', dryRun });
            if (!dryRun && this.traspasoResultado) this.traspasoPaso = '';
        },

        traspasoCancelar() {
            this.traspasoPaso = '';
            this.traspasoPlan = null;
            this.traspasoObjetivo = null;
            this.traspasoError = null;
        },

        // ── 4. Llamada al backend ──
        async _traspasoEjecutar({ modo, dryRun, forzarInsertar = false }) {
            const idPedidoTest = this.pedidoDetail?.PED_idpedido;
            if (!idPedidoTest) { this.traspasoError = 'No hay pedido de test cargado'; return; }

            this.traspasoEnCurso = true;
            this.traspasoError = null;
            if (dryRun) this.traspasoPlan = null;

            const body = { idPedidoTest, email: this._traspasoEmail(), modo, dryRun };
            if (forzarInsertar) body.forzarInsertar = true;
            if (modo === 'MODIFICAR') {
                if (this.traspasoObjetivo?.PED_idpedido) body.idPedidoProd = this.traspasoObjetivo.PED_idpedido;
                if (this.traspasoAnularSobrantes) body.anularLineasSobrantes = true;
            }
            console.log(`[traspaso] POST pasar-a-produccion`, JSON.stringify(body));

            try {
                const res = await fetch(this._traspasoUrl('pasar-a-produccion'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json().catch(() => ({}));
                console.log(`[traspaso] respuesta ${res.status}`, data);
                this._traspasoAplicarRespuesta(data);

                if (!res.ok || !data.ok) {
                    this.traspasoError = data.message || data.motivo || `Error ${res.status}`;
                    if (data.requiereObjetivo) this.traspasoPaso = 'pedirObjetivo';
                    if (this.traspasoValidaciones.some(v => v.estado === 'ERROR') || data.candidatos || data.bloqueos) {
                        this.traspasoMostrarTraza = true;
                    }
                    return;
                }

                if (data.dryRun) { this.traspasoPlan = data; return; }

                if (data.sinCambios) {
                    this.traspasoAvisos = [...this.traspasoAvisos, 'No habia ninguna diferencia: no se ha tocado nada en produccion'];
                }
                this.traspasoResultado = data;
                // Recargar la comparacion para ver el pedido de produccion resultante
                if (this._traspasoItem && typeof this.openPedidoDetail === 'function') {
                    const item = this._traspasoItem;
                    const resultado = this.traspasoResultado;
                    const traza = this.traspasoTraza;
                    const avisos = this.traspasoAvisos;
                    await this.openPedidoDetail(item);
                    this._traspasoItem = item;
                    this.traspasoResultado = resultado;
                    this.traspasoTraza = traza;
                    this.traspasoAvisos = avisos;
                    // Si acabamos de crear/modificar, pintamos ese pedido en el panel derecho
                    const idProd = resultado?.resultado?.PED_idpedido;
                    if (idProd) {
                        try {
                            const r2 = await fetch(this._traspasoUrl(`pedido-prod-id/${idProd}`));
                            if (r2.ok) {
                                const p = await r2.json();
                                this.pedidoDetailProd = p.header;
                                this.pedidoLineasProd = p.lineas;
                                this.prodNotFound = false;
                            }
                        } catch (e) { console.warn('[traspaso] no se pudo recargar el panel de produccion', e); }
                    }
                }
            } catch (err) {
                console.error('[traspaso] ERROR', err);
                this.traspasoError = err.message || 'Error de red llamando al backend';
            } finally {
                this.traspasoEnCurso = false;
            }
        }
    };
}
