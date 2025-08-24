/**
 * 쿠폰 유효기간 타입
 */
export enum ValidityType {
  RELATIVE = 'RELATIVE', // 상대적 유효기간 (발급일로부터 N일)
  ABSOLUTE = 'ABSOLUTE', // 절대적 유효기간 (고정 날짜 범위)
}
