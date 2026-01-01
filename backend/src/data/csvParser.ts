import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  PillarDefinition,
  IndicatorDefinition,
  ScoringCriterion,
  LubometerFormula,
  PenaltyRule,
  ReadinessZone,
  CloseBlockerRule,
  TruthIndexRule,
  ObjectionMapping,
  HotButton,
  PushDelayRule,
} from './csvTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From dist/data/ go up to project root: dist/data -> dist -> server -> project root
// Use process.cwd() to get the project root (where server/ is located), then go up one level
const projectRoot = join(process.cwd(), '..');
const CSV_DIR = projectRoot;

export class CSVParser {
  private pillars: PillarDefinition[] = [];
  private indicators: Map<number, IndicatorDefinition> = new Map();
  private lubometerFormula: LubometerFormula | null = null;
  private truthIndexRules: TruthIndexRule[] = [];
  private objectionMappings: ObjectionMapping[] = [];
  private hotButtons: HotButton[] = [];
  private pushDelayRules: PushDelayRule[] = [];

  async loadAll() {
    await this.loadPillars();
    await this.loadPillarDetails();
    await this.loadLubometerFormula();
    await this.loadTruthIndex();
    await this.loadObjectionMatrix();
    await this.loadHotButtons();
    await this.loadPushDelayRules();
  }

  private async loadPillars() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillars.csv');
    const content = readFileSync(filePath, 'utf-8');
    // Skip first 4 lines (header rows) before parsing
    const lines = content.split('\n');
    const dataLines = lines.slice(4).join('\n');
    const records = parse(dataLines, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const pillarMap = new Map<string, PillarDefinition>();
    let currentPillar: PillarDefinition | null = null;

    for (const record of records) {
      // Check if this row has a new pillar
      if (record['Pillar ID'] && record['Pillar Name']) {
        const pillarId = record['Pillar ID'].trim();
        if (!pillarMap.has(pillarId)) {
          const newPillar: PillarDefinition = {
            id: pillarId,
            name: record['Pillar Name'].trim(),
            weight: parseFloat(record['Pillar Weight'] || '1.0'),
            indicators: [],
          };
          pillarMap.set(pillarId, newPillar);
          currentPillar = newPillar;
        } else {
          currentPillar = pillarMap.get(pillarId)!;
        }
      }

      // Add indicator to current pillar (if we have one and this row has indicator data)
      if (currentPillar && record['Indicator ID'] && record['Indicator Name']) {
        const indicatorId = parseInt(record['Indicator ID']);
        if (!isNaN(indicatorId)) {
          const indicator: IndicatorDefinition = {
            id: indicatorId,
            name: record['Indicator Name'].trim(),
            weight: parseFloat(record['Indicator Weight'] || '1.0'),
            pillarId: currentPillar.id,
            scoringCriteria: [],
          };
          currentPillar.indicators.push(indicator);
          this.indicators.set(indicatorId, indicator);
        }
      }
    }

    this.pillars = Array.from(pillarMap.values());
  }

