// Message affiché au citoyen quand l'envoi de son inscription échoue, selon le
// code d'erreur renvoyé par le back (voir registrations_controller.ts côté
// svc-inscription). Les cas liés aux pièces justificatives sont distingués :
// ils ne se règlent pas en "réessayant" à l'identique.
export function registrationErrorMessage(data: unknown): string {
  const code = (data as { error?: string } | null)?.error

  switch (code) {
    case 'documents_destination_not_configured':
      return "Les inscriptions avec pièces justificatives ne sont pas encore ouvertes pour ce service — contactez l'organisme."
    case 'documents_email_failed':
      return "Vos pièces n'ont pas pu être transmises à l'organisme : votre inscription n'est pas enregistrée. Réessayez dans quelques instants."
    case 'documents_too_large':
      return 'Vos pièces sont trop volumineuses (10 Mo au total, 5 Mo maximum par fichier).'
    case 'invalid_document':
      return "Un des fichiers n'est pas valide (formats acceptés : PDF, PNG, JPEG)."
    default:
      return "Échec de l'envoi de l'inscription — réessayez."
  }
}
