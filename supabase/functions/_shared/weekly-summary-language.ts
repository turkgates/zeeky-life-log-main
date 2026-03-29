/**
 * zeeky-weekly-summary Edge Function: when upserting `weekly_summaries.summary_data`,
 * merge the request `language` into the JSON you persist:
 *
 *   summary_data: { ...fieldsFromModel, language: languageFromBody }
 */
export function mergeLanguageIntoSummaryData<T extends object>(
  summaryData: T,
  language: string | undefined,
): T & { language: string } {
  return { ...summaryData, language: language?.trim() || 'tr' };
}
