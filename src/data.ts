export interface ManualPage {
  id: string;
  manualId: string;
  pageNumber: number;
  sectionTitle: string;
  subTitle?: string;
  paragraphs: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  diagramType?: 'schematic' | 'isometric' | 'wiring' | 'block' | 'gears' | 'handset' | 'terminal'| 'tree';
  isImageBased?: boolean;
}

export interface DocumentSection {
  id: string;
  title: string;
  isExpandable: boolean;
  docId?: string; // If single doc
  subDocuments?: {
    id: string;
    title: string;
    docId: string;
  }[];
}

// DOCUMENT_STRUCTURE and MANUALS_INFO are now provided dynamically by the XML
// configuration in `src/assets/config/documents.xml`. This file keeps only

