# Publicador en línea: que cualquier usuario publique desde su equipo

Hoy solo publica el PC del administrador (servidor.ps1). Con este publicador, quien tenga perfil **editor** o
**editor por panel** toca **🚀 Publicar**, escribe su contraseña y en 1–2 minutos todos ven el cambio.
Solo se suben los paneles que el usuario tiene asignados.

Se hace **una sola vez**. Son 3 pasos: la llave de GitHub, el Worker en Cloudflare y la dirección en la página.

## 1. Llave de GitHub (token) — solo para este repositorio

1. Entre a GitHub con la cuenta dueña del repositorio → foto de perfil → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nombre: `publicador comite-aps`. Expiración: la que permita la política de la empresa (por ejemplo, 1 año).
3. **Repository access** → **Only select repositories** → `comite-aps`.
4. **Permissions** → **Repository permissions** → **Contents: Read and write** (deje todo lo demás en *No access*).
5. **Generate token** y copie el valor (empieza por `github_pat_…`). **No lo pegue en ningún chat, correo ni archivo**:
   solo va en Cloudflare (paso 2.5).

## 2. Worker en Cloudflare (gratis)

1. Cree la cuenta en https://dash.cloudflare.com/sign-up (correo del área) y verifique el correo.
2. Menú izquierdo → **Compute (Workers)** → **Workers & Pages** → **Create** → **Create Worker**
   (plantilla «Hello World»).
3. Nombre: `comite-aps-publicador` → **Deploy**.
4. **Edit code**: borre todo, pegue el contenido completo de `publicador/worker.js` → **Deploy**.
5. Vuelva al Worker → **Settings** → **Variables and Secrets** → **Add** → tipo **Secret**,
   nombre `GITHUB_TOKEN`, valor: el token del paso 1 → **Deploy**.
6. Copie la dirección del Worker, del estilo `https://comite-aps-publicador.<su-subdominio>.workers.dev`.

Comprobación: abra esa dirección + `/datos` en el navegador. Debe responder `Origen no permitido` (es lo correcto:
solo responde a la página del comité).

## 3. Dirección en la página

Pase la dirección del paso 2.6 a Claude (no es secreta) o póngala en `js/store.js`:

```js
const PUBLICADOR_URL = 'https://comite-aps-publicador.<su-subdominio>.workers.dev';
```

y publique como siempre. Desde ahí, en otros equipos el botón **📤 Enviar cambios** pasa a ser **🚀 Publicar**.

## Bueno saber

- La contraseña del usuario viaja cifrada (HTTPS) solo al Worker, que la compara con la huella publicada; no se guarda.
- Si dos personas publican a la vez, el segundo se vuelve a mezclar solo: se conservan los cambios de ambos
  (en listas, como el reporte de levante, gana el último que publicó).
- Su PC sigue publicando como siempre (servidor.ps1); el publicador es para los demás equipos.
- Para quitarle el permiso a alguien: cámbiele el perfil o la fecha límite en 🔐 Usuarios y accesos y publique.
- Para apagar el publicador: borre el Worker o el token en GitHub. La página vuelve a ofrecer «📤 Enviar cambios».
- Si se agrega un panel nuevo a *Usuarios y accesos*, hay que actualizar la lista `PANELES` del worker y volver a pegarlo.
