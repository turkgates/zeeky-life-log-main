/**
 * zeeky-suggestions Edge Function: read `language` from the request body and
 * prepend this string to your system prompt (e.g. as rule "0. …"):
 *
 *   const { user_id, mode, language } = await req.json()
 *   const languageInstruction = getSuggestionsLanguageInstruction(language)
 *   // system: `0. ${languageInstruction}\n` + existing rules
 */
export function getSuggestionsLanguageInstruction(language: string | undefined): string {
  if (language === 'en') {
    return 'Generate all suggestions in English only.';
  }
  if (language === 'fr') {
    return 'Génère toutes les suggestions en français uniquement.';
  }
  return 'Tüm önerileri sadece Türkçe yaz.';
}
