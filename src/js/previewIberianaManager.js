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
                }
            } catch (e) {
                this.error = 'No se pudo conectar con el parser: ' + e.message;
            } finally {
                this.loading = false;
            }
        },

        reset() {
            this.fileObj = null;
            this.fileName = null;
            this.resultado = null;
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
