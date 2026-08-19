/**
 * Preview PDF de GARCIA-LAX.
 *
 * Dos cosas lo diferencian del preview de Lehman:
 *
 * 1. Un PDF de Garcia Lax NO es un pedido, son varios: la tabla trae una columna
 *    "Position" y cada Position es un pedido independiente en el ERP, con su
 *    referencia, su destino y su fecha de salida. Por eso /preview devuelve
 *    { pedidos: [...] } y aquí se itera, con un bloque por pedido.
 *
 * 2. El parser es un Service ClusterIP: el navegador no lo alcanza. Se habla con él
 *    a través del proxy del backend (/api/mapping/lax/*), igual que con greenyard.
 */
export default function previewGarcialaxManager() {
    return {
        // estado UI
        dragging: false,
        loading: false,
        fileName: null,
        fileObj: null,
        error: null,

        // resultado del parser: { ok, n_pedidos, pedidos: [...], resultado: {...} }
        resultado: null,

        // Pedido de PRODUCCION que casa con cada Position, indexado por posición del
        // array de pedidos: { 0: {header, lineas}, 1: null, ... }
        pedidosERP: {},
        loadingERP: false,

        init() {},

        parserBase() {
            // El parser vive en la ClusterIP; el backend hace de proxy de paso.
            return `${window.env?.IP_BACKEND}/api/mapping/lax`;
        },

        // ── Drag & Drop ──────────────────────────────────────────────
        onDragOver(e) {
            e.preventDefault();
            this.dragging = true;
        },
        onDragLeave() {
            this.dragging = false;
        },
        onDrop(e) {
            e.preventDefault();
            this.dragging = false;
            this._setFile(e.dataTransfer.files[0]);
        },
        onFileSelect(e) {
            this._setFile(e.target.files[0]);
        },

        _setFile(file) {
            if (file && file.type === 'application/pdf') {
                this.fileObj = file;
                this.fileName = file.name;
                this.error = null;
            } else if (file) {
                this.error = 'Solo se aceptan ficheros PDF.';
            }
        },

        // ── Analizar ─────────────────────────────────────────────────
        async analizar() {
            if (!this.fileObj) {
                this.error = 'Selecciona un PDF primero.';
                return;
            }
            this.loading = true;
            this.error = null;
            this.resultado = null;
            this.pedidosERP = {};

            try {
                const formData = new FormData();
                formData.append('file', this.fileObj);

                const res = await fetch(`http://${this.parserBase()}/preview`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (!res.ok || !data.ok) {
                    this.error = data.error || `Error ${res.status}`;
                } else {
                    this.resultado = data;
                    this.buscarPedidosERP();
                }
            } catch (e) {
                this.error = 'No se pudo conectar con el parser: ' + e.message;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Busca en PRODUCCION el pedido de cada Position. Garcia Lax empareja por
         * PED_referencia (BESTELLNR va vacío), que es justo lo que devuelve el parser
         * en cabecera.ref. Un 404 significa "todavía no está en producción".
         */
        async buscarPedidosERP() {
            const pedidos = this.resultado?.pedidos || [];
            const clienteId = pedidos[0]?.cabecera?.cliente?.id;
            if (!clienteId) return;

            this.loadingERP = true;
            const base = window.env?.IP_BACKEND || 'localhost';
            try {
                await Promise.all(pedidos.map(async (p, idx) => {
                    const ref = p?.cabecera?.ref;
                    if (!ref) return;
                    const params = new URLSearchParams({ cliente: clienteId, referencia: ref });
                    const destino = p?.cabecera?.direccion?.id;
                    if (destino) params.set('iddestino', destino);
                    try {
                        const res = await fetch(`http://${base}/api/mapping/estado-pedidos-garcialax-test/pedido-prod?${params}`);
                        if (res.ok) this.pedidosERP[idx] = await res.json();
                    } catch (e) {
                        console.error('Error buscando pedido ERP (Position ' + (p?.cabecera?.position || idx) + '):', e);
                    }
                }));
            } finally {
                this.loadingERP = false;
            }
        },

        erpDe(idx) {
            return this.pedidosERP[idx] ?? null;
        },

        erpLinea(idx, resolucion) {
            const erp = this.erpDe(idx);
            if (!erp?.lineas || !resolucion?.id_presentacion) return null;
            // Se casa por GenSal, no por índice: el ERP puede tener las líneas en otro orden.
            return erp.lineas.find(l => l.PEL_idgensal === resolucion.id_presentacion) ?? null;
        },

        erpDiffs(l, erpL) {
            if (!erpL || !l?.resolucion) return null;
            const r = l.resolucion;
            const diffs = [];
            if (erpL.PEL_idgensal !== r.id_presentacion)
                diffs.push({ campo: 'Presentación', erp: erpL.PEL_idgensal + (erpL.Presentacion ? ' — ' + erpL.Presentacion : ''), nuevo: r.id_presentacion + (r.nombre_gensal ? ' — ' + r.nombre_gensal : '') });
            if (erpL.PEL_idgenero !== r.id_genero)
                diffs.push({ campo: 'Género', erp: erpL.PEL_idgenero + (erpL.NomGenero ? ' — ' + erpL.NomGenero : ''), nuevo: r.id_genero + (r.nom_genero ? ' — ' + r.nom_genero : '') });
            if (erpL.PEL_idtipoconfeccion !== r.id_tipo_confeccion)
                diffs.push({ campo: 'Confección', erp: erpL.PEL_idtipoconfeccion + (erpL.NomConfeccion ? ' — ' + erpL.NomConfeccion : ''), nuevo: r.id_tipo_confeccion });
            if (erpL.PEL_idcategoria !== r.id_categoria)
                diffs.push({ campo: 'Categoría', erp: erpL.PEL_idcategoria + (erpL.NomCategoria ? ' — ' + erpL.NomCategoria : ''), nuevo: r.id_categoria + (r.nom_cate ? ' — ' + r.nom_cate : '') });
            return diffs;
        },

        reset() {
            this.fileObj = null;
            this.fileName = null;
            this.resultado = null;
            this.pedidosERP = {};
            this.error = null;
        },

        // ── Helpers de UI ────────────────────────────────────────────
        lineasOk(pedido) {
            return (pedido?.lineas || []).filter(l => l.ok);
        },
        totalKgNetos(pedido) {
            return (pedido?.lineas || [])
                .reduce((s, l) => s + (l.resolucion?.kg_netos || 0), 0)
                .toFixed(2);
        },
        totalKgBrutos(pedido) {
            return (pedido?.lineas || [])
                .reduce((s, l) => s + (l.resolucion?.kg_brutos || 0), 0)
                .toFixed(2);
        },
        totalBultos(pedido) {
            return (pedido?.lineas || []).reduce((s, l) => s + (l.raw?.bultos || 0), 0);
        },
        // Totales del documento completo (todas las Positions)
        docKgNetos() {
            return (this.resultado?.pedidos || [])
                .reduce((s, p) => s + parseFloat(this.totalKgNetos(p)), 0)
                .toFixed(2);
        },
        docLineas() {
            return (this.resultado?.pedidos || []).reduce((s, p) => s + (p.lineas?.length || 0), 0);
        },
        docLineasOk() {
            return (this.resultado?.pedidos || []).reduce((s, p) => s + this.lineasOk(p).length, 0);
        }
    };
}
