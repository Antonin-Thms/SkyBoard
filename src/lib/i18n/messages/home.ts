import { defineMessages } from "../define";

/** Page d'accueil : présentation, statistiques, étapes, gestes du mode vol. */
export default defineMessages({
  fr: {
    title: "Accueil",
    description: "Pilote tes kneeboards OpenKneeboard depuis une tablette ou un téléphone.",
    eyebrow: "Kneeboards pour DCS World en VR",
    headline: "Tes kneeboards dans le casque, pilotés du bout des doigts.",
    intro:
      "SkyBoard affiche tes documents dans OpenKneeboard. Depuis une tablette ou un téléphone, change de page, zoome et déplace-toi avec des gestes, sans retirer le casque.",
    stats: {
      documents: "Documents",
      folders: "Dossiers",
      cockpits: "Cockpits",
    },
    next: {
      addDocuments: "Ajouter mes premiers kneeboards",
      createCockpit: "Créer mon premier cockpit",
      openRemote: "Ouvrir la remote",
    },
    stepsTitle: "Démarrer en 3 étapes",
    step: "Étape {n}",
    steps: {
      documents: {
        title: "Ajoute tes kneeboards",
        text: "PDF, images, ou les kneeboards d'une mission (.miz) ou d'un track (.trk). Range-les par dossier, un par serveur par exemple.",
        cta: "Documents",
      },
      cockpits: {
        title: "Branche le casque",
        text: "Crée un cockpit, copie son URL et colle-la dans un onglet Web Dashboard d'OpenKneeboard.",
        cta: "Cockpits",
      },
      remote: {
        title: "Pilote au doigt",
        text: "Ouvre la remote sur une tablette ou un téléphone (ou scanne le QR code affiché sur le PC).",
        cta: "Remote",
      },
    },
    gesturesTitle: "Gestes du mode vol",
    gesturesHint: "Utilisables partout sur l'écran, sans regarder.",
    gestures: {
      pinch: { title: "Pincer", text: "Zoom centré entre les doigts (×1 à ×6)" },
      pan: { title: "Glisser à deux doigts", text: "Déplacer la page (ou à un doigt si zoomé)" },
      swipe: { title: "Swipe horizontal", text: "← document suivant · → document précédent" },
      doubleTap: { title: "Double tap", text: "Revenir à la page entière" },
      edges: {
        title: "Bords de l'écran",
        text: "Swipe vertical : ↓ page suivante · ↑ précédente (PDF de plusieurs pages)",
      },
      cursor: { title: "Curseur", text: "Bouton « Curseur » : ton doigt apparaît dans le casque" },
    },
  },
  en: {
    title: "Home",
    description: "Control your OpenKneeboard kneeboards from a tablet or a phone.",
    eyebrow: "Kneeboards for DCS World in VR",
    headline: "Your kneeboards in the headset, controlled at your fingertips.",
    intro:
      "SkyBoard displays your documents in OpenKneeboard. From a tablet or a phone, turn pages, zoom and pan with gestures, without taking off the headset.",
    stats: {
      documents: "Documents",
      folders: "Folders",
      cockpits: "Cockpits",
    },
    next: {
      addDocuments: "Add my first kneeboards",
      createCockpit: "Create my first cockpit",
      openRemote: "Open the remote",
    },
    stepsTitle: "Get started in 3 steps",
    step: "Step {n}",
    steps: {
      documents: {
        title: "Add your kneeboards",
        text: "PDFs, images, or the kneeboards of a mission (.miz) or a track (.trk). Sort them into folders, one per server for example.",
        cta: "Documents",
      },
      cockpits: {
        title: "Connect the headset",
        text: "Create a cockpit, copy its URL and paste it into an OpenKneeboard Web Dashboard tab.",
        cta: "Cockpits",
      },
      remote: {
        title: "Fly with your fingers",
        text: "Open the remote on a tablet or a phone (or scan the QR code shown on the PC).",
        cta: "Remote",
      },
    },
    gesturesTitle: "Flight mode gestures",
    gesturesHint: "Work anywhere on the screen, without looking.",
    gestures: {
      pinch: { title: "Pinch", text: "Zoom centered between your fingers (×1 to ×6)" },
      pan: { title: "Two-finger drag", text: "Move the page (or one finger when zoomed in)" },
      swipe: { title: "Horizontal swipe", text: "← next document · → previous document" },
      doubleTap: { title: "Double tap", text: "Back to the full page" },
      edges: {
        title: "Screen edges",
        text: "Vertical swipe: ↓ next page · ↑ previous (multi-page PDFs)",
      },
      cursor: { title: "Cursor", text: "“Cursor” button: your finger shows up in the headset" },
    },
  },
  de: {
    title: "Start",
    description: "Steuere deine OpenKneeboard-Kneeboards von einem Tablet oder Smartphone aus.",
    eyebrow: "Kneeboards für DCS World in VR",
    headline: "Deine Kneeboards im Headset, mit den Fingerspitzen gesteuert.",
    intro:
      "SkyBoard zeigt deine Dokumente in OpenKneeboard an. Vom Tablet oder Smartphone aus blätterst, zoomst und verschiebst du mit Gesten, ohne das Headset abzunehmen.",
    stats: {
      documents: "Dokumente",
      folders: "Ordner",
      cockpits: "Cockpits",
    },
    next: {
      addDocuments: "Meine ersten Kneeboards hinzufügen",
      createCockpit: "Mein erstes Cockpit erstellen",
      openRemote: "Remote öffnen",
    },
    stepsTitle: "In 3 Schritten loslegen",
    step: "Schritt {n}",
    steps: {
      documents: {
        title: "Füge deine Kneeboards hinzu",
        text: "PDFs, Bilder oder die Kneeboards einer Mission (.miz) oder eines Tracks (.trk). Sortiere sie in Ordner, zum Beispiel einen pro Server.",
        cta: "Dokumente",
      },
      cockpits: {
        title: "Verbinde das Headset",
        text: "Erstelle ein Cockpit, kopiere seine URL und füge sie in einen Web-Dashboard-Tab von OpenKneeboard ein.",
        cta: "Cockpits",
      },
      remote: {
        title: "Steuere mit dem Finger",
        text: "Öffne die Remote auf einem Tablet oder Smartphone (oder scanne den QR-Code auf dem PC).",
        cta: "Remote",
      },
    },
    gesturesTitle: "Gesten im Flugmodus",
    gesturesHint: "Überall auf dem Bildschirm nutzbar, ohne hinzusehen.",
    gestures: {
      pinch: { title: "Zusammenziehen", text: "Zoom zwischen den Fingern zentriert (×1 bis ×6)" },
      pan: { title: "Mit zwei Fingern ziehen", text: "Seite verschieben (oder mit einem Finger, wenn gezoomt)" },
      swipe: { title: "Horizontal wischen", text: "← nächstes Dokument · → vorheriges Dokument" },
      doubleTap: { title: "Doppeltippen", text: "Zurück zur ganzen Seite" },
      edges: {
        title: "Bildschirmränder",
        text: "Vertikal wischen: ↓ nächste Seite · ↑ vorherige (mehrseitige PDFs)",
      },
      cursor: { title: "Cursor", text: "Schaltfläche „Cursor“: Dein Finger erscheint im Headset" },
    },
  },
  es: {
    title: "Inicio",
    description: "Controla tus kneeboards de OpenKneeboard desde una tableta o un teléfono.",
    eyebrow: "Kneeboards para DCS World en RV",
    headline: "Tus kneeboards en el visor, controlados con la punta de los dedos.",
    intro:
      "SkyBoard muestra tus documentos en OpenKneeboard. Desde una tableta o un teléfono, cambia de página, haz zoom y desplázate con gestos, sin quitarte el visor.",
    stats: {
      documents: "Documentos",
      folders: "Carpetas",
      cockpits: "Cockpits",
    },
    next: {
      addDocuments: "Añadir mis primeros kneeboards",
      createCockpit: "Crear mi primer cockpit",
      openRemote: "Abrir la remote",
    },
    stepsTitle: "Empieza en 3 pasos",
    step: "Paso {n}",
    steps: {
      documents: {
        title: "Añade tus kneeboards",
        text: "PDF, imágenes o los kneeboards de una misión (.miz) o de un track (.trk). Ordénalos en carpetas, una por servidor por ejemplo.",
        cta: "Documentos",
      },
      cockpits: {
        title: "Conecta el visor",
        text: "Crea un cockpit, copia su URL y pégala en una pestaña Web Dashboard de OpenKneeboard.",
        cta: "Cockpits",
      },
      remote: {
        title: "Controla con el dedo",
        text: "Abre la remote en una tableta o un teléfono (o escanea el código QR que aparece en el PC).",
        cta: "Remote",
      },
    },
    gesturesTitle: "Gestos del modo vuelo",
    gesturesHint: "Funcionan en cualquier parte de la pantalla, sin mirar.",
    gestures: {
      pinch: { title: "Pellizcar", text: "Zoom centrado entre los dedos (×1 a ×6)" },
      pan: { title: "Arrastrar con dos dedos", text: "Mover la página (o con un dedo si hay zoom)" },
      swipe: { title: "Deslizar en horizontal", text: "← documento siguiente · → documento anterior" },
      doubleTap: { title: "Doble toque", text: "Volver a la página completa" },
      edges: {
        title: "Bordes de la pantalla",
        text: "Deslizar en vertical: ↓ página siguiente · ↑ anterior (PDF de varias páginas)",
      },
      cursor: { title: "Cursor", text: "Botón «Cursor»: tu dedo aparece en el visor" },
    },
  },
});
