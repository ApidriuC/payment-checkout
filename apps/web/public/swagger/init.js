// En un archivo aparte y no inline, para que la CSP pueda mantener script-src 'self'.
window.ui = SwaggerUIBundle({
  url: '/docs-json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: 'BaseLayout',
});
