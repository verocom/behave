const EN_PRIVACY = [
  { heading: 'What we collect', body: 'Limitless collects your email address, display name, journal entries, behaviors, tags, and optional cost amounts that you choose to enter.' },
  { heading: 'How we store your data', body: 'Limitless stores account data in Google Firebase (Firebase Authentication and Cloud Firestore). Your data is stored under your account and is readable only by that authenticated user. We do not sell your data, show ads, or use third-party analytics currently.' },
  { heading: 'Voice journaling', body: "Voice journaling uses your browser's Web Speech API. On Chrome, audio may be sent to Google's speech servers for transcription. Limitless does not store the audio; only the resulting transcript is saved when you choose to save an entry." },
  { heading: 'Limitless+ payments', body: 'Limitless+ subscriptions are processed by Stripe. Your card details go directly to Stripe and are never stored by Limitless; we only keep your subscription status, renewal date and Stripe customer ID. If you redeem a clinic code, we store the code and the clinic it came from — never any health information.' },
  { heading: 'Daily reminder', body: 'If you turn on the gentle reminder, we store the hour you chose, your time zone, your language and the push address your browser gives us. The notification travels through your browser’s push service (Google, Mozilla, Apple or Microsoft) and contains only a short invitation, never your journal. Turning the reminder off or deleting your account removes this information.' },
  { heading: 'Your choices', body: 'You can export your account data as JSON or your entries as CSV from Manage. You can also permanently delete all of your Limitless data and your account from Manage.' },
  { heading: 'Not medical advice', body: 'Limitless is not a medical device and does not provide medical or psychological advice. Do not use it for diagnosis, treatment, or emergencies.' },
  { heading: 'Contact and updates', body: 'Questions about privacy can be sent to support@limitless.app. Last updated: October 22, 2026.' },
];
const FR_PRIVACY = [
  { heading: 'Données recueillies', body: 'Limitless recueille votre adresse courriel, votre nom d’affichage, vos entrées de journal, vos comportements, vos tags et les montants optionnels que vous choisissez d’ajouter.' },
  { heading: 'Stockage', body: 'Limitless stocke les données dans Google Firebase (Firebase Authentication et Cloud Firestore). Vos données sont stockées dans votre compte et ne sont lisibles que par cet utilisateur authentifié. Nous ne vendons pas vos données, n’affichons pas de publicités et n’utilisons pas actuellement d’analytique tierce.' },
  { heading: 'Journal vocal', body: 'Le journal vocal utilise l’API Web Speech de votre navigateur. Dans Chrome, l’audio peut être envoyé aux serveurs de reconnaissance vocale de Google. Limitless ne stocke pas l’audio; seul le texte transcrit est enregistré lorsque vous sauvegardez une entrée.' },
  { heading: 'Paiements Limitless+', body: 'Les abonnements Limitless+ sont traités par Stripe. Vos données de carte sont transmises directement à Stripe et ne sont jamais stockées par Limitless; nous conservons seulement le statut de l’abonnement, sa date de renouvellement et votre identifiant client Stripe. Si vous activez un code de clinique, nous conservons le code et la clinique qui l’a remis — jamais d’information de santé.' },
  { heading: 'Rappel quotidien', body: 'Si vous activez le rappel doux, nous conservons l’heure choisie, votre fuseau horaire, votre langue et l’adresse de notification fournie par votre navigateur. La notification passe par le service de notifications de votre navigateur (Google, Mozilla, Apple ou Microsoft) et ne contient qu’une courte invitation, jamais votre journal. Arrêter le rappel ou supprimer votre compte efface ces informations.' },
  { heading: 'Vos choix', body: 'Vous pouvez exporter vos données en JSON ou vos entrées en CSV depuis Gérer. Vous pouvez aussi supprimer définitivement toutes vos données et votre compte depuis Gérer.' },
  { heading: 'Pas un avis médical', body: 'Limitless n’est pas un dispositif médical et ne fournit pas de conseils médicaux ou psychologiques. Ne l’utilisez pas pour un diagnostic, un traitement ou une urgence.' },
  { heading: 'Contact et mises à jour', body: 'Pour toute question, écrivez à support@limitless.app. Dernière mise à jour : 22 octobre 2026.' },
];
const ES_PRIVACY = [
  { heading: 'Qué recopilamos', body: 'Limitless recopila tu correo electrónico, nombre visible, entradas del diario, comportamientos, etiquetas y los importes opcionales que decidas añadir.' },
  { heading: 'Cómo almacenamos tus datos', body: 'Limitless almacena los datos en Google Firebase (Firebase Authentication y Cloud Firestore). Tus datos se guardan en tu cuenta y solo puede leerlos ese usuario autenticado. No vendemos tus datos, no mostramos anuncios ni usamos analítica de terceros actualmente.' },
  { heading: 'Diario de voz', body: 'El diario de voz usa la API Web Speech de tu navegador. En Chrome, el audio puede enviarse a los servidores de voz de Google para transcribirlo. Limitless no almacena el audio; solo se guarda la transcripción cuando eliges guardar una entrada.' },
  { heading: 'Pagos de Limitless+', body: 'Las suscripciones a Limitless+ las procesa Stripe. Los datos de tu tarjeta van directamente a Stripe y Limitless nunca los almacena; solo guardamos el estado de la suscripción, su fecha de renovación y tu identificador de cliente de Stripe. Si activas un código de clínica, guardamos el código y la clínica que lo emitió, nunca información de salud.' },
  { heading: 'Recordatorio diario', body: 'Si activas el recordatorio suave, guardamos la hora elegida, tu zona horaria, tu idioma y la dirección de notificaciones que da tu navegador. La notificación pasa por el servicio de notificaciones de tu navegador (Google, Mozilla, Apple o Microsoft) y solo contiene una breve invitación, nunca tu diario. Desactivar el recordatorio o eliminar tu cuenta borra esta información.' },
  { heading: 'Tus opciones', body: 'Puedes exportar todos tus datos en JSON o tus entradas en CSV desde Gestionar. También puedes eliminar permanentemente todos tus datos y tu cuenta desde Gestionar.' },
  { heading: 'No es consejo médico', body: 'Limitless no es un dispositivo médico ni ofrece consejos médicos o psicológicos. No lo uses para diagnósticos, tratamientos o emergencias.' },
  { heading: 'Contacto y actualizaciones', body: 'Puedes escribir a support@limitless.app. Última actualización: 22 de octubre de 2026.' },
];

