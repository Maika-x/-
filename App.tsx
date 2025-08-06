

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Match, PointType, MatchStatus, TeamSummary, CalculatedMatch, CalculatedMatchWinner, ScoredPoint, SavedTeam, TournamentInfo, Player, PastMatch, IndividualMatch, IndividualMatchType, CalculatedIndividualMatch, PastIndividualMatch, TeamMatchFormat } from './types';
import { TEAM_COMPOSITIONS, UI_TEXT, MATCH_STATUS_TEXT } from './constants';
import { ScoreSheet } from './components/ScoreSheet';
import { ResultModal } from './components/ResultModal';
import { TeamSetup, HomeTeamSetup, OpponentTeamSetup } from './components/TeamSetup';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { IndividualMatchSetup } from './components/IndividualMatchSetup';
import { IndividualScoreboard } from './components/IndividualScoreboard';
import { HistoryScreen } from './components/PastMatchesList';


// Initialize the Gemini AI model
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type Screen = 'home' | 'team_setup' | 'individual_setup' | 'history' | 'team_match' | 'individual_match';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  // --- Common State ---
  const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Team Match State ---
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [pastMatches, setPastMatches] = useState<PastMatch[]>([]);
  const [gameMode, setGameMode] = useState<3 | 5 | 7 | null>(null);
  const [matchFormat, setMatchFormat] = useState<TeamMatchFormat>('POINT_MATCH');
  const [teamA, setTeamA] = useState<SavedTeam | null>(null);
  const [teamB, setTeamB] = useState<SavedTeam | null>(null);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [daihyosenMatch, setDaihyosenMatch] = useState<Match | null>(null);
  const [teamToContinue, setTeamToContinue] = useState<{ team: SavedTeam, gameMode: 3 | 5 | 7, matchFormat: TeamMatchFormat } | null>(null);


  // --- Individual Match State ---
  const [individualMatch, setIndividualMatch] = useState<IndividualMatch | null>(null);
  const [pastIndividualMatches, setPastIndividualMatches] = useState<PastIndividualMatch[]>([]);


  useEffect(() => {
    try {
      const teamsData = localStorage.getItem('kendo-scoreboard-teams');
      if (teamsData) setSavedTeams(JSON.parse(teamsData));
      
      const pastMatchesData = localStorage.getItem('kendo-scoreboard-past-matches');
      if (pastMatchesData) setPastMatches(JSON.parse(pastMatchesData));
      
      const pastIndMatchesData = localStorage.getItem('kendo-scoreboard-past-individual-matches');
      if (pastIndMatchesData) setPastIndividualMatches(JSON.parse(pastIndMatchesData));

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  useEffect(() => {
    // Only save when there are teams to save, to avoid overwriting on initial load with empty array
    if (savedTeams.length > 0 || localStorage.getItem('kendo-scoreboard-teams')) {
      try {
        localStorage.setItem('kendo-scoreboard-teams', JSON.stringify(savedTeams));
      } catch (error) {
        console.error("Failed to save teams to localStorage", error);
      }
    }
  }, [savedTeams]);
  
  useEffect(() => {
    if (pastMatches.length > 0 || localStorage.getItem('kendo-scoreboard-past-matches')) {
      try {
        localStorage.setItem('kendo-scoreboard-past-matches', JSON.stringify(pastMatches));
      } catch (error) {
        console.error("Failed to save past matches to localStorage", error);
      }
    }
  }, [pastMatches]);

  useEffect(() => {
    if (pastIndividualMatches.length > 0 || localStorage.getItem('kendo-scoreboard-past-individual-matches')) {
      try {
        localStorage.setItem('kendo-scoreboard-past-individual-matches', JSON.stringify(pastIndividualMatches));
      } catch (error) {
        console.error("Failed to save past individual matches to localStorage", error);
      }
    }
  }, [pastIndividualMatches]);
  
  const goHome = useCallback(() => {
    setCurrentScreen('home');
    setTournamentInfo(null);
    setTeamA(null);
    setTeamB(null);
    setGameMode(null);
    setMatchFormat('POINT_MATCH');
    setHomeTeamId(null);
    setMatches([]);
    setDaihyosenMatch(null);
    setIndividualMatch(null);
    setIsFinished(false);
    setShowResultModal(false);
    setAnalysis(null);
    setIsAnalyzing(false);
    setTeamToContinue(null);
  }, []);

  const handleSetupComplete = (newTournamentInfo: TournamentInfo, homeTeamConfig: HomeTeamSetup, opponentTeamConfig: OpponentTeamSetup, newMatchFormat: TeamMatchFormat) => {
    // Reset previous match state
    setDaihyosenMatch(null);
    setIsFinished(false);
    setShowResultModal(false);
    setAnalysis(null);
    setIsAnalyzing(false);
    
    // Save/update teams and get their full objects
    let updatedTeams = [...savedTeams];
    const saveOrUpdateTeam = (config: HomeTeamSetup | OpponentTeamSetup): SavedTeam => {
      const existingIndex = config.id ? updatedTeams.findIndex(t => t.id === config.id) : -1;
      
      if (existingIndex > -1) {
        // Update existing team
        const updatedTeam = { ...updatedTeams[existingIndex], ...config.teamData };
        updatedTeams[existingIndex] = updatedTeam;
        return updatedTeam;
      } else {
        // Create new team
        const newTeam = { ...config.teamData, id: `${Date.now()}-${Math.random()}` };
        updatedTeams.push(newTeam);
        return newTeam;
      }
    };

    const homeTeamFull = saveOrUpdateTeam(homeTeamConfig);
    const opponentTeamFull = saveOrUpdateTeam(opponentTeamConfig);
    setSavedTeams(updatedTeams);
    setHomeTeamId(homeTeamFull.id);

    // Set new tournament and team config
    setTournamentInfo(newTournamentInfo);
    setGameMode(homeTeamConfig.gameMode);
    setMatchFormat(newMatchFormat);

    // Assign teams to A (White/Left) and B (Red/Right)
    const finalTeamA = homeTeamConfig.color === 'white' ? homeTeamFull : opponentTeamFull;
    const finalTeamB = homeTeamConfig.color === 'white' ? opponentTeamFull : homeTeamFull;
    setTeamA(finalTeamA);
    setTeamB(finalTeamB);

    if (newMatchFormat === 'KACHI_NUKI') {
      const initialMatch = {
        playerA: finalTeamA.members[0] || { name: '' },
        playerB: finalTeamB.members[0] || { name: '' },
        points: [],
        status: MatchStatus.PENDING,
      };
      setMatches([initialMatch]);
    } else {
      const initialMatches = Array.from({ length: homeTeamConfig.gameMode }, (_, i) => ({
          playerA: finalTeamA.members[i] || { name: '' },
          playerB: finalTeamB.members[i] || { name: '' },
          points: [],
          status: MatchStatus.PENDING,
      }));
      setMatches(initialMatches);
    }
    setCurrentScreen('team_match');
  };

  const handleMatchFormatChange = useCallback((newFormat: TeamMatchFormat) => {
    if (newFormat === matchFormat) return;

    if (window.confirm('試合形式を変更すると、現在のスコア記録がリセットされます。よろしいですか？\n(Changing the match format will reset the current score record. Are you sure?)')) {
        setMatchFormat(newFormat);
        setDaihyosenMatch(null);
        
        if (!teamA || !teamB || !gameMode) return;

        if (newFormat === 'KACHI_NUKI') {
            const initialMatch = {
                playerA: teamA.members[0] || { name: '' },
                playerB: teamB.members[0] || { name: '' },
                points: [],
                status: MatchStatus.PENDING,
            };
            setMatches([initialMatch]);
        } else { // POINT_MATCH
            const initialMatches = Array.from({ length: gameMode }, (_, i) => ({
                playerA: teamA.members[i] || { name: '' },
                playerB: teamB.members[i] || { name: '' },
                points: [],
                status: MatchStatus.PENDING,
            }));
            setMatches(initialMatches);
        }
    }
  }, [matchFormat, teamA, teamB, gameMode]);
  
  const handleSkipSetup = () => {
    const defaultGameMode = 5;
    const defaultMembers = Array.from({ length: defaultGameMode }, (): Player => ({ name: '', affiliation: '' }));

    const homeTeamSetup: HomeTeamSetup = {
        teamData: {
            name: UI_TEXT.TEAM_RED_DEFAULT,
            members: defaultMembers,
            substitutes: [],
        },
        gameMode: defaultGameMode,
        color: 'red',
    };

    const opponentTeamSetup: OpponentTeamSetup = {
        teamData: {
            name: UI_TEXT.TEAM_WHITE_DEFAULT,
            members: defaultMembers,
            substitutes: [],
        },
    };
    
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];

    handleSetupComplete(
        { name: '団体戦 (Team Match)', date: dateString, venue: '' },
        homeTeamSetup,
        opponentTeamSetup,
        'POINT_MATCH'
    );
  };
  
  const handleIndividualSetupComplete = (match: IndividualMatch) => {
    setIndividualMatch(match);
    setTournamentInfo(match.tournamentInfo);
    setIsFinished(false);
    setShowResultModal(false);
    setAnalysis(null);
    setIsAnalyzing(false);
    setCurrentScreen('individual_match');
  };

  const handleSkipIndividualSetup = () => {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];

    const defaultMatch: IndividualMatch = {
        tournamentInfo: { name: '個人戦 (Individual Match)', date: dateString, venue: '' },
        playerA: { name: UI_TEXT.TEAM_WHITE_DEFAULT, affiliation: '' }, // '白'
        playerB: { name: UI_TEXT.TEAM_RED_DEFAULT, affiliation: '' }, // '赤'
        points: [],
        status: MatchStatus.PENDING,
        matchType: 'SANBON',
    };
    
    handleIndividualSetupComplete(defaultMatch);
  };

  const calculateWinner = (match: Match | IndividualMatch, isDaihyosen: boolean = false): Omit<CalculatedMatch, keyof Match> => {
    // Handle special statuses first, as they override point calculations.
    if (match.status === MatchStatus.FUSEN_A_WINS) return { winner: 'A', pointsA: 2, pointsB: 0, resultText: MATCH_STATUS_TEXT[match.status] };
    if (match.status === MatchStatus.FUSEN_B_WINS) return { winner: 'B', pointsA: 0, pointsB: 2, resultText: MATCH_STATUS_TEXT[match.status] };
    if (match.status === MatchStatus.HANTEI_A_WINS) return { winner: 'A', pointsA: 1, pointsB: 0, resultText: MATCH_STATUS_TEXT[match.status] };
    if (match.status === MatchStatus.HANTEI_B_WINS) return { winner: 'B', pointsA: 0, pointsB: 1, resultText: MATCH_STATUS_TEXT[match.status] };
    
    // Calculate points from ippons and hansoku
    const directIpponsA = match.points.filter(p => p.player === 'A' && p.type !== PointType.HANSOKU).length;
    const hansokuCountA = match.points.filter(p => p.player === 'A' && p.type === PointType.HANSOKU).length;
    const directIpponsB = match.points.filter(p => p.player === 'B' && p.type !== PointType.HANSOKU).length;
    const hansokuCountB = match.points.filter(p => p.player === 'B' && p.type === PointType.HANSOKU).length;

    const totalPointsA = directIpponsA + Math.floor(hansokuCountB / 2);
    const totalPointsB = directIpponsB + Math.floor(hansokuCountA / 2);

    const isIndividual = 'matchType' in match;

    // --- Individual Match Logic ---
    if (isIndividual) {
        const individual = match as IndividualMatch;
        let winner: CalculatedMatchWinner = null;
        
        const pointLimit = individual.matchType === 'SANBON' ? 2 : 1;
        if (totalPointsA >= pointLimit) {
            winner = 'A';
        } else if (totalPointsB >= pointLimit) {
            winner = 'B';
        }
        
        // If match is finished by time (Hikiwake) and no one reached the point limit
        if (winner === null && match.status === MatchStatus.HIKIWAKE) {
            if (totalPointsA > totalPointsB) {
                winner = 'A';
            } else if (totalPointsB > totalPointsA) {
                winner = 'B';
            }
            // If points are equal, winner remains null, enforcing the "no draw" rule for individual matches.
            // The user must choose a Hantei winner or score in Encho.
        }

        let resultText: string | null = null;
        if (winner === 'A' || winner === 'B') {
            if (match.status === MatchStatus.ENCHO) {
                resultText = MATCH_STATUS_TEXT[MatchStatus.ENCHO];
            }
            // "Ippon Gachi" is for any 1-0 victory
            else if ((totalPointsA === 1 && totalPointsB === 0) || (totalPointsB === 1 && totalPointsA === 0)) {
                resultText = '一本勝';
            }
        }
        
        return { winner, pointsA: totalPointsA, pointsB: totalPointsB, resultText };
    }


    // --- Team Match & Daihyosen Logic ---
    let winner: CalculatedMatchWinner = null;
    const pointLimit = matchFormat === 'KACHI_NUKI' ? 1 : 2;

    if (totalPointsA >= pointLimit && !isDaihyosen) winner = 'A';
    else if (totalPointsB >= pointLimit && !isDaihyosen) winner = 'B';
    else if (totalPointsA > totalPointsB && match.status !== MatchStatus.PENDING && match.status !== MatchStatus.ENCHO) winner = 'A';
    else if (totalPointsB > totalPointsA && match.status !== MatchStatus.PENDING && match.status !== MatchStatus.ENCHO) winner = 'B';

    if (totalPointsA > 0 && isDaihyosen) winner = 'A';
    if (totalPointsB > 0 && isDaihyosen) winner = 'B';
    
    if (isDaihyosen) {
        // For Daihyosen, a winner is only decided by a point.
        // A draw is not possible in daihyosen.
        return { winner: winner, pointsA: totalPointsA, pointsB: totalPointsB, resultText: null };
    }

    if (match.status === MatchStatus.ENCHO_HIKIWAKE || match.status === MatchStatus.HIKIWAKE) {
      if (winner === null) {
        winner = 'Draw';
      }
      
      let resultText: string | null = null;
      if (winner === 'Draw' && totalPointsA === 0 && totalPointsB === 0) {
        resultText = MATCH_STATUS_TEXT[match.status];
      } else if ((totalPointsA === 1 && totalPointsB === 0) || (totalPointsB === 1 && totalPointsA === 0)) {
        resultText = '一本勝';
      }
      
      return { winner, pointsA: totalPointsA, pointsB: totalPointsB, resultText };
    }

    if (winner) {
        const resultText = (match.status === MatchStatus.ENCHO) ? MATCH_STATUS_TEXT[MatchStatus.ENCHO] : null;
        return { winner, pointsA: totalPointsA, pointsB: totalPointsB, resultText };
    }
    
    // Match is still pending, no winner yet
    return { winner: null, pointsA: totalPointsA, pointsB: totalPointsB, resultText: null };
  };

  const isMatchConcluded = (match: CalculatedMatch): boolean => {
    return match.winner !== null;
  }

  const calculatedMatches: CalculatedMatch[] = useMemo(() => 
    matches.map(match => ({ ...match, ...calculateWinner(match, false) })), 
  [matches, matchFormat]);

  const calculatedDaihyosen: CalculatedMatch | null = useMemo(() => 
    daihyosenMatch ? { ...daihyosenMatch, ...calculateWinner(daihyosenMatch, true) } : null,
  [daihyosenMatch]);
  
  const calculatedIndividualMatch: CalculatedIndividualMatch | null = useMemo(() =>
    individualMatch ? { ...individualMatch, ...calculateWinner(individualMatch, false) } : null,
  [individualMatch]);

  const getNextKachiNukiPlayerIndices = useCallback((matches: CalculatedMatch[]) => {
    let nextA = 0;
    let nextB = 0;
    for (const match of matches) {
      if (match.winner === 'A') {
        nextB++;
      } else if (match.winner === 'B') {
        nextA++;
      } else if (match.winner === 'Draw') {
        nextA++;
        nextB++;
      }
    }
    return { teamA: nextA, teamB: nextB };
  }, []);

  const teamSummary: [TeamSummary, TeamSummary] = useMemo(() => {
    const summaryA: TeamSummary = { wins: 0, ippons: 0 };
    const summaryB: TeamSummary = { wins: 0, ippons: 0 };
    
    const allMatches = calculatedDaihyosen ? [...calculatedMatches, calculatedDaihyosen] : calculatedMatches;

    if (matchFormat === 'KACHI_NUKI') {
      const indices = getNextKachiNukiPlayerIndices(allMatches.filter(m => m !== calculatedDaihyosen));
      summaryA.wins = indices.teamB;
      summaryB.wins = indices.teamA;
    } else { // POINT_MATCH
      allMatches.forEach(match => {
        if (match.winner === 'A') summaryA.wins++;
        if (match.winner === 'B') summaryB.wins++;
      });
    }

    allMatches.forEach(match => {
      summaryA.ippons += match.pointsA;
      summaryB.ippons += match.pointsB;
    });

    return [summaryA, summaryB];
  }, [calculatedMatches, calculatedDaihyosen, matchFormat, getNextKachiNukiPlayerIndices]);

  useEffect(() => {
    if (matchFormat !== 'KACHI_NUKI' || isFinished || !teamA || !teamB || !gameMode) return;

    const lastMatch = calculatedMatches[calculatedMatches.length - 1];
    if (lastMatch && isMatchConcluded(lastMatch)) {
      const nextPlayerIndices = getNextKachiNukiPlayerIndices(calculatedMatches);

      const isGameOver = nextPlayerIndices.teamA >= gameMode || nextPlayerIndices.teamB >= gameMode;

      if (!isGameOver) {
        const nextMatch: Match = {
          playerA: teamA.members[nextPlayerIndices.teamA],
          playerB: teamB.members[nextPlayerIndices.teamB],
          points: [],
          status: MatchStatus.PENDING,
        };
        // Add next match only if it hasn't been added yet
        if (matches.length === calculatedMatches.length) {
          setMatches(prev => [...prev, nextMatch]);
        }
      }
    }
  }, [calculatedMatches, matchFormat, isFinished, teamA, teamB, gameMode, matches.length, getNextKachiNukiPlayerIndices]);

  const handleStartDaihyosen = useCallback(() => {
    if (daihyosenMatch || matches.length === 0) return;

    const taishoMatch = matches[matches.length - 1];
    setDaihyosenMatch({
      playerA: taishoMatch?.playerA || { name: UI_TEXT.REPRESENTATIVE },
      playerB: taishoMatch?.playerB || { name: UI_TEXT.REPRESENTATIVE },
      points: [],
      status: MatchStatus.PENDING,
    });
    setShowResultModal(false);
    setIsFinished(false);
  }, [matches, daihyosenMatch]);

  const updatePlayer = useCallback((index: number, team: 'A' | 'B', player: Player, isDaihyosen: boolean) => {
    const updater = (prev: Match | null): Match | null => {
      if (!prev) return null;
      const playerToUpdate = team === 'A' ? 'playerA' : 'playerB';
      return {
        ...prev,
        [playerToUpdate]: player,
      };
    };

    if (isDaihyosen) {
      setDaihyosenMatch(updater);
    } else {
      setMatches(prevMatches => {
        const newMatches = [...prevMatches];
        const matchToUpdate = newMatches[index];
        if (!matchToUpdate) return prevMatches;
        newMatches[index] = updater(matchToUpdate) as Match;
        return newMatches;
      });
    }
  }, []);


  const handleTeamNameChange = (team: 'A' | 'B', name: string) => {
    const teamToUpdate = team === 'A' ? teamA : teamB;
    if (!teamToUpdate) return;
    
    const updatedTeam = { ...teamToUpdate, name };
    if (team === 'A') setTeamA(updatedTeam);
    else setTeamB(updatedTeam);
    
    setSavedTeams(prev => prev.map(st => st.id === updatedTeam.id ? updatedTeam : st));
  };

  const addPoint = useCallback((matchIndex: number, player: 'A' | 'B', type: PointType, isDaihyosen: boolean) => {
    const updater = (match: Match): Match => {
        if (type !== PointType.HANSOKU) {
            const pointLimit = matchFormat === 'KACHI_NUKI' ? 1 : 2;
            const directIppons = match.points.filter(p => p.player === player && p.type !== PointType.HANSOKU).length;
            if (directIppons >= pointLimit && !isDaihyosen) return match;
            if (directIppons >= 1 && isDaihyosen) return match;
        }
        const newPoint: ScoredPoint = { id: Date.now(), player, type };
        const newStatus = match.status === MatchStatus.ENCHO ? MatchStatus.ENCHO : MatchStatus.PENDING;
        return { ...match, points: [...match.points, newPoint], status: newStatus };
    };

    if (isDaihyosen) {
        setDaihyosenMatch(prev => prev ? updater(prev) : null);
    } else {
        setMatches(prev => {
            const newMatches = [...prev];
            newMatches[matchIndex] = updater(newMatches[matchIndex]);
            return newMatches;
        });
    }
  }, [matchFormat]);
  
  const updateIndividualMatch = (updater: (match: IndividualMatch) => IndividualMatch) => {
    setIndividualMatch(prev => prev ? updater(prev) : null);
  };

  const addIndividualPoint = useCallback((player: 'A' | 'B', type: PointType) => {
    updateIndividualMatch(match => {
      if (type !== PointType.HANSOKU) {
        const directIppons = match.points.filter(p => p.player === player && p.type !== PointType.HANSOKU).length;
        const limit = match.matchType === 'SANBON' ? 2 : 1;
        if (directIppons >= limit) return match;
      }
      const newPoint: ScoredPoint = { id: Date.now(), player, type };
      const newStatus = match.status === MatchStatus.ENCHO ? MatchStatus.ENCHO : MatchStatus.PENDING;
      return { ...match, points: [...match.points, newPoint], status: newStatus };
    });
  }, []);

  const undoPoint = useCallback((matchIndex: number, player: 'A' | 'B', isDaihyosen: boolean) => {
    const updater = (match: Match): Match => {
        const newPoints = [...match.points];
        let pointIndexToRemove = -1;
        for (let i = newPoints.length - 1; i >= 0; i--) {
            if (newPoints[i].player === player) {
                pointIndexToRemove = i;
                break;
            }
        }
        if (pointIndexToRemove > -1) {
            newPoints.splice(pointIndexToRemove, 1);
        }
        const newStatus = match.status === MatchStatus.ENCHO ? MatchStatus.ENCHO : MatchStatus.PENDING;
        return { ...match, points: newPoints, status: newStatus };
    };

    if (isDaihyosen) {
        setDaihyosenMatch(prev => prev ? updater(prev) : null);
    } else {
        setMatches(prev => {
            const newMatches = [...prev];
            newMatches[matchIndex] = updater(newMatches[matchIndex]);
            return newMatches;
        });
    }
  }, []);
  
  const undoIndividualPoint = useCallback((player: 'A' | 'B') => {
    updateIndividualMatch(match => {
      const newPoints = [...match.points];
      let pointIndexToRemove = -1;
      for (let i = newPoints.length - 1; i >= 0; i--) {
        if (newPoints[i].player === player) {
          pointIndexToRemove = i;
          break;
        }
      }
      if (pointIndexToRemove > -1) {
        newPoints.splice(pointIndexToRemove, 1);
      }
      const newStatus = match.status === MatchStatus.ENCHO ? MatchStatus.ENCHO : MatchStatus.PENDING;
      return { ...match, points: newPoints, status: newStatus };
    });
  }, []);

  const updateMatchStatus = useCallback((index: number, status: MatchStatus) => {
    setMatches(prev => {
      const newMatches = [...prev];
      const match = { ...newMatches[index] };

      const wasSpecial = match.status.startsWith('FUSEN') || match.status.startsWith('HANTEI');

      if (status === MatchStatus.FUSEN_A_WINS) {
        match.points = [{id: Date.now(), type: PointType.FUSEN, player: 'A'}];
      } else if (status === MatchStatus.FUSEN_B_WINS) {
        match.points = [{id: Date.now(), type: PointType.FUSEN, player: 'B'}];
      } else if (status === MatchStatus.HANTEI_A_WINS) {
        match.points = [{id: Date.now(), type: PointType.HANTEI, player: 'A'}];
      } else if (status === MatchStatus.HANTEI_B_WINS) {
        match.points = [{id: Date.now(), type: PointType.HANTEI, player: 'B'}];
      } else if (wasSpecial) {
        match.points = [];
      }
      
      match.status = status;
      newMatches[index] = match;
      return newMatches;
    });
  }, []);

  const updateIndividualMatchStatus = useCallback((status: MatchStatus) => {
    updateIndividualMatch(match => {
        const newMatch = { ...match };
         const wasSpecial = newMatch.status.startsWith('FUSEN') || newMatch.status.startsWith('HANTEI');

        if (status === MatchStatus.FUSEN_A_WINS) {
            newMatch.points = [{id: Date.now(), type: PointType.FUSEN, player: 'A'}];
        } else if (status === MatchStatus.FUSEN_B_WINS) {
            newMatch.points = [{id: Date.now(), type: PointType.FUSEN, player: 'B'}];
        } else if (status === MatchStatus.HANTEI_A_WINS) {
            newMatch.points = [{id: Date.now(), type: PointType.HANTEI, player: 'A'}];
        } else if (status === MatchStatus.HANTEI_B_WINS) {
            newMatch.points = [{id: Date.now(), type: PointType.HANTEI, player: 'B'}];
        } else if (wasSpecial) {
            newMatch.points = [];
        }
        
        newMatch.status = status;
        return newMatch;
    });
  }, []);

  const handleIndividualTournamentInfoChange = useCallback((field: keyof TournamentInfo, value: string) => {
    updateIndividualMatch(match => {
        if (!match) return match;
        return {
            ...match,
            tournamentInfo: {
                ...match.tournamentInfo,
                [field]: value,
            },
        };
    });
  }, []);

  const handleTeamTournamentInfoChange = useCallback((field: keyof TournamentInfo, value: string) => {
    setTournamentInfo(prev => {
        if (!prev) return null;
        return {
            ...prev,
            [field]: value,
        };
    });
  }, []);


  const handleAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysis(null);

    let prompt = '';
    if (currentScreen === 'team_match' && teamA && teamB && gameMode && tournamentInfo) {
      const [summaryA, summaryB] = teamSummary;
      let winnerText = '';
      if (summaryA.wins > summaryB.wins) winnerText = `${teamA.name} wins.`;
      else if (summaryB.wins > summaryA.wins) winnerText = `${teamB.name} wins.`;
      else if (summaryA.ippons > summaryB.ippons) winnerText = `${teamA.name} wins on points.`;
      else if (summaryB.ippons > summaryA.ippons) winnerText = `${teamB.name} wins on points.`;
      else winnerText = 'Draw.';
      
      if (calculatedDaihyosen?.winner) {
          winnerText = `${calculatedDaihyosen.winner === 'A' ? teamA.name : teamB.name} wins in a tie-breaker.`;
      }

      const matchDetails = [...calculatedMatches, calculatedDaihyosen]
        .filter((m): m is CalculatedMatch => !!m)
        .map((match, i) => {
            const pos = matchFormat === 'KACHI_NUKI' ? `Match ${i+1}` : (i < matches.length ? TEAM_COMPOSITIONS[gameMode].positions[i] : UI_TEXT.REPRESENTATIVE);
            const winnerName = match.winner === 'A' ? match.playerA.name : (match.winner === 'B' ? match.playerB.name : 'Draw');
            const playerADetail = `${match.playerA.name}${match.playerA.affiliation ? ` (${match.playerA.affiliation})` : ''}`;
            const playerBDetail = `${match.playerB.name}${match.playerB.affiliation ? ` (${match.playerB.affiliation})` : ''}`;
            return `${pos}: ${playerADetail} vs ${playerBDetail} - Winner: ${winnerName}, Score: ${match.pointsA}-${match.pointsB}`;
        }).join('\n');
      
      const tournamentRoundInfo = tournamentInfo.round ? ` - ${tournamentInfo.round}` : '';
      prompt = `You are a Kendo match commentator. Analyze the following team match result and provide a brief, encouraging summary in Japanese.

Tournament: ${tournamentInfo.name}${tournamentRoundInfo} (${tournamentInfo.date} at ${tournamentInfo.venue})
Match Format: ${matchFormat === 'KACHI_NUKI' ? 'Kachi-nuki (Elimination)' : 'Point Match'}
Match between ${teamA.name} (White) and ${teamB.name} (Red).

Final Result: ${winnerText}
- ${teamA.name}: ${summaryA.wins} wins, ${summaryA.ippons} total points.
- ${teamB.name}: ${summaryB.wins} wins, ${summaryB.ippons} total points.

Individual Match details:
${matchDetails}

Provide a short analysis (2-3 sentences) of the match, highlighting key moments or player performances. Keep the tone positive and respectful to both teams. Output only the analysis text.`;
    } else if (currentScreen === 'individual_match' && calculatedIndividualMatch) {
        const { playerA, playerB, winner, pointsA, pointsB, matchType, tournamentInfo: matchTournamentInfo } = calculatedIndividualMatch;
        let winnerText = '引き分け';
        if (winner === 'A') winnerText = `${playerA.name}の勝利`;
        else if (winner === 'B') winnerText = `${playerB.name}の勝利`;
        
        const pointsDetail = `(${pointsA} - ${pointsB})`;
        const roundInfo = matchTournamentInfo.round ? `\n試合: ${matchTournamentInfo.round}` : '';
        const playerADetail = `${playerA.name}${playerA.affiliation ? ` (${playerA.affiliation})` : ''}`;
        const playerBDetail = `${playerB.name}${playerB.affiliation ? ` (${playerB.affiliation})` : ''}`;

        prompt = `You are a Kendo match commentator. Analyze the following individual match result and provide a brief, encouraging summary in Japanese.

大会: ${matchTournamentInfo.name} (${matchTournamentInfo.date} @ ${matchTournamentInfo.venue})
対戦: ${playerADetail} (白) vs ${playerBDetail} (赤)${roundInfo}
形式: ${matchType === 'SANBON' ? '三本勝負' : '一本勝負'}

最終結果: ${winnerText} ${pointsDetail}

Provide a short analysis (2-3 sentences) of the match. Keep the tone positive and respectful to both players. Output only the analysis text.`;
    } else {
      setIsAnalyzing(false);
      return;
    }


    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        setAnalysis(response.text);
    } catch (error) {
        console.error("AI analysis failed:", error);
        setAnalysis("分析中にエラーが発生しました。(An error occurred during analysis.)");
    } finally {
        setIsAnalyzing(false);
    }
  }, [currentScreen, teamSummary, teamA, teamB, calculatedMatches, calculatedDaihyosen, gameMode, matches.length, tournamentInfo, calculatedIndividualMatch, matchFormat]);
  
  const handleShowResultModal = useCallback(() => {
    setIsFinished(true);
    setShowResultModal(true);
  }, []);

  const saveTeamMatch = useCallback((finalResult: string) => {
    if (tournamentInfo && teamA && teamB && homeTeamId && gameMode) {
        const [currentSummaryA, currentSummaryB] = teamSummary;

        let winnerTeamName = '引き分け';

        if (calculatedDaihyosen?.winner) {
            winnerTeamName = `${calculatedDaihyosen.winner === 'A' ? teamA.name : teamB.name} の勝利 (代表選)`;
        } else {
            if (currentSummaryA.wins > currentSummaryB.wins) winnerTeamName = `${teamA.name} の勝利`;
            else if (currentSummaryB.wins > currentSummaryA.wins) winnerTeamName = `${teamB.name} の勝利`;
            else if (currentSummaryA.ippons > currentSummaryB.ippons) winnerTeamName = `${teamA.name} の勝利 (本数勝)`;
            else if (currentSummaryB.ippons > currentSummaryA.ippons) winnerTeamName = `${teamB.name} の勝利 (本数勝)`;
        }
        
        const newPastMatch: PastMatch = {
            id: Date.now(),
            tournamentInfo, teamA, teamB, homeTeamId,
            matches: calculatedMatches,
            daihyosenMatch: calculatedDaihyosen,
            summary: teamSummary,
            winnerTeamName,
            timestamp: Date.now(),
            finalResult: finalResult.trim() || undefined,
            matchFormat: matchFormat,
            gameMode: gameMode,
        };
        
        setPastMatches(prev => [newPastMatch, ...prev.filter(p => p.id !== newPastMatch.id)]);
      }
  }, [teamSummary, teamA, teamB, calculatedMatches, calculatedDaihyosen, tournamentInfo, homeTeamId, matchFormat, gameMode]);

  const handleSaveAndReset = (finalResult: string) => {
      saveTeamMatch(finalResult);
      goHome();
  };

  const handleSaveAndNextMatch = (finalResult: string) => {
      saveTeamMatch(finalResult);
      handleNextMatch();
  };
  
  const handleSaveAndClose = (finalResult: string) => {
      saveTeamMatch(finalResult);
      setShowResultModal(false);
  };
  
  const handleSaveIndividualMatchAndReset = useCallback((finalResult: string) => {
    if (!calculatedIndividualMatch) return;
    const newPastMatch: PastIndividualMatch = {
        id: Date.now(),
        match: calculatedIndividualMatch,
        timestamp: Date.now(),
        finalResult: finalResult.trim() || undefined,
    };
    setPastIndividualMatches(prev => [newPastMatch, ...prev]);
    goHome();
  }, [calculatedIndividualMatch, goHome]);

  const handleEditMatch = useCallback(() => {
    setIsFinished(false);
    setShowResultModal(false);
  }, []);
  
  const handleDeletePastMatch = useCallback((id: number) => {
    if (window.confirm('この試合結果を本当に削除しますか？')) {
      setPastMatches(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const handleDeletePastIndividualMatch = useCallback((id: number) => {
    if (window.confirm('この試合結果を本当に削除しますか？')) {
      setPastIndividualMatches(prev => prev.filter(p => p.id !== id));
    }
  }, []);
  
  const handleLoadPastMatch = useCallback((pastMatch: PastMatch) => {
      setTournamentInfo(pastMatch.tournamentInfo);
      setTeamA(pastMatch.teamA);
      setTeamB(pastMatch.teamB);
      
      const loadedMatches = pastMatch.matches.map(({ winner, resultText, pointsA, pointsB, ...match }) => match);
      setMatches(loadedMatches);
      
      const loadedDaihyosen = pastMatch.daihyosenMatch ? (({ winner, resultText, pointsA, pointsB, ...match }) => match)(pastMatch.daihyosenMatch) : null;
      setDaihyosenMatch(loadedDaihyosen);
      
      setGameMode(pastMatch.gameMode);
      setMatchFormat(pastMatch.matchFormat || 'POINT_MATCH');
      setHomeTeamId(pastMatch.homeTeamId);

      setIsFinished(false);
      setShowResultModal(false);
      setAnalysis(null);
      setIsAnalyzing(false);
      
      setCurrentScreen('team_match');
  }, []);

  const handleNextMatch = useCallback(() => {
    if (!teamA || !teamB || !gameMode) return;

    const [summaryA, summaryB] = teamSummary;
    let winnerSide: 'A' | 'B' | null = null;
    if (calculatedDaihyosen?.winner) {
        if (calculatedDaihyosen.winner !== 'Draw') {
            winnerSide = calculatedDaihyosen.winner;
        }
    } else {
        if (summaryA.wins > summaryB.wins) winnerSide = 'A';
        else if (summaryB.wins > summaryA.wins) winnerSide = 'B';
        else if (summaryA.ippons > summaryB.ippons) winnerSide = 'A';
        else if (summaryB.ippons > summaryA.ippons) winnerSide = 'B';
    }

    const winningTeamData = winnerSide === 'A' ? teamA : winnerSide === 'B' ? teamB : null;

    if (!winningTeamData || !winnerSide) {
        goHome();
        return;
    }

    const finalMembers = calculatedMatches.map(match => winnerSide === 'A' ? match.playerA : match.playerB);

    const teamWithFinalRoster: SavedTeam = {
        ...winningTeamData,
        members: finalMembers,
    };
    
    const existingTournamentInfo = { ...tournamentInfo };
    
    // Partial reset for next match, then go to team setup
    goHome();
    setTournamentInfo(existingTournamentInfo as TournamentInfo);
    setTeamToContinue({ team: teamWithFinalRoster, gameMode, matchFormat });
    setCurrentScreen('team_setup');

  }, [teamA, teamB, gameMode, teamSummary, calculatedMatches, calculatedDaihyosen, tournamentInfo, goHome, matchFormat]);


  // --- Render Logic ---

  switch (currentScreen) {
    case 'home':
      return <ModeSelectionScreen 
        onStartTeamMatch={() => setCurrentScreen('team_setup')} 
        onStartIndividualMatch={() => setCurrentScreen('individual_setup')}
        onViewHistory={() => setCurrentScreen('history')}
      />;

    case 'history':
        return <HistoryScreen
            pastMatches={pastMatches}
            pastIndividualMatches={pastIndividualMatches}
            onLoadPastMatch={handleLoadPastMatch}
            onDeletePastMatch={handleDeletePastMatch}
            onDeletePastIndividualMatch={handleDeletePastIndividualMatch}
            onBack={goHome}
        />;

    case 'team_setup':
      return <TeamSetup 
                savedTeams={savedTeams}
                setSavedTeams={setSavedTeams}
                onSetupComplete={handleSetupComplete} 
                onSkipSetup={handleSkipSetup}
                onBack={goHome}
                teamToContinue={teamToContinue}
              />;

    case 'team_match': {
        if (!teamA || !teamB || !gameMode || !tournamentInfo || !homeTeamId) {
            useEffect(() => { goHome() }, [goHome]);
            return null; // or loading spinner
        }
      
        const allRegularMatchesConcluded = matchFormat === 'POINT_MATCH' 
            ? calculatedMatches.every(isMatchConcluded)
            : (getNextKachiNukiPlayerIndices(calculatedMatches).teamA >= gameMode || getNextKachiNukiPlayerIndices(calculatedMatches).teamB >= gameMode);

        const isDaihyosenActive = daihyosenMatch !== null;
        const opponentTeam = homeTeamId === teamA.id ? teamB : teamA;
        const matchTitle = `(対 ${teamA.id === teamB.id ? opponentTeam.name + " (複製)" : opponentTeam.name}戦)`;

        const [summaryA, summaryB] = teamSummary;

        const isTie = allRegularMatchesConcluded && !isDaihyosenActive && (
          (matchFormat === 'POINT_MATCH' && summaryA.wins === summaryB.wins && summaryA.ippons === summaryB.ippons) ||
          (matchFormat === 'KACHI_NUKI' && calculatedMatches[calculatedMatches.length - 1]?.winner === 'Draw')
        );
        
        let winner: 'A' | 'B' | 'Draw' | null = null;
        
        if (allRegularMatchesConcluded) {
            if (matchFormat === 'KACHI_NUKI') {
                const indices = getNextKachiNukiPlayerIndices(calculatedMatches);
                if (indices.teamA >= gameMode) winner = 'B';
                else if (indices.teamB >= gameMode) winner = 'A';
                else if (isTie) winner = 'Draw';
            } else {
                if (summaryA.wins > summaryB.wins) winner = 'A';
                else if (summaryB.wins > summaryA.wins) winner = 'B';
                else if (summaryA.ippons > summaryB.ippons) winner = 'A';
                else if (summaryB.ippons > summaryA.ippons) winner = 'B';
                else winner = 'Draw';
            }
        }
        
        if (calculatedDaihyosen?.winner && calculatedDaihyosen.winner !== 'Draw') {
          winner = calculatedDaihyosen.winner;
        }

        const homeTeamWon = (teamA?.id === homeTeamId && winner === 'A') || (teamB?.id === homeTeamId && winner === 'B');

        return (
          <div className="bg-[#f8f6f2] min-h-screen">
            <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6 lg:p-8">
              <header className="text-center mb-4 sm:mb-6">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-800 tracking-tight">{tournamentInfo.name}</h1>
                  
                  {isFinished && tournamentInfo.round ? (
                    <p className="text-lg sm:text-xl text-gray-600 font-bold mt-2">{tournamentInfo.round}</p>
                  ) : (
                    <div className="mt-2 flex justify-center items-center gap-2">
                      <label htmlFor="round-input-team" className="text-lg sm:text-xl text-gray-600 font-bold">回戦:</label>
                      <input
                        id="round-input-team"
                        type="text"
                        value={tournamentInfo.round || ''}
                        placeholder="例: 一回戦、決勝"
                        disabled={isFinished}
                        onChange={(e) => handleTeamTournamentInfoChange('round', e.target.value)}
                        list="round-options-list"
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white text-lg sm:text-xl text-gray-600 font-bold text-center w-48"
                      />
                      <datalist id="round-options-list">
                          <option value="予選リーグ" />
                          <option value="一回戦" />
                          <option value="二回戦" />
                          <option value="三回戦" />
                          <option value="四回戦" />
                          <option value="五回戦" />
                          <option value="六回戦" />
                          <option value="七回戦" />
                          <option value="準々決勝" />
                          <option value="準決勝" />
                          <option value="決勝" />
                          <option value="順位決定戦" />
                      </datalist>
                    </div>
                  )}

                  <p className="text-base sm:text-lg text-gray-500 mt-2">
                    {tournamentInfo.date} @ {tournamentInfo.venue}
                  </p>
              </header>
              
              <main className="bg-[#FFFEFD] rounded-2xl shadow-lg p-3 sm:p-6">
                <ScoreSheet
                  matchTitle={matchTitle}
                  teamA={teamA}
                  teamB={teamB}
                  onTeamNameChange={handleTeamNameChange}
                  playerPositions={TEAM_COMPOSITIONS[gameMode].positions}
                  matches={calculatedMatches}
                  daihyosenMatch={calculatedDaihyosen}
                  summary={teamSummary}
                  winner={winner}
                  isFinished={isFinished}
                  isDaihyosenActive={isDaihyosenActive}
                  onPlayerChange={updatePlayer}
                  onAddPoint={addPoint}
                  onUndoPoint={undoPoint}
                  onStatusChange={updateMatchStatus}
                  matchFormat={matchFormat}
                  onMatchFormatChange={handleMatchFormatChange}
                />
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                      <button
                        onClick={goHome}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
                        >
                        トップに戻る (Back to Top)
                      </button>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end items-center gap-4 w-full sm:w-auto">
                      {isFinished ? (
                        <button
                          onClick={handleEditMatch}
                          className="w-full sm:w-auto px-6 py-2.5 text-base sm:text-lg sm:px-8 sm:py-3 bg-gray-600 text-white font-bold rounded-lg shadow-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          試合を編集 (Edit Match)
                        </button>
                      ) : (
                        <>
                          {isTie && (
                            <button
                              onClick={handleStartDaihyosen}
                              className="w-full sm:w-auto px-6 py-2.5 text-base sm:text-lg sm:px-8 sm:py-3 bg-yellow-500 text-gray-900 font-bold rounded-lg shadow-md hover:bg-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              代表選を開始 (Start Tie-breaker)
                            </button>
                          )}
                          <button
                            onClick={handleShowResultModal}
                            disabled={!allRegularMatchesConcluded || (isDaihyosenActive && !calculatedDaihyosen?.winner)}
                            className="w-full sm:w-auto px-6 py-2.5 text-base sm:text-lg sm:px-8 sm:py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            試合終了 (Finish Match)
                          </button>
                        </>
                      )}
                  </div>
                </div>
              </main>

              <footer className="text-center mt-6 sm:mt-8 text-gray-500 text-sm">
                <p>Created by Maika</p>
              </footer>
            </div>
            <ResultModal
              isOpen={showResultModal}
              onSaveAndClose={handleSaveAndClose}
              onEdit={handleEditMatch}
              onSaveAndReset={handleSaveAndReset}
              onSaveAndNextMatch={handleSaveAndNextMatch}
              onDaihyosen={handleStartDaihyosen}
              teamAName={teamA.name}
              teamBName={teamB.name}
              teamASummary={summaryA}
              teamBSummary={summaryB}
              daihyosenFinished={isDaihyosenActive && !!calculatedDaihyosen?.winner}
              onAnalysis={handleAnalysis}
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              didHomeTeamWin={homeTeamWon}
            />
          </div>
        );
      }

    case 'individual_setup':
       return <IndividualMatchSetup 
                  onSetupComplete={handleIndividualSetupComplete} 
                  onSkipIndividualSetup={handleSkipIndividualSetup}
                  onBack={goHome}
                  savedTeams={savedTeams}
              />;
              
    case 'individual_match': {
        if (!calculatedIndividualMatch) {
            useEffect(() => { goHome() }, [goHome]);
            return null;
        }

        return (
           <IndividualScoreboard 
              match={calculatedIndividualMatch}
              onAddPoint={(player, type) => addIndividualPoint(player, type)}
              onUndoPoint={(player) => undoIndividualPoint(player)}
              onStatusChange={updateIndividualMatchStatus}
              onShowResultModal={handleShowResultModal}
              onSaveAndReset={handleSaveIndividualMatchAndReset}
              isFinished={isFinished}
              onEdit={handleEditMatch}
              onAnalysis={handleAnalysis}
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              showResultModal={showResultModal}
              onCloseResultModal={() => setShowResultModal(false)}
              onTournamentInfoChange={handleIndividualTournamentInfoChange}
            />
        );
      }
    
    default:
      goHome();
      return null;
  }
};

export default App;