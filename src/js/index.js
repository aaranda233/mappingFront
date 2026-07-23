import "jsvectormap/dist/jsvectormap.min.css";
import "flatpickr/dist/flatpickr.min.css";
import "dropzone/dist/dropzone.css";
import "../css/style.css";

import Alpine from "alpinejs";
import persist from "@alpinejs/persist";
import flatpickr from "flatpickr";
import Dropzone from "dropzone";

import chart01 from "./components/charts/chart-01";
import chart02 from "./components/charts/chart-02";
import chart03 from "./components/charts/chart-03";
import map01 from "./components/map-01";
import "./components/calendar-init.js";
import "./components/image-resize";

import mappingManager from "./mappingManager.js";
import transporteManager from "./transporteManager.js";
import estadoPedidosManager from "./estadoPedidosManager.js";
import estadoPedidosEurogroupManager from "./estadoPedidosEurogroupManager.js";
import estadoPedidosEurogroupTestManager from "./estadoPedidosEurogroupTestManager.js";
import estadoPedidosIberianaManager from "./estadoPedidosIberianaManager.js";
import estadoPedidosIberianaTestManager from "./estadoPedidosIberianaTestManager.js";
import estadoPedidosGreenyardManager from "./estadoPedidosGreenyardManager.js";
import estadoPedidosGreenyardTestManager from "./estadoPedidosGreenyardTestManager.js";
import estadoPedidosAnecoopManager from "./estadoPedidosAnecoopManager.js";
import estadoPedidosAnecoopTestManager from "./estadoPedidosAnecoopTestManager.js";
import estadoPedidosAlfruitManager from "./estadoPedidosAlfruitManager.js";
import estadoPedidosAlfruitTestManager from "./estadoPedidosAlfruitTestManager.js";
import estadoPedidosPelicanManager from "./estadoPedidosPelicanManager.js";
import estadoPedidosPelicanTestManager from "./estadoPedidosPelicanTestManager.js";
import estadoPedidosImgManager from "./estadoPedidosImgManager.js";
import estadoPedidosImgTestManager from "./estadoPedidosImgTestManager.js";
import estadoPedidosLehmanManager from "./estadoPedidosLehmanManager.js";
import estadoPedidosLehmanTestManager from "./estadoPedidosLehmanTestManager.js";
import previewLehmanManager from "./previewLehmanManager.js";
import adminManager from "./adminManager.js";
import presentacionesManager from "./presentacionesManager.js";
import direccionesManager from "./direccionesManager.js";
import tutorialGuide from "./tutorialGuide.js";
import previewIberianaManager from "./previewIberianaManager.js";
import greenyardManager from "./greenyardManager.js";
import chatbotManager from "./chatbotManager.js";

// Salvaguarda: si /env.js no se cargó (404, ConfigMap ausente en dev…),
// evitar que window.env undefined haga reventar todo el store.
window.env = window.env || {};

window.mappingManager = mappingManager;
window.transporteManager = transporteManager;
window.presentacionesManager = presentacionesManager;
window.direccionesManager = direccionesManager;
window.previewIberianaManager = previewIberianaManager;
window.greenyardManager = greenyardManager;
window.estadoPedidosManager = estadoPedidosManager;
window.estadoPedidosEurogroupManager = estadoPedidosEurogroupManager;
window.estadoPedidosEurogroupTestManager = estadoPedidosEurogroupTestManager;
window.estadoPedidosIberianaManager = estadoPedidosIberianaManager;
window.estadoPedidosIberianaTestManager = estadoPedidosIberianaTestManager;
window.estadoPedidosGreenyardManager = estadoPedidosGreenyardManager;
window.estadoPedidosGreenyardTestManager = estadoPedidosGreenyardTestManager;
window.estadoPedidosAnecoopManager = estadoPedidosAnecoopManager;
window.estadoPedidosAnecoopTestManager = estadoPedidosAnecoopTestManager;
window.estadoPedidosAlfruitManager = estadoPedidosAlfruitManager;
window.estadoPedidosAlfruitTestManager = estadoPedidosAlfruitTestManager;
window.estadoPedidosPelicanManager = estadoPedidosPelicanManager;
window.estadoPedidosPelicanTestManager = estadoPedidosPelicanTestManager;
window.estadoPedidosImgManager = estadoPedidosImgManager;
window.estadoPedidosImgTestManager = estadoPedidosImgTestManager;
window.estadoPedidosLehmanManager = estadoPedidosLehmanManager;
window.estadoPedidosLehmanTestManager = estadoPedidosLehmanTestManager;
window.previewLehmanManager = previewLehmanManager;
window.adminManager = adminManager;
window.tutorialGuide = tutorialGuide;
window.chatbotManager = chatbotManager;

Alpine.plugin(persist);
window.Alpine = Alpine;

