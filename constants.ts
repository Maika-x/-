import { PointType, MatchStatus } from './types';

export const TEAM_COMPOSITIONS: { [key in 3 | 5 | 7]: { positions: string[], placeholders: string[] } } = {
  5: {
    positions: ['先鋒', '次鋒', '中堅', '副将', '大将'],
    placeholders: ['選手1', '選手2', '選手3', '選手4', '選手5'],
  },
  3: {
    positions: ['先鋒', '中堅', '大将'],
    placeholders: ['選手1', '選手2', '選手3'],
  },
  7: {
    positions: ['先鋒', '次鋒', '五将', '中堅', '三将', '副将', '大将'],
    placeholders: ['選手1', '選手2', '選手3', '選手4', '選手5', '選手6', '選手7'],
  },
};

export const UI_TEXT = {
    TEAM_RED_DEFAULT: '赤',
    TEAM_WHITE_DEFAULT: '白',
    SUMMARY: '成績',
    REPRESENTATIVE: '代表',
    WIN_BY_FORFEIT: '不戦勝',
    DRAW: '引分',
};

export const POINT_TYPE_DETAILS: { [key in PointType]: { label: string; name:string } } = {
    [PointType.MEN]: { label: 'メ', name: 'Men' },
    [PointType.KOTE]: { label: 'コ', name: 'Kote' },
    [PointType.DO]: { label: 'ド', name: 'Do' },
    [PointType.TSUKI]: { label: 'ツ', name: 'Tsuki' },
    [PointType.HANSOKU]: { label: '▲', name: 'Hansoku' },
    [PointType.FUSEN]: { label: '不', name: 'Fusen' },
    [PointType.HANTEI]: { label: '判', name: 'Hantei' },
};

export const SCORING_POINT_TYPES: PointType[] = [PointType.MEN, PointType.KOTE, PointType.DO, PointType.TSUKI];

export const ALL_POINT_TYPES: PointType[] = [PointType.MEN, PointType.KOTE, PointType.DO, PointType.TSUKI, PointType.HANSOKU];

export const MATCH_STATUS_TEXT: { [key in MatchStatus]: string } = {
    [MatchStatus.PENDING]: '進行中(戻る)',
    [MatchStatus.ENCHO]: '延長',
    [MatchStatus.FUSEN_A_WINS]: '白 不戦勝',
    [MatchStatus.FUSEN_B_WINS]: '赤 不戦勝',
    [MatchStatus.HIKIWAKE]: '引き分け',
    [MatchStatus.HANTEI_A_WINS]: '白 判定勝',
    [MatchStatus.HANTEI_B_WINS]: '赤 判定勝',
    [MatchStatus.ENCHO_HIKIWAKE]: '延長引分',
};
