# LAB-PSI · Microbiología NEXTGEN V1.0.381

Proyecto listo para subir a la raíz de un repositorio GitHub.

## Publicación
- Ejecutar `npm install` y `npm run build`.
- Netlify: comando `npm run build`; directorio de publicación `dist`.
- No subir `node_modules/`, `dist/` ni archivos `.env`.
- Las reglas de Firestore se encuentran en `firestore.rules` y deben publicarse por separado en Firebase Console. Subirlas a GitHub no las activa.
- Consultar `GUIA_FIREBASE_V381.txt` antes de publicar las reglas.

## Versión
- Versión del paquete: 1.0.381.
- Archivos de versión: `src/app-version.js`, `public/version.json` y `public/sw.js`.

Este paquete conserva el código, estilos y recursos del ZIP recibido. No se ha comprobado la compilación ni el funcionamiento en Firebase.


## V1.0.382 — Optimización conservadora de alertas
Se centralizaron y reutilizaron suscripciones idénticas del motor de alertas, evitando observadores redundantes de colecciones en main y cleaning-alerts. No se modificaron reglas de Firestore, documentos, lógica de liberación ni cálculos de alertas. La reducción efectiva de lecturas requiere medición en Firebase; las consultas de colecciones completas aún pueden resultar costosas.

## V1.0.383 — Suscripciones compartidas en limpieza y equipos
- Plan de limpieza: suscripciones a registros y fuentes operativas reutilizan el motor compartido de alertas.
- Autoclaves: suscripciones a ciclos, lotes y productos reutilizan el mismo motor cuando la consulta coincide.
- Monitoreo de áreas: se conserva el observador compartido del centro de alertas incorporado en V1.0.382.
- Sin cambios en reglas, transacciones, históricos, lógica de controles o autorizaciones.
- Pendiente: reducir lecturas iniciales de colecciones completas mediante índices/resúmenes validados y medir consumo por módulo.
