export default function transportesManager() {
    return {
        transportes: [],
        loading: false,
        primeraCarga: true,
        toast: null,

        init() {
            this.loadTransportes();
            setInterval(() => this.loadTransportes(), 10000);
        },

        async loadTransportes() {
            if (this.primeraCarga) this.loading = true;

            try {
                const res = await fetch("http://192.168.2.202:5008/api/mapping/transportes");
                const data = await res.json();

                // Añade campo seleccion para cada item
                this.transportes = data.map(item => ({
                    ...item,
                    seleccion: ""
                }));
            } catch (err) {
                console.error("Error cargando transportes:", err);
            } finally {
                this.loading = false;
                this.primeraCarga = false;
            }
        },
        async enviar(item) {
            if (!item.seleccion) {
                this.showToast("⚠️ Selecciona una dirección");
                return;
            }

            try {
                const res = await fetch("http://192.168.2.202:5008/api/mapping/transportes/consumir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        _id: item._id,
                        id: item.id_mapping,
                        idDireccion: parseInt(item.seleccion)
                    })
                });
            
                const result = await res.json();

                 
                if (res.ok) {
                    this.transportes = this.transportes.filter(t => t._id !== item._id);
                    this.showToast("✅ Transporte procesado correctamente");
                } else {
                    alert("❌ Error: " + (result.message || "Respuesta inesperada"));
                }
            } catch (err) {
                console.error("Error enviando transporte:", err);
                this.showToast("⚠️ No se pudo contactar con el servidor");
            }
        }
        ,

        showToast(msg) {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#2563eb",
                stopOnFocus: true
            }).showToast();
        }
    };
}
