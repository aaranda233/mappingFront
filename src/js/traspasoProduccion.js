/**
 * Mixin de sincronizacion TEST -> PRODUCCION para los apartados estado-pedidos-*-test.
 *
 * En pantalla solo hay dos botones (INSERTAR / MODIFICAR) debajo de la comparacion.
 * Al pulsar MODIFICAR aparecen los campos del pedido de produccion a modificar
 * (ejercicio prerellenado; si el pedido casa con uno, tambien el nº) y el mismo boton
 * ejecuta la modificacion.
 *
 * TODO lo demas (analisis, motor destino, maestros, contadores, SQL, diffs, avisos)
 * va a los logs, no a la pantalla:
 *   - consola del navegador: prefijo [traspaso]
 *   - log del pod:           [analizar:<apartado>:<id>] y [traspaso:<apartado>:<id>]
 */
export default function traspasoProduccion() {
    return {
        traspasoEnCurso: false,
        traspasoMostrarForm: false,
        traspasoUltimo: null,   // { accion:'INSERTAR'|'MODIFICAR', ok:boolean }
        traspasoForm: { ejercicio: '', numeroPedido: '', idPedido: '' },
        _traspasoItem: null,
        _traspasoAnalisis: null,

        _resetTraspaso(item = null) {
            this.traspasoEnCurso = false;
            this.traspasoMostrarForm = false;
            this.traspasoUltimo = null;
            this.traspasoForm = { ejercicio: '', numeroPedido: '', idPedido: '' };
            this._traspasoItem = item;
            this._traspasoAnalisis = null;
        },

        _traspasoUrl(ruta) { return `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/${ruta}`; },
        _traspasoEmail() {
            try { return (window.Alpine && window.Alpine.store('global')?.userEmail) || ''; } catch (e) { return ''; }
        },

        traspasoListo() { return !!this.pedidoDetail?.PED_idpedido && !this.traspasoEnCurso; },

        /**
         * Se llama al abrir el pedido. Analiza contra produccion solo para dejarlo en
         * los logs y para prerellenar el formulario; no pinta nada en pantalla.
         */
        async traspasoCargarPrevio() {
            const id = this.pedidoDetail?.PED_idpedido;
            if (!id) return;
            try {
                const res = await fetch(this._traspasoUrl(`analizar?idPedidoTest=${id}`));
                const data = await res.json();
                if (!res.ok || !data.ok) { console.warn('[traspaso] analizar fallo', data); return; }
                this._traspasoAnalisis = data;
                this.traspasoForm.ejercicio = String(data.ejercicioDestino ?? '');
                if (data.modo === 'MODIFICAR' && data.prod?.PED_pedido) {
                    this.traspasoForm.numeroPedido = String(data.prod.PED_pedido);
                }
                console.log(`[traspaso] analisis pedido test ${id}: modo=${data.modo} candidatos=${data.candidatos?.length} ` +
                    `destino=${data.motorDestino}${data.mismoMotor ? ' [MISMO MOTOR QUE TEST]' : ''}` +
                    (data.autoExcluido ? ` (se excluye el propio pedido ${data.autoExcluido})` : ''));
                if (Array.isArray(data.traza)) data.traza.forEach(t => console.log(`[traspaso]   +${t.ms}ms [${t.paso}] ${t.detalle}`));
                if ((data.bloqueos || []).length) console.warn('[traspaso] bloqueos para modificar:', data.bloqueos);
                if (data.diffs) console.log('[traspaso] diferencias con produccion:', JSON.stringify(data.diffs));

                // Si casa con uno y el panel de PRODUCCION no lo encontro (busca por
                // PED_NumeroPedido, vacio en muchos pedidos), se pinta aqui.
                if (data.modo === 'MODIFICAR' && data.prod?.PED_idpedido && !this.pedidoDetailProd) {
                    const r2 = await fetch(this._traspasoUrl(`pedido-prod-id/${data.prod.PED_idpedido}`));
                    if (r2.ok) {
                        const p = await r2.json();
                        this.pedidoDetailProd = p.header;
                        this.pedidoLineasProd = p.lineas;
                        this.prodNotFound = false;
                    }
                }
            } catch (e) { console.warn('[traspaso] error analizando', e); }
        },

        /** Boton INSERTAR */
        async traspasoInsertar() {
            await this._traspasoEjecutar('INSERTAR');
        },

        /** Boton MODIFICAR: primer clic abre los campos, segundo clic ejecuta. */
        async traspasoModificarClick() {
            if (!this.traspasoMostrarForm) {
                this.traspasoMostrarForm = true;
                console.log('[traspaso] formulario de modificacion abierto', JSON.stringify(this.traspasoForm));
                return;
            }
            await this._traspasoEjecutar('MODIFICAR');
        },

        async _traspasoEjecutar(modo) {
            const idPedidoTest = this.pedidoDetail?.PED_idpedido;
            if (!idPedidoTest) { console.error('[traspaso] no hay pedido de test cargado'); return; }

            const body = { idPedidoTest, email: this._traspasoEmail(), modo, dryRun: false };
            if (modo === 'MODIFICAR') {
                const idProd = String(this.traspasoForm.idPedido || '').trim();
                const num = String(this.traspasoForm.numeroPedido || '').trim();
                const ejer = String(this.traspasoForm.ejercicio || '').trim();
                if (idProd) body.idPedidoProd = idProd;
                else if (num) { body.numeroPedidoProd = num; if (ejer) body.ejercicioProd = ejer; }
            }

            this.traspasoEnCurso = true;
            this.traspasoUltimo = null;
            console.log(`[traspaso] POST ${modo}`, JSON.stringify(body));

            try {
                const res = await fetch(this._traspasoUrl('pasar-a-produccion'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json().catch(() => ({}));
                const ok = res.ok && data.ok;

                // Todo el detalle a la consola: es donde se mira ahora.
                if (ok) {
                    console.log(`[traspaso] ${modo} OK`, JSON.stringify(data.resultado ?? {}));
                } else {
                    console.error(`[traspaso] ${modo} RECHAZADO (${res.status}): ${data.message || data.motivo || 'sin motivo'}`);
                    if (data.candidatos) console.error('[traspaso] candidatos:', JSON.stringify(data.candidatos));
                    if (data.bloqueos) console.error('[traspaso] bloqueos:', JSON.stringify(data.bloqueos));
                    if (data.validaciones) {
                        data.validaciones.filter(v => v.estado === 'ERROR')
                            .forEach(v => console.error(`[traspaso] maestro KO: ${v.etiqueta} (${v.contexto}) id=${v.id}: ${v.motivo}`));
                    }
                }
                (data.avisos || []).forEach(a => console.warn(`[traspaso] aviso: ${a}`));
                (data.traza || []).forEach(t => console.log(`[traspaso]   +${t.ms}ms [${t.paso}] ${t.detalle}${t.datos ? '  ' + (typeof t.datos === 'string' ? t.datos : JSON.stringify(t.datos)) : ''}`));
                if (data.sinCambios) console.log('[traspaso] no habia ninguna diferencia: no se ha tocado nada');

                this.traspasoUltimo = { accion: modo, ok };

                if (ok) {
                    this.traspasoMostrarForm = false;
                    // Recargar la comparacion con el pedido de produccion resultante
                    const idProd = data.resultado?.PED_idpedido;
                    if (this._traspasoItem && typeof this.openPedidoDetail === 'function') {
                        const item = this._traspasoItem;
                        const ultimo = this.traspasoUltimo;
                        await this.openPedidoDetail(item);
                        this._traspasoItem = item;
                        this.traspasoUltimo = ultimo;
                    }
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
                console.error(`[traspaso] ${modo} ERROR de red`, err);
                this.traspasoUltimo = { accion: modo, ok: false };
            } finally {
                this.traspasoEnCurso = false;
            }
        }
    };
}
