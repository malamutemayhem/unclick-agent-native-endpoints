export interface ConversationalCard {
  headline: string;
  summary: string;
  keyFacts: string[];
  nextActions: string[];
  deepLink?: string;
}

export function buildCard(fields: ConversationalCard): ConversationalCard {
  return fields;
}