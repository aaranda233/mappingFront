// env.js para pruebas con docker-compose en local.
// Se monta en el contenedor nginx como /usr/share/nginx/html/env.js.
// El navegador (host) habla con el backend publicado en localhost:4000.
window.env = {
  IP_BACKEND: "localhost:4000",
  IP_LANGCHAIN: "localhost:4000",
  IP_GREENYARD_PARSER: "localhost:5005",
  VERSION: "dev",
  ADMIN_USERS: ["bluque.garcia"],
  DEVELOPER_USERS: ["bluque.garcia"],
};