const EN_TERMS = [
  { heading: 'Eligibility', body: 'You must be at least 16 years old to use Limitless.' },
  { heading: 'Your account', body: 'You are responsible for keeping your account credentials secure and for activity under your account. Provide accurate information and tell us if you suspect unauthorized access.' },
  { heading: 'Acceptable use', body: 'Use Limitless lawfully and respectfully. Do not abuse, disrupt, reverse engineer, scrape, or attempt unauthorized access to the service or another user’s data.' },
  { heading: 'Limitless+ subscription', body: 'The journal, daily check-ins, the 7-day basics program and crisis resources are free. Limitless+ is an optional subscription billed monthly or yearly through Stripe. It renews automatically until you cancel it from Limitless+ → Manage my subscription; you keep access until the end of the paid period. Deleting your account does not cancel a subscription. Access granted by a clinic code is free and ends on the date shown in the app.' },
  { heading: 'No medical claims', body: 'Limitless is a journaling and self-reflection tool, not a medical device or professional medical or psychological service. We make no medical claims.' },
  { heading: 'No warranty', body: 'Limitless is provided as available, without warranties of uninterrupted availability, accuracy, fitness for a particular purpose, or freedom from errors.' },
  { heading: 'Limitation of liability', body: 'To the maximum extent permitted by law, Limitless and its operators are not liable for indirect, incidental, special, consequential, or loss-of-data damages arising from your use of the service.' },
  { heading: 'Governing law', body: 'These Terms are governed by the laws of Quebec, Canada, without regard to conflict-of-law rules.' },
  { heading: 'Contact and updates', body: 'Questions can be sent to support@limitless.app. Last updated: October 22, 2026.' },
];
const FR_TERMS = [
  { heading: 'Admissibilité', body: 'Vous devez avoir au moins 16 ans pour utiliser Limitless.' },
  { heading: 'Votre compte', body: 'Vous êtes responsable de protéger vos identifiants et des activités de votre compte. Fournissez des informations exactes et avisez-nous de tout accès non autorisé.' },
  { heading: 'Utilisation acceptable', body: 'Utilisez Limitless légalement et avec respect. N’abusez pas du service, ne le perturbez pas, ne tentez pas d’y accéder sans autorisation et n’accédez jamais aux données d’un autre utilisateur.' },
  { heading: 'Abonnement Limitless+', body: 'Le journal, les check-ins, le parcours de base de 7 jours et les ressources de crise sont gratuits. Limitless+ est un abonnement optionnel, facturé chaque mois ou chaque année par Stripe. Il se renouvelle automatiquement jusqu’à ce que vous l’annuliez depuis Limitless+ → Gérer mon abonnement; vous gardez l’accès jusqu’à la fin de la période payée. Supprimer votre compte n’annule pas l’abonnement. L’accès offert par un code de clinique est gratuit et prend fin à la date indiquée dans l’app.' },
  { heading: 'Aucune prétention médicale', body: 'Limitless est un outil de journal et d’introspection, pas un dispositif médical ni un service médical ou psychologique professionnel. Nous ne faisons aucune prétention médicale.' },
  { heading: 'Aucune garantie', body: 'Limitless est fourni tel quel, sans garantie de disponibilité continue, d’exactitude, d’adaptation à un usage particulier ou d’absence d’erreurs.' },
  { heading: 'Limitation de responsabilité', body: 'Dans la mesure permise par la loi, Limitless et ses opérateurs ne sont pas responsables des dommages indirects, accessoires, spéciaux, consécutifs ou des pertes de données liés à votre utilisation du service.' },
  { heading: 'Droit applicable', body: 'Ces conditions sont régies par les lois du Québec, Canada, sans égard aux règles de conflit de lois.' },
  { heading: 'Contact et mises à jour', body: 'Écrivez à support@limitless.app. Dernière mise à jour : 22 octobre 2026.' },
];
const ES_TERMS = [
  { heading: 'Elegibilidad', body: 'Debes tener al menos 16 años para usar Limitless.' },
  { heading: 'Tu cuenta', body: 'Eres responsable de mantener seguras tus credenciales y de la actividad de tu cuenta. Proporciona información correcta e infórmanos si sospechas un acceso no autorizado.' },
  { heading: 'Uso aceptable', body: 'Usa Limitless de forma legal y respetuosa. No abuses, interrumpas, sometas a ingeniería inversa, raspes ni intentes acceder sin autorización al servicio o a los datos de otra persona.' },
  { heading: 'Suscripción Limitless+', body: 'El diario, los check-ins, el programa básico de 7 días y los recursos de crisis son gratuitos. Limitless+ es una suscripción opcional, facturada mensual o anualmente a través de Stripe. Se renueva automáticamente hasta que la canceles desde Limitless+ → Gestionar mi suscripción; mantienes el acceso hasta el final del período pagado. Eliminar tu cuenta no cancela la suscripción. El acceso otorgado por un código de clínica es gratuito y termina en la fecha indicada en la app.' },
  { heading: 'Sin afirmaciones médicas', body: 'Limitless es una herramienta de diario y reflexión, no un dispositivo médico ni un servicio médico o psicológico profesional. No hacemos afirmaciones médicas.' },
  { heading: 'Sin garantías', body: 'Limitless se proporciona según disponibilidad, sin garantías de disponibilidad ininterrumpida, exactitud, idoneidad para un fin particular o ausencia de errores.' },
  { heading: 'Limitación de responsabilidad', body: 'En la medida permitida por la ley, Limitless y sus operadores no son responsables de daños indirectos, incidentales, especiales, consecuentes o pérdida de datos derivados del uso del servicio.' },
  { heading: 'Ley aplicable', body: 'Estos Términos se rigen por las leyes de Quebec, Canadá, sin considerar las reglas sobre conflictos de leyes.' },
  { heading: 'Contacto y actualizaciones', body: 'Puedes escribir a support@limitless.app. Última actualización: 22 de octubre de 2026.' },
];

export const PRIVACY = { en: EN_PRIVACY, fr: FR_PRIVACY, es: ES_PRIVACY };
export const TERMS = { en: EN_TERMS, fr: FR_TERMS, es: ES_TERMS };
