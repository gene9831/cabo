// -------------------- 基础类型 --------------------

export interface Card {
  id: string; // 卡牌唯一ID
  value: number; // 数值（用于判定效果 / 计分）
}

export interface HandCard {
  card: Card;
  isFaceUp: boolean; // 是否正面可见
}

// -------------------- 玩家 --------------------

export interface Player {
  id: string; // 游戏内玩家 ID（非 userId）
  userId: string; // 关联 User 表
  hand: HandCard[]; // 手牌
  peekedAtSetup: boolean; // 是否在SETUP偷看过两张
}

// -------------------- 游戏 --------------------

export type GameStatus = 'PLAYING' | 'PAUSED' | 'ENDED' | 'ABANDONED';

export interface Game {
  id: string;
  status: GameStatus;
  createdAt: Date;
  updatedAt: Date;

  // 玩家信息
  playerIds: string[];
  currentPlayerIndex: number;

  // 牌堆
  deck: Card[];
  discardPile: Card[];

  // 进度
  round: number;
  phase: GamePhase;
  scores: number[][];
}

// -------------------------
// 游戏阶段（状态机）
// -------------------------

export type GamePhase =
  // SETUP
  | {
      type: 'SETUP';
    }

  // READY（已准备，等待 5 秒）
  | {
      type: 'READY';
      readyAt: number; // 时间戳（毫秒）— 用于 5 秒倒计时
    }

  // ACTION_CHOICE 正在选择动作：从牌堆或者弃牌堆抽牌 / 呼叫Cabo
  | {
      type: 'ACTION_CHOICE';
      playerId: string; // 当前行动玩家
    }

  //  DRAW 已抽到牌
  | {
      type: 'DRAW';
      playerId: string;
      drawnCard: Card; // 已抽到的卡
      from: 'DECK' | 'DISCARD'; // 从哪个堆抽到的
    }

  // DISCARD 已弃牌
  | {
      type: 'DISCARD';
      playerId: string;
      discardedCard: Card; // 弃掉的卡
      canUseSkill: boolean; // 是否可以使用技能
    }

  // PEEK 正在偷看自己的牌
  | {
      type: 'PEEK';
      playerId: string;
    }

  // SPY 正在偷看别人的牌
  | {
      type: 'SPY';
      playerId: string; // 发动技能者
    }

  //  SWAP 正在交换牌
  | {
      type: 'SWAP';
      playerId: string; // 发动技能者
    }

  // REPLACE 正在选择替换手牌
  | {
      type: 'REPLACE';
      playerId: string;
      drawnCard: Card; // 抽到的卡，等待选择替换
    }

  //  ROUND_END 本轮结束
  | {
      type: 'ROUND_END';
    };