  private async loadPillarDetails() {
    const pillarFiles = [
      { id: 'P1', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 1.csv' },
      { id: 'P2', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 2.csv' },
      { id: 'P3', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 3.csv' },
      { id: 'P4', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 4.csv' },
      { id: 'P5', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 5.csv' },
      { id: 'P6', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 6.csv' },
      { id: 'P7', file: 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 7.csv' },
    ];

    for (const { id, file } of pillarFiles) {
      const filePath = join(CSV_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (const record of records) {
        if (!record['Indicator ID']) continue;

        const indicatorId = parseInt(record['Indicator ID']);
        const indicator = this.indicators.get(indicatorId);

        if (indicator && indicator.pillarId === id) {
          const criterion: ScoringCriterion = {
            scoreLevel: record['Score Level'] as 'Low (1–3)' | 'Mid (4–6)' | 'High (7–10)',
            domain: record['Domain'] as 'Personal Dev' | 'B2B' | 'Real Estate',
            sampleQuestion: record['Sample Question'] || '',
            exampleAnswer: record['Example Prospect Answer'] || '',
          };
          indicator.scoringCriteria.push(criterion);
        }
      }
    }
  }

  private async loadLubometerFormula() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Lubometer Formula.csv');
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
        trim: true,
    });

    const steps: string[] = [];
    const penaltyRules: PenaltyRule[] = [];
    const readinessZones: ReadinessZone[] = [];
    const closeBlockerRules: CloseBlockerRule[] = [];

    for (const record of records) {
      const step = record['Step'];
      const description = record['Description'];
      const logic = record['Logic / Notes'];

      if (step && description) {
        if (step.toString().includes('Step')) {
          steps.push(`${step}: ${description}`);
        } else if (step.toString().includes('Rule')) {
          const penaltyMatch = logic?.match(/–(\d+)/);
          if (penaltyMatch) {
            penaltyRules.push({
              id: step.toString(),
              description: description || '',
              condition: logic || '',
              penalty: parseInt(penaltyMatch[1]),
            });
          }
        } else if (logic?.includes('→')) {
          const [range, label] = logic.split('→').map((s: string) => s.trim());
          readinessZones.push({
            range: range || '',
            label: label || '',
            color: label?.includes('Green') ? 'green' : label?.includes('Yellow') ? 'yellow' : label?.includes('Red') ? 'red' : 'no-go',
          });
        } else if (step.toString().includes('Close Blocker')) {
          closeBlockerRules.push({
            id: step.toString(),
            condition: description || '',
            action: logic || '',
          });
        }
      }
    }

    this.lubometerFormula = {
      steps,
      penaltyRules,
      readinessZones,
      closeBlockerRules,
    };
  }

  private async loadTruthIndex() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Truth Index.csv');
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const record of records) {
      if (record['Rule ID'] && record['Incoherence Condition']) {
        const penaltyMatch = record['Penalty (Points)']?.match(/–(\d+)|(\d+)/);
        const penalty = penaltyMatch ? parseInt(penaltyMatch[1] || penaltyMatch[2]) : 0;

        this.truthIndexRules.push({
          id: record['Rule ID'].trim(),
          condition: record['Incoherence Condition'].trim(),
          triggerLogic: record['Trigger Logic'] || '',
          penalty: penalty,
          notes: record['Notes'] || '',
        });
      }
    }
  }

  private async loadObjectionMatrix() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Indicators and Objection Matrix.csv');
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const record of records) {
      if (record['ID'] && record['Pillar & Indicator']) {
        this.objectionMappings.push({
          id: record['ID'].trim(),
          pillar: record['Pillar & Indicator'].split(',')[0]?.trim() || '',
          indicator: record['Pillar & Indicator'].split(',')[1]?.trim() || '',
          exampleObjection: record['Example Objection'] || '',
          pearlPrompt: record['PEARL Prompt'] || '',
          davidPrompt: record['David (Self-led Insight)'] || '',
          calvinPrompt: record['Calvin (Pattern Interrupt)'] || '',
          caronePrompt: record['Carone (Direct Challenge)'] || '',
        });
      }
    }
  }

  private async loadHotButtons() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Hot Buttons Tracker.csv');
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const record of records) {
      if (record['#'] && record['Pillar & Indicator']) {
        const parts = record['Pillar & Indicator'].split(',');
        const indicatorIdMatch = record['Pillar & Indicator'].match(/Indicator\s+(\d+)/i);
        const indicatorId = indicatorIdMatch ? parseInt(indicatorIdMatch[1]) : parseInt(record['#']);

        this.hotButtons.push({
          indicatorId: indicatorId,
          pillar: parts[0]?.trim() || '',
          indicator: parts[1]?.trim() || '',
          isHotButton: record['🔥 Hot Button'] === '✓',
          smartClosingPrompt: record['Smart Closing Prompt'] || '',
          exampleLanguage: record['Example Prospect Language'] || '',
        });
      }
    }
  }

  private async loadPushDelayRules() {
    const filePath = join(CSV_DIR, 'Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Push_Delay Rules.csv');
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const record of records) {
      if (record['Rule ID'] && record['Condition Description']) {
        this.pushDelayRules.push({
          id: record['Rule ID'].trim(),
          condition: record['Condition Description'].trim(),
          triggerLogic: record['Trigger Logic'] || '',
          recommendedAction: record['Recommended Action'] || '',
          notes: record['Notes'] || '',
        });
      }
    }
  }

  getPillars(): PillarDefinition[] {
    return this.pillars;
  }

  getIndicator(id: number): IndicatorDefinition | undefined {
    return this.indicators.get(id);
  }

  getLubometerFormula(): LubometerFormula | null {
    return this.lubometerFormula;
  }

  getTruthIndexRules(): TruthIndexRule[] {
    return this.truthIndexRules;
  }

  getObjectionMappings(): ObjectionMapping[] {
    return this.objectionMappings;
  }

  getHotButtons(): HotButton[] {
    return this.hotButtons;
  }

  getPushDelayRules(): PushDelayRule[] {
    return this.pushDelayRules;
  }

  getAllIndicators(): IndicatorDefinition[] {
    return Array.from(this.indicators.values());
  }
}

let parserInstance: CSVParser | null = null;

export async function getCSVParser(): Promise<CSVParser> {
  if (!parserInstance) {
    parserInstance = new CSVParser();
    await parserInstance.loadAll();
  }
  return parserInstance;
}

