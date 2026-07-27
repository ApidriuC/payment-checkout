// El SPA enruta en el cliente: una recarga en /checkout o /result/:ref debe
// devolver index.html. Se aplica solo al comportamiento por defecto, así los
// errores de /api/* llegan al cliente tal cual en vez de convertirse en HTML.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // La documentación se publica como el objeto "docs", sin extensión.
  if (uri === '/docs') {
    return request;
  }

  // Cualquier ruta con extensión es un archivo real del bundle.
  if (uri.indexOf('.') !== -1) {
    return request;
  }

  request.uri = '/index.html';
  return request;
}
