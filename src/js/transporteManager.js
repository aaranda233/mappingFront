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
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes`);
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
                item.error = "Por favor selecciona una dirección antes de enviar.";
                return;
            }

            item.error = ""; // limpiamos errores anteriores

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes/consumir`, {
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
                    item.error = "❌ Error: " + (result.message || "Respuesta inesperada");
                }

            } catch (err) {
                console.error("Error enviando transporte:", err);
                item.error = "⚠️ No se pudo contactar con el servidor";
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
        },
        enviarAI(item, event) {
            const ball = document.getElementById('aiBall');
            const chatBtn = document.getElementById('chat-toggle-button');

            if (!ball || !chatBtn || !event) return;

            const start = event.target.getBoundingClientRect();
            const end = chatBtn.getBoundingClientRect();

            // Pelota animada hacia el chat
            ball.style.top = `${start.top + window.scrollY}px`;
            ball.style.left = `${start.left + window.scrollX}px`;
            ball.style.opacity = '1';
            ball.style.transform = 'translate(0, 0)';
            void ball.offsetWidth;

            const deltaX = end.left - start.left;
            const deltaY = end.top - start.top;

            ball.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.5)`;

            setTimeout(() => {
                ball.style.opacity = '0';
                ball.style.transform = 'none';
                chatBtn.click();
            }, 750);

            // Espera a que se abra el chat y lanza la solicitud a la IA
            setTimeout(() => {
                if (window.chat) {
                    const prompt = `Hola, dame la información del pedido con referencia ${item.ref_pedido}`;

                    window.chat.messages.push({
                        id: Date.now(),
                        role: 'user',
                        content: prompt
                    });

                    window.chat.proposedMessage = '';
                    window.chat.loading = true;
                    window.chat.useProposedMessage = true;

                    sendToLLMStreamed(prompt, window.chat.sessionId, chunk => {
                        window.chat.proposedMessage += chunk;
                    }).then(() => {
                        window.chat.loading = false;
                        window.chat.scrollToBottom();
                    }).catch(() => {
                        window.chat.loading = false;
                        window.chat.proposedMessage = '❌ Error al obtener respuesta.';
                    });
                }
            }, 800);
        }
    };
}
