/**
 * Job house cargo-row spans.
 * Base ratio when haz columns are shown:
 * container 1.3, package 1.3, pkgs/weight/volume/chargeable 0.8,
 * haz/UN/class/pkg 1.1, actions 0.8.
 * Actions stay 0.8; the other columns share the remaining 11.2 in that ratio
 * so the row always totals 12. Without haz columns, UN/class/pkg weight is
 * folded into the same ratio.
 */
export type HouseCargoSpans = {
  container: number;
  packageType: number;
  noOfPackages: number;
  gross: number;
  volume: number;
  chargeable: number;
  haz: number;
  un: number;
  className: number;
  pkg: number;
  actions: number;
};

const ACTIONS = 0.8;

export function oceanHouseCargoSpans(showHaz: boolean): HouseCargoSpans {
  if (showHaz) {
    return {
      container: 1.42,
      packageType: 1.42,
      noOfPackages: 0.88,
      gross: 0.88,
      volume: 0.88,
      chargeable: 0.88,
      haz: 1.21,
      un: 1.21,
      className: 1.21,
      pkg: 1.21,
      actions: ACTIONS,
    };
  }
  return {
    container: 2.11,
    packageType: 2.11,
    noOfPackages: 1.3,
    gross: 1.3,
    volume: 1.3,
    chargeable: 1.3,
    haz: 1.78,
    un: 0,
    className: 0,
    pkg: 0,
    actions: ACTIONS,
  };
}

export function airHouseCargoSpans(showHaz: boolean): HouseCargoSpans {
  if (showHaz) {
    return {
      container: 0,
      packageType: 1.64,
      noOfPackages: 1.01,
      gross: 1.01,
      volume: 1.01,
      chargeable: 1.01,
      haz: 1.38,
      un: 1.38,
      className: 1.38,
      pkg: 1.38,
      actions: ACTIONS,
    };
  }
  return {
    container: 0,
    packageType: 2.6,
    noOfPackages: 1.6,
    gross: 1.6,
    volume: 1.6,
    chargeable: 1.6,
    haz: 2.2,
    un: 0,
    className: 0,
    pkg: 0,
    actions: ACTIONS,
  };
}
