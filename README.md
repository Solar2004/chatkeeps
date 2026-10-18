# Chatkeeps

Selecciona mensajes de WhatsApp Web y guárdalos como texto para una IA o como un HTML que puedes abrir sin conexión. Extensión Manifest V3 para Vivaldi, Chrome y Chromium. Código abierto, sin cuenta adicional ni servicio en la nube.

## Instalar

1. Descarga `chatkeeps-0.6.0.zip` desde [Releases](https://github.com/Solar2004/chatkeeps/releases) y descomprímelo.
2. Abre `vivaldi://extensions` o `chrome://extensions` y activa **Modo desarrollador**.
3. Pulsa **Cargar descomprimida** y elige la carpeta que contiene `manifest.json`.
4. Recarga WhatsApp Web. Verás un único icono verde; al abrirlo, el panel indica **Chatkeeps v0.6.0**.

Si actualizas una instalación anterior, sustituye su carpeta `dist`, pulsa **Recargar** en la extensión y recarga también WhatsApp. Tener dos versiones activas puede producir conflictos.

Para compilar desde el código (Node.js 20 o posterior):

```bash
npm ci
npm run build
```

Carga la carpeta `dist` que genera la compilación.

## Desde un mensaje antiguo hasta el final

1. Abre el chat y desplázate al mensaje desde el que quieres empezar.
2. Abre Chatkeeps y pulsa **Desde un mensaje hasta el final**.
3. Pulsa el mensaje inicial. Se incluye ese mensaje y se recorre el historial hacia los posteriores.
4. Espera sin desplazar manualmente el chat. El icono permite abrir el progreso y cancelar.
5. Revisa la selección y pulsa **Copiar texto** o **Exportar HTML**.

Los mensajes capturados permanecen en memoria aunque WhatsApp retire sus filas al desplazarse. No se duplican. Al cancelar, se conserva lo recogido con una nota de captura parcial. Cambiar de chat o recargar la página descarta la selección.

## También puedes

- Marcar por clic, Shift + clic o arrastre. Cada arrastre añade mensajes; acercarte a un borde desplaza el chat. Esc termina el marcado y conserva la selección.
- Capturar los últimos N mensajes o convertir una selección nativa de texto en mensajes completos.
- Mover el icono mínimo arrastrándolo, o con las flechas cuando tiene el foco.
- Copiar texto legible con autores, fechas, mensajes numerados, citas separadas y marcadores de multimedia. Los IDs técnicos quedan en JSON.
- Guardar TXT y JSON, completar citas disponibles y descargar o transcribir audios mediante un servicio local opcional.

## Enviar por intervalos

Abre el chat destinatario y entra en **Enviar por intervalos**. Escribe el mensaje, el intervalo en segundos (1–86400) y la cantidad (1–100). **Iniciar envíos** activa la secuencia: el primer mensaje espera el intervalo completo. El texto y el destinatario quedan fijados al iniciar; no se usa el cuadro de escritura ni se reemplazan tus borradores.

El panel muestra el contador y el próximo envío. **Detener** cancela los siguientes; un envío ya iniciado puede completarse. Cambiar de chat o recargar/cerrar WhatsApp detiene la secuencia. Funciona con el panel minimizado, señalado por un aro ámbar en el icono. Mantén el navegador abierto: la suspensión de pestañas o del equipo puede retrasar los envíos. No se acumulan envíos para mandarlos de golpe al volver.

Un error detiene la secuencia sin reintentos automáticos. El contador indica solicitudes completadas por WhatsApp, no confirmaciones de lectura del destinatario. La programación no se guarda tras recargar y se aplica solo a la pestaña donde la activaste.

## HTML con multimedia

El archivo tiene burbujas de conversación, fechas, respuestas, imágenes y stickers, reproductores de audio/vídeo y enlaces para descargar documentos. Usa **Ctrl+F** para buscar y **Ctrl+P** para imprimir o guardar PDF. Las citas enlazan al original cuando se conoce su ID y está incluido.

Con **Incluir archivos en el HTML**, Chatkeeps solicita a WhatsApp los archivos originales, a resolución completa, y los incorpora al propio HTML. No necesitas una carpeta adicional. Si el original no se recupera, puede incluir la vista previa en baja calidad que muestra el chat; el HTML y el panel lo señalan e indican el motivo. Los archivos ausentes se señalan; no se inventa su contenido. Puedes desactivar esta opción para obtener un archivo más ligero.

## Alcance y límites

- Se captura lo que WhatsApp Web consigue cargar en el chat abierto. No se garantiza historial que WhatsApp no haya sincronizado. Una discontinuidad detectada se indica como captura parcial.
- El recorrido hacia el final tiene límites de cinco minutos y aproximadamente 20.000 mensajes. La descarga acepta hasta 20 MB por archivo y 100 MB de multimedia acumulada por HTML.
- WhatsApp no ofrece una interfaz DOM estable: sus actualizaciones pueden requerir adaptar selectores o WA-JS. Un archivo caducado o no descargable puede faltar.
- Autor, hora exacta, tipo de mensaje y texto completo se leen del propio registro de WhatsApp Web (WA-JS) para cada mensaje seleccionado, también en fotos sin texto, donde la página no muestra esos datos. Si WA-JS no reconoce un mensaje, se usa lo visible en la página y lo que falte se señala; no se inventa. La fecha usa el formato de tu navegador.
- Si algo sale mal, **Copiar diagnóstico técnico** (en «Citas, audios y exportación») copia la estructura de los mensajes seleccionados sin textos, nombres ni números, para adjuntarla a un issue.
- No se interpretan imágenes, stickers ni vídeo. Las transcripciones automáticas se etiquetan y pueden contener errores.

## Privacidad

No hay analítica, cuentas, subida de conversaciones ni APIs de IA externas. El código trabaja en WhatsApp Web; recuperar multimedia usa la conexión de WhatsApp. Abrir un chat puede marcarlo como leído por el funcionamiento normal de WhatsApp.

Los HTML son autónomos, sin scripts ni conexiones externas, y el contenido del chat se escapa antes de insertarlo. Contienen los mensajes y archivos elegidos: compártelos solo con quien quieras que los lea. TXT/JSON no contienen claves, archivos codificados ni URLs internas de multimedia.

Permisos: `scripting` y `activeTab` permiten el panel y la interacción con WA-JS; el acceso se limita a WhatsApp Web y al servicio opcional `127.0.0.1:8766`. La selección y la clave local solo viven en memoria.

## Transcripción local opcional

Necesitas Python 3 y las dependencias de [faster-whisper](https://github.com/SYSTRAN/faster-whisper). Desde el código fuente:

```bash
python3 -m venv .venv
.venv/bin/pip install 'faster-whisper>=1,<2'
./scripts/iniciar-transcripcion.sh --model small
```

Pega la clave efímera que imprime el servidor en **Audios y transcripción local**. La primera ejecución descarga el modelo; la transcripción se procesa en tu máquina. El servidor solo escucha en `127.0.0.1`. Si un audio no está disponible, puedes descargarlo manualmente y adjuntarlo desde el panel.

## Desarrollo

```bash
npm test
npm run build
npm run test:browser
npm run test:extension
```

Las pruebas de navegador usan chats sintéticos. Usan `/usr/bin/chromium` por defecto; define `CHROMIUM_PATH` para otro ejecutable. `test:extension` abre WhatsApp Web en un perfil temporal sin sesión y verifica la carga MV3/WA-JS; necesita conexión. `npm run check` ejecuta todos los pasos.

Para contribuir, abre un issue o pull request. Incluye versión del navegador, versión de Chatkeeps y una reproducción sin conversaciones privadas. No adjuntes tokens, perfiles ni exportaciones reales.

## Licencia

MIT. Consulta [LICENSE](LICENSE) y [UPSTREAM.md](UPSTREAM.md) para las atribuciones. WA-JS mantiene su licencia Apache-2.0. Proyecto independiente, sin afiliación con WhatsApp o Meta.
