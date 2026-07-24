export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  VOIDED = 'VOIDED',
  ERROR = 'ERROR',
}

export const FINAL_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.APPROVED,
  TransactionStatus.DECLINED,
  TransactionStatus.VOIDED,
  TransactionStatus.ERROR,
];

export const isFinal = (status: TransactionStatus): boolean => FINAL_STATUSES.includes(status);

/** Only an approved payment consumes the reserved units; every other outcome releases them. */
export const releasesStock = (status: TransactionStatus): boolean =>
  status === TransactionStatus.DECLINED ||
  status === TransactionStatus.VOIDED ||
  status === TransactionStatus.ERROR;
