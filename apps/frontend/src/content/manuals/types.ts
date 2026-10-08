/** A user manual stored as structured blocks and rendered by the in-app help. */
export type ManualBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'note'; label: string; text: string; tone?: 'success' }
  | { type: 'table'; header: string[]; rows: string[][]; widths: number[] }
  | { type: 'figure'; src: string; caption: string; number: number; width: number; height: number; scale: number };

export type ManualContent = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  blocks: ManualBlock[];
};
