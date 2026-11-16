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
