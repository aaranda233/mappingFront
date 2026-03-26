export default function tutorialGuide() {
    return {
        active: false,
        step: 0,
        steps: [
            {
                icon: 'sidebar',
                title: 'Menu lateral',
                description: 'Desde aquí accedes a las secciones principales: <b>Pedidos</b>, <b>Transportes</b> y <b>Estado Pedidos</b>. Cada una muestra un contador con las tareas pendientes.',
                position: 'center'
            },
            {
                icon: 'card',
                title: 'Cards de Mapping',
                description: 'Cada pedido aparece como una tarjeta. Puedes ver la <b>referencia</b>, <b>cliente</b> y <b>descripción</b> del producto. Pulsa <b>PDF</b> para ver el documento original.',
                position: 'center'
            },
            {
                icon: 'search',
                title: 'Buscar presentaciones',
                description: 'Dentro de cada card, usa el <b>buscador de presentaciones</b> para encontrar el producto correcto en el sistema. También puedes pulsar el icono de búsqueda rápida junto a la descripción.',
                position: 'center'
            },
            {
                icon: 'status',
                title: 'Estado de Pedidos',
                description: 'En la sección <b>Estado Pedidos</b> del menú puedes ver en tiempo real el estado de cada proveedor: <b>EDEKA</b>, <b>EUROGROUP</b> e <b>IBERIANA</b>.',
                position: 'center'
            },
            {
                icon: 'pilot',
                title: 'Pilotos de estado',
                description: 'Los indicadores de colores te avisan del estado:<br><span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span> <b>Verde</b> = procesado correctamente</span><br><span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span> <b>Rojo</b> = error en el proceso</span><br><span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-gray-400"></span> <b>Gris</b> = sin actividad</span>',
                position: 'center'
            },
            {
                icon: 'check',
                title: 'Listo para empezar',
                description: 'Ya conoces lo básico. Recuerda que puedes volver a ver este tutorial en cualquier momento pulsando el botón <b>Tutorial</b> en la cabecera.',
                position: 'center'
            }
        ],

        initTutorial() {
            const seen = localStorage.getItem('tutorialSeen');
            if (!seen) {
                this.active = true;
                this.step = 0;
            }
        },

        startTutorial() {
            this.step = 0;
            this.active = true;
        },

        closeTutorial() {
            this.active = false;
            localStorage.setItem('tutorialSeen', 'true');
        },

        tooltipPosition() {
            return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
        }
    };
}
