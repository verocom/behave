const EN_PRIVACY = [
  { heading: 'What we collect', body: 'BeHave collects your email address, display name, journal entries, behaviors, tags, and optional cost amounts that you choose to enter.' },
  { heading: 'How we store your data', body: 'BeHave stores account data in Google Firebase (Firebase Authentication and Cloud Firestore). Your data is stored under your account and is readable only by that authenticated user. We do not sell your data, show ads, or use third-party analytics currently.' },
  { heading: 'Voice journaling', body: "Voice journaling uses your browser's Web Speech API. On Chrome, audio may be sent to Google's speech servers for transcription. BeHave does not store the audio; only the resulting transcript is saved when you choose to save an entry." },
  { heading: 'Your choices', body: 'You can export your account data as JSON or your entries as CSV from Manage. You can also permanently delete all of your BeHave data and your account from Manage.' },
  { heading: 'Not medical advice', body: 'BeHave is not a medical device and does not provide medical or psychological advice. Do not use it for diagnosis, treatment, or emergencies.' },
  { heading: 'Contact and updates', body: 'Questions about privacy can be sent to support@behave.app. Last updated: February 21, 2026.' },
];
const FR_PRIVACY = [
  { heading: 'Données recueillies', body: 'BeHave recueille votre adresse courriel, votre nom d’affichage, vos entrées de journal, vos comportements, vos tags et les montants optionnels que vous choisissez d’ajouter.' },
  { heading: 'Stockage', body: 'BeHave stocke les données dans Google Firebase (Firebase Authentication et Cloud Firestore). Vos données sont stockées dans votre compte et ne sont lisibles que par cet utilisateur authentifié. Nous ne vendons pas vos données, n’affichons pas de publicités et n’utilisons pas actuellement d’analytique tierce.' },
  { heading: 'Journal vocal', body: 'Le journal vocal utilise l’API Web Speech de votre navigateur. Dans Chrome, l’audio peut être envoyé aux serveurs de reconnaissance vocale de Google. BeHave ne stocke pas l’audio; seul le texte transcrit est enregistré lorsque vous sauvegardez une entrée.' },
  { heading: 'Vos choix', body: 'Vous pouvez exporter vos données en JSON ou vos entrées en CSV depuis Gérer. Vous pouvez aussi supprimer définitivement toutes vos données et votre compte depuis Gérer.' },
  { heading: 'Pas un avis médical', body: 'BeHave n’est pas un dispositif médical et ne fournit pas de conseils médicaux ou psychologiques. Ne l’utilisez pas pour un diagnostic, un traitement ou une urgence.' },
  { heading: 'Contact et mises à jour', body: 'Pour toute question, écrivez à support@behave.app. Dernière mise à jour : 21 février 2026.' },
];
const ES_PRIVACY = [
  { heading: 'Qué recopilamos', body: 'BeHave recopila tu correo electrónico, nombre visible, entradas del diario, comportamientos, etiquetas y los importes opcionales que decidas añadir.' },
  { heading: 'Cómo almacenamos tus datos', body: 'BeHave almacena los datos en Google Firebase (Firebase Authentication y Cloud Firestore). Tus datos se guardan en tu cuenta y solo puede leerlos ese usuario autenticado. No vendemos tus datos, no mostramos anuncios ni usamos analítica de terceros actualmente.' },
  { heading: 'Diario de voz', body: 'El diario de voz usa la API Web Speech de tu navegador. En Chrome, el audio puede enviarse a los servidores de voz de Google para transcribirlo. BeHave no almacena el audio; solo se guarda la transcripción cuando eliges guardar una entrada.' },
  { heading: 'Tus opciones', body: 'Puedes exportar todos tus datos en JSON o tus entradas en CSV desde Gestionar. También puedes eliminar permanentemente todos tus datos y tu cuenta desde Gestionar.' },
  { heading: 'No es consejo médico', body: 'BeHave no es un dispositivo médico ni ofrece consejos médicos o psicológicos. No lo uses para diagnósticos, tratamientos o emergencias.' },
  { heading: 'Contacto y actualizaciones', body: 'Puedes escribir a support@behave.app. Última actualización: 21 de febrero de 2026.' },
];

