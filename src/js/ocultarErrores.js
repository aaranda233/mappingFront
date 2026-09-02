/**
 * Mixin del check "Ocultar errores" del historial, compartido por los 21 apartados de
 * Estado Pedidos (los 10 de test, los 10 de produccion y el de EDK).
 *
 * Es un filtro de VISTA: no toca las peticiones ni el historial que llega del backend, solo
 * decide que filas se pintan. Por eso el historial de la tabla pasa a recorrer
 * historialVisible() en vez de historial directamente.
 *
 * OJO con el TOP 100: el backend devuelve las 100 filas mas recientes del apartado, y el
 * filtro se aplica DESPUES. Con el check puesto se ven las procesadas que haya entre esas
 * 100, no las 100 procesadas mas recientes. En eurogroup, que tiene 610 filas en TEST, eso
 * se nota; no hay paginacion, asi que lo que no entra en las 100 no se ve desde ninguna parte.
 *
 * La preferencia se guarda por PAGINA en localStorage: quien trabaja mirando solo lo que ha
 * salido bien no quiere volver a marcarlo cada vez que entra. La clave sale de
 * location.pathname y no de _endpoint para poder resolverla al construir el objeto, cuando
 * el manager todavia no ha puesto sus propias claves.
 */

const CLAVE = () => {
    try { return `ocultarErrores:${window.location.pathname}`; } catch (e) { return null; }
};

const leer = () => {
    try {
        const k = CLAVE();
        return k ? window.localStorage.getItem(k) === '1' : false;
    } catch (e) {
        // Ventana privada, cookies bloqueadas o sin window (las pruebas de node): el check
        // sigue funcionando, simplemente no se recuerda.
        return false;
    }
};

export default function ocultarErrores() {
    return {
        ocultarErrores: leer(),

        /** Filas del historial que se pintan. Con el check puesto, sin las de estado error. */
        historialVisible() {
            const lista = this.historial || [];
            if (!this.ocultarErrores) return lista;
            return lista.filter(h => h && h.estado !== 'error');
        },

        /** Cuantas filas esconde el check ahora mismo, para poder decirlo al lado. */
        erroresOcultos() {
            return (this.historial || []).filter(h => h && h.estado === 'error').length;
        },

        /** x-model ya ha cambiado el valor cuando se llama: aqui solo se recuerda. */
        recordarOcultarErrores() {
            try {
                const k = CLAVE();
                if (k) window.localStorage.setItem(k, this.ocultarErrores ? '1' : '0');
            } catch (e) { /* sin localStorage no se recuerda, y no pasa nada */ }
            try {
                this._log(`ocultarErrores=${this.ocultarErrores} (${this.erroresOcultos()} fila(s) de error)`);
            } catch (e) { /* los managers de produccion no todos tienen _log */ }
        }
    };
}
