export default function greenyardManager() {
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

        // modal del PDF partido
        modalOpen: false,
        modalPedido: null,
        modalUrl: null,

        // blobs creados (para revocar y no fugar memoria)
        _blobUrls: [],

        init() {},

        parserBase() {
            return (window.env && window.env.IP_GREENYARD_PARSER) || '192.168.10.119:5005';
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
            } else {
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
            this.modalPedido = pedido;
            this.modalUrl = pedido.url;
            this.modalOpen = true;
        },
        closeModal() {
            this.modalOpen = false;
            this.modalPedido = null;
            this.modalUrl = null;
        },

        reset() {
            this.fileObj = null;
            this.fileName = null;
            this.error = null;
            if (this.originalUrl) { URL.revokeObjectURL(this.originalUrl); this.originalUrl = null; }
            this._clearResultado();
        }
    };
}
