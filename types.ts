
export enum PointType {
  MEN = 'M',
  KOTE = 'K',
  DO = 'D',
  TSUKI = 'T',
  HANSOKU = 'H',
  FUSEN = 'F',
  HANTEI = 'X',
}

export enum MatchStatus {
  PENDING = 'PENDING',
  ENCHO = 'ENCHO', // Overtime
  FUSEN_A_WINS = 'FUSEN_A_WINS', // Team A wins by forfeit
  FUSEN_B_WINS = 'FUSEN_B_WINS', // Team B wins by forfeit
  HIKIWAKE = 'HIKIWAKE', // Draw
  HANTEI_A_WINS = 'HANTEI_A_WINS', // Team A wins by decision
  HANTEI_B_WINS = 'HANTEI_B_WINS', // Team B wins by decision
  ENCHO_HIKIWAKE = 'ENCHO_HIKIWAKE', // Overtime Draw
}

export interface ScoredPoint {
  id: number;
  type: PointType;
  player: 'A' | 'B';
}

export interface Player {
  name: string;
  affiliation?: string;
}

export interface Match {
  playerA: Player;
  playerB: Player;
  points: ScoredPoint[];
  status: MatchStatus;
}

export type CalculatedMatchWinner = 'A' | 'B' | 'Draw' | null;

export interface CalculatedMatch extends Match {
    winner: CalculatedMatchWinner;
    resultText: string | null;
    pointsA: number;
    pointsB: number;
}

export interface TeamSummary {
  wins: number;
  ippons: number;
}

export interface SavedTeam {
  id: string;
  name: string;
  members: Player[];
  substitutes: Player[];
}

export interface HomeTeam extends SavedTeam {
  gameMode: 3 | 5 | 7;
  color: 'red' | 'white';
}

export interface TournamentInfo {
  name: string;
  date: string;
  venue: string;
  round?: string;
}

export interface PastMatch {
  id: number;
  tournamentInfo: TournamentInfo;
  teamA: SavedTeam;
  teamB: SavedTeam;
  homeTeamId: string;
  matches: CalculatedMatch[];
  daihyosenMatch: CalculatedMatch | null;
  summary: [TeamSummary, TeamSummary];
  winnerTeamName: string;
  timestamp: number;
  finalResult?: string;
  matchFormat: TeamMatchFormat;
  gameMode: 3 | 5 | 7;
}

// Individual Match Types
export type IndividualMatchType = 'IPPON' | 'SANBON';
export type TeamMatchFormat = 'POINT_MATCH' | 'KACHI_NUKI';

export interface IndividualMatch {
  playerA: Player; // White
  playerB: Player; // Red
  points: ScoredPoint[];
  status: MatchStatus;
  matchType: IndividualMatchType;
  tournamentInfo: TournamentInfo;
}
    
export interface CalculatedIndividualMatch extends IndividualMatch {
    winner: CalculatedMatchWinner;
    resultText: string | null;
    pointsA: number;
    pointsB: number;
}

export interface PastIndividualMatch {
  id: number;
  match: CalculatedIndividualMatch;
  timestamp: number;
  finalResult?: string;
}