const EN_TERMS = [
  { heading: 'Eligibility', body: 'You must be at least 16 years old to use BeHave.' },
  { heading: 'Your account', body: 'You are responsible for keeping your account credentials secure and for activity under your account. Provide accurate information and tell us if you suspect unauthorized access.' },
  { heading: 'Acceptable use', body: 'Use BeHave lawfully and respectfully. Do not abuse, disrupt, reverse engineer, scrape, or attempt unauthorized access to the service or another user’s data.' },
  { heading: 'No medical claims', body: 'BeHave is a journaling and self-reflection tool, not a medical device or professional medical or psychological service. We make no medical claims.' },
  { heading: 'No warranty', body: 'BeHave is provided as available, without warranties of uninterrupted availability, accuracy, fitness for a particular purpose, or freedom from errors.' },
  { heading: 'Limitation of liability', body: 'To the maximum extent permitted by law, BeHave and its operators are not liable for indirect, incidental, special, consequential, or loss-of-data damages arising from your use of the service.' },
  { heading: 'Governing law', body: 'These Terms are governed by the laws of Quebec, Canada, without regard to conflict-of-law rules.' },
  { heading: 'Contact and updates', body: 'Questions can be sent to support@behave.app. Last updated: February 21, 2026.' },
];
const FR_TERMS = [
  { heading: 'Admissibilité', body: 'Vous devez avoir au moins 16 ans pour utiliser BeHave.' },
  { heading: 'Votre compte', body: 'Vous êtes responsable de protéger vos identifiants et des activités de votre compte. Fournissez des informations exactes et avisez-nous de tout accès non autorisé.' },
  { heading: 'Utilisation acceptable', body: 'Utilisez BeHave légalement et avec respect. N’abusez pas du service, ne le perturbez pas, ne tentez pas d’y accéder sans autorisation et n’accédez jamais aux données d’un autre utilisateur.' },
  { heading: 'Aucune prétention médicale', body: 'BeHave est un outil de journal et d’introspection, pas un dispositif médical ni un service médical ou psychologique professionnel. Nous ne faisons aucune prétention médicale.' },
  { heading: 'Aucune garantie', body: 'BeHave est fourni tel quel, sans garantie de disponibilité continue, d’exactitude, d’adaptation à un usage particulier ou d’absence d’erreurs.' },
  { heading: 'Limitation de responsabilité', body: 'Dans la mesure permise par la loi, BeHave et ses opérateurs ne sont pas responsables des dommages indirects, accessoires, spéciaux, consécutifs ou des pertes de données liés à votre utilisation du service.' },
  { heading: 'Droit applicable', body: 'Ces conditions sont régies par les lois du Québec, Canada, sans égard aux règles de conflit de lois.' },
  { heading: 'Contact et mises à jour', body: 'Écrivez à support@behave.app. Dernière mise à jour : 21 février 2026.' },
];
const ES_TERMS = [
  { heading: 'Elegibilidad', body: 'Debes tener al menos 16 años para usar BeHave.' },
  { heading: 'Tu cuenta', body: 'Eres responsable de mantener seguras tus credenciales y de la actividad de tu cuenta. Proporciona información correcta e infórmanos si sospechas un acceso no autorizado.' },
  { heading: 'Uso aceptable', body: 'Usa BeHave de forma legal y respetuosa. No abuses, interrumpas, sometas a ingeniería inversa, raspes ni intentes acceder sin autorización al servicio o a los datos de otra persona.' },
  { heading: 'Sin afirmaciones médicas', body: 'BeHave es una herramienta de diario y reflexión, no un dispositivo médico ni un servicio médico o psicológico profesional. No hacemos afirmaciones médicas.' },
  { heading: 'Sin garantías', body: 'BeHave se proporciona según disponibilidad, sin garantías de disponibilidad ininterrumpida, exactitud, idoneidad para un fin particular o ausencia de errores.' },
  { heading: 'Limitación de responsabilidad', body: 'En la medida permitida por la ley, BeHave y sus operadores no son responsables de daños indirectos, incidentales, especiales, consecuentes o pérdida de datos derivados del uso del servicio.' },
  { heading: 'Ley aplicable', body: 'Estos Términos se rigen por las leyes de Quebec, Canadá, sin considerar las reglas sobre conflictos de leyes.' },
  { heading: 'Contacto y actualizaciones', body: 'Puedes escribir a support@behave.app. Última actualización: 21 de febrero de 2026.' },
];

export const PRIVACY = { en: EN_PRIVACY, fr: FR_PRIVACY, es: ES_PRIVACY };
export const TERMS = { en: EN_TERMS, fr: FR_TERMS, es: ES_TERMS };
