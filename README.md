# LAB-PSI · ERP MICROBIOLOGÍA NEXTGEN V1.0.0

## Alcance real de esta entrega
Fase 1: proyecto nuevo Vite + Firebase, autenticación, consulta de perfil con permisos, cierre por inactividad, diseño responsive y motor central de listeners preparado para módulos futuros. **No hay módulos microbiológicos operativos, migración, respaldo, ni pruebas multiusuario implementadas.** El ERP antiguo no se toca.

## Preparar Firebase (proyecto `microbiologia-psi`)
1. En Authentication > Método de acceso, habilite Correo/Contraseña.
2. Cree el usuario administrador en Authentication. Copie su **UID**.
3. En Firestore > Reglas, publique `firestore.rules` (deniega todo excepto lectura del perfil propio y lectura de usuarios por ADMIN; los perfiles se crean exclusivamente desde consola/SDK Admin).
4. En Firestore > Datos, cree colección `users`, documento cuyo ID sea el **UID exacto** del administrador, con campos `active` (boolean) `true`, `role` (string) `ADMIN`, `userCode` (string) `JJF`.
5. No cree documentos usando correo como ID: este ERP usa UID para evitar errores por cambio de correo. Los analistas se habilitarán posteriormente con `role: ANALISTA` y `active: true`.
6. Compruebe que el dominio Netlify final esté autorizado en Authentication > Configuración > Dominios autorizados.

## Despliegue
En local: `npm install` y `npm run dev`.
En GitHub: suba **el contenido de esta carpeta**, no `node_modules` ni `dist`.
En Netlify: conecte el repositorio; build `npm run build`; publish `dist`.

## Arquitectura de sincronización
`src/sync.js` centraliza listeners con reutilización por clave, cancelación al salir de una pantalla y al cambiar de usuario. No abre listeners por defecto. Cada módulo futuro debe declarar consultas limitadas y usar este servicio. La estimación real de lecturas requiere medición de Firestore; compartir listeners no garantiza por sí solo cero lecturas. La persistencia IndexedDB, cola offline, reconciliación, resolución de conflictos y auditoría serán fases posteriores, no se presentan como implementadas.

## Seguridad
El `apiKey` web de Firebase es identificador público del cliente, **no es una contraseña**. La protección depende de las reglas, Authentication y control de permisos. No habilitar reglas abiertas. No incorporar credenciales de cuentas de servicio en el frontend.


## V1.0.1
- PWA: manifest, iconos y Service Worker solo en producción. En localhost con `npm run dev` se prueba la interfaz, pero para verificar instalación ejecutar `npm run build` y `npm run preview`.
- Campana y panel visual de comunicaciones: sin listeners ni notificaciones reales todavía.
- Sin cambios en Firestore, roles ni reglas; no requiere migración.
- No guarda datos microbiológicos offline. El Service Worker solo conserva archivos estáticos del mismo origen.
- Si hubo un SW de pruebas anterior, en Chrome DevTools > Application > Service Workers se puede desregistrar para evitar caché antigua.

## V1.0.6 — Centro de Comunicaciones PRO
- Interfaz de conversaciones con burbujas, filtro de estado, selección de colaborador y envío directo.
- Campana con panel flotante y vista de hasta cinco comunicaciones pendientes.
- Se conserva la suscripción compartida original de bandeja entrante (máximo 60 documentos). El historial enviado se carga una vez por sesión al abrir Comunicaciones (máximo 60 documentos); no se abre un listener por conversación.
- La lectura y atención son estados separados y solo puede modificarlos el destinatario.
- No se han cambiado las reglas Firestore ni la estructura de documentos.
- LIMITACIONES: historial de 60 entradas por dirección; mensajes enviados desde otras pestañas no se reflejan en tiempo real en la sesión del remitente hasta recargar; notificaciones solo dentro de la app (no push de sistema); la entrega a un dispositivo no se confirma, solo la escritura en Firebase.
- Instalación: `npm install`, `npm run dev`; compilación: `npm run build`.