// Register global store
import store from "./store.js";
Alpine.store("global", store);
Alpine.store("global").fetchUserInfo(); // Fetch user role
Alpine.store("global").fetchCounts(); // Initial fetch
Alpine.store("global").fetchEstadoPedidos(); // Initial fetch estado pedidos EDEKA
Alpine.store("global").fetchEstadoPedidosEurogroup(); // Initial fetch estado pedidos EUROGROUP
Alpine.store("global").fetchEstadoPedidosEurogroupTest(); // Initial fetch estado pedidos EUROGROUP TEST
Alpine.store("global").fetchEstadoPedidosIberiana(); // Initial fetch estado pedidos IBERIANA
Alpine.store("global").fetchEstadoPedidosIberianaTest(); // Initial fetch estado pedidos IBERIANA TEST
Alpine.store("global").fetchEstadoPedidosGreenyard(); // Initial fetch estado pedidos GREENYARD
Alpine.store("global").fetchEstadoPedidosGreenyardTest(); // Initial fetch estado pedidos GREENYARD TEST
Alpine.store("global").fetchEstadoPedidosAnecoop(); // Initial fetch estado pedidos ANECOOP
Alpine.store("global").fetchEstadoPedidosAnecoopTest(); // Initial fetch estado pedidos ANECOOP TEST
Alpine.store("global").fetchEstadoPedidosAlfruit(); // Initial fetch estado pedidos ALFRUIT
Alpine.store("global").fetchEstadoPedidosAlfruitTest(); // Initial fetch estado pedidos ALFRUIT TEST
Alpine.store("global").fetchEstadoPedidosPelican(); // Initial fetch estado pedidos PELICAN
Alpine.store("global").fetchEstadoPedidosPelicanTest(); // Initial fetch estado pedidos PELICAN TEST
Alpine.store("global").fetchEstadoPedidosImg(); // Initial fetch estado pedidos IMG
Alpine.store("global").fetchEstadoPedidosImgTest(); // Initial fetch estado pedidos IMG TEST
Alpine.store("global").fetchEstadoPedidosLehman(); // Initial fetch estado pedidos LEHMANN
Alpine.store("global").fetchEstadoPedidosLehmanTest(); // Initial fetch estado pedidos LEHMANN TEST
Alpine.store("global").fetchGreenyardHealth(); // Initial ping al parser Greenyard (piloto)
setInterval(() => Alpine.store("global").fetchCounts(), 30000); // Refresh every 30s
setInterval(() => Alpine.store("global").fetchEstadoPedidos(), 1000); // Refresh estado pedidos EDEKA every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosEurogroup(), 1000); // Refresh estado pedidos EUROGROUP every 1s
setInterval(
  () => Alpine.store("global").fetchEstadoPedidosEurogroupTest(),
  1000,
); // Refresh estado pedidos EUROGROUP TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosIberiana(), 1000); // Refresh estado pedidos IBERIANA every 1s
setInterval(
  () => Alpine.store("global").fetchEstadoPedidosIberianaTest(),
  1000,
); // Refresh estado pedidos IBERIANA TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosGreenyard(), 1000); // Refresh estado pedidos GREENYARD every 1s
setInterval(
  () => Alpine.store("global").fetchEstadoPedidosGreenyardTest(),
  1000,
); // Refresh estado pedidos GREENYARD TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosAnecoop(), 1000); // Refresh estado pedidos ANECOOP every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosAnecoopTest(), 1000); // Refresh estado pedidos ANECOOP TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosAlfruit(), 1000); // Refresh estado pedidos ALFRUIT every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosAlfruitTest(), 1000); // Refresh estado pedidos ALFRUIT TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosPelican(), 1000); // Refresh estado pedidos PELICAN every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosPelicanTest(), 1000); // Refresh estado pedidos PELICAN TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosImg(), 1000); // Refresh estado pedidos IMG every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosImgTest(), 1000); // Refresh estado pedidos IMG TEST every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosLehman(), 1000); // Refresh estado pedidos LEHMANN every 1s
setInterval(() => Alpine.store("global").fetchEstadoPedidosLehmanTest(), 1000); // Refresh estado pedidos LEHMANN TEST every 1s
setInterval(() => Alpine.store("global").fetchGreenyardHealth(), 5000); // Ping parser Greenyard cada 5s (piloto)

Alpine.start();

// Init flatpickr
flatpickr(".datepicker", {
  mode: "range",
  static: true,
  monthSelectorType: "static",
  dateFormat: "M j, Y",
  defaultDate: [new Date().setDate(new Date().getDate() - 6), new Date()],
  prevArrow:
    '<svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.25 6L9 12.25L15.25 18.5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nextArrow:
    '<svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.75 19L15 12.75L8.75 6.5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  onReady: (selectedDates, dateStr, instance) => {
    // eslint-disable-next-line no-param-reassign
    instance.element.value = dateStr.replace("to", "-");
    const customClass = instance.element.getAttribute("data-class");
    instance.calendarContainer.classList.add(customClass);
  },
  onChange: (selectedDates, dateStr, instance) => {
    // eslint-disable-next-line no-param-reassign
    instance.element.value = dateStr.replace("to", "-");
  },
});

// Init Dropzone
const dropzoneArea = document.querySelectorAll("#demo-upload");

if (dropzoneArea.length) {
  let myDropzone = new Dropzone("#demo-upload", { url: "/file/post" });
}

// Document Loaded
document.addEventListener("DOMContentLoaded", () => {
  chart01();
  chart02();
  chart03();
  map01();
});

// Get the current year
const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

// For Copy//
document.addEventListener("DOMContentLoaded", () => {
  const copyInput = document.getElementById("copy-input");
  if (copyInput) {
    // Select the copy button and input field
    const copyButton = document.getElementById("copy-button");
    const copyText = document.getElementById("copy-text");
    const websiteInput = document.getElementById("website-input");

    // Event listener for the copy button
    copyButton.addEventListener("click", () => {
      // Copy the input value to the clipboard
      navigator.clipboard.writeText(websiteInput.value).then(() => {
        // Change the text to "Copied"
        copyText.textContent = "Copied";

        // Reset the text back to "Copy" after 2 seconds
        setTimeout(() => {
          copyText.textContent = "Copy";
        }, 2000);
      });
    });
  }
});
