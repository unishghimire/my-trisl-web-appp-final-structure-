export enum Role {
  USER = 'player',
  ORG = 'organizer',
  ADMIN = 'admin'
}

export enum LedgerCategory {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  ENTRY_FEE = 'entry_fee',
  PRIZE = 'prize',
  REFUND = 'refund',
  ORGANIZER_SHARE = 'organizer_share',
  ADJUSTMENT = 'adjustment',
  PROMO = 'promo'
}

export enum LedgerType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT'
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
