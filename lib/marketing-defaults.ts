export type MarketingTimingDefaults = {
  generalCampaignLengthDays: number;
  songCampaignAdvanceDays: number;
  songCampaignLengthDays: number;
};

export const fallbackMarketingTimingDefaults: MarketingTimingDefaults = {
  generalCampaignLengthDays: 14,
  songCampaignAdvanceDays: 3,
  songCampaignLengthDays: 14
};

export function validateMarketingTimingDefaults(value: MarketingTimingDefaults) {
  const { generalCampaignLengthDays, songCampaignAdvanceDays, songCampaignLengthDays } = value;
  return Number.isInteger(songCampaignLengthDays) && songCampaignLengthDays > 0 &&
    Number.isInteger(generalCampaignLengthDays) && generalCampaignLengthDays > 0 &&
    Number.isInteger(songCampaignAdvanceDays) && songCampaignAdvanceDays >= 0 &&
    songCampaignAdvanceDays < songCampaignLengthDays;
}

export function songCampaignOffsets({ songCampaignAdvanceDays, songCampaignLengthDays }: Pick<MarketingTimingDefaults, "songCampaignAdvanceDays" | "songCampaignLengthDays">) {
  return Array.from({ length: songCampaignLengthDays }, (_, index) => index - songCampaignAdvanceDays);
}

export function addMarketingDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function proposedGeneralCampaignEndDate(startDate: string, lengthDays: number) {
  return addMarketingDays(startDate, lengthDays - 1);
}
