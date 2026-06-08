export default function previewIberianaManager() {
    return {
        // estado UI
        dragging: false,
        loading: false,
        fileName: null,
        fileObj: null,
        error: null,

        // resultado
        resultado: null,
        pedidoERP: null,
        loadingERP: false,

        init() {},

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
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                this.fileObj = file;
                this.fileName = file.name;
                this.error = null;
            } else {
                this.error = 'Solo se aceptan ficheros PDF.';
            }
        },
        onFileSelect(e) {
            const file = e.target.files[0];
            if (file) {
                this.fileObj = file;
                this.fileName = file.name;
                this.error = null;
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

            try {
                const formData = new FormData();
                formData.append('file', this.fileObj);

                const base = window.env?.IP_IBERIANA_PARSER || 'localhost:5000';
                const res = await fetch(`http://${base}/preview`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (!res.ok || !data.ok) {
                    this.error = data.error || `Error ${res.status}`;
                } else {
                    this.resultado = data;
                    this.buscarPedidoERP();
                }
            } catch (e) {
                this.error = 'No se pudo conectar con el parser: ' + e.message;
            } finally {
                this.loading = false;
            }
        },

        async buscarPedidoERP() {
            const bestellNr = this.resultado?.cabecera?.bestellNr;
            const clienteId = this.resultado?.cabecera?.cliente?.id;
            if (!bestellNr || !clienteId) return;
            this.loadingERP = true;
            this.pedidoERP = null;
            try {
                const params = new URLSearchParams({ bestellnr: bestellNr, cliente: clienteId, centro: 10 });
                const base = window.env?.IP_BACKEND || 'localhost';
                const res = await fetch(`http://${base}/api/mapping/estado-pedidos-iberiana-test/pedido-prod?${params}`);
                if (res.ok) this.pedidoERP = await res.json();
                // 404 = todavía no insertado en producción, ignorar
            } catch (e) {
                console.error('Error buscando pedido ERP:', e);
            } finally {
                this.loadingERP = false;
            }
        },

        erpLinea(resolucion) {
            if (!this.pedidoERP?.lineas || !resolucion?.id_presentacion) return null;
            // Match by GenSal instead of by index — ERP may store lines in different order than PDF
            return this.pedidoERP.lineas.find(l => l.PEL_idgensal === resolucion.id_presentacion) ?? null;
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
            this.pedidoERP = null;
            this.error = null;
        },

        // ── Helpers de UI ────────────────────────────────────────────
        badgeOk: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800',
        badgeErr: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800',
        badgeWarn: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800',

        lineasOk() {
            return this.resultado?.lineas?.filter(l => l.ok) || [];
        },
        lineasErr() {
            return this.resultado?.lineas?.filter(l => !l.ok) || [];
        },
        totalKgNetos() {
            return (this.resultado?.lineas || [])
                .reduce((s, l) => s + (l.resolucion?.kg_netos || 0), 0)
                .toFixed(2);
        },
        totalKgBrutos() {
            return (this.resultado?.lineas || [])
                .reduce((s, l) => s + (l.resolucion?.kg_brutos || 0), 0)
                .toFixed(2);
        }
    };
}
