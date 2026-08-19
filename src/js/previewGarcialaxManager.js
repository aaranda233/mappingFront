/**
 * Preview PDF de GARCIA-LAX: ver cómo queda repartido el documento, sin enviar nada.
 *
 * Calcado del de greenyard (`greenyardManager`), con dos diferencias:
 *
 * 1. No hay alta de claves. Greenyard reparte por "casting" y necesita mantener la tabla
 *    Casting -> Grupo; en Garcia Lax el reparto sale del propio documento (una "Position"
 *    por pedido, con su destino), así que no hay nada que dar de alta.
 *
 * 2. En greenyard `/split` ES el endpoint de producción. Aquí el de producción sigue siendo
 *    `/parse-temporal` (lo llama outlook-garcialax) y `/split` solo mira. La maqueta se genera
 *    SIEMPRE, también con un destino único: es un visor, y si devolviera lo que
 *    `/parse-temporal` manda (el PDF original cuando no parte) no habría nada que revisar.
 *    Cada pedido trae `en_produccion` con lo que se enviaría de verdad.
 *
 * Al parser se llega por el proxy del backend (/api/mapping/lax), no directo: lax-parser es
 * un Service ClusterIP y el navegador no lo alcanza.
 */
export default function previewGarcialaxManager() {
    return {
        // ── estado UI ────────────────────────────────────────────────
        dragging: false,
        loading: false,
        fileName: null,
        fileObj: null,
        error: null,

        // PDF original (mitad izquierda)
        originalUrl: null,

        // resultado del /split
        resultado: null,

        // modal del PDF (partido u original)
        modalOpen: false,
        modalPedido: null,
        modalUrl: null,
        modalTitle: '',
        modalSub: '',

        // blobs creados (para revocar y no fugar memoria)
        _blobUrls: [],

        init() {},

        parserBase() {
            // Se accede al parser a través del backend (proxy /api/mapping/lax):
            // el navegador solo habla con el backend, que sí alcanza la ClusterIP del parser.
            return `${window.env?.IP_BACKEND}/api/mapping/lax`;
        },

        // ── Drag & Drop / selección ──────────────────────────────────
        onDragOver(e) { e.preventDefault(); this.dragging = true; },
        onDragLeave() { this.dragging = false; },
        onDrop(e) {
            e.preventDefault();
            this.dragging = false;
            this._setFile(e.dataTransfer.files[0]);
        },
        onFileSelect(e) { this._setFile(e.target.files[0]); },

        _setFile(file) {
            if (file && file.type === 'application/pdf') {
                this.fileObj = file;
                this.fileName = file.name;
                this.error = null;
                this._clearResultado();
                if (this.originalUrl) URL.revokeObjectURL(this.originalUrl);
                this.originalUrl = URL.createObjectURL(file);
            } else if (file) {
                this.error = 'Solo se aceptan ficheros PDF.';
            }
        },

        // ── base64 -> blob URL (visor robusto en iframe) ─────────────
        _b64ToBlobUrl(b64) {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            this._blobUrls.push(url);
            return url;
        },

        _clearResultado() {
            this.resultado = null;
            this._blobUrls.forEach(u => URL.revokeObjectURL(u));
            this._blobUrls = [];
            this.closeModal();
        },

        // ── Partir pedido (POST /split) ──────────────────────────────
        async partir() {
            if (!this.fileObj) { this.error = 'Selecciona un PDF primero.'; return; }
            this.loading = true;
            this.error = null;
            this._clearResultado();

            try {
                const formData = new FormData();
                formData.append('file', this.fileObj);

                const res = await fetch(`http://${this.parserBase()}/split`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (!res.ok || !data.ok) {
                    this.error = data.error || `Error ${res.status}`;
                } else {
                    // convertir cada PDF base64 a blob URL y soltar el base64
                    data.pedidos.forEach(p => {
                        p.url = p.file ? this._b64ToBlobUrl(p.file) : null;
                        p.file = null;
                    });
                    this.resultado = data;
                }
            } catch (e) {
                this.error = 'No se pudo conectar con el parser: ' + e.message;
            } finally {
                this.loading = false;
            }
        },

        // ── Modal ────────────────────────────────────────────────────
        openModal(pedido) {
            if (!pedido.url) return;   // sin recorte no hay nada que ver
            this.modalPedido = pedido;
            this.modalUrl = pedido.url;
            this.modalTitle = pedido.nombre || pedido.ref_pedido || 'Pedido';
            this.modalSub = [
                'Position ' + (pedido.position || '—'),
                pedido.n_lineas + (pedido.n_lineas === 1 ? ' línea' : ' líneas'),
                pedido.total_bultos + ' bultos',
                pedido.recorte ? 'recorte' : 'PDF original'
            ].join(' · ');
            this.modalOpen = true;
        },
        openOriginal() {
            if (!this.originalUrl) return;
            this.modalPedido = null;
            this.modalUrl = this.originalUrl;
            this.modalTitle = 'PDF original';
            this.modalSub = this.fileName || '';
            this.modalOpen = true;
        },
        closeModal() {
            this.modalOpen = false;
            this.modalPedido = null;
            this.modalUrl = null;
            this.modalTitle = '';
            this.modalSub = '';
        },

        reset() {
            this.fileObj = null;
            this.fileName = null;
            this.error = null;
            if (this.originalUrl) { URL.revokeObjectURL(this.originalUrl); this.originalUrl = null; }
            this._clearResultado();
        },

        // ── Helpers de UI ────────────────────────────────────────────

        /**
         * El subtítulo del documento decide qué hace el PHP con él, así que se avisa:
         * un 'cambio' es la revisión de un pedido ya enviado y NO debería dar de alta uno
         * nuevo; un 'matricula' solo asigna el camión.
         */
        tipoDoc() {
            return this.resultado?.tipo_documento || 'pedido';
        },
        tipoDocEsAviso() {
            return this.tipoDoc() !== 'pedido';
        },
        tipoDocTexto() {
            switch (this.tipoDoc()) {
                case 'cambio':    return 'CAMBIO — revisión de un pedido ya enviado, no da de alta uno nuevo';
                case 'matricula': return 'MATRÍCULA — solo asigna el camión al pedido ya existente';
                default:          return 'PEDIDO nuevo';
            }
        },
        sinRecorte() {
            return (this.resultado?.pedidos || []).filter(p => !p.url).length;
        }
    };
}
