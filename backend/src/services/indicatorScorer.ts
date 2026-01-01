import type { IndicatorScore, TranscriptChunk } from '../types/analysis.js';
import type { IndicatorDefinition, ScoringCriterion } from '../data/csvTypes.js';
import { getCSVParser, type CSVParser } from '../data/csvParser.js';

export class IndicatorScorer {
  private parser: CSVParser | null = null;
  private conversationHistory: TranscriptChunk[] = [];
  private indicatorScores: Map<number, IndicatorScore> = new Map();

  async initialize() {
    if (!this.parser) {
      this.parser = await getCSVParser();
    }
  }

  updateConversation(transcript: TranscriptChunk[]) {
    this.conversationHistory = transcript;
  }

  async scoreAllIndicators(): Promise<IndicatorScore[]> {
    await this.initialize();
    if (!this.parser) throw new Error('Parser not initialized');
    
    const indicators = this.parser.getAllIndicators();
    const allText = this.conversationHistory
      .map(chunk => chunk.text)
      .join(' ')
      .toLowerCase();

    const scores: IndicatorScore[] = [];

    for (const indicator of indicators) {
      const score = await this.scoreIndicator(indicator, allText);
      scores.push(score);
      this.indicatorScores.set(indicator.id, score);
    }

    return scores;
  }

  private async scoreIndicator(
    indicator: IndicatorDefinition,
    conversationText: string
  ): Promise<IndicatorScore> {
    let totalScore = 0;
    let evidenceCount = 0;
    const evidence: string[] = [];

    // Score based on criteria in CSV
    for (const criterion of indicator.scoringCriteria) {
      const matchScore = this.matchCriterion(criterion, conversationText);
      if (matchScore > 0) {
        totalScore += matchScore;
        evidenceCount++;
        
        // Extract evidence snippets
        const snippet = this.extractEvidence(criterion, conversationText);
        if (snippet) {
          evidence.push(snippet);
        }
      }
    }

    // Calculate average score based on matched criteria
    let finalScore = 0;
    if (evidenceCount > 0) {
      finalScore = Math.round(totalScore / evidenceCount);
    } else {
      // Default to midpoint if no matches found
      finalScore = 5;
    }

    // Ensure score is between 1-10
    finalScore = Math.max(1, Math.min(10, finalScore));

    return {
      id: indicator.id,
      name: indicator.name,
      score: finalScore,
      pillarId: indicator.pillarId,
      evidence: evidence.length > 0 ? evidence : undefined,
    };
  }

  private matchCriterion(criterion: ScoringCriterion, text: string): number {
    const question = criterion.sampleQuestion.toLowerCase();
    const answer = criterion.exampleAnswer.toLowerCase();
    
    // Extract keywords from example answer
    const answerKeywords = this.extractKeywords(answer);
    const questionKeywords = this.extractKeywords(question);
    
    // Check for keyword matches
    let matchScore = 0;
    const allKeywords = [...answerKeywords, ...questionKeywords];
    
    for (const keyword of allKeywords) {
      if (text.includes(keyword)) {
        matchScore += 1;
      }
    }

    // Score based on level
    if (matchScore === 0) return 0;
    
    switch (criterion.scoreLevel) {
      case 'Low (1–3)':
        return matchScore >= 1 ? 2 : 1;
      case 'Mid (4–6)':
        return matchScore >= 2 ? 5 : 4;
      case 'High (7–10)':
        return matchScore >= 3 ? 9 : 7;
      default:
        return 5;
    }
  }

  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'to', 'from', 'in', 'on', 'at',
      'by', 'for', 'with', 'about', 'of', 'as', 'it', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how', 'and', 'or', 'but', 'not', 'so', 'if',
      'than', 'just', 'more', 'most', 'very', 'really', 'quite', 'too', 'also',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  }

  private extractEvidence(criterion: ScoringCriterion, text: string): string | null {
    // Try to find sentences that contain keywords from the criterion
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const keywords = this.extractKeywords(criterion.exampleAnswer + ' ' + criterion.sampleQuestion);
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      const matches = keywords.filter(kw => sentenceLower.includes(kw));
      if (matches.length >= 2) {
        return sentence.trim().substring(0, 150); // Limit length
      }
    }
    
    return null;
  }

  getIndicatorScore(id: number): IndicatorScore | undefined {
    return this.indicatorScores.get(id);
  }

  getAllScores(): IndicatorScore[] {
    return Array.from(this.indicatorScores.values());
  }
}

let scorerInstance: IndicatorScorer | null = null;

export function getIndicatorScorer(): IndicatorScorer {
  if (!scorerInstance) {
    scorerInstance = new IndicatorScorer();
  }
  return scorerInstance;
}

