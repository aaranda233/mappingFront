export default function greenyardManager() {
    return {
        // ── estado UI ────────────────────────────────────────────────
        dragging: false,
        loading: false,
        fileName: null,
        fileObj: null,
        error: null,

        // ── alta de claves (Casting -> Grupo) ──
        claveInput: '',
        grupoInput: '',
        castings: [],
        grupos: [],
        grupoOpen: false,
        insertLoading: false,
        insertMsg: '',
        insertError: '',

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

        init() { this.loadCastings(); },

        parserBase() {
            // Se accede al parser a través del backend (proxy /api/mapping/greenyard):
            // el navegador solo habla con el backend, que sí alcanza la ClusterIP del parser.
            return `${window.env?.IP_BACKEND}/api/mapping/greenyard`;
        },

        // ── alta de claves ───────────────────────────────────────────
        async loadCastings() {
            try {
                const res = await fetch(`http://${this.parserBase()}/castings`);
                const data = await res.json();
                if (data.ok) {
                    this.castings = data.castings || [];
                    this.grupos = [...new Set(this.castings.map(c => c.Grupo).filter(Boolean))].sort();
                }
            } catch (e) { /* el piloto ya refleja si el parser está caído */ }
        },

        filteredGrupos() {
            const q = (this.grupoInput || '').toLowerCase().trim();
            if (!q) return this.grupos;
            return this.grupos.filter(g => g.toLowerCase().includes(q));
        },

        selectGrupo(g) { this.grupoInput = g; this.grupoOpen = false; },

        async insertarClave() {
            const casting = (this.claveInput || '').trim();
            const grupo = (this.grupoInput || '').trim();
            this.insertMsg = ''; this.insertError = '';
            if (!casting || !grupo) { this.insertError = 'Rellena Clave y Grupo.'; return; }
            this.insertLoading = true;
            try {
                const res = await fetch(`http://${this.parserBase()}/castings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ casting, grupo })
                });
                const data = await res.json();
                if (!res.ok || !data.ok) {
                    this.insertError = data.error || `Error ${res.status}`;
                } else {
                    this.insertMsg = `Insertada "${casting}" → "${grupo}"`;
                    this.claveInput = '';
                    this.grupoInput = '';
                    await this.loadCastings();
                }
            } catch (e) {
                this.insertError = 'No se pudo conectar con el parser: ' + e.message;
            } finally {
                this.insertLoading = false;
            }
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
            this.modalTitle = pedido.nombre;
            this.modalSub = pedido.n_lineas + ' líneas · Lote ' + (pedido.lote || '—');
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
        }
    };
}
