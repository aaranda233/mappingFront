/**
 * Mixin de sincronizacion TEST -> PRODUCCION para los apartados estado-pedidos-*-test.
 *
 * En pantalla solo hay dos botones (INSERTAR / MODIFICAR) debajo de la comparacion.
 * Al pulsar MODIFICAR aparecen los campos del pedido de produccion a modificar
 * (ejercicio prerellenado; si el pedido casa con uno, tambien el nº) y el mismo boton
 * ejecuta la modificacion.
 *
 * La UNICA cosa del analisis que se pinta en pantalla es el aviso de candidato debil
 * (ver traspasoCargarPrevio): es lo que evita duplicar un pedido, y en la consola no
 * lo mira nadie antes de pulsar INSERTAR.
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
        traspasoMensaje: '',    // una linea de resultado bajo los botones
        traspasoMensajeOk: true,
        // El ultimo INSERTAR se rechazo por duplicado: sale el boton pequeno de forzar.
        traspasoForzar: false,
        // Los pedidos de produccion que provocaron ese rechazo, para nombrarlos en la
        // confirmacion antes de duplicar.
        traspasoCandidatos: [],
        traspasoForm: { ejercicio: '', numeroPedido: '', idPedido: '' },
        // PDF firmado que el traspaso acaba de archivar, para ofrecer imprimirlo.
        // { idnuxeo, codigo } o null si no se archivo nada.
        traspasoDoc: null,
        // Por que no hay nada que imprimir, para poder decirlo en vez de callar.
        traspasoDocMotivo: '',
        traspasoImprimiendo: false,
        // Modal grande de "pedido creado/modificado con exito". Lleva dentro la pregunta
        // de imprimir. { accion, pedido, detalle } o null.
        traspasoResultado: null,
        _traspasoItem: null,
        _traspasoAnalisis: null,

        // Una operacion de traspaso esta en vuelo. NO es lo mismo que traspasoEnCurso:
        // _resetTraspaso() se llama en medio de la propia operacion (desde
        // openPedidoDetail, para recargar la comparacion) y borra todo el estado de la UI,
        // asi que traspasoEnCurso volvia a false y los botones se reactivaban un segundo
        // antes de que apareciese el modal de resultado. En ese hueco un segundo clic
        // lanzaba otro POST y se creaba el pedido dos veces. Esta bandera la baja SOLO
        // _traspasoEjecutar, en su finally, y por eso sobrevive al reset.
        _traspasoOperando: false,

        _resetTraspaso(item = null) {
            this.traspasoEnCurso = false;
            this.traspasoMostrarForm = false;
            this.traspasoUltimo = null;
            this.traspasoMensaje = '';
            this.traspasoMensajeOk = true;
            this.traspasoForzar = false;
            this.traspasoCandidatos = [];
            this.traspasoForm = { ejercicio: '', numeroPedido: '', idPedido: '' };
            this.traspasoDoc = null;
            this.traspasoDocMotivo = '';
            this.traspasoImprimiendo = false;
            this.traspasoResultado = null;
            this._traspasoItem = item;
            this._traspasoAnalisis = null;
        },

        // PDF archivados del apartado, por pedido de test: { <id_pedido_net>: { idnuxeo, ... } }.
        // Es lo que decide si una fila del historial lleva boton de impresora.
        traspasoDocsPorPedido: {},
        // El id_pedido_net que se esta imprimiendo desde la tabla, para poner ese boton en
        // "..." sin bloquear los demas.
        traspasoImprimiendoFila: null,

        _traspasoUrl(ruta) { return `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/${ruta}`; },

        /**
         * Carga de una vez que pedidos del apartado tienen PDF archivado. Una sola peticion
         * por apartado, no una por fila: el panel pinta hasta 100 y ya sondea de sobra.
         *
         * Nunca rompe la tabla: si falla, el mapa se queda como esta y simplemente no sale
         * ningun boton nuevo (en dev no hay documental y el mapa viene vacio siempre).
         */
        async traspasoCargarDocumentos() {
            try {
                const res = await fetch(this._traspasoUrl('documentos'));
                if (!res.ok) { console.warn(`[traspaso] documentos HTTP ${res.status}`); return; }
                const data = await res.json();
                this.traspasoDocsPorPedido = data.documentos || {};
                const n = Object.keys(this.traspasoDocsPorPedido).length;
                console.log(`[traspaso] ${n} pedido(s) con PDF archivado${data.ok ? '' : ` (sin documental: ${data.motivo})`}`);
            } catch (err) {
                console.warn('[traspaso] no se pudo cargar la lista de PDF archivados', err);
            }
        },

        /** El PDF archivado de una fila del historial, o null si ese pedido no tiene. */
        traspasoDocDeFila(item) {
            const id = item?.id_pedido_net;
            if (!id) return null;
            return this.traspasoDocsPorPedido[id] || this.traspasoDocsPorPedido[String(id)] || null;
        },

        /**
         * Imprime el PDF archivado de una fila, sin abrir el pedido. Mismo mecanismo que
         * traspasoImprimirDoc (blob + iframe, porque el backend esta en otro origen), pero
         * partiendo del idnuxeo que ya venia en el mapa.
         */
        async traspasoImprimirFila(item) {
            const doc = this.traspasoDocDeFila(item);
            if (!doc || this.traspasoImprimiendoFila) return;
            this.traspasoImprimiendoFila = item.id_pedido_net;
            try {
                await this._traspasoImprimirIdnuxeo(doc.idnuxeo);
                console.log(`[traspaso] enviado a imprimir ${doc.idnuxeo}.pdf (pedido de produccion ${doc.pedidoProd})`);
            } catch (err) {
                console.error(`[traspaso] no se pudo imprimir ${doc.idnuxeo}: ${err.message}`);
                window.alert(`No se pudo imprimir el pedido ${doc.pedidoProd}: ${err.message}`);
            } finally {
                this.traspasoImprimiendoFila = null;
            }
        },
        _traspasoEmail() {
            try { return (window.Alpine && window.Alpine.store('global')?.userEmail) || ''; } catch (e) { return ''; }
        },

        // Los botones estan activos solo si hay pedido cargado y NO hay nada en vuelo. Se
        // mira tambien _traspasoOperando, que es la unica de las dos que no puede borrar
        // _resetTraspaso a media operacion.
        traspasoListo() {
            return !!this.pedidoDetail?.PED_idpedido && !this.traspasoEnCurso && !this._traspasoOperando;
        },

        /**
         * Se llama al abrir el pedido. Analiza contra produccion para dejarlo en los
         * logs y para prerellenar el formulario. Lo unico que pinta es el aviso de
         * candidato debil, cuando no ha casado ninguna referencia pero en produccion
         * ya hay un pedido al mismo destino y con la misma fecha de salida.
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

                // Aviso de candidato debil: no ha casado ninguna referencia, pero en
                // produccion ya hay pedidos de este cliente al mismo destino y con la
                // misma fecha de salida. No impide INSERTAR: puede ser un pedido nuevo
                // perfectamente legitimo. Solo obliga a mirarlo antes de pulsar.
                const debiles = data.candidatosDebiles || [];
                if (debiles.length > 0) {
                    console.warn('[traspaso] candidatos debiles (mismo destino y fecha de salida):', JSON.stringify(debiles));
                    const lista = debiles
                        .map(c => `nº ${c.PED_pedido} (ref "${(c.PED_referencia || '').trim() || 'vacia'}", ${c.lineas} linea/s)`)
                        .join(', ');
                    this.traspasoMensaje = `OJO: ninguna referencia casa, pero en produccion ya hay ${debiles.length} pedido(s) ` +
                        `de este cliente al mismo destino y con la misma fecha de salida: ${lista}. ` +
                        `Comprueba que no sea el mismo pedido con la referencia mal escrita antes de INSERTAR.`;
                    this.traspasoMensajeOk = false;
                }

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

        /**
         * Boton INSERTAR. Nunca fuerza: si el pedido ya esta en produccion, el backend
         * responde 409 y aparece el boton pequeno de forzar. Antes este mismo boton se
         * convertia en el forzado, y un segundo clic en el mismo sitio creaba el
         * duplicado sin mas: asi salieron el 31610 (anecoop) y el 31731 (daifressh).
         */
        async traspasoInsertar() {
            await this._traspasoEjecutar('INSERTAR');
        },

        /**
         * Boton pequeno "Insertar igualmente", que solo sale despues de un 409. Pide
         * confirmacion nombrando el pedido que se va a duplicar: es una salida legitima
         * (dos pedidos iguales el mismo dia al mismo destino existen), pero tiene que ser
         * deliberada.
         */
        async traspasoInsertarForzado() {
            const yaHay = (this.traspasoCandidatos || [])
                .map(c => `nº ${c.PED_pedido} (ref "${(c.PED_referencia || '').trim() || 'vacia'}")`)
                .join('\n  ');
            const texto = [
                'Vas a crear un pedido NUEVO en produccion.',
                '',
                yaHay ? `Ya existe en produccion:\n  ${yaHay}` : 'El backend ya avisó de que este pedido se habia traspasado antes.',
                '',
                'Si continuas se quedaran LOS DOS, y para deshacerlo habra que anular uno a mano desde el ERP.',
                '',
                '¿Seguro que es un pedido distinto?'
            ].join('\n');
            if (!window.confirm(texto)) {
                console.log('[traspaso] insercion forzada CANCELADA por el usuario');
                return;
            }
            console.warn('[traspaso] insercion FORZADA confirmada por el usuario');
            await this._traspasoEjecutar('INSERTAR', { forzar: true });
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

        async _traspasoEjecutar(modo, { forzar = false } = {}) {
            // Guard de reentrada. El :disabled del boton no basta: dos clics en el mismo
            // tick de Alpine entran los dos antes de que se repinte, y con el hueco que
            // habia (ver _traspasoOperando) eso creaba el pedido dos veces.
            if (this._traspasoOperando) {
                console.warn(`[traspaso] ${modo} ignorado: ya hay una operacion en curso`);
                return;
            }
            const idPedidoTest = this.pedidoDetail?.PED_idpedido;
            if (!idPedidoTest) { console.error('[traspaso] no hay pedido de test cargado'); return; }
            this._traspasoOperando = true;

            const body = { idPedidoTest, email: this._traspasoEmail(), modo, dryRun: false };
            const forzando = modo === 'INSERTAR' && forzar;
            if (forzando) {
                // Se salta las dos barreras: la de claves (forzarInsertar) y la del
                // historico de traspasos (permitirRepetir).
                body.forzarInsertar = true;
                body.permitirRepetir = true;
            }
            if (modo === 'MODIFICAR') {
                const idProd = String(this.traspasoForm.idPedido || '').trim();
                const num = String(this.traspasoForm.numeroPedido || '').trim();
                const ejer = String(this.traspasoForm.ejercicio || '').trim();
                if (idProd) body.idPedidoProd = idProd;
                else if (num) { body.numeroPedidoProd = num; if (ejer) body.ejercicioProd = ejer; }
            }

            this.traspasoEnCurso = true;
            this.traspasoUltimo = null;
            this.traspasoMensaje = modo === 'INSERTAR' ? 'Insertando...' : 'Modificando...';
            this.traspasoMensajeOk = true;
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
                this.traspasoMensajeOk = ok;
                const r = data.resultado || {};
                // Si INSERTAR se rechaza por duplicado (claves o historico), aparece el boton
                // pequeno de forzar. Los candidatos se guardan para poder nombrarlos en la
                // confirmacion: "ya existe el nº 31730", no un "¿seguro?" a ciegas.
                if (!ok && modo === 'INSERTAR' && res.status === 409 && (data.candidatos || data.traspasoPrevio)) {
                    this.traspasoForzar = true;
                    this.traspasoCandidatos = data.candidatos || [];
                    console.warn('[traspaso] rechazado por duplicado: aparece el boton de insertar igualmente');
                } else if (ok) {
                    this.traspasoForzar = false;
                    this.traspasoCandidatos = [];
                }
                if (!ok) {
                    this.traspasoMensaje = data.message || data.motivo || `Error ${res.status}`;
                } else if (data.sinCambios) {
                    this.traspasoMensaje = `SIN CAMBIOS: el pedido nº ${r.PED_pedido ?? '?'} de produccion ya estaba igual`;
                } else if (modo === 'INSERTAR') {
                    this.traspasoMensaje = `INSERTADO en produccion${forzando ? ' (FORZADO, ya habia otro igual)' : ''}: ` +
                        `pedido nº ${r.PED_pedido ?? '?'} ` +
                        `(PED_idpedido ${r.PED_idpedido ?? '?'}, ejercicio ${r.ejercicio ?? '?'}) ` +
                        `con ${r.lineas?.length ?? 0} linea(s) y ${r.almacenes ?? 0} fila(s) de almacen`;
                } else {
                    this.traspasoMensaje = `MODIFICADO en produccion: pedido nº ${r.PED_pedido ?? '?'} ` +
                        `(PED_idpedido ${r.PED_idpedido ?? '?'}) — ${r.camposCabecera ?? 0} campo(s) de cabecera, ` +
                        `${r.lineasActualizadas ?? 0} linea(s) actualizada(s), ${r.lineasNuevas ?? 0} nueva(s), ` +
                        `${r.lineasAnuladas ?? 0} anulada(s)`;
                }

                if (ok) {
                    this.traspasoMostrarForm = false;
                    // openPedidoDetail vuelve a llamar a _resetTraspaso, que borra el mensaje
                    // y el resto del estado. Por eso se guarda aqui lo que hay que conservar
                    // y se repone despues de recargar la comparacion.
                    const textoResultado = this.traspasoMensaje;
                    // Recargar la comparacion con el pedido de produccion resultante
                    const idProd = data.resultado?.PED_idpedido;
                    if (this._traspasoItem && typeof this.openPedidoDetail === 'function') {
                        const item = this._traspasoItem;
                        const ultimo = this.traspasoUltimo;
                        await this.openPedidoDetail(item);
                        this._traspasoItem = item;
                        this.traspasoUltimo = ultimo;
                        this.traspasoMensaje = textoResultado;
                        this.traspasoMensajeOk = true;
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
                    // Si se ha archivado el pedido firmado, ofrecer imprimirlo. Vale
                    // igual para INSERTAR y para MODIFICAR: en los dos casos el
                    // documento se re-sella con el numero de produccion.
                    this._traspasoPrepararImpresion(r.documental);
                    // El pedido acaba de estrenar PDF: refrescar el mapa para que su fila
                    // de la tabla saque el boton de impresora sin recargar la pagina. Sin
                    // await, que esto no retrase el modal de resultado.
                    if (r.documental?.ok) this.traspasoCargarDocumentos();

                    // Modal grande de resultado. Antes el texto se perdia: lo escribia el
                    // codigo de arriba y acto seguido openPedidoDetail lo borraba, asi que
                    // el comercial no veia confirmacion de nada.
                    this.traspasoResultado = {
                        accion: modo,
                        pedido: r.PED_pedido ?? '?',
                        detalle: data.sinCambios
                            ? 'El pedido de produccion ya estaba igual: no se ha tocado nada.'
                            : textoResultado
                    };
                }
            } catch (err) {
                console.error(`[traspaso] ${modo} ERROR de red`, err);
                this.traspasoUltimo = { accion: modo, ok: false };
                this.traspasoMensaje = `Error de red: ${err.message || err}`;
                this.traspasoMensajeOk = false;
            } finally {
                // Lo ultimo de todo, y despues de que el modal de resultado ya este puesto:
                // hasta aqui los botones siguen deshabilitados. Si falla, se rehabilitan
                // para poder reintentar.
                this.traspasoEnCurso = false;
                this._traspasoOperando = false;
            }
        },

        /**
         * Deja preparado el aviso de "imprimir el pedido firmado" si el traspaso ha
         * archivado el documento. Solo se ofrece cuando el barcode se ha re-sellado
         * con el numero de produccion: imprimir un pedido cuyo codigo apunta al de
         * test es peor que no imprimirlo, porque en almacen se escanea y abre otro.
         */
        _traspasoPrepararImpresion(documental) {
            this.traspasoDoc = null;
            this.traspasoDocMotivo = '';
            if (!documental) {
                // Pasa siempre en dev: TRASPASO_DOCUMENTAL solo esta puesto en el chart de
                // produccion, asi que el PDF ni se archiva.
                this.traspasoDocMotivo = 'El archivado documental no esta activo en este entorno.';
                return;
            }
            if (!documental.ok) {
                this.traspasoDocMotivo = `No se archivo el pedido firmado: ${documental.motivo || 'motivo no indicado'}`;
                console.warn(`[traspaso] no hay pedido firmado que imprimir: ${documental.motivo || 'documental no archivado'}`);
                return;
            }
            if (!documental.resellado?.ok) {
                this.traspasoDocMotivo = 'El codigo de barras del PDF no se pudo re-sellar, asi que seguiria ' +
                    `apuntando al pedido de test (${documental.resellado?.motivo || 'motivo no indicado'}).`;
                console.warn('[traspaso] no se ofrece imprimir: el barcode del PDF no se pudo re-sellar ' +
                             `(${documental.resellado?.motivo}), seguiria con el numero de test`);
                return;
            }
            this.traspasoDoc = { idnuxeo: documental.idnuxeo, codigo: documental.resellado.codigo };
            console.log(`[traspaso] pedido firmado listo para imprimir: ${documental.idnuxeo}.pdf (barcode ${documental.resellado.codigo})`);
        },

        /**
         * Descarga un PDF archivado y lo manda a la impresora. Se baja como blob y se
         * imprime desde un iframe: el visor del navegador no deja llamar a print() sobre un
         * iframe de otro origen, y el backend esta en otro host. Con el blob pasa a ser del
         * mismo origen y print() si funciona.
         *
         * Lanza si no se puede; lo usan los dos sitios que imprimen (el modal de resultado
         * del traspaso y el boton de cada fila de la tabla).
         */
        async _traspasoImprimirIdnuxeo(idnuxeo) {
            let url = null;
            try {
                const res = await fetch(this._traspasoUrl(`documento/${encodeURIComponent(idnuxeo)}`));
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.message || `HTTP ${res.status}`);
                }
                url = URL.createObjectURL(await res.blob());

                const iframe = document.createElement('iframe');
                iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
                iframe.src = url;
                await new Promise((resolve, reject) => {
                    iframe.onload = resolve;
                    iframe.onerror = () => reject(new Error('el visor no pudo cargar el PDF'));
                    document.body.appendChild(iframe);
                });
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    // Algun navegador no deja imprimir desde el iframe: se abre en
                    // una pestaña para que se pueda imprimir a mano.
                    console.warn('[traspaso] print() desde el iframe fallo, abro el PDF en una pestaña', e);
                    window.open(url, '_blank');
                }
                // El blob y el iframe tienen que sobrevivir al dialogo de impresion:
                // liberarlos antes deja la vista previa en blanco.
                setTimeout(() => {
                    iframe.remove();
                    URL.revokeObjectURL(url);
                }, 60000);
            } catch (err) {
                if (url) URL.revokeObjectURL(url);
                throw err;
            }
        },

        /** Imprime el PDF que el traspaso acaba de archivar, desde el modal de resultado. */
        async traspasoImprimirDoc() {
            if (!this.traspasoDoc || this.traspasoImprimiendo) return;
            const { idnuxeo } = this.traspasoDoc;
            this.traspasoImprimiendo = true;
            try {
                await this._traspasoImprimirIdnuxeo(idnuxeo);
                console.log(`[traspaso] enviado a imprimir ${idnuxeo}.pdf`);
                this.traspasoCerrarResultado();
                this.traspasoDoc = null;
                // El pedido que se acaba de traspasar ya tiene PDF: que su fila de la tabla
                // estrene el boton de impresora sin esperar a recargar la pagina.
                this.traspasoCargarDocumentos();
            } catch (err) {
                console.error(`[traspaso] no se pudo imprimir ${idnuxeo}.pdf: ${err.message}`, err);
                this.traspasoMensaje = `No se pudo abrir el pedido firmado para imprimir: ${err.message}`;
                this.traspasoMensajeOk = false;
            } finally {
                this.traspasoImprimiendo = false;
            }
        },

        traspasoNoImprimir() {
            if (this.traspasoDoc) console.log(`[traspaso] no se imprime ${this.traspasoDoc.idnuxeo}.pdf`);
            this.traspasoDoc = null;
            this.traspasoCerrarResultado();
        },

        /** Cierra el modal de resultado. El pedido ya esta hecho; esto es solo el aviso. */
        traspasoCerrarResultado() {
            this.traspasoResultado = null;
        }
    };
}
