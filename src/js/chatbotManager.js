export default function chatbotManager() {
  return {
    open: false,
    loading: false,
    input: "",
    messages: [], // { role: 'user' | 'assistant', content: string }
    contexto: null, // datos del mapping que el comercial está mirando

    init() {
      // Abre el chat con el contexto de un pedido cuando se pulsa "¿Por qué?" en una tarjeta.
      window.addEventListener("abrir-chat-mapping", (e) => {
        this.contexto = e.detail || null;
        this.open = true;
        const desc = this.contexto && this.contexto.descripcion;
        if (desc && !this.loading) {
          this.input = `¿Por qué se vuelve a pedir el mapping de "${desc}"?`;
        }
      });
    },

    async send() {
      const texto = this.input.trim();
      if (!texto || this.loading) return;

      this.messages.push({ role: "user", content: texto });
      this.input = "";
      this.loading = true;
      this.$nextTick(() => this.scrollAbajo());

      try {
        const res = await fetch(
          `http://${window.env.IP_BACKEND}/api/mapping/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: this.messages,
              contexto: this.contexto,
            }),
          },
        );

        let data = {};
        try {
          data = await res.json();
        } catch (e) {
          throw new Error("Respuesta no válida del servidor");
        }

        if (!res.ok) {
          throw new Error(data.message || "Error del asistente");
        }

        this.messages.push({
          role: "assistant",
          content: data.reply || "(sin respuesta)",
        });
      } catch (err) {
        console.error("Error en el chat:", err);
        this.messages.push({ role: "assistant", content: `⚠️ ${err.message}` });
      } finally {
        this.loading = false;
        this.$nextTick(() => this.scrollAbajo());
      }
    },

    reset() {
      this.messages = [];
      this.contexto = null;
      this.input = "";
    },

    scrollAbajo() {
      const el = this.$refs.scroll;
      if (el) el.scrollTop = el.scrollHeight;
    },
  };
}
