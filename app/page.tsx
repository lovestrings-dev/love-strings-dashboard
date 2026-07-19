"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { forwardRef } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock3,
  Disc3,
  Headphones,
  Link as LinkIcon,
  MapPin,
  Upload,
  Music2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Video
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Section = (typeof sections)[number];
type MarketingStatus = "not-started" | "in-progress" | "done" | "irrelevant";
type CampaignDayProgressStatus = "empty" | "partial" | "complete";
type ProductionBudgetLine = {
  id: string;
  amount: number;
  bucket?: BudgetSourceBucket;
  description: string;
};
type ExtraCampaignTask = {
  id: string;
  budgetLines?: ProductionBudgetLine[];
  title: string;
  status: MarketingStatus;
};
type CampaignTaskItem = {
  id: string;
  label: string;
  status: MarketingStatus;
};
type FocusQueueActionTarget =
  | {
      campaignId: string;
      dayNumber: number;
      kind: "marketing";
      taskKey?: keyof CampaignDay["statuses"];
      extraTaskId?: string;
    }
  | {
      extraTaskId?: string;
      kind: "production";
      songId: string;
      stepId: string;
      taskKey: "main" | "extra";
    };
type FocusQueueItem = CampaignTaskItem & {
  actionTarget?: FocusQueueActionTarget;
  dueDate?: string;
  notes?: string;
  source: "Marketing" | "Production" | "Other";
};
type OtherTask = {
  id: string;
  dueDate: string;
  notes: string;
  status: MarketingStatus;
  title: string;
};
type DailyFocusProgressItem = {
  date: string;
  label: string;
  source: FocusQueueItem["source"];
  status: MarketingStatus;
  taskKey: string;
};
type CampaignDay = {
  dayNumber: number;
  date: string;
  dateKey: string;
  isDefaultDay: boolean;
  releaseOffset: number;
  clipName: string;
  extraTasks: ExtraCampaignTask[];
  statuses: {
    facebookPost: MarketingStatus;
    websiteUpdate: MarketingStatus;
    youtubePost: MarketingStatus;
    production: MarketingStatus;
    instagramUpload: MarketingStatus;
    youtubeUpload: MarketingStatus;
  };
};
type ProductionStep = {
  id: string;
  label: string;
  deadline: string;
  isDefaultStep: boolean;
  notes: string;
  budgetLines?: ProductionBudgetLine[];
  status: MarketingStatus;
  extraTasks: ExtraCampaignTask[];
};
type ProductionSongConfig = {
  id: string;
  dbId?: string;
  title: string;
  deadline: string;
  albumArtUrl: string;
  steps: ProductionStep[];
};
type ProductionWorkbookSeed = {
  bpm?: number;
  demo?: string;
  demoTime?: string;
  deadline: string;
  drums?: string;
  id: string;
  other?: string;
  piano?: string;
  productionComment: string;
  releaseDate?: string;
  sourceOrder: number;
  style?: string;
  title: string;
  violin?: string;
  vocal?: string;
};
type BudgetEntryType = "earned" | "spent" | "one-off" | "recurring";
type BudgetSourceBucket = "events" | "production" | "marketing" | "other";
type BudgetLedgerSortKey = "date" | "bucket" | "description" | "amount" | "type";
type BudgetRecurringCadence = "monthly" | "yearly";
type SortDirection = "ascending" | "descending";
type BudgetEntry = {
  id: string;
  dbId?: string;
  date: string;
  description: string;
  amount: number;
  type: BudgetEntryType;
  bucket?: BudgetSourceBucket;
  recurringCadence?: BudgetRecurringCadence;
  paymentPlanEndDate?: string;
  generated?: boolean;
  sourceRecurringEntryId?: string;
  sourceEventEntryId?: string;
  sourceMarketingCampaignId?: string;
  sourceProductionItemId?: string;
};
type EventEntry = {
  id: string;
  dbId?: string;
  date: string;
  name: string;
  nameUrl: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
  posterUrl?: string;
  budgetLines?: ProductionBudgetLine[];
  earnedAmount?: number;
  earnedDescription?: string;
  spentAmount?: number;
  spentDescription?: string;
};
type LocationAddressBookEntry = {
  id: string;
  dbId?: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
  contactName: string;
  contactPhone: string;
  contactNotes: string;
};
type RoadmapBoxStatus = "done" | "active" | "planned" | "partial";
type RoadmapMonth = {
  id: string;
  label: string;
  phase: 1 | 2 | 3;
  planned: number;
  released: number;
};
type RoadmapPhase = {
  id: string;
  phaseNumber: number;
  title: string;
  period: string;
  targetCount: number;
  releasedCount: number;
  activeCount: number;
  accent: "blue" | "berry" | "green";
  summary: string;
  milestones: string[];
};
type CampaignDaySeed = {
  dateKey: string;
  clipName: string;
  instagramDone?: boolean;
  youtubeDone?: boolean;
};
type MarketingCampaignConfig = {
  id: string;
  dbId?: string;
  releaseTitle: string;
  releaseDate: string;
  albumArtUrl: string;
  budgetLines?: ProductionBudgetLine[];
  campaignDays?: CampaignDay[];
  daySeeds?: CampaignDaySeed[];
};
type MetricRow = {
  metric_name: string;
  metric_value: number | string;
  notes: string | null;
  source: string | null;
  snapshot_date: string;
  imported_at: string;
  platforms: { slug: string } | Array<{ slug: string }> | null;
  content_posts: { title: string | null } | Array<{ title: string | null }> | null;
  releases: { title: string | null } | Array<{ title: string | null }> | null;
};
type MetricTrendPoint = {
  date: string;
  source: "manual" | "supabase";
  value: number;
};
type PlatformMetricDelta = {
  direction: "down" | "flat" | "up";
  value: number;
};
type RefreshStatus = {
  message: string;
  state: "error" | "idle" | "loading" | "success";
};
type QrCodeLink = {
  id: string;
  name: string;
  qrImageUrl: string;
  targetUrl: string;
};
type AppleMusicImportStatus = RefreshStatus;
type AppleMusicCsvRow = {
  avgDailyListeners: number;
  plays: number;
  purchases: number;
  radioSpins: number;
  shazams: number;
  song: string;
};
type MarketingCampaignTaskDbRow = {
  id: string;
  task_kind:
    | "production"
    | "instagram_upload"
    | "youtube_upload"
    | "website_update"
    | "facebook_post"
    | "youtube_post"
    | "extra";
  title: string;
  status: MarketingStatus;
  position: number;
  is_standard_task: boolean;
};
type MarketingCampaignDayDbRow = {
  id: string;
  day_number: number;
  campaign_date: string;
  release_offset: number;
  clip_name: string;
  is_default_day: boolean;
  marketing_campaign_tasks: MarketingCampaignTaskDbRow[] | null;
};
type MarketingCampaignDbRow = {
  id: string;
  slug: string;
  title: string;
  release_date: string;
  album_art_url: string;
  marketing_campaign_days: MarketingCampaignDayDbRow[] | null;
};
type ProductionSongDbRow = {
  id: string;
  slug: string;
  title: string;
  production_deadline: string;
  album_art_url: string;
};
type ProductionStepDbRow = {
  id: string;
  production_song_id: string;
  stable_key: string;
  label: string;
  step_deadline: string;
  status: MarketingStatus;
  notes: string;
  position: number;
  is_default_step: boolean;
};
type ProductionStepTaskDbRow = {
  id: string;
  production_step_id: string;
  title: string;
  status: MarketingStatus;
  position: number;
};
type ProductionBudgetLineDbRow = {
  id: string;
  production_step_id: string | null;
  production_step_task_id: string | null;
  description: string;
  amount: number | string;
  budget_bucket?: BudgetSourceBucket | null;
  position: number;
};
type EventLocationDbRow = {
  id: string;
  stable_key: string;
  location_name: string;
  location_url: string;
  address: string;
  address_url: string;
  contact_name: string;
  contact_phone: string;
  contact_notes: string;
};
type EventDbRow = {
  id: string;
  stable_key: string;
  event_date: string;
  event_name: string;
  event_url: string;
  poster_url?: string | null;
  location_id: string | null;
  location_name: string;
  location_url: string;
  address: string;
  address_url: string;
};
type EventBudgetLineDbRow = {
  id: string;
  event_id: string;
  description: string;
  amount: number | string;
  budget_bucket?: BudgetSourceBucket | null;
  position: number;
};
type EventsSnapshot = {
  entries: EventEntry[];
  locations: LocationAddressBookEntry[];
};

const platformStats = [
  {
    platform: "Instagram",
    slug: "instagram",
    profileUrl: "https://www.instagram.com/lovestringsband/",
    icon: Camera,
    dashboard: true,
    metrics: [
      { label: "Followers", metricName: "followers", value: "184" },
      {
        label: "Accounts Reached, Last 30 Days",
        metricName: "accounts_reached_30d",
        value: "3.5K"
      },
      {
        label: "Views, Last 30 Days",
        metricName: "views_30d",
        value: "29.0K"
      },
      {
        label: "Latest Reel/Post Views",
        metricName: "latest_reel_post_views",
        value: "2.1K",
        context: "Our version of Flowers is officially out!"
      }
    ]
  },
  {
    platform: "YouTube Channel",
    slug: "youtube",
    profileUrl: "https://www.youtube.com/@LoveStringsBand",
    icon: Video,
    dashboard: true,
    metrics: [
      { label: "Subscribers", metricName: "subscribers", value: "39" },
      { label: "Lifetime Views", metricName: "total_channel_views", value: "17.8K" },
      {
        label: "Latest Video Views",
        metricName: "latest_video_views",
        value: "39",
        context: "A Rooftop Sunset in Vienna | Wonderful Life (Acoustic Cover)"
      },
      {
        label: "Latest Short Views",
        metricName: "latest_short_views",
        value: "19",
        context: "Learning English Through Music"
      }
    ]
  },
  {
    platform: "YouTube Music",
    slug: "youtube-music",
    profileUrl:
      "https://music.youtube.com/channel/UCKlfg9lYKyMOg_Oiz-Zb1Fg?si=E-Vckp5-kB98MZKy",
    icon: Headphones,
    dashboard: true,
    metrics: [
      { label: "Subscribers", metricName: "subscribers", value: "11" },
      { label: "Total Plays", metricName: "total_plays", value: "75" },
      {
        label: "Current Release Plays",
        metricName: "current_release_plays",
        value: "15",
        context: "Flowers"
      }
    ]
  },
  {
    platform: "Spotify",
    slug: "spotify",
    profileUrl:
      "https://open.spotify.com/artist/4CESELwcVlIPnfiWuaxRbF?si=odblVX83T7SBd486lli_sg",
    icon: Headphones,
    dashboard: true,
    metrics: [
      { label: "Followers", metricName: "followers", value: "10" },
      { label: "Total Streams", metricName: "total_streams", value: "19" },
      {
        label: "Current Release Streams",
        metricName: "current_release_streams",
        value: "4",
        context: "Flowers"
      }
    ]
  },
  {
    platform: "Apple Music",
    slug: "apple-music",
    profileUrl: "https://music.apple.com/us/artist/love-strings/1894951732",
    icon: Music2,
    dashboard: true,
    metrics: [
      { label: "Last Update", metricName: "last_update_date", value: "04/07/2026" },
      { label: "Total Plays", metricName: "total_plays", value: "12" },
      { label: "Total Shazams", metricName: "total_shazams", value: "0" },
      {
        label: "Current Release Plays",
        metricName: "current_release_plays",
        value: "0",
        context: "Flowers"
      },
      {
        label: "Current Release Shazams",
        metricName: "current_release_shazams",
        value: "0",
        context: "Flowers"
      }
    ]
  },
  {
    platform: "Amazon Music",
    slug: "amazon-music",
    profileUrl:
      "https://amazon.de/music/player/artists/B0GXX8D1Q6/love-strings?marketplaceId=A1PA6795UKMFR9&musicTerritory=DE&ref=dm_sh_DllfMUlhifqDm8suXQHK2D5tg",
    icon: Headphones,
    dashboard: false,
    metrics: [
      { label: "Listeners", metricName: "listeners", value: "3" },
      { label: "Total Streams", metricName: "total_streams", value: "4" },
      {
        label: "Current Release Streams",
        metricName: "current_release_streams",
        value: "2",
        context: "Flowers"
      }
    ]
  },
  {
    platform: "Deezer",
    slug: "deezer",
    profileUrl: "https://www.deezer.com/en/artist/9299570",
    icon: Disc3,
    dashboard: false,
    metrics: [
      { label: "Fans", metricName: "fans", value: "2" },
      { label: "Total Streams", metricName: "total_streams", value: "4" },
      {
        label: "Current Release Streams",
        metricName: "current_release_streams",
        value: "2",
        context: "Flowers"
      }
    ]
  }
];

const platformPlaceholder = {
  platform: "New Platform",
  slug: "new-platform-placeholder",
  icon: Headphones,
  dashboard: false,
  metrics: [
    { label: "Fans", metricName: "fans", value: "XXX" },
    { label: "Streams", metricName: "total_streams", value: "XXX" },
    {
      label: "Current Streams",
      metricName: "current_release_streams",
      value: "XXX",
      context: "Release name"
    }
  ]
};

const defaultQrCodeLinks: QrCodeLink[] = [
  {
    id: "website",
    name: "Website",
    qrImageUrl: "/love-strings-website-qr.png",
    targetUrl: "https://www.lovestrings.at/"
  },
  {
    id: "dashboard",
    name: "Dashboard",
    qrImageUrl: "",
    targetUrl: "https://love-strings-dashboard.vercel.app/"
  },
  ...platformStats.map((platform) => ({
    id: `platform-${platform.slug}`,
    name: platform.platform,
    qrImageUrl: "",
    targetUrl: platform.profileUrl
  }))
];

const appVersionLabel = "Beta 1.8";

const sections = [
  "Dashboard",
  "Marketing",
  "Production",
  "Platforms",
  "Events",
  "Budget",
  "Roadmap"
] as const;

const marketingStatusOptions: MarketingStatus[] = [
  "not-started",
  "in-progress",
  "done"
];

const marketingUploadStatusOptions: MarketingStatus[] = [
  ...marketingStatusOptions,
  "irrelevant"
];

const statusLabels: Record<MarketingStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  done: "Done",
  irrelevant: "Irrelevant"
};

const campaignDayStatusLabels: Record<CampaignDayProgressStatus, string> = {
  complete: "complete",
  empty: "nothing done",
  partial: "partially complete"
};

const marketingCampaign: MarketingCampaignConfig = {
  id: "rock-and-roll",
  releaseTitle: "Rock and Roll",
  releaseDate: "10/07/2026",
  albumArtUrl:
    "https://res.cloudinary.com/zg6yhttv/image/upload/v1782829034/Rock_and_Roll_-_Love_Strings_-_Cover_Art_web_avazio.jpg"
};

const historicalMarketingCampaigns: MarketingCampaignConfig[] = [
  {
    id: "flowers",
    releaseTitle: "Flowers",
    releaseDate: "19/06/2026",
    albumArtUrl: "",
    daySeeds: [
      {
        dateKey: "2026-06-15",
        clipName: "Рилс про фотосессию! Вечером! / Music lovers",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-16",
        clipName:
          "Скоро релиз нового сингла! Есть идеи что записали для вас? / Feed a man",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-17",
        clipName: "Возможно так? / Flowers teaser 1",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-18",
        clipName: "Уже завтра - FLOWERS / Flowers teaser 2",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-19",
        clipName: "Release FLOWERS (обложка сингла) / Flowers release",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-20",
        clipName: "Рилс с вопросом, где найти цветы",
        instagramDone: true
      },
      {
        dateKey: "2026-06-21",
        clipName: "Сторисы",
        instagramDone: true
      },
      {
        dateKey: "2026-06-22",
        clipName: "Рилс: Димын ДР",
        instagramDone: true
      },
      {
        dateKey: "2026-06-23",
        clipName: "Рилс: дети / FL English lesson",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-06-24",
        clipName: "Рилс с ютуб мьюзиком",
        instagramDone: true
      },
      {
        dateKey: "2026-06-25",
        clipName: "Рилс: развешиваю вещи и пою Flowers",
        instagramDone: true
      },
      {
        dateKey: "2026-06-26",
        clipName: "Рилс: Юлин ДР",
        instagramDone: true
      },
      {
        dateKey: "2026-06-27",
        clipName: "Фото МАРГО",
        instagramDone: true
      },
      {
        dateKey: "2026-06-28",
        clipName: "Рилс из дома",
        instagramDone: true
      }
    ]
  },
  {
    id: "wonderful-life",
    releaseTitle: "Wonderful Life",
    releaseDate: "15/05/2026",
    albumArtUrl: "",
    daySeeds: [
      {
        dateKey: "2026-05-15",
        clipName: "Wonderful Life release"
      },
      {
        dateKey: "2026-05-19",
        clipName: "WL vertical, JB short 1 (evening) / WL mood",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-05-21",
        clipName: "WL mood 1",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-24",
        clipName: "WL mood 2",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-26",
        clipName: "WL mood 3",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-28",
        clipName: "WL mood 4",
        youtubeDone: true
      }
    ]
  },
  {
    id: "jukebox",
    releaseTitle: "Jukebox",
    releaseDate: "16/05/2026",
    albumArtUrl: "",
    daySeeds: [
      {
        dateKey: "2026-05-16",
        clipName: "JB full reel / JB video",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-05-17",
        clipName: "post+stories / JB short 1",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-05-18",
        clipName: "Post carousel / JB short 2",
        instagramDone: true,
        youtubeDone: true
      },
      {
        dateKey: "2026-05-20",
        clipName: "JB short 3",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-22",
        clipName: "JB short 4",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-23",
        clipName: "JB short 5",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-25",
        clipName: "JB short 6",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-27",
        clipName: "JB short 7",
        youtubeDone: true
      },
      {
        dateKey: "2026-05-29",
        clipName: "JB short 8",
        youtubeDone: true
      }
    ]
  },
  {
    id: "intro",
    releaseTitle: "Intro",
    releaseDate: "21/04/2026",
    albumArtUrl: "",
    daySeeds: [
      {
        dateKey: "2026-04-21",
        clipName: "Intro release"
      }
    ]
  }
];

const marketingCampaigns: MarketingCampaignConfig[] = [
  marketingCampaign,
  ...historicalMarketingCampaigns
];

const campaignDraftStorageKey = "love-strings-marketing-campaign-drafts";
const productionDraftStorageKey = "love-strings-production-song-drafts-v3";
const budgetDraftStorageKey = "love-strings-budget-entry-drafts-v2";
const deletedBudgetForecastStorageKey = "love-strings-budget-deleted-forecast-v1";
const eventDraftStorageKey = "love-strings-event-entry-drafts-v1";
const locationAddressBookStorageKey = "love-strings-location-address-book-v1";
const qrCodeLinksStorageKey = "love-strings-qr-code-links-v1";
const otherTaskStorageKey = "love-strings-focus-other-tasks-v1";
const otherTaskSupabaseMigrationKey = "love-strings-focus-other-tasks-supabase-v1";
const appleMusicReminderDismissedDateKey =
  "love-strings-apple-music-reminder-dismissed-date-v1";

const newMarketingCampaign: Omit<MarketingCampaignConfig, "id"> = {
  releaseTitle: "New Campaign",
  releaseDate: "10/07/2026",
  albumArtUrl: ""
};

const defaultCampaignDayCount = 14;
const defaultProductionStepTemplates = [
  { label: "Demo", offset: -42 },
  { label: "Drums", offset: -35 },
  { label: "Guitars", offset: -30 },
  { label: "Bass", offset: -27 },
  { label: "Vocals", offset: -23 },
  { label: "Edit", offset: -18 },
  { label: "Mix", offset: -13 },
  { label: "Master", offset: -8 },
  { label: "License", offset: -5 },
  { label: "Cover Art", offset: -3 },
  { label: "Distributor", offset: 0 }
];
const productionWorkbookSeeds: ProductionWorkbookSeed[] = [
  {
    bpm: 160,
    deadline: "07/04/2026",
    demo: "V",
    demoTime: "01:49",
    drums: "VV",
    id: "intro",
    piano: "VV",
    productionComment: "PRODUCED",
    releaseDate: "21/04/2026",
    sourceOrder: 1,
    style:
      "Released as original composition to set up Love Strings on all platforms for future cover releases",
    title: "Love Strings - Intro (original instrumental)",
    violin: "X",
    vocal: "INSTR."
  },
  {
    bpm: 126,
    deadline: "01/05/2026",
    demo: "V",
    demoTime: "03:59",
    drums: "VV",
    id: "wonderful-life",
    piano: "VV",
    productionComment: "PRODUCED",
    releaseDate: "15/05/2026",
    sourceOrder: 2,
    style: "OLD pop fast",
    title: "Black - Wonderful Life",
    violin: "X",
    vocal: "DUO"
  },
  {
    bpm: 160,
    deadline: "02/05/2026",
    demo: "V",
    demoTime: "05:41",
    drums: "VV",
    id: "jukebox-medley",
    piano: "VV",
    productionComment: "PRODUCED",
    releaseDate: "16/05/2026",
    sourceOrder: 3,
    style:
      "RnR fast; released only as YouTube video due to licensing difficulty",
    title:
      "Jukebox Medley - Matchbox / Long Tall Sally / Blue Suede Shoes / Tutti Frutti",
    violin: "X",
    vocal: "DUO"
  },
  {
    bpm: 108,
    deadline: "05/06/2026",
    demo: "V",
    demoTime: "04:18",
    drums: "VV",
    id: "flowers",
    piano: "VV",
    productionComment: "PRODUCED",
    releaseDate: "19/06/2026",
    sourceOrder: 4,
    style: "NEW pop",
    title: "Miley Cyrus - Flowers",
    violin: "X",
    vocal: "DUO"
  },
  {
    bpm: 148,
    deadline: "26/06/2026",
    demo: "V",
    demoTime: "03:29",
    drums: "VV",
    id: "rock-and-roll",
    piano: "VV",
    productionComment: "PRODUCED",
    releaseDate: "10/07/2026",
    sourceOrder: 5,
    style: "RnR fast",
    title: "Led Zeppelin - Rock and Roll",
    violin: "X",
    vocal: "DUO"
  },
  {
    bpm: 100,
    deadline: "17/07/2026",
    demo: "V",
    demoTime: "03:38",
    drums: "VV",
    id: "shallow",
    piano: "X",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "31/07/2026",
    sourceOrder: 6,
    style: "NEW pop slow",
    title: "Lady Gaga, Bradley Cooper - Shallow",
    violin: "?",
    vocal: "DUO"
  },
  {
    bpm: 148,
    deadline: "07/08/2026",
    demo: "V",
    demoTime: "04:31",
    drums: "VV",
    id: "enjoy-the-ride",
    piano: "?",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "21/08/2026",
    sourceOrder: 7,
    style: "OLD pop fast",
    title: "Morcheeba - Enjoy The Ride",
    violin: "?",
    vocal: "DUO"
  },
  {
    bpm: 86,
    deadline: "28/08/2026",
    demo: "V",
    demoTime: "03:10",
    drums: "VV",
    id: "just-the-two-of-us",
    piano: "VV",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "11/09/2026",
    sourceOrder: 8,
    style: "OLD pop slow",
    title: "Bill Withers - Just The Two Of Us",
    violin: "?",
    vocal: "DUO"
  },
  {
    bpm: 112,
    deadline: "18/09/2026",
    demo: "V",
    demoTime: "03:45",
    drums: "VV",
    id: "calm-after-the-storm",
    piano: "X",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "02/10/2026",
    sourceOrder: 9,
    style: "NEW pop slow",
    title: "The Common Linnets - Calm After The Storm",
    violin: "?",
    vocal: "DUO"
  },
  {
    bpm: 114,
    deadline: "09/10/2026",
    demo: "V",
    demoTime: "03:24",
    drums: "VV",
    id: "levitate",
    piano: "VV",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "23/10/2026",
    sourceOrder: 10,
    style: "RnR slow",
    title: "Imelda May - Levitate",
    violin: "?",
    vocal: "DUO"
  },
  {
    bpm: 140,
    deadline: "30/10/2026",
    demo: "V",
    demoTime: "03:21",
    drums: "VV",
    id: "who-knows-what-tomorrow-may-bring",
    piano: "VV",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "13/11/2026",
    sourceOrder: 11,
    style: "RnR fast",
    title: "Claire Lynch - Who Knows What Tomorrow May Bring",
    violin: "V",
    vocal: "DUO"
  },
  {
    bpm: 108,
    deadline: "20/11/2026",
    demo: "V",
    demoTime: "03:23",
    drums: "?",
    id: "nagadai",
    piano: "X",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "04/12/2026",
    sourceOrder: 12,
    style: "NEW pop slow",
    title: "Domiy - Нагадай",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 134,
    deadline: "11/12/2026",
    demo: "V",
    demoTime: "03:28",
    drums: "V",
    id: "mercy",
    piano: "VV",
    productionComment: "I HAVE DEMO",
    releaseDate: "25/12/2026",
    sourceOrder: 13,
    style: "NEW pop fast",
    title: "Duffy - Mercy",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 110,
    deadline: "01/01/2027",
    demo: "V",
    demoTime: "04:24",
    drums: "V",
    id: "the-best",
    other: "Slava/Zax",
    piano: "VV",
    productionComment: "I HAVE DEMO",
    releaseDate: "15/01/2027",
    sourceOrder: 14,
    style: "OLD pop slow",
    title: "Tina Turner - The Best",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 128,
    deadline: "22/01/2027",
    demo: "V",
    demoTime: "02:58",
    drums: "V",
    id: "perhaps-perhaps-perhaps",
    piano: "VV",
    productionComment: "I HAVE DEMO",
    releaseDate: "05/02/2027",
    sourceOrder: 15,
    style: "RnR slow",
    title: "Doris Day - Perhaps Perhaps Perhaps",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 100,
    deadline: "12/02/2027",
    demo: "V",
    demoTime: "03:43",
    drums: "V",
    id: "red-light-spells-danger",
    piano: "VV",
    productionComment: "I HAVE DEMO",
    releaseDate: "26/02/2027",
    sourceOrder: 16,
    style: "RnR slow",
    title: "Billy Ocean - Red Light Spells Danger",
    violin: "?",
    vocal: "DIM"
  },
  {
    bpm: 160,
    deadline: "05/03/2027",
    demo: "V",
    demoTime: "03:29",
    drums: "V",
    id: "these-boots-are-made-for-walkin",
    piano: "VV",
    productionComment: "I HAVE DEMO",
    releaseDate: "19/03/2027",
    sourceOrder: 17,
    style: "RnR fast",
    title: "Nancy Sinatra - These Boots Are Made For Walkin'",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 100,
    deadline: "26/03/2027",
    demo: "V",
    demoTime: "02:53",
    drums: "V",
    id: "johnnys-got-a-boom-boom",
    piano: "V",
    productionComment: "I HAVE DEMO",
    releaseDate: "09/04/2027",
    sourceOrder: 18,
    style: "RnR fast",
    title: "Imelda May - Johnny's Got A Boom Boom",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 134,
    deadline: "16/04/2027",
    demo: "V",
    demoTime: "03:21",
    drums: "V",
    id: "moonlight-kiss",
    piano: "V",
    productionComment: "I HAVE DEMO",
    releaseDate: "30/04/2027",
    sourceOrder: 19,
    style: "RnR fast",
    title: "Raul Malo - Moonlight Kiss",
    violin: "?",
    vocal: "DIM"
  },
  {
    bpm: 96,
    deadline: "07/05/2027",
    demo: "V",
    demoTime: "03:08",
    drums: "V",
    id: "this-is-the-life",
    piano: "V",
    productionComment: "I HAVE DEMO",
    releaseDate: "21/05/2027",
    sourceOrder: 20,
    style: "NEW pop slow",
    title: "Amy Macdonald - This is the Life",
    violin: "V",
    vocal: "YUL"
  },
  {
    bpm: 106,
    deadline: "28/05/2027",
    demo: "V",
    demoTime: "03:12",
    drums: "V",
    id: "jolene",
    piano: "V",
    productionComment: "I HAVE DEMO",
    releaseDate: "11/06/2027",
    sourceOrder: 21,
    style: "OLD pop slow",
    title: "Dolly Parton - Jolene",
    violin: "V",
    vocal: "YUL"
  },
  {
    deadline: "18/06/2027",
    drums: "V",
    id: "folsom-prison-blues",
    piano: "V",
    productionComment: "NO DEMO YET",
    releaseDate: "02/07/2027",
    sourceOrder: 22,
    style: "RnR slow",
    title: "Johnny Cash - Folsom Prison Blues",
    violin: "V",
    vocal: "DIM"
  },
  {
    deadline: "09/07/2027",
    drums: "V",
    id: "heartbreak-hotel",
    piano: "V",
    productionComment: "NO DEMO YET",
    releaseDate: "23/07/2027",
    sourceOrder: 23,
    style: "RnR slow",
    title: "Elvis Presley - Heartbreak Hotel",
    violin: "?",
    vocal: "DIM"
  },
  {
    deadline: "30/07/2027",
    drums: "V",
    id: "oh-lonesome-me",
    piano: "V",
    productionComment: "NO DEMO YET",
    releaseDate: "13/08/2027",
    sourceOrder: 24,
    style: "RnR slow",
    title: "OH LONESOME ME - Don Gibson",
    violin: "V",
    vocal: "DIM"
  },
  {
    deadline: "20/08/2027",
    drums: "V",
    id: "so-long-im-gone",
    piano: "V",
    productionComment: "NO DEMO YET",
    releaseDate: "03/09/2027",
    sourceOrder: 25,
    style: "RnR slow",
    title: "Warren Smith - So Long I'm Gone",
    violin: "V",
    vocal: "DIM"
  },
  {
    deadline: "10/09/2027",
    drums: "?",
    id: "toms-diner",
    piano: "?",
    productionComment: "NO DEMO YET",
    releaseDate: "24/09/2027",
    sourceOrder: 26,
    style: "RnR fast",
    title: "Suzanne Vega - Tom's Diner",
    violin: "?",
    vocal: "YUL"
  },
  {
    bpm: 130,
    deadline: "01/10/2027",
    demo: "V",
    demoTime: "03:23",
    drums: "VV",
    id: "personal-jesus",
    piano: "X",
    productionComment: "CAN BE PRODUCED",
    releaseDate: "15/10/2027",
    sourceOrder: 27,
    style: "OLD pop slow",
    title: "Personal Jesus",
    violin: "X",
    vocal: "YUL"
  }
];
const productionSongs: ProductionSongConfig[] = sortProductionSongsByDeadline(
  productionWorkbookSeeds.map(createProductionSongFromWorkbookSeed)
);
const budgetEntries: BudgetEntry[] = [
  { id: "hrc-gig", date: "10/01/2026", description: "HRC gig", amount: 340, type: "earned" },
  { id: "photoshoot", date: "16/03/2026", description: "Photoshoot", amount: 210, type: "spent" },
  { id: "cla-plugins", date: "01/03/2026", description: "CLA Plugins", amount: 100, type: "spent" },
  { id: "landr", date: "20/04/2026", description: "LANDR", amount: 100, type: "spent" },
  { id: "intro-release", date: "20/04/2026", description: "Intro release", amount: 10, type: "spent" },
  { id: "wl-licence", date: "20/04/2026", description: "WL Licence", amount: 20, type: "spent" },
  { id: "wl-release", date: "01/05/2026", description: "WL release", amount: 10, type: "spent" },
  { id: "canva-12m", date: "20/04/2026", description: "Canva 12m", amount: 144, type: "spent" },
  { id: "pickwicks-april", date: "04/04/2026", description: "Pickwick's", amount: 260, type: "earned" },
  {
    id: "suno",
    amount: -90,
    date: "04/04/2026",
    description: "SUNO",
    paymentPlanEndDate: "04/04/2027",
    recurringCadence: "monthly",
    type: "recurring"
  },
  { id: "rhg-lebenszeit", date: "08/05/2026", description: "RHG Lebenszeit", amount: 190, type: "earned" },
  { id: "flowers-license", date: "25/05/2026", description: "Flowers license", amount: 20, type: "spent" },
  { id: "flowers-release", date: "26/05/2026", description: "Flowers release", amount: 10, type: "spent" },
  { id: "pickwicks-may-spent", date: "30/05/2026", description: "Pickwick's", amount: 60, type: "spent" },
  { id: "pickwicks-may-earned", date: "30/05/2026", description: "Pickwick's", amount: 260, type: "earned" },
  { id: "rock-and-roll-license", date: "15/06/2026", description: "Rock and Roll license", amount: 20, type: "spent" },
  { id: "rock-and-roll-release", date: "15/06/2026", description: "Rock and Roll release", amount: 10, type: "spent" },
  { id: "wedding", date: "26/06/2026", description: "Wedding", amount: 1100, type: "earned" }
];
const eventEntries: EventEntry[] = [
  {
    id: "event-2026-05-30-pickwicks",
    date: "30/05/2026",
    name: "INTERACTIVE SHOW by Love Strings",
    nameUrl: "",
    locationName: "Pickwicks International Bar Vienna",
    locationUrl: "https://www.instagram.com/pickwickspubvienna/",
    address: "Marc-Aurel-Straße 10-12, 1010 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2026-05-14-blooming-planet",
    date: "16/05/2026",
    name: "Love Strings at Blooming Planet Festival",
    nameUrl: "",
    locationName: "Blooming Planet Festival",
    locationUrl: "https://maps.app.goo.gl/",
    address: "",
    addressUrl: "",
    earnedAmount: 100,
    earnedDescription: "Blooming Planet event income",
    spentAmount: 30,
    spentDescription: "Blooming Planet event expense"
  },
  {
    id: "event-2026-05-08-lebenszeit",
    date: "08/05/2026",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "LEBENSZEIT",
    locationUrl: "https://maps.app.goo.gl/",
    address: "Kurze Zeile 68, 2212 Großengersdorf",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2026-04-04-pickwicks",
    date: "04/04/2026",
    name: "INTERACTIVE SHOW by Love Strings",
    nameUrl: "",
    locationName: "Pickwicks International Bar Vienna",
    locationUrl: "https://www.instagram.com/pickwickspubvienna/",
    address: "Marc-Aurel-Straße 10-12, 1010 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2026-02-10-hard-rock-cafe",
    date: "10/02/2026",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Hard Rock Cafe Vienna",
    locationUrl: "https://cafe.hardrock.com/vienna/",
    address: "Rotenturmstraße 25, 1010 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2026-01-23-saloon",
    date: "23/01/2026",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "Saloon, Wien",
    locationUrl: "https://maps.app.goo.gl/",
    address: "Wagramer Str. 79, 1220 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-11-20-mickey-finns",
    date: "20/11/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Mickey Finn's Irish Pub",
    locationUrl: "https://www.instagram.com/mickeyfinnsvienna/",
    address: "1030 Vienna, Austria",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-10-10-gradus",
    date: "10/10/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Gradus Club Wien",
    locationUrl: "https://www.instagram.com/gradusclub/",
    address: "Eschenbachgasse 7, 1010 Wien, Austria",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-09-21-felixdorf",
    date: "21/09/2025",
    name: "Love Strings & Roadhouse Gang at CAR & US-BIKE Treffen Felixdorf",
    nameUrl: "https://1.us/",
    locationName: "CAR & US-BIKE Treffen Felixdorf",
    locationUrl: "https://1.us/",
    address: "Badgasse 4, 2603 Felixdorf, Österreich",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-09-10-mickey-finns",
    date: "10/09/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Mickey Finn's Irish Pub",
    locationUrl: "https://www.instagram.com/mickeyfinnsvienna/",
    address: "1030 Vienna, Austria",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-07-22-augartenspitz",
    date: "22/07/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Am Augartenspitz",
    locationUrl: "https://maps.app.goo.gl/",
    address: "Obere Augartenstraße 1e, 1020 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-07-04-saloon",
    date: "04/07/2025",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "Saloon, Wien",
    locationUrl: "https://maps.app.goo.gl/",
    address: "Wagramer Str. 79, 1220 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-06-14-lucky-cruisers",
    date: "14/06/2025",
    name: "Love Strings & Roadhouse Gang at Lucky Cruisers Weekend 2025",
    nameUrl: "https://www.lcw.cz/",
    locationName: "Lucky Cruisers Weekend 2025",
    locationUrl: "https://www.lcw.cz/",
    address: "Pasohlávky 114 E, 691 22 Pasohlávky, Czechia",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-05-31-church",
    date: "31/05/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "The Church International Pub",
    locationUrl: "https://www.the-church.at/",
    address: "Radetzkystraße 3, 1030 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-05-10-gleisgarten",
    date: "10/05/2025",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "Gleis//Garten, Wien",
    locationUrl: "https://www.gleisgarten.com/",
    address: "Eichenstrasse 2, 1120 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-03-28-gradus",
    date: "28/03/2025",
    name: "Love Strings & Friends",
    nameUrl: "",
    locationName: "Gradus Club Wien",
    locationUrl: "https://www.instagram.com/gradusclub/",
    address: "Eschenbachgasse 7, 1010 Wien, Austria",
    addressUrl: ""
  },
  {
    id: "event-2025-03-02-mickey-finns",
    date: "02/03/2025",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Mickey Finn's Irish Pub",
    locationUrl: "https://www.instagram.com/mickeyfinnsvienna/",
    address: "1030 Vienna, Austria",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2025-02-01-quattro",
    date: "01/02/2025",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "Club Cafe Quattro",
    locationUrl: "https://www.quattro-club.at/",
    address: "Währingerstrasse 167, 1180 Wien",
    addressUrl: ""
  },
  {
    id: "event-2025-01-25-saloon",
    date: "25/01/2025",
    name: "Love Strings & Roadhouse Gang",
    nameUrl: "",
    locationName: "Saloon",
    locationUrl: "https://www.saloon.co.at/",
    address: "Wagramer Straße 79, 1220 Wien",
    addressUrl: ""
  },
  {
    id: "event-2024-12-14-gradus",
    date: "14/12/2024",
    name: "Love Strings & Friends",
    nameUrl: "",
    locationName: "Gradus Club Wien",
    locationUrl: "https://www.instagram.com/gradusclub/",
    address: "Eschenbachgasse 7, 1010 Wien, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-10-10-arena-beisl",
    date: "10/10/2024",
    name: "Love Strings at Double Tap",
    nameUrl: "https://www.instagram.com/doubletap_band/",
    locationName: "Arena Beisl Wien",
    locationUrl: "https://www.instagram.com/arena_beisl/",
    address: "Arena Beisl, Vienna, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-09-21-kvartirnik",
    date: "21/09/2024",
    name: "Love Strings at Kvartirnik",
    nameUrl: "",
    locationName: "GRADUS",
    locationUrl: "https://maps.app.goo.gl/",
    address: "Eschenbachgasse 7, 1010 Wien",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2024-09-13-songwriter-club",
    date: "13/09/2024",
    name: "Russian Singer-Songwriter Club",
    nameUrl: "",
    locationName: "Vienna",
    locationUrl: "",
    address: "Vienna, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-09-09-cafe-carina",
    date: "09/09/2024",
    name: "Love Strings at Open Stage",
    nameUrl: "",
    locationName: "Cafe Carina",
    locationUrl: "https://www.cafe-carina.at/",
    address: "Vienna, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-08-30-slavic-folk-fest",
    date: "30/08/2024",
    name: "Love Strings at Slavic Folk Fest",
    nameUrl: "",
    locationName: "Slavic Folk Fest",
    locationUrl: "",
    address: "Slovakia",
    addressUrl: ""
  },
  {
    id: "event-2024-08-21-mickey-finns",
    date: "21/08/2024",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Mickey Finn's Irish Pub",
    locationUrl: "",
    address: "1030 Vienna, Austria",
    addressUrl: "https://maps.app.goo.gl/"
  },
  {
    id: "event-2024-08-16-church",
    date: "16/08/2024",
    name: "Love Strings",
    nameUrl: "",
    locationName: "The Church International Pub",
    locationUrl: "https://www.the-church.at/",
    address: "Vienna, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-08-08-zadar",
    date: "08/08/2024",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Zadar",
    locationUrl: "",
    address: "Zadar, Croatia",
    addressUrl: ""
  },
  {
    id: "event-2024-07-24-mickey-finns",
    date: "24/07/2024",
    name: "Love Strings",
    nameUrl: "",
    locationName: "Mickey Finn's Irish Pub",
    locationUrl: "",
    address: "Vienna, Austria",
    addressUrl: ""
  },
  {
    id: "event-2024-06-08-kvartirnik",
    date: "08/06/2024",
    name: "Love Strings at Kvartirnik",
    nameUrl: "",
    locationName: "GRADUS",
    locationUrl: "",
    address: "Vienna, Austria",
    addressUrl: ""
  }
];
const roadmapMonths: RoadmapMonth[] = [
  { id: "2026-04", label: "Apr 26", phase: 1, planned: 1, released: 1 },
  { id: "2026-05", label: "May 26", phase: 1, planned: 2, released: 2 },
  { id: "2026-06", label: "Jun 26", phase: 1, planned: 1, released: 1 },
  { id: "2026-07", label: "Jul 26", phase: 1, planned: 2, released: 1 },
  { id: "2026-08", label: "Aug 26", phase: 1, planned: 1, released: 0 },
  { id: "2026-09", label: "Sep 26", phase: 1, planned: 1, released: 0 },
  { id: "2026-10", label: "Oct 26", phase: 1, planned: 3, released: 0 },
  { id: "2026-11", label: "Nov 26", phase: 1, planned: 1, released: 0 },
  { id: "2026-12", label: "Dec 26", phase: 1, planned: 1, released: 0 },
  { id: "2027-01", label: "Jan 27", phase: 1, planned: 2, released: 0 },
  { id: "2027-02", label: "Feb 27", phase: 1, planned: 1, released: 0 },
  { id: "2027-03", label: "Mar 27", phase: 1, planned: 1, released: 0 },
  { id: "2027-04", label: "Apr 27", phase: 1, planned: 2, released: 0 },
  { id: "2027-05", label: "May 27", phase: 1, planned: 1, released: 0 },
  { id: "2027-06", label: "Jun 27", phase: 1, planned: 1, released: 0 },
  { id: "2027-07", label: "Jul 27", phase: 1, planned: 1, released: 0 },
  { id: "2027-08", label: "Aug 27", phase: 2, planned: 1, released: 0 },
  { id: "2027-09", label: "Sep 27", phase: 2, planned: 1, released: 0 },
  { id: "2027-10", label: "Oct 27", phase: 2, planned: 2, released: 0 },
  { id: "2027-11", label: "Nov 27", phase: 2, planned: 1, released: 0 },
  { id: "2027-12", label: "Dec 27", phase: 2, planned: 1, released: 0 },
  { id: "2028-01", label: "Jan 28", phase: 3, planned: 1, released: 0 }
];
const roadmapPhases: RoadmapPhase[] = [
  {
    id: "phase-1",
    phaseNumber: 1,
    title: "English Covers / Brand Formation",
    period: "Apr 2026 - Jul 2027",
    targetCount: 20,
    releasedCount: 5,
    activeCount: 1,
    accent: "blue",
    summary:
      "Launch Love Strings, build the first English cover catalog, and make the release process repeatable.",
    milestones: ["5 releases by Jul 2026", "10 releases by Oct 2026", "20 releases by Jul 2027"]
  },
  {
    id: "phase-2",
    phaseNumber: 2,
    title: "Ukrainian and Russian Covers / Audience expanse",
    period: "Jan 2027 - Dec 2027",
    targetCount: 10,
    releasedCount: 0,
    activeCount: 0,
    accent: "berry",
    summary:
      "Add Russian-language covers while English covers continue in parallel.",
    milestones: ["First Russian cover", "Two-language catalog", "25-30 releases in catalog"]
  },
  {
    id: "phase-3",
    phaseNumber: 3,
    title: "Original Songs / Monetisation via royalties",
    period: "Summer 2027 onward",
    targetCount: 5,
    releasedCount: 0,
    activeCount: 0,
    accent: "green",
    summary:
      "Start original Love Strings material and build long-term owned music assets.",
    milestones: ["First original single", "Original campaign", "35+ releases by 2028+"]
  }
];

function sortCampaignsByReleaseDate(campaigns: MarketingCampaignConfig[]) {
  return [...campaigns].sort(
    (firstCampaign, secondCampaign) =>
      getCampaignSortTime(secondCampaign.releaseDate) -
      getCampaignSortTime(firstCampaign.releaseDate)
  );
}

function sortProductionSongsByDeadline(songs: ProductionSongConfig[]) {
  const todayTime = getTodayUtcDate().getTime();

  return [...songs].sort(
    (firstSong, secondSong) =>
      getProductionSongSortTime(firstSong.deadline, todayTime) -
      getProductionSongSortTime(secondSong.deadline, todayTime)
  );
}

function getProductionSongSortTime(deadlineInput: string, todayTime: number) {
  const deadlineTime = getProductionDeadlineSortTime(deadlineInput);

  if (deadlineTime >= todayTime) {
    return deadlineTime;
  }

  return Number.MAX_SAFE_INTEGER - deadlineTime;
}

function sortProductionStepsByDeadline(steps: ProductionStep[]) {
  return [...steps].sort(
    (firstStep, secondStep) =>
      getProductionDeadlineSortTime(firstStep.deadline) -
      getProductionDeadlineSortTime(secondStep.deadline)
  );
}

function getProductionDeadlineSortTime(deadlineInput: string) {
  return parseCampaignDate(deadlineInput)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function getNextProductionSongDeadline(songs: ProductionSongConfig[]) {
  const latestDeadline = songs
    .map((song) => parseCampaignDate(song.deadline))
    .filter((date): date is Date => Boolean(date))
    .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0];

  return latestDeadline ? addUtcDays(latestDeadline, 14) : addUtcDays(getTodayUtcDate(), 28);
}

function createProductionSongSeed({
  albumArtUrl = "",
  deadline,
  id,
  statusPattern,
  title
}: {
  albumArtUrl?: string;
  deadline: string;
  id: string;
  statusPattern: MarketingStatus[];
  title: string;
}): ProductionSongConfig {
  return {
    albumArtUrl,
    deadline,
    id,
    steps: buildProductionSteps(deadline, title, statusPattern),
    title
  };
}

function createProductionSongFromWorkbookSeed(
  seed: ProductionWorkbookSeed
): ProductionSongConfig {
  return {
    albumArtUrl: seed.id === "rock-and-roll"
      ? "https://res.cloudinary.com/zg6yhttv/image/upload/v1782829034/Rock_and_Roll_-_Love_Strings_-_Cover_Art_web_avazio.jpg"
      : "",
    deadline: seed.deadline,
    id: seed.id,
    steps: buildProductionStepsFromWorkbookSeed(seed),
    title: seed.title
  };
}

function buildProductionSteps(
  productionDeadlineInput: string,
  songTitle: string,
  statusPattern: MarketingStatus[] = ["not-started"]
) {
  const productionDeadline =
    parseCampaignDate(productionDeadlineInput) ?? new Date(Date.UTC(2026, 5, 26));

  return defaultProductionStepTemplates.map((template, index) => {
    const deadline = addUtcDays(productionDeadline, template.offset);
    const status =
      statusPattern.length === 1
        ? statusPattern[0]
        : statusPattern[index] ?? "not-started";

    return {
      id: `${createStableId(template.label)}-${index + 1}`,
      label: template.label,
      deadline: formatDateForInput(deadline),
      isDefaultStep: true,
      notes: `${songTitle}: ${template.label.toLowerCase()} notes`,
      budgetLines: getDefaultProductionStepBudgetLines(template.label),
      status,
      extraTasks: []
    } satisfies ProductionStep;
  });
}

function buildProductionStepsFromWorkbookSeed(seed: ProductionWorkbookSeed) {
  const productionDeadline =
    parseCampaignDate(seed.deadline) ?? new Date(Date.UTC(2026, 5, 26));

  return defaultProductionStepTemplates.map((template, index) => {
    const deadline = addUtcDays(productionDeadline, template.offset);

    return {
      id: `${createStableId(template.label)}-${index + 1}`,
      label: template.label,
      deadline: formatDateForInput(deadline),
      isDefaultStep: true,
      notes: getProductionStepWorkbookNote(seed, template.label),
      budgetLines: getDefaultProductionStepBudgetLines(template.label),
      status: getProductionStepWorkbookStatus(seed, template.label),
      extraTasks: []
    } satisfies ProductionStep;
  });
}

function getDefaultProductionStepBudgetLines(stepLabel: string): ProductionBudgetLine[] {
  if (stepLabel === "License") {
    return [
      {
        amount: -20,
        bucket: "production",
        description: "License",
        id: "default-license-budget"
      }
    ];
  }

  if (stepLabel === "Distributor") {
    return [
      {
        amount: -10,
        bucket: "production",
        description: "Distributor",
        id: "default-distributor-budget"
      }
    ];
  }

  return [];
}

function normalizeProductionSongsWithBudgetDefaults(
  songs: ProductionSongConfig[]
) {
  return songs.map((song) => ({
    ...song,
    steps: song.steps.map((step) => ({
      ...step,
      budgetLines:
        step.budgetLines !== undefined
          ? step.budgetLines
          : getDefaultProductionStepBudgetLines(step.label),
      extraTasks: step.extraTasks.map((task) => ({
        ...task,
        budgetLines: task.budgetLines ?? []
      }))
    }))
  }));
}

function getProductionSongForRelease(
  releaseTitle: string,
  songs: ProductionSongConfig[]
) {
  const releaseSlug = createStableId(releaseTitle);

  if (!releaseSlug) {
    return null;
  }

  return songs.find((song) => {
    const songSlug = createStableId(song.title);
    return (
      songSlug === releaseSlug ||
      songSlug.endsWith(`-${releaseSlug}`) ||
      songSlug.includes(releaseSlug)
    );
  }) ?? null;
}

function getProductionAlbumArtForRelease(
  releaseTitle: string,
  songs: ProductionSongConfig[]
) {
  return getProductionSongForRelease(releaseTitle, songs)?.albumArtUrl ?? "";
}

function getProductionStepWorkbookStatus(
  seed: ProductionWorkbookSeed,
  stepLabel: string
): MarketingStatus {
  if (seed.productionComment === "PRODUCED") {
    return "done";
  }

  if (stepLabel === "Demo") {
    return seed.demo ? "done" : "not-started";
  }

  if (stepLabel === "Drums") {
    return getWorkbookInstrumentStatus(seed.drums);
  }

  if (["Guitars", "Bass", "Vocals"].includes(stepLabel)) {
    return seed.productionComment === "CAN BE PRODUCED"
      ? "in-progress"
      : "not-started";
  }

  return "not-started";
}

function getWorkbookInstrumentStatus(value?: string) {
  if (value === "VV" || value === "X") {
    return "done";
  }

  if (value === "V" || value === "?") {
    return "in-progress";
  }

  return "not-started";
}

function getProductionStepWorkbookNote(
  seed: ProductionWorkbookSeed,
  stepLabel: string
) {
  const metadataNotes = [
    seed.productionComment,
    seed.style,
    seed.vocal ? `Vocal: ${seed.vocal}` : null,
    seed.bpm ? `BPM ${seed.bpm}` : null,
    seed.demoTime ? `Demo ${seed.demoTime}` : null,
    seed.other ? `Other: ${seed.other}` : null
  ].filter(Boolean);
  const compactNotes = [
    seed.productionComment,
    seed.style,
    seed.vocal ? `Vocal ${seed.vocal}` : null,
    seed.bpm ? `BPM ${seed.bpm}` : null
  ].filter(Boolean);
  const instrumentNotes = [
    `Drums ${seed.drums ?? "-"}`,
    `Piano ${seed.piano ?? "-"}`,
    `Violin ${seed.violin ?? "-"}`
  ].join(" / ");

  if (stepLabel === "Demo") {
    return seed.demo
      ? `Demo ready; ${metadataNotes.join("; ")}`
      : `No demo yet; ${compactNotes.join("; ")}`;
  }

  if (stepLabel === "Drums") {
    return `Workbook instruments: ${instrumentNotes}`;
  }

  if (stepLabel === "Vocals") {
    return `Vocal lead: ${seed.vocal ?? "not set"}; ${seed.productionComment}`;
  }

  if (stepLabel === "License") {
    return seed.releaseDate
      ? `Check license before release ${seed.releaseDate}`
      : "License check before release date is confirmed";
  }

  if (stepLabel === "Distributor") {
    return seed.releaseDate
      ? `Distributor deadline supports release ${seed.releaseDate}`
      : "Distributor deadline will link to Marketing release date later";
  }

  return compactNotes.join("; ") || `${seed.title}: ${stepLabel.toLowerCase()} notes`;
}

function createStableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDateForInput(date: Date) {
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join("/");
}

function formatModuleHeaderDate() {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Vienna",
    weekday: "short",
    year: "numeric"
  }).format(new Date());

  return date.toUpperCase();
}

function ModuleHeaderDate() {
  return <span className="topbar-date">{formatModuleHeaderDate()}</span>;
}

function sortBudgetEntriesByDate(entries: BudgetEntry[]) {
  return [...entries].sort(
    (firstEntry, secondEntry) =>
      getBudgetDateSortTime(secondEntry.date) - getBudgetDateSortTime(firstEntry.date)
  );
}

function sortBudgetEntriesForLedger(
  entries: BudgetEntry[],
  sortKey: BudgetLedgerSortKey,
  sortDirection: SortDirection
) {
  const directionMultiplier = sortDirection === "ascending" ? 1 : -1;

  return [...entries].sort((firstEntry, secondEntry) => {
    const comparison = compareBudgetEntries(firstEntry, secondEntry, sortKey);

    if (comparison !== 0) {
      return comparison * directionMultiplier;
    }

    return (
      getBudgetDateSortTime(secondEntry.date) - getBudgetDateSortTime(firstEntry.date)
    );
  });
}

function compareBudgetEntries(
  firstEntry: BudgetEntry,
  secondEntry: BudgetEntry,
  sortKey: BudgetLedgerSortKey
) {
  if (sortKey === "date") {
    return getBudgetDateSortTime(firstEntry.date) - getBudgetDateSortTime(secondEntry.date);
  }

  if (sortKey === "amount") {
    return getBudgetSignedAmount(firstEntry) - getBudgetSignedAmount(secondEntry);
  }

  if (sortKey === "bucket") {
    return compareText(
      getBudgetSourceBucket(firstEntry),
      getBudgetSourceBucket(secondEntry)
    );
  }

  if (sortKey === "type") {
    return compareText(getBudgetPaymentType(firstEntry), getBudgetPaymentType(secondEntry));
  }

  return compareText(firstEntry.description, secondEntry.description);
}

function compareText(firstValue: string, secondValue: string) {
  return firstValue.localeCompare(secondValue, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function sortEventEntriesByDate(entries: EventEntry[]) {
  return [...entries].sort(
    (firstEntry, secondEntry) =>
      getBudgetDateSortTime(secondEntry.date) - getBudgetDateSortTime(firstEntry.date)
  );
}

function normalizeEventEntries(entries: EventEntry[]) {
  return sortEventEntriesByDate(entries.map(normalizeEventBudgetLines));
}

function normalizeEventBudgetLines(entry: EventEntry): EventEntry {
  const existingBudgetLines = dedupeProductionBudgetLines(
    normalizeProductionBudgetLines(entry.budgetLines ?? [])
  );
  const migratedBudgetLines: ProductionBudgetLine[] = [];

  if (entry.earnedAmount && entry.earnedAmount > 0) {
    migratedBudgetLines.push({
      id: "event-budget-earned",
      amount: Math.abs(entry.earnedAmount),
      bucket: "events",
      description: entry.earnedDescription?.trim() || "earned"
    });
  }

  if (entry.spentAmount && entry.spentAmount > 0) {
    migratedBudgetLines.push({
      id: "event-budget-spent",
      amount: -Math.abs(entry.spentAmount),
      bucket: "events",
      description: entry.spentDescription?.trim() || "spent"
    });
  }

  return {
    ...entry,
    budgetLines:
      existingBudgetLines.length > 0
        ? existingBudgetLines
        : migratedBudgetLines.length > 0
          ? dedupeProductionBudgetLines(migratedBudgetLines)
          : ([
              {
                id: "event-budget-line-default",
                amount: 0,
                bucket: "events",
                description: ""
              }
            ] satisfies ProductionBudgetLine[])
  };
}

function dedupeProductionBudgetLines(lines: ProductionBudgetLine[]) {
  const seenLineFingerprints = new Set<string>();

  return lines.filter((line) => {
    const fingerprint = [
      line.description.trim().toLowerCase(),
      Number(line.amount).toFixed(2),
      getEventBudgetLineBucket(line)
    ].join("::");

    if (seenLineFingerprints.has(fingerprint)) {
      return false;
    }

    seenLineFingerprints.add(fingerprint);
    return true;
  });
}

function buildLocationAddressBookEntries(events: EventEntry[]) {
  const locationsByKey = new Map<string, LocationAddressBookEntry>();

  sortEventEntriesByDate(events).forEach((event) => {
    const locationName = event.locationName.trim();
    const address = event.address.trim();
    const key = getLocationConsolidationKey(locationName, address);

    if (!key) {
      return;
    }

    const nextLocation = {
      id: `location-${key}`,
      locationName: locationName || "Location name",
      locationUrl: event.locationUrl,
      address: address || "Address",
      addressUrl: event.addressUrl,
      contactName: "",
      contactPhone: "",
      contactNotes: ""
    };

    locationsByKey.set(
      key,
      mergeLocationAddressBookEntry(locationsByKey.get(key), nextLocation)
    );
  });

  return [...locationsByKey.values()].sort((firstLocation, secondLocation) =>
    firstLocation.locationName.localeCompare(secondLocation.locationName)
  );
}

function normalizeLocationAddressBookEntries(entries: unknown[]) {
  const normalizedEntries = entries
    .filter((entry): entry is Partial<LocationAddressBookEntry> =>
      Boolean(entry && typeof entry === "object")
    )
    .map((entry, index) => ({
      id:
        typeof entry.id === "string" && entry.id
          ? entry.id
          : `location-${Date.now()}-${index}`,
      dbId: typeof entry.dbId === "string" ? entry.dbId : undefined,
      locationName:
        typeof entry.locationName === "string" && entry.locationName
          ? entry.locationName
          : "Location name",
      locationUrl: typeof entry.locationUrl === "string" ? entry.locationUrl : "",
      address:
        typeof entry.address === "string" && entry.address ? entry.address : "Address",
      addressUrl: typeof entry.addressUrl === "string" ? entry.addressUrl : "",
      contactName: typeof entry.contactName === "string" ? entry.contactName : "",
      contactPhone: typeof entry.contactPhone === "string" ? entry.contactPhone : "",
      contactNotes: typeof entry.contactNotes === "string" ? entry.contactNotes : ""
    }));

  return consolidateLocationAddressBookEntries(normalizedEntries);
}

function mergeLocationAddressBookWithEvents(
  locations: LocationAddressBookEntry[],
  events: EventEntry[]
) {
  const existingKeys = new Set(
    locations.map((location) =>
      getLocationConsolidationKey(location.locationName, location.address)
    )
  );
  const missingLocations = buildLocationAddressBookEntries(events).filter(
    (location) =>
      !existingKeys.has(
        getLocationConsolidationKey(location.locationName, location.address)
      )
  );

  return consolidateLocationAddressBookEntries([...locations, ...missingLocations]);
}

function consolidateLocationAddressBookEntries(
  locations: LocationAddressBookEntry[]
) {
  const locationsByKey = new Map<string, LocationAddressBookEntry>();

  locations.forEach((location) => {
    const key = getLocationConsolidationKey(
      location.locationName,
      location.address
    );

    if (!key) {
      return;
    }

    locationsByKey.set(
      key,
      mergeLocationAddressBookEntry(locationsByKey.get(key), {
        ...location,
        id: location.id || `location-${key}`
      })
    );
  });

  return [...locationsByKey.values()].sort((firstLocation, secondLocation) =>
    firstLocation.locationName.localeCompare(secondLocation.locationName)
  );
}

function mergeLocationAddressBookEntry(
  currentLocation: LocationAddressBookEntry | undefined,
  nextLocation: LocationAddressBookEntry
) {
  if (!currentLocation) {
    return nextLocation;
  }

  return {
    ...currentLocation,
    locationName: getPreferredLocationName(
      currentLocation.locationName,
      nextLocation.locationName
    ),
    locationUrl: getPreferredLocationValue(
      currentLocation.locationUrl,
      nextLocation.locationUrl
    ),
    address: getPreferredLocationAddress(
      currentLocation.address,
      nextLocation.address
    ),
    addressUrl: getPreferredLocationValue(
      currentLocation.addressUrl,
      nextLocation.addressUrl
    ),
    contactName: getPreferredLocationValue(
      currentLocation.contactName,
      nextLocation.contactName
    ),
    contactPhone: getPreferredLocationValue(
      currentLocation.contactPhone,
      nextLocation.contactPhone
    ),
    contactNotes: mergeLocationNotes(
      currentLocation.contactNotes,
      nextLocation.contactNotes
    )
  };
}

function getPreferredLocationName(currentValue: string, nextValue: string) {
  if (!currentValue.trim()) {
    return nextValue;
  }

  if (!nextValue.trim()) {
    return currentValue;
  }

  if (currentValue === currentValue.toUpperCase() && nextValue !== nextValue.toUpperCase()) {
    return nextValue;
  }

  return currentValue.length >= nextValue.length ? currentValue : nextValue;
}

function getPreferredLocationAddress(currentValue: string, nextValue: string) {
  if (isBroadLocationAddress(currentValue)) {
    return nextValue || currentValue;
  }

  if (!currentValue.trim()) {
    return nextValue;
  }

  return currentValue.length >= nextValue.length ? currentValue : nextValue;
}

function getPreferredLocationValue(currentValue: string, nextValue: string) {
  return currentValue.trim() || nextValue.trim();
}

function mergeLocationNotes(currentValue: string, nextValue: string) {
  const currentNotes = currentValue.trim();
  const nextNotes = nextValue.trim();

  if (!currentNotes) {
    return nextNotes;
  }

  if (!nextNotes || currentNotes.includes(nextNotes)) {
    return currentNotes;
  }

  return `${currentNotes}\n${nextNotes}`;
}

function getLocationConsolidationKey(locationName: string, address: string) {
  const venueAlias = getLocationVenueAlias(locationName);
  const normalizedAddress = normalizeLocationText(address);

  if (venueAlias) {
    return `venue-${venueAlias}`;
  }

  if (normalizedAddress && !isBroadLocationAddress(address)) {
    return `address-${canonicalizeLocationAddress(address)}`;
  }

  return getLocationAddressBookKey(locationName, address);
}

function getLocationAddressBookKey(locationName: string, address: string) {
  const normalizedLocationName = normalizeLocationText(locationName);
  const normalizedAddress = canonicalizeLocationAddress(address);

  if (!normalizedLocationName && !normalizedAddress) {
    return "";
  }

  return `${normalizedLocationName}-${normalizedAddress}`;
}

function normalizeLocationText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalizeLocationAddress(address: string) {
  return normalizeLocationText(
    address
      .replace(/\bstr\.\b/gi, "strasse")
      .replace(/\bstraße\b/gi, "strasse")
      .replace(/\bstrasse\b/gi, "strasse")
      .replace(/\bösterreich\b/gi, "austria")
      .replace(/,\s*austria$/i, "")
  );
}

function isBroadLocationAddress(address: string) {
  const normalizedAddress = normalizeLocationText(address);

  return (
    !normalizedAddress ||
    normalizedAddress === "address" ||
    normalizedAddress === "vienna-austria" ||
    normalizedAddress === "vienna" ||
    normalizedAddress === "slovakia" ||
    normalizedAddress === "zadar-croatia"
  );
}

function getLocationVenueAlias(locationName: string) {
  const normalizedName = normalizeLocationText(locationName);
  const aliases: Record<string, string> = {
    "gradus": "gradus-club-wien",
    "gradus-club-wien": "gradus-club-wien",
    "mickey-finn-s-irish-pub": "mickey-finns-irish-pub",
    "mickey-finns-irish-pub": "mickey-finns-irish-pub",
    "pickwicks-international-bar-vienna": "pickwicks-international-bar-vienna",
    "saloon": "saloon-wien",
    "saloon-wien": "saloon-wien",
    "the-church-international-pub": "the-church-international-pub"
  };

  return aliases[normalizedName] ?? null;
}

function getPastEventsForLocation(
  location: LocationAddressBookEntry,
  events: EventEntry[]
) {
  const locationKey = getLocationAddressBookKey(
    location.locationName,
    location.address
  );
  const consolidatedLocationKey = getLocationConsolidationKey(
    location.locationName,
    location.address
  );
  const todayTime = getTodayUtcDate().getTime();

  return sortEventEntriesByDate(events).filter((event) => {
    const eventDate = parseFlexibleBudgetDate(event.date);

    return (
      eventDate !== null &&
      eventDate.getTime() <= todayTime &&
      (getLocationConsolidationKey(event.locationName, event.address) ===
        consolidatedLocationKey ||
        getLocationAddressBookKey(event.locationName, event.address) === locationKey)
    );
  });
}

function getMatchingLocationAddressBookEntry(
  event: EventEntry,
  locations: LocationAddressBookEntry[]
) {
  const eventLocationKey = getLocationAddressBookKey(
    event.locationName,
    event.address
  );
  const eventConsolidatedLocationKey = getLocationConsolidationKey(
    event.locationName,
    event.address
  );

  return locations.find(
    (location) =>
      getLocationConsolidationKey(location.locationName, location.address) ===
        eventConsolidatedLocationKey ||
      getLocationAddressBookKey(location.locationName, location.address) ===
        eventLocationKey
  );
}

function getNextUpcomingEvent(entries: EventEntry[]) {
  const todayTime = getTodayUtcDate().getTime();

  return [...entries]
    .map((entry) => ({
      entry,
      eventDate: parseFlexibleBudgetDate(entry.date)
    }))
    .filter(
      (candidate): candidate is { entry: EventEntry; eventDate: Date } =>
        candidate.eventDate !== null && candidate.eventDate.getTime() >= todayTime
    )
    .sort(
      (firstCandidate, secondCandidate) =>
        firstCandidate.eventDate.getTime() - secondCandidate.eventDate.getTime()
    )[0]?.entry ?? null;
}

function getDaysUntilDate(targetDate: Date) {
  const todayTime = getTodayUtcDate().getTime();
  return Math.ceil((targetDate.getTime() - todayTime) / 86_400_000);
}

function formatEventDaysLeft(days: number) {
  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "1 day left";
  }

  return `${days} days left`;
}

function getBudgetDateSortTime(dateInput: string) {
  return parseFlexibleBudgetDate(dateInput)?.getTime() ?? 0;
}

function parseFlexibleBudgetDate(value: string) {
  const normalizedValue = value.trim();
  const dottedMatch = normalizedValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (dottedMatch) {
    const [, day, month, year] = dottedMatch;
    return parseCampaignDate(`${day}/${month}/${year}`);
  }

  return parseCampaignDate(normalizedValue);
}

function getBudgetSummary(entries: BudgetEntry[]) {
  const today = getTodayUtcDate();
  const oneMonthAhead = addMonthsToDate(today, 1);
  const historicalEntries = entries.filter((entry) => {
    const entryDate = parseFlexibleBudgetDate(entry.date);
    return entryDate !== null && entryDate.getTime() <= today.getTime();
  });
  const upcomingEntries = entries.filter((entry) => {
    const entryDate = parseFlexibleBudgetDate(entry.date);
    return (
      entryDate !== null &&
      entryDate.getTime() > today.getTime() &&
      entryDate.getTime() <= oneMonthAhead.getTime()
    );
  });
  const totalEarned = historicalEntries
    .map(getBudgetSignedAmount)
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => sum + amount, 0);
  const totalSpent = historicalEntries
    .map(getBudgetSignedAmount)
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  const balance = totalEarned - totalSpent;
  const potentialEarn = upcomingEntries
    .map(getBudgetSignedAmount)
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => sum + amount, 0);
  const upcomingSpend = upcomingEntries
    .map(getBudgetSignedAmount)
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  const upcomingBalance = balance + potentialEarn - upcomingSpend;
  const bucketSummaries = getBudgetBucketSummaries(historicalEntries, upcomingEntries);

  return {
    balance,
    bucketSummaries,
    potentialEarn,
    upcomingSpend,
    totalEarned,
    totalSpent,
    upcomingBalance
  };
}

function getBudgetCashflowPoints(entries: BudgetEntry[]) {
  const monthlyEntries = new Map<string, { amount: number; date: Date }>();

  entries
    .map((entry) => ({
      amount: getBudgetSignedAmount(entry),
      date: parseFlexibleBudgetDate(entry.date)
    }))
    .filter(
      (entry): entry is { amount: number; date: Date } => entry.date !== null
    )
    .forEach((entry) => {
      const monthDate = new Date(
        Date.UTC(entry.date.getUTCFullYear(), entry.date.getUTCMonth(), 1)
      );
      const monthKey = monthDate.toISOString().slice(0, 7);
      const currentMonth = monthlyEntries.get(monthKey) ?? {
        amount: 0,
        date: monthDate
      };

      currentMonth.amount += entry.amount;
      monthlyEntries.set(monthKey, currentMonth);
    });

  let runningBalance = 0;

  return Array.from(monthlyEntries.values())
    .sort((firstEntry, secondEntry) => firstEntry.date.getTime() - secondEntry.date.getTime())
    .map((entry) => {
      runningBalance += entry.amount;

      return {
        balance: runningBalance,
        key: entry.date.toISOString().slice(0, 7),
        label: formatBudgetMonthLabel(entry.date)
      };
    });
}

function getBudgetMonthlyIncomeSpend(entries: BudgetEntry[]) {
  const months = new Map<string, { date: Date; income: number; spend: number }>();

  entries.forEach((entry) => {
    const entryDate = parseFlexibleBudgetDate(entry.date);

    if (!entryDate) {
      return;
    }

    const monthDate = new Date(
      Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), 1)
    );
    const monthKey = monthDate.toISOString().slice(0, 7);
    const currentMonth = months.get(monthKey) ?? {
      date: monthDate,
      income: 0,
      spend: 0
    };
    const signedAmount = getBudgetSignedAmount(entry);

    if (signedAmount >= 0) {
      currentMonth.income += signedAmount;
    } else {
      currentMonth.spend += Math.abs(signedAmount);
    }

    months.set(monthKey, currentMonth);
  });

  return Array.from(months.values())
    .sort((firstMonth, secondMonth) => firstMonth.date.getTime() - secondMonth.date.getTime())
    .map((month) => ({
      income: month.income,
      key: month.date.toISOString().slice(0, 7),
      label: formatBudgetMonthLabel(month.date),
      spend: month.spend
    }));
}

function formatBudgetMonthLabel(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC"
  });
}

function getBudgetBucketSummaries(
  historicalEntries: BudgetEntry[],
  upcomingEntries: BudgetEntry[]
) {
  return budgetSummaryBucketOptions.reduce(
    (summaries, bucket) => ({
      ...summaries,
      [bucket.value]: {
        historical: sumBudgetEntriesByBucket(historicalEntries, bucket.value),
        upcoming: sumBudgetEntriesByBucket(upcomingEntries, bucket.value)
      }
    }),
    {} as Record<Exclude<BudgetSourceBucket, "other">, { historical: number; upcoming: number }>
  );
}

function sumBudgetEntriesByBucket(
  entries: BudgetEntry[],
  bucket: BudgetSourceBucket
) {
  return entries
    .filter((entry) => getBudgetSourceBucket(entry) === bucket)
    .map(getBudgetSignedAmount)
    .reduce((sum, amount) => sum + amount, 0);
}

function getBudgetEntriesWithForecast(
  entries: BudgetEntry[],
  events: EventEntry[],
  marketingCampaigns: MarketingCampaignConfig[],
  productionSongs: ProductionSongConfig[],
  deletedForecastIds: string[]
) {
  const existingIds = new Set(entries.map((entry) => entry.id));
  const existingFingerprints = new Set(entries.map(getBudgetEntryFingerprint));
  const existingDateAmountFingerprints = new Set(
    entries.map(getBudgetEntryDateAmountFingerprint)
  );
  const deletedIds = new Set(deletedForecastIds);
  const recurringEntries = entries.flatMap((entry) =>
    generateBudgetRecurringEntries(entry).filter(
      (generatedEntry) =>
        !existingIds.has(generatedEntry.id) &&
        !deletedIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry)) &&
        !existingDateAmountFingerprints.has(
          getBudgetEntryDateAmountFingerprint(generatedEntry)
        )
    )
  );
  const eventEntries = events.flatMap((event) =>
    generateEventBudgetEntries(event).filter(
      (generatedEntry) =>
        !existingIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry))
    )
  );
  const marketingEntries = marketingCampaigns.flatMap((campaign) =>
    generateMarketingCampaignBudgetEntries(campaign).filter(
      (generatedEntry) =>
        !existingIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry))
    )
  );
  const productionEntries = productionSongs.flatMap((song) =>
    generateProductionBudgetEntries(song).filter(
      (generatedEntry) =>
        isBudgetEntryInVisibleBudgetWindow(generatedEntry) &&
        !existingIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry))
    )
  );

  return sortBudgetEntriesByDate([
    ...entries,
    ...recurringEntries,
    ...eventEntries,
    ...marketingEntries,
    ...productionEntries
  ]);
}

function isBudgetEntryInVisibleBudgetWindow(entry: BudgetEntry) {
  const entryDate = parseFlexibleBudgetDate(entry.date);
  const today = getTodayUtcDate();
  const oneMonthAhead = addMonthsToDate(today, 1);

  return (
    entryDate !== null &&
    entryDate.getTime() <= oneMonthAhead.getTime()
  );
}

function generateBudgetRecurringEntries(entry: BudgetEntry) {
  if (entry.type !== "recurring" || entry.generated) {
    return [];
  }

  const startDate = parseFlexibleBudgetDate(entry.date);
  const endDate = parseFlexibleBudgetDate(entry.paymentPlanEndDate ?? "");

  if (!startDate || !endDate) {
    return [];
  }

  const today = getTodayUtcDate();
  const forecastEndDate = addMonthsToDate(today, 1);
  const cadenceMonths = entry.recurringCadence === "yearly" ? 12 : 1;
  const generatedEntries: BudgetEntry[] = [];
  let occurrenceDate = addMonthsToDate(startDate, cadenceMonths);

  while (
    occurrenceDate.getTime() <= endDate.getTime() &&
    occurrenceDate.getTime() <= forecastEndDate.getTime()
  ) {
    generatedEntries.push({
      ...entry,
      bucket: getBudgetSourceBucket(entry),
      date: formatDateForInput(occurrenceDate),
      generated: true,
      id: getBudgetGeneratedEntryId(entry.id, occurrenceDate),
      sourceRecurringEntryId: entry.id
    });
    occurrenceDate = addMonthsToDate(occurrenceDate, cadenceMonths);
  }

  return generatedEntries;
}

function getBudgetGeneratedEntryId(entryId: string, occurrenceDate: Date) {
  return `budget-forecast-${entryId}-${occurrenceDate.toISOString().slice(0, 10)}`;
}

function generateEventBudgetEntries(event: EventEntry) {
  return (event.budgetLines ?? [])
    .filter((line) => line.amount !== 0)
    .map((line) => ({
      amount: line.amount,
      bucket: getEventBudgetLineBucket(line),
      date: event.date,
      description: getEventBudgetDescription(event.name, line),
      generated: true,
      id: getBudgetEventGeneratedEntryId(event.id, line),
      sourceEventEntryId: event.id,
      type: "one-off" as const
    }));
}

function generateMarketingCampaignBudgetEntries(
  campaign: MarketingCampaignConfig
) {
  return (campaign.budgetLines ?? [])
    .filter((line) => line.amount !== 0)
    .map((line) => ({
      amount: line.amount,
      bucket: "marketing" as const,
      date: campaign.releaseDate,
      description: getMarketingCampaignBudgetDescription(
        campaign.releaseTitle,
        line
      ),
      generated: true,
      id: getBudgetMarketingCampaignGeneratedEntryId(campaign.id, line),
      sourceMarketingCampaignId: campaign.id,
      type: "one-off" as const
    }));
}

function getBudgetMarketingCampaignGeneratedEntryId(
  campaignId: string,
  line: ProductionBudgetLine
) {
  return `budget-marketing-${campaignId}-${line.id}-${line.amount.toFixed(2)}`;
}

function getMarketingCampaignBudgetDescription(
  campaignTitle: string,
  line: ProductionBudgetLine
) {
  const cleanDescription = line.description.trim();

  if (!cleanDescription) {
    return `${campaignTitle} marketing ${line.amount > 0 ? "earned" : "spent"}`;
  }

  return `${campaignTitle} marketing - ${cleanDescription}`;
}

function generateProductionBudgetEntries(song: ProductionSongConfig) {
  return song.steps.flatMap((step) => {
    const stepBudgetLines =
      step.budgetLines !== undefined
        ? step.budgetLines
        : getFallbackProductionStepBudgetLines(step);
    const stepEntries = generateProductionBudgetLineEntries({
      budgetLines: stepBudgetLines,
      date: step.deadline,
      itemId: `${song.id}-${step.id}`,
      itemName: step.label,
      songTitle: song.title
    });
    const taskEntries = step.extraTasks.flatMap((task) =>
      generateProductionBudgetLineEntries({
        budgetLines: task.budgetLines ?? [],
        date: step.deadline,
        itemId: `${song.id}-${step.id}-${task.id}`,
        itemName: task.title,
        songTitle: song.title
      })
    );

    return [...stepEntries, ...taskEntries];
  });
}

function getFallbackProductionStepBudgetLines(step: ProductionStep) {
  if (!step.isDefaultStep) {
    return [];
  }

  return getDefaultProductionStepBudgetLines(step.label);
}

function generateProductionBudgetLineEntries({
  budgetLines,
  date,
  itemId,
  itemName,
  songTitle
}: {
  budgetLines: ProductionBudgetLine[];
  date: string;
  itemId: string;
  itemName: string;
  songTitle: string;
}) {
  return budgetLines
    .filter((line) => line.amount !== 0)
    .map((line) => ({
      amount: line.amount,
      bucket: getProductionBudgetLineBucket(line),
      date,
      description: getProductionBudgetDescription(songTitle, itemName, line),
      generated: true,
      id: getBudgetProductionGeneratedEntryId(itemId, line),
      sourceProductionItemId: itemId,
      type: "one-off" as const
    }));
}

function getBudgetProductionGeneratedEntryId(
  itemId: string,
  line: ProductionBudgetLine
) {
  return `budget-production-${itemId}-${line.id}-${line.amount.toFixed(2)}`;
}

function getProductionBudgetDescription(
  songTitle: string,
  itemName: string,
  line: ProductionBudgetLine
) {
  const cleanDescription = line.description.trim();
  const suffix = cleanDescription || (line.amount > 0 ? "earned" : "spent");

  return `${songTitle} - ${itemName} - ${suffix}`;
}

function getBudgetEventGeneratedEntryId(
  eventId: string,
  line: ProductionBudgetLine
) {
  return `budget-event-${eventId}-${line.id}-${line.amount.toFixed(2)}`;
}

function getEventBudgetDescription(
  eventName: string,
  line: ProductionBudgetLine
) {
  const cleanDescription = line.description.trim();

  if (!cleanDescription) {
    return `${eventName} ${line.amount > 0 ? "earned" : "spent"}`;
  }

  return `${eventName} - ${cleanDescription}`;
}

function getBudgetEntryFingerprint(entry: BudgetEntry) {
  return [
    entry.date,
    entry.description.trim().toLowerCase(),
    getBudgetSignedAmount(entry)
  ].join("|");
}

function getBudgetEntryDateAmountFingerprint(entry: BudgetEntry) {
  return [entry.date, getBudgetSignedAmount(entry)].join("|");
}

function addMonthsToDate(date: Date, months: number) {
  const nextDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
  const targetDay = date.getUTCDate();
  const lastDayOfMonth = new Date(
    Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)
  ).getUTCDate();

  nextDate.setUTCDate(Math.min(targetDay, lastDayOfMonth));
  return nextDate;
}

function getBudgetSignedAmount(entry: BudgetEntry) {
  if (entry.amount < 0) {
    return entry.amount;
  }

  if (entry.type === "spent") {
    return -Math.abs(entry.amount);
  }

  return entry.amount;
}

const budgetSourceBucketOptions: Array<{
  label: string;
  value: BudgetSourceBucket;
}> = [
  { label: "Events", value: "events" },
  { label: "Production", value: "production" },
  { label: "Marketing", value: "marketing" },
  { label: "Other", value: "other" }
];

const budgetSummaryBucketOptions: Array<{
  label: string;
  value: Exclude<BudgetSourceBucket, "other">;
}> = [
  { label: "Events", value: "events" },
  { label: "Production", value: "production" },
  { label: "Marketing", value: "marketing" }
];

const eventBudgetBucketOptions = budgetSourceBucketOptions.filter(
  (bucket) => bucket.value !== "production"
);

function getBudgetSourceBucket(entry: BudgetEntry): BudgetSourceBucket {
  if (
    entry.bucket === "events" ||
    entry.bucket === "production" ||
    entry.bucket === "marketing" ||
    entry.bucket === "other"
  ) {
    return entry.bucket;
  }

  if (entry.sourceEventEntryId) {
    return "events";
  }

  if (entry.sourceProductionItemId || entry.sourceRecurringEntryId) {
    return "production";
  }

  if (entry.sourceMarketingCampaignId) {
    return "marketing";
  }

  return inferBudgetSourceBucket(entry.description);
}

function inferBudgetSourceBucket(description: string): BudgetSourceBucket {
  const normalizedDescription = description.toLowerCase();

  if (
    normalizedDescription.includes("pickwick") ||
    normalizedDescription.includes("gig") ||
    normalizedDescription.includes("wedding") ||
    normalizedDescription.includes("lebenszeit") ||
    normalizedDescription.includes("event")
  ) {
    return "events";
  }

  if (
    normalizedDescription.includes("canva") ||
    normalizedDescription.includes("photo") ||
    normalizedDescription.includes("ads") ||
    normalizedDescription.includes("marketing") ||
    normalizedDescription.includes("promo")
  ) {
    return "marketing";
  }

  return "production";
}

function normalizeBudgetSourceBucket(value?: string): BudgetSourceBucket {
  if (
    value === "events" ||
    value === "production" ||
    value === "marketing" ||
    value === "other"
  ) {
    return value;
  }

  return "production";
}

function getProductionBudgetLineBucket(
  line: ProductionBudgetLine
): BudgetSourceBucket {
  return "production";
}

function getEventBudgetLineBucket(line: ProductionBudgetLine): BudgetSourceBucket {
  if (
    line.bucket === "events" ||
    line.bucket === "marketing" ||
    line.bucket === "other"
  ) {
    return line.bucket;
  }

  return "events";
}

function getBudgetGeneratedSourceLabel(entry: BudgetEntry) {
  if (entry.sourceEventEntryId) {
    return "Events";
  }

  if (entry.sourceMarketingCampaignId) {
    return "Marketing";
  }

  if (entry.sourceProductionItemId) {
    return "Production";
  }

  if (entry.sourceRecurringEntryId) {
    return "Recurring";
  }

  return null;
}

function canDeleteBudgetEntryFromLedger(entry: BudgetEntry) {
  return !entry.generated || Boolean(entry.sourceRecurringEntryId);
}

function getBudgetPaymentType(entry: BudgetEntry) {
  return entry.type === "recurring" ? "recurring" : "one-off";
}

function getAmountToneClass(value: number) {
  if (value < 0) {
    return "amount-negative";
  }

  return "amount-positive";
}

function getTransactionAmountToneClass(value: number) {
  if (value < 0) {
    return "amount-expense";
  }

  if (value > 0) {
    return "amount-positive";
  }

  return undefined;
}

function getBudgetBucketToneClass(bucket: BudgetSourceBucket, value: number) {
  if (bucket === "production" || bucket === "marketing") {
    return "amount-expense";
  }

  return getAmountToneClass(value);
}

function parseEditableAmount(value: string) {
  const normalizedValue = value.trim().replace(/,/g, "");

  if (normalizedValue === "") {
    return 0;
  }

  if (
    normalizedValue === "-" ||
    normalizedValue === "+" ||
    normalizedValue === "." ||
    normalizedValue === "-." ||
    normalizedValue === "+."
  ) {
    return null;
  }

  const amount = Number(normalizedValue);

  return Number.isFinite(amount) ? amount : null;
}

function formatEditableAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "EUR",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency"
  }).format(value);
}

function formatSpentCurrency(value: number) {
  return formatCurrency(-Math.abs(value));
}

function getCampaignSortTime(releaseDateInput: string) {
  return parseCampaignDate(releaseDateInput)?.getTime() ?? 0;
}

function getCampaignCompletionScore(campaign: MarketingCampaignConfig) {
  const days =
    campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds);

  return calculateCampaignCompletion(days);
}

function getDashboardCampaignPreview(campaigns: MarketingCampaignConfig[]) {
  const today = getTodayUtcDate();
  const sortedCampaigns = sortCampaignsByReleaseDate(campaigns);
  const current =
    sortedCampaigns.find((campaign) => isCampaignActive(campaign, today)) ??
    null;
  const benchmark =
    [...sortedCampaigns]
      .sort(
        (firstCampaign, secondCampaign) =>
          getCampaignCompletionScore(secondCampaign) -
            getCampaignCompletionScore(firstCampaign) ||
          getCampaignSortTime(secondCampaign.releaseDate) -
            getCampaignSortTime(firstCampaign.releaseDate)
      )[0] ?? null;
  const next =
    sortedCampaigns
      .filter((campaign) => {
        const releaseDate = parseCampaignDate(campaign.releaseDate);
        return releaseDate ? releaseDate.getTime() >= today.getTime() : false;
      })
      .sort(
        (firstCampaign, secondCampaign) =>
          getCampaignSortTime(firstCampaign.releaseDate) -
          getCampaignSortTime(secondCampaign.releaseDate)
      )
      .find((campaign) => campaign.id !== current?.id) ?? null;

  return { benchmark, current, next };
}

function getProductionCompletionScore(song: ProductionSongConfig) {
  return calculateProductionCompletion(song.steps);
}

function getProductionBenchmarkDays(song: ProductionSongConfig) {
  const sortedSteps = sortProductionStepsByDeadline(song.steps);
  const firstStep = sortedSteps[0];
  const firstWorkStep =
    firstStep?.label === "Demo" && firstStep.status === "done"
      ? sortedSteps[1] ?? firstStep
      : firstStep;
  const lastStep = sortedSteps.at(-1);
  const startDate = firstWorkStep ? parseCampaignDate(firstWorkStep.deadline) : null;
  const endDate = lastStep ? parseCampaignDate(lastStep.deadline) : null;

  if (!startDate || !endDate) {
    return null;
  }

  return Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
  );
}

function getDashboardProductionPreview(songs: ProductionSongConfig[]) {
  const sortedSongs = sortProductionSongsByDeadline(songs);
  const [current, next] = sortedSongs;
  const completedSongs = sortedSongs.filter(
    (song) => getProductionCompletionScore(song) === 100
  );
  const benchmarkCandidates = completedSongs.length > 0 ? completedSongs : sortedSongs;
  const benchmark =
    benchmarkCandidates
      .sort((firstSong, secondSong) => {
        const firstDays = getProductionBenchmarkDays(firstSong) ?? Number.MAX_SAFE_INTEGER;
        const secondDays = getProductionBenchmarkDays(secondSong) ?? Number.MAX_SAFE_INTEGER;

        return (
          firstDays - secondDays ||
          getProductionCompletionScore(secondSong) -
            getProductionCompletionScore(firstSong) ||
          getCampaignSortTime(secondSong.deadline) -
            getCampaignSortTime(firstSong.deadline)
        );
      })[0] ?? null;

  return { benchmark, current: current ?? null, next: next ?? null };
}

function getDashboardFocusQueue(
  campaignPreview: ReturnType<typeof getDashboardCampaignPreview>,
  productionPreviewSongs: ProductionSongConfig[],
  otherTasks: OtherTask[] = [],
  utilityTasks: FocusQueueItem[] = []
) {
  const selectedCampaign = campaignPreview.current ?? campaignPreview.next;
  const selectedSong = productionPreviewSongs[0] ?? productionPreviewSongs[1] ?? null;
  const marketingTasks = selectedCampaign
    ? getNextCampaignTasks(
        selectedCampaign.campaignDays ??
          buildCampaignDays(selectedCampaign.releaseDate, selectedCampaign.daySeeds)
      )
    : [];
  const productionTasks = selectedSong ? getNextProductionTasks(selectedSong.steps) : [];
  const marketingFocusItems = selectedCampaign
    ? marketingTasks.map((task) =>
        toFocusQueueItem(
          task,
          "Marketing",
          getMarketingFocusActionTarget(selectedCampaign.id, task.id)
        )
      )
    : [];
  const productionFocusItems = selectedSong
    ? productionTasks.map((task) =>
        toFocusQueueItem(
          task,
          "Production",
          getProductionFocusActionTarget(selectedSong, task.id)
        )
      )
    : [];
  const primaryMarketingTask = marketingTasks[0]
    ? marketingFocusItems[0]
    : null;
  const primaryProductionTask = productionTasks[0]
    ? productionFocusItems[0]
    : null;
  const activeOtherTasks = otherTasks
    .filter((task) => task.status !== "done" && task.status !== "irrelevant")
    .sort(
      (firstTask, secondTask) =>
        getBudgetDateSortTime(firstTask.dueDate) -
          getBudgetDateSortTime(secondTask.dueDate) ||
        firstTask.title.localeCompare(secondTask.title)
    )
    .map(toOtherFocusQueueItem);
  const otherHistoryTasks = otherTasks
    .filter((task) => task.status === "done" || task.status === "irrelevant")
    .sort(
      (firstTask, secondTask) =>
        getBudgetDateSortTime(secondTask.dueDate) -
          getBudgetDateSortTime(firstTask.dueDate) ||
        firstTask.title.localeCompare(secondTask.title)
    )
    .map(toOtherFocusQueueItem);

  return {
    allTasks: [
      ...(primaryMarketingTask ? [primaryMarketingTask] : []),
      ...(primaryProductionTask ? [primaryProductionTask] : []),
      ...utilityTasks,
      ...activeOtherTasks
    ],
    visibleTasks: [
      primaryMarketingTask,
      primaryProductionTask,
      ...utilityTasks,
      ...activeOtherTasks.slice(0, 3)
    ].filter((task): task is FocusQueueItem => Boolean(task))
  };
}

function getCampaignDailyProgressItems(
  campaign: MarketingCampaignConfig,
  days: CampaignDay[]
) {
  return days.flatMap((day): Array<Omit<DailyFocusProgressItem, "date">> => [
    {
      label: `${campaign.releaseTitle} - ${day.date} - Make video / post`,
      source: "Marketing",
      status: day.statuses.production,
      taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:production`
    },
    {
      label: `${campaign.releaseTitle} - ${day.date} - IG Upload`,
      source: "Marketing",
      status: day.statuses.instagramUpload,
      taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:instagram`
    },
    {
      label: `${campaign.releaseTitle} - ${day.date} - YT upload`,
      source: "Marketing",
      status: day.statuses.youtubeUpload,
      taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:youtube`
    },
    ...(hasReleaseDayDefaultTasks(day)
      ? [
          {
            label: `${campaign.releaseTitle} - ${day.date} - Update website`,
            source: "Marketing" as const,
            status: day.statuses.websiteUpdate,
            taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:website-update`
          },
          {
            label: `${campaign.releaseTitle} - ${day.date} - Facebook post`,
            source: "Marketing" as const,
            status: day.statuses.facebookPost,
            taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:facebook-post`
          },
          {
            label: `${campaign.releaseTitle} - ${day.date} - YouTube post`,
            source: "Marketing" as const,
            status: day.statuses.youtubePost,
            taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:youtube-post`
          }
        ]
      : []),
    ...day.extraTasks.map((task) => ({
      label: `${campaign.releaseTitle} - ${day.date} - ${task.title}`,
      source: "Marketing" as const,
      status: task.status,
      taskKey: `marketing:${campaign.id}:day:${day.dayNumber}:extra:${task.id}`
    }))
  ]);
}

function getProductionDailyProgressItems(song: ProductionSongConfig) {
  return song.steps.flatMap(
    (step): Array<Omit<DailyFocusProgressItem, "date">> => [
      {
        label: `${song.title} - ${step.label}`,
        source: "Production",
        status: step.status,
        taskKey: `production:${song.id}:step:${step.id}:main`
      },
      ...step.extraTasks.map((task) => ({
        label: `${song.title} - ${step.label} - ${task.title}`,
        source: "Production" as const,
        status: task.status,
        taskKey: `production:${song.id}:step:${step.id}:extra:${task.id}`
      }))
    ]
  );
}

function getChangedDailyProgressItems(
  previousItems: Array<Omit<DailyFocusProgressItem, "date">>,
  nextItems: Array<Omit<DailyFocusProgressItem, "date">>
) {
  const previousStatusByKey = new Map(
    previousItems.map((item) => [item.taskKey, item.status])
  );

  return nextItems.filter(
    (item) => previousStatusByKey.get(item.taskKey) !== item.status
  );
}

function toFocusQueueItem(
  task: CampaignTaskItem,
  source: FocusQueueItem["source"],
  actionTarget?: FocusQueueActionTarget
): FocusQueueItem {
  return {
    ...task,
    actionTarget,
    id: `${source.toLowerCase()}-${task.id}`,
    source
  };
}

function toOtherFocusQueueItem(task: OtherTask): FocusQueueItem {
  const dueDate = parseFlexibleBudgetDate(task.dueDate);
  const title = task.title.trim() || "Untitled task";
  const notes = task.notes.trim();

  return {
    dueDate: task.dueDate,
    id: `other-${task.id}`,
    label: `${dueDate ? formatCampaignDate(dueDate) : task.dueDate} - ${title}${
      notes ? ` - ${notes}` : ""
    }`,
    notes: task.notes,
    source: "Other",
    status: task.status
  };
}

function normalizeOtherTasks(tasks: unknown[]): OtherTask[] {
  return tasks
    .filter((task): task is Partial<OtherTask> => Boolean(task && typeof task === "object"))
    .map((task, index) => ({
      dueDate:
        typeof task.dueDate === "string" && task.dueDate
          ? task.dueDate
          : formatDateForInput(getTodayUtcDate()),
      id:
        typeof task.id === "string" && task.id
          ? task.id
          : `other-task-${Date.now()}-${index}`,
      notes: typeof task.notes === "string" ? task.notes : "",
      status: marketingUploadStatusOptions.includes(task.status as MarketingStatus)
        ? (task.status as MarketingStatus)
        : "not-started",
      title:
        typeof task.title === "string"
          ? task.title
          : "Other task"
    }));
}

function getMarketingFocusActionTarget(
  campaignId: string,
  taskId: string
): FocusQueueActionTarget | undefined {
  const [dayNumberValue] = taskId.split("-");
  const dayNumber = Number(dayNumberValue);
  const taskKeyValue = taskId.slice(`${dayNumberValue}-`.length);

  if (!Number.isFinite(dayNumber)) {
    return undefined;
  }

  if (taskKeyValue === "production") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "production" };
  }

  if (taskKeyValue === "instagram") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "instagramUpload" };
  }

  if (taskKeyValue === "youtube") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "youtubeUpload" };
  }

  if (taskKeyValue === "website-update") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "websiteUpdate" };
  }

  if (taskKeyValue === "facebook-post") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "facebookPost" };
  }

  if (taskKeyValue === "youtube-post") {
    return { campaignId, dayNumber, kind: "marketing", taskKey: "youtubePost" };
  }

  return {
    campaignId,
    dayNumber,
    extraTaskId: taskKeyValue,
    kind: "marketing"
  };
}

function getProductionFocusActionTarget(
  song: ProductionSongConfig,
  taskId: string
): FocusQueueActionTarget | undefined {
  const mainStep = song.steps.find((step) => taskId === `${step.id}-main`);

  if (mainStep) {
    return {
      kind: "production",
      songId: song.id,
      stepId: mainStep.id,
      taskKey: "main"
    };
  }

  for (const step of song.steps) {
    const extraTask = step.extraTasks.find((task) => taskId === `${step.id}-${task.id}`);

    if (extraTask) {
      return {
        extraTaskId: extraTask.id,
        kind: "production",
        songId: song.id,
        stepId: step.id,
        taskKey: "extra"
      };
    }
  }

  return undefined;
}

function getTaskDateSortTime(label: string) {
  const dateMatch = label.match(/\b\d{2}\/\d{2}\/\d{4}\b/);

  if (!dateMatch) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parseCampaignDate(dateMatch[0])?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function getCampaignEndDate(campaign: MarketingCampaignConfig) {
  if (campaign.campaignDays?.length) {
    const campaignDates = campaign.campaignDays
      .map((day) => parseCampaignDateKey(day.dateKey))
      .filter((date): date is Date => Boolean(date))
      .sort((firstDate, secondDate) => firstDate.getTime() - secondDate.getTime());

    return campaignDates[campaignDates.length - 1] ?? null;
  }

  const releaseDate = parseCampaignDate(campaign.releaseDate);

  if (!releaseDate) {
    return null;
  }

  return addUtcDays(addUtcDays(releaseDate, -4), defaultCampaignDayCount - 1);
}

function isCampaignActive(campaign: MarketingCampaignConfig, today: Date) {
  const releaseDate = parseCampaignDate(campaign.releaseDate);

  if (!releaseDate) {
    return false;
  }

  if (campaign.campaignDays?.length) {
    const campaignDates = campaign.campaignDays
      .map((day) => parseCampaignDateKey(day.dateKey))
      .filter((date): date is Date => Boolean(date))
      .sort((firstDate, secondDate) => firstDate.getTime() - secondDate.getTime());
    const startDate = campaignDates[0];
    const endDate = campaignDates[campaignDates.length - 1];

    return Boolean(startDate && endDate && today >= startDate && today <= endDate);
  }

  const startDate = addUtcDays(releaseDate, -4);
  const endDate = addUtcDays(startDate, defaultCampaignDayCount - 1);

  return today >= startDate && today <= endDate;
}

function getTodayUtcDate() {
  const today = new Date();
  return new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function getViennaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Vienna",
    year: "numeric"
  }).formatToParts(new Date());
  const valueByType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function buildCampaignDays(
  releaseDateInput: string,
  daySeeds: CampaignDaySeed[] = []
) {
  const releaseDate =
    parseCampaignDate(releaseDateInput) ?? new Date(Date.UTC(2026, 6, 10));
  const seedByDate = new Map(daySeeds.map((seed) => [seed.dateKey, seed]));

  return Array.from({ length: defaultCampaignDayCount }, (_, index) =>
    applyCampaignDaySeed(buildCampaignDay(releaseDate, index), seedByDate)
  );
}

function mapMarketingCampaignRows(rows: MarketingCampaignDbRow[]) {
  return sortCampaignsByReleaseDate(
    rows.map((campaign) => ({
      id: campaign.slug,
      dbId: campaign.id,
      releaseTitle: campaign.title,
      releaseDate: formatDateKeyForInput(campaign.release_date),
      albumArtUrl: campaign.album_art_url,
      campaignDays: mapMarketingCampaignDayRows(
        campaign.marketing_campaign_days ?? [],
        shouldIncludeReleaseDayDefaults(campaign.release_date)
      )
    }))
  );
}

function shouldIncludeReleaseDayDefaults(releaseDateKey: string) {
  const releaseDate = parseCampaignDateKey(releaseDateKey);
  const today = parseCampaignDateKey(getViennaDateKey());

  if (!releaseDate || !today) return false;

  return addUtcDays(releaseDate, defaultCampaignDayCount - 5) >= today;
}

function mergeMarketingCampaignLocalBudgetLines(
  nextCampaigns: MarketingCampaignConfig[],
  currentCampaigns: MarketingCampaignConfig[]
) {
  const campaignByKey = new Map<string, MarketingCampaignConfig>();

  currentCampaigns.forEach((campaign) => {
    [campaign.id, campaign.dbId, campaign.releaseTitle]
      .filter(Boolean)
      .forEach((key) => {
        campaignByKey.set(key as string, campaign);
      });
  });

  return sortCampaignsByReleaseDate(
    nextCampaigns.map((campaign) => {
      const localCampaign =
        campaignByKey.get(campaign.id) ??
        (campaign.dbId ? campaignByKey.get(campaign.dbId) : undefined) ??
        campaignByKey.get(campaign.releaseTitle);

      return {
        ...campaign,
        budgetLines: localCampaign?.budgetLines ?? campaign.budgetLines ?? []
      };
    })
  );
}

function mapMarketingCampaignDayRows(
  rows: MarketingCampaignDayDbRow[],
  includeReleaseTasks: boolean
) {
  return [...rows]
    .sort((firstDay, secondDay) => firstDay.day_number - secondDay.day_number)
    .map((day) => {
      const tasks = day.marketing_campaign_tasks ?? [];
      const standardTaskByKind = new Map(
        tasks
          .filter((task) => task.is_standard_task)
          .map((task) => [task.task_kind, task])
      );

      return {
        dayNumber: day.day_number,
        date: formatCampaignDateKey(day.campaign_date),
        dateKey: day.campaign_date,
        isDefaultDay: day.is_default_day,
        releaseOffset: day.release_offset,
        clipName: day.clip_name,
        extraTasks: tasks
          .filter((task) => task.task_kind === "extra")
          .sort((firstTask, secondTask) => firstTask.position - secondTask.position)
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status
          })),
        statuses: {
          facebookPost:
            includeReleaseTasks && day.release_offset === 0
              ? standardTaskByKind.get("facebook_post")?.status ?? "not-started"
              : "irrelevant",
          websiteUpdate:
            includeReleaseTasks && day.release_offset === 0
              ? standardTaskByKind.get("website_update")?.status ?? "not-started"
              : "irrelevant",
          youtubePost:
            includeReleaseTasks && day.release_offset === 0
              ? standardTaskByKind.get("youtube_post")?.status ?? "not-started"
              : "irrelevant",
          production:
            standardTaskByKind.get("production")?.status ?? "not-started",
          instagramUpload:
            standardTaskByKind.get("instagram_upload")?.status ?? "not-started",
          youtubeUpload:
            standardTaskByKind.get("youtube_upload")?.status ?? "not-started"
        }
      } satisfies CampaignDay;
    });
}

function mapProductionRows({
  budgetLines,
  songs,
  steps,
  tasks
}: {
  budgetLines: ProductionBudgetLineDbRow[];
  songs: ProductionSongDbRow[];
  steps: ProductionStepDbRow[];
  tasks: ProductionStepTaskDbRow[];
}) {
  const tasksByStepId = new Map<string, ProductionStepTaskDbRow[]>();
  const stepBudgetLinesByStepId = new Map<string, ProductionBudgetLineDbRow[]>();
  const taskBudgetLinesByTaskId = new Map<string, ProductionBudgetLineDbRow[]>();

  for (const task of tasks) {
    tasksByStepId.set(task.production_step_id, [
      ...(tasksByStepId.get(task.production_step_id) ?? []),
      task
    ]);
  }

  for (const budgetLine of budgetLines) {
    if (budgetLine.production_step_id) {
      stepBudgetLinesByStepId.set(budgetLine.production_step_id, [
        ...(stepBudgetLinesByStepId.get(budgetLine.production_step_id) ?? []),
        budgetLine
      ]);
    }

    if (budgetLine.production_step_task_id) {
      taskBudgetLinesByTaskId.set(budgetLine.production_step_task_id, [
        ...(taskBudgetLinesByTaskId.get(budgetLine.production_step_task_id) ?? []),
        budgetLine
      ]);
    }
  }

  return sortProductionSongsByDeadline(
    songs.map((song) => ({
      albumArtUrl: song.album_art_url,
      dbId: song.id,
      deadline: formatDateKeyForInput(song.production_deadline),
      id: song.slug,
      steps: steps
        .filter((step) => step.production_song_id === song.id)
        .sort((firstStep, secondStep) => firstStep.position - secondStep.position)
        .map((step) => ({
          budgetLines: mapProductionBudgetLineRows(
            stepBudgetLinesByStepId.get(step.id) ?? []
          ),
          deadline: formatDateKeyForInput(step.step_deadline),
          extraTasks: (tasksByStepId.get(step.id) ?? [])
            .sort((firstTask, secondTask) => firstTask.position - secondTask.position)
            .map((task) => ({
              budgetLines: mapProductionBudgetLineRows(
                taskBudgetLinesByTaskId.get(task.id) ?? []
              ),
              id: task.id,
              status: task.status,
              title: task.title
            })),
          id: step.stable_key,
          isDefaultStep: step.is_default_step,
          label: step.label,
          notes: step.notes,
          status: step.status
        })),
      title: song.title
    }))
  );
}

function mapProductionBudgetLineRows(rows: ProductionBudgetLineDbRow[]) {
  return rows
    .sort((firstLine, secondLine) => firstLine.position - secondLine.position)
    .map((line) => ({
      amount: Number(line.amount),
      bucket: normalizeBudgetSourceBucket(line.budget_bucket ?? "production"),
      description: line.description,
      id: line.id
    }));
}

function mapEventsSnapshotRows({
  budgetLines,
  entries,
  locations
}: {
  budgetLines: EventBudgetLineDbRow[];
  entries: EventDbRow[];
  locations: EventLocationDbRow[];
}): EventsSnapshot {
  const budgetLinesByEventId = new Map<string, EventBudgetLineDbRow[]>();

  budgetLines.forEach((line) => {
    budgetLinesByEventId.set(line.event_id, [
      ...(budgetLinesByEventId.get(line.event_id) ?? []),
      line
    ]);
  });

  return {
    entries: normalizeEventEntries(
      entries.map((entry) => ({
        address: entry.address,
        addressUrl: entry.address_url,
        budgetLines: mapEventBudgetLineRows(
          budgetLinesByEventId.get(entry.id) ?? []
        ),
        date: formatDateKeyForInput(entry.event_date),
        dbId: entry.id,
        id: entry.stable_key,
        locationName: entry.location_name,
        locationUrl: entry.location_url,
        name: entry.event_name,
        nameUrl: entry.event_url,
        posterUrl: entry.poster_url ?? ""
      }))
    ),
    locations: normalizeLocationAddressBookEntries(
      locations.map((location) => ({
        address: location.address,
        addressUrl: location.address_url,
        contactName: location.contact_name,
        contactNotes: location.contact_notes,
        contactPhone: location.contact_phone,
        dbId: location.id,
        id: location.stable_key,
        locationName: location.location_name,
        locationUrl: location.location_url
      }))
    )
  };
}

function mapEventBudgetLineRows(rows: EventBudgetLineDbRow[]) {
  return rows
    .sort((firstLine, secondLine) => firstLine.position - secondLine.position)
    .map((line) => ({
      amount: Number(line.amount),
      bucket: getEventBudgetLineBucket({
        amount: Number(line.amount),
        bucket: line.budget_bucket ?? "events",
        description: line.description,
        id: line.id
      }),
      description: line.description,
      id: line.id
    }));
}

function applyCampaignDaySeed(
  day: CampaignDay,
  seedByDate: Map<string, CampaignDaySeed>
) {
  const seed = seedByDate.get(day.dateKey);

  if (!seed) {
    return day;
  }

  return {
    ...day,
    clipName: seed.clipName,
    statuses: {
      ...day.statuses,
      production:
        seed.instagramDone || seed.youtubeDone ? "done" : day.statuses.production,
      instagramUpload: seed.instagramDone ? "done" : "not-started",
      youtubeUpload: seed.youtubeDone ? "done" : "not-started"
    } satisfies CampaignDay["statuses"]
  };
}

function buildCampaignDay(releaseDate: Date, index: number): CampaignDay {
  const date = addUtcDays(releaseDate, index - 4);
  const dayNumber = index + 1;
  const releaseOffset = dayNumber - 5;
  const theme =
    index === 4
      ? "Release day"
      : releaseOffset < 0
        ? `Countdown ${Math.abs(releaseOffset)}`
        : `Post-release ${releaseOffset}`;

  return {
    dayNumber,
    date: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }),
    dateKey: date.toISOString().slice(0, 10),
    isDefaultDay: dayNumber <= defaultCampaignDayCount,
    releaseOffset,
    clipName: `${theme}: vertical performance clip`,
    extraTasks: getPlaceholderExtraTasks(dayNumber),
    statuses: {
      facebookPost: releaseOffset === 0 ? "not-started" : "irrelevant",
      websiteUpdate: releaseOffset === 0 ? "not-started" : "irrelevant",
      youtubePost: releaseOffset === 0 ? "not-started" : "irrelevant",
      production: getPlaceholderStatus(index, 0),
      instagramUpload: getPlaceholderStatus(index, 1),
      youtubeUpload: getPlaceholderStatus(index, 2)
    }
  };
}

function createCampaignSlug(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "campaign"}-${Date.now()}`;
}

async function saveMarketingCampaignDays(
  campaign: MarketingCampaignConfig,
  campaignDays: CampaignDay[]
) {
  if (!campaign.dbId) {
    return;
  }

  try {
    const days = campaignDays.map((day) => ({
      campaign_date: day.dateKey,
      clip_name: day.clipName,
      day_number: day.dayNumber,
      is_default_day: day.isDefaultDay,
      release_offset: day.releaseOffset,
      tasks: [
        {
          task_kind: "production",
          title: "Make video / post",
          status: day.statuses.production,
          position: 1,
          is_standard_task: true
        },
        {
          task_kind: "instagram_upload",
          title: "IG Upload",
          status: day.statuses.instagramUpload,
          position: 2,
          is_standard_task: true
        },
        {
          task_kind: "youtube_upload",
          title: "YT upload",
          status: day.statuses.youtubeUpload,
          position: 3,
          is_standard_task: true
        },
        ...(hasReleaseDayDefaultTasks(day)
          ? [
              {
                task_kind: "website_update",
                title: "Update website",
                status: day.statuses.websiteUpdate,
                position: 4,
                is_standard_task: true
              },
              {
                task_kind: "facebook_post",
                title: "Facebook post",
                status: day.statuses.facebookPost,
                position: 5,
                is_standard_task: true
              },
              {
                task_kind: "youtube_post",
                title: "YouTube post",
                status: day.statuses.youtubePost,
                position: 6,
                is_standard_task: true
              }
            ]
          : []),
        ...day.extraTasks.map((task, index) => ({
          task_kind: "extra",
          title: task.title,
          status: task.status,
          position: index + 7,
          is_standard_task: false
        }))
      ]
    }));
    const response = await fetch("/api/marketing/campaign-days", {
      body: JSON.stringify({ campaignId: campaign.dbId, days }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-marketing": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Marketing campaign save failed with status ${response.status}.`
      );
    }
  } catch (error) {
    console.warn("Unable to save marketing campaign days.", error);
  }
}

type ProductionSongSaveResult =
  | { dbId: string; id: string; ok: true }
  | { error: string; ok: false };

async function saveProductionSongToSupabase(
  song: ProductionSongConfig
): Promise<ProductionSongSaveResult> {
  try {
    const response = await fetch("/api/production/songs", {
      body: JSON.stringify({ song }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-production": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        error: body.error ?? `Production save failed with status ${response.status}.`,
        ok: false
      };
    }

    const result = await response.json();
    const savedSong = result.savedSongs?.[0] as
      | { dbId: string; id: string }
      | undefined;

    if (!savedSong) {
      return {
        error: "Production save did not return a saved song.",
        ok: false
      };
    }

    return { ...savedSong, ok: true };
  } catch (error) {
    console.warn("Unable to save production song to Supabase.", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to save production song to Supabase.",
      ok: false
    };
  }
}

async function saveProductionSongsToSupabase(songs: ProductionSongConfig[]) {
  try {
    const response = await fetch("/api/production/songs", {
      body: JSON.stringify({ songs }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-production": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Production seed failed with status ${response.status}.`
      );
    }

    const result = await response.json();
    return (result.savedSongs ?? []) as Array<{ dbId: string; id: string }>;
  } catch (error) {
    console.warn("Unable to seed production songs in Supabase.", error);
    return [];
  }
}

async function deleteProductionSongFromSupabase(songDbId: string) {
  try {
    const response = await fetch("/api/production/songs", {
      body: JSON.stringify({ dbId: songDbId }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-production": "write"
      },
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Production delete failed with status ${response.status}.`
      );
    }
  } catch (error) {
    console.warn("Unable to delete production song from Supabase.", error);
  }
}

async function loadEventsSnapshotFromSupabase(): Promise<EventsSnapshot | null> {
  try {
    const response = await fetch("/api/events", {
      credentials: "same-origin",
      method: "GET"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Events load failed with status ${response.status}.`);
    }

    const result = (await response.json()) as EventsSnapshot;

    return {
      entries: normalizeEventEntries(result.entries ?? []),
      locations: normalizeLocationAddressBookEntries(result.locations ?? [])
    };
  } catch (error) {
    console.warn("Unable to load events from Supabase.", error);
    return null;
  }
}

async function saveEventsSnapshotToSupabase({
  entries,
  locations
}: EventsSnapshot): Promise<EventsSnapshot | null> {
  try {
    const response = await fetch("/api/events", {
      body: JSON.stringify({ entries, locations }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-events": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Events save failed with status ${response.status}.`);
    }

    const result = (await response.json()) as EventsSnapshot;

    return {
      entries: normalizeEventEntries(result.entries ?? []),
      locations: normalizeLocationAddressBookEntries(result.locations ?? [])
    };
  } catch (error) {
    console.warn("Unable to save events to Supabase.", error);
    return null;
  }
}

async function loadOtherTasksFromSupabase(): Promise<OtherTask[] | null> {
  try {
    const response = await fetch("/api/focus/other-tasks", {
      credentials: "same-origin",
      method: "GET"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Other tasks load failed with status ${response.status}.`
      );
    }

    const result = (await response.json()) as { tasks?: OtherTask[] };
    return normalizeOtherTasks(result.tasks ?? []);
  } catch (error) {
    console.warn("Unable to load focus other tasks from Supabase.", error);
    return null;
  }
}

async function saveOtherTasksToSupabase(
  tasks: OtherTask[]
): Promise<OtherTask[] | null> {
  try {
    const response = await fetch("/api/focus/other-tasks", {
      body: JSON.stringify({ tasks }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-focus": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Other tasks save failed with status ${response.status}.`
      );
    }

    const result = (await response.json()) as { tasks?: OtherTask[] };
    return normalizeOtherTasks(result.tasks ?? []);
  } catch (error) {
    console.warn("Unable to save focus other tasks to Supabase.", error);
    return null;
  }
}

async function deleteOtherTaskFromSupabase(taskId: string) {
  try {
    const response = await fetch("/api/focus/other-tasks", {
      body: JSON.stringify({ id: taskId }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-focus": "write"
      },
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Other task delete failed with status ${response.status}.`
      );
    }

    return true;
  } catch (error) {
    console.warn("Unable to delete focus other task from Supabase.", error);
    return false;
  }
}

async function loadDailyFocusProgress(date: string) {
  try {
    const response = await fetch(`/api/focus/daily-progress?date=${date}`, {
      credentials: "same-origin",
      method: "GET"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Daily focus progress load failed with status ${response.status}.`
      );
    }

    const result = (await response.json()) as { items?: DailyFocusProgressItem[] };
    return result.items ?? [];
  } catch (error) {
    console.warn("Unable to load daily focus progress from Supabase.", error);
    return null;
  }
}

async function saveDailyFocusProgress(item: DailyFocusProgressItem) {
  try {
    const response = await fetch("/api/focus/daily-progress", {
      body: JSON.stringify({ item }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-focus": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? `Daily focus progress save failed with status ${response.status}.`
      );
    }

    const result = (await response.json()) as { items?: DailyFocusProgressItem[] };
    return result.items ?? [];
  } catch (error) {
    console.warn("Unable to save daily focus progress to Supabase.", error);
    return null;
  }
}

function normalizeQrCodeLinks(links: QrCodeLink[]) {
  return links.map((link, index) => ({
    id:
      typeof link.id === "string" && link.id
        ? link.id
        : `qr-${Date.now()}-${index}`,
    name:
      typeof link.name === "string" && link.name ? link.name : "QR Code",
    qrImageUrl: typeof link.qrImageUrl === "string" ? link.qrImageUrl : "",
    targetUrl: typeof link.targetUrl === "string" ? link.targetUrl : ""
  }));
}

async function loadQrCodeLinksFromSupabase(): Promise<QrCodeLink[] | null> {
  try {
    const response = await fetch("/api/qr-links", {
      credentials: "same-origin",
      method: "GET"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `QR links load failed with status ${response.status}.`);
    }

    const result = (await response.json()) as { links?: QrCodeLink[] };
    return normalizeQrCodeLinks(result.links ?? []);
  } catch (error) {
    console.warn("Unable to load QR links from Supabase.", error);
    return null;
  }
}

async function saveQrCodeLinksToSupabase(
  links: QrCodeLink[]
): Promise<QrCodeLink[] | null> {
  try {
    const response = await fetch("/api/qr-links", {
      body: JSON.stringify({ links }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-qr": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `QR links save failed with status ${response.status}.`);
    }

    const result = (await response.json()) as { links?: QrCodeLink[] };
    return normalizeQrCodeLinks(result.links ?? []);
  } catch (error) {
    console.warn("Unable to save QR links to Supabase.", error);
    return null;
  }
}

type BudgetSnapshot = {
  deletedForecastIds: string[];
  entries: BudgetEntry[];
};

function normalizeBudgetEntries(entries: BudgetEntry[]) {
  return sortBudgetEntriesByDate(
    entries.map((entry) => ({
      ...entry,
      amount: Number(entry.amount) || 0,
      bucket:
        entry.bucket === "events" ||
        entry.bucket === "production" ||
        entry.bucket === "marketing"
          ? entry.bucket
          : inferBudgetSourceBucket(entry.description),
      date: typeof entry.date === "string" ? entry.date : formatDateForInput(getTodayUtcDate()),
      description: typeof entry.description === "string" ? entry.description : "",
      id: typeof entry.id === "string" && entry.id ? entry.id : `budget-entry-${Date.now()}`,
      type:
        entry.type === "recurring" ||
        entry.type === "one-off" ||
        entry.type === "earned" ||
        entry.type === "spent"
          ? entry.type
          : "one-off"
    }))
  );
}

async function loadBudgetSnapshotFromSupabase(): Promise<BudgetSnapshot | null> {
  try {
    const response = await fetch("/api/budget", {
      credentials: "same-origin",
      method: "GET"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Budget load failed with status ${response.status}.`);
    }

    const result = (await response.json()) as BudgetSnapshot;

    return {
      deletedForecastIds: Array.isArray(result.deletedForecastIds)
        ? result.deletedForecastIds.filter(
            (forecastId): forecastId is string => typeof forecastId === "string"
          )
        : [],
      entries: normalizeBudgetEntries(result.entries ?? [])
    };
  } catch (error) {
    console.warn("Unable to load budget from Supabase.", error);
    return null;
  }
}

async function saveBudgetSnapshotToSupabase({
  deletedForecastIds,
  entries
}: BudgetSnapshot): Promise<BudgetSnapshot | null> {
  try {
    const response = await fetch("/api/budget", {
      body: JSON.stringify({
        deletedForecastIds,
        entries: entries.filter((entry) => !entry.generated)
      }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-love-strings-budget": "write"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Budget save failed with status ${response.status}.`);
    }

    const result = (await response.json()) as BudgetSnapshot;

    return {
      deletedForecastIds: Array.isArray(result.deletedForecastIds)
        ? result.deletedForecastIds.filter(
            (forecastId): forecastId is string => typeof forecastId === "string"
          )
        : [],
      entries: normalizeBudgetEntries(result.entries ?? [])
    };
  } catch (error) {
    console.warn("Unable to save budget to Supabase.", error);
    return null;
  }
}

export default function Home() {
  const productionSaveTimers = useRef<Record<string, number>>({});
  const otherTaskSaveTimers = useRef<Record<string, number>>({});
  const eventSaveTimer = useRef<number | null>(null);
  const budgetSaveTimer = useRef<number | null>(null);
  const qrCodeSaveTimer = useRef<number | null>(null);
  const hasRequestedEventSupabaseLoad = useRef(false);
  const hasRequestedBudgetSupabaseLoad = useRef(false);
  const hasRequestedOtherTaskSupabaseLoad = useRef(false);
  const hasRequestedQrCodeSupabaseLoad = useRef(false);
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [dailyFocusProgress, setDailyFocusProgress] = useState<
    DailyFocusProgressItem[]
  >([]);
  const [appleMusicReminderDismissedDate, setAppleMusicReminderDismissedDate] =
    useState("");
  const [platformStatsData, setPlatformStatsData] = useState(platformStats);
  const [platformMetricRows, setPlatformMetricRows] = useState<MetricRow[]>([]);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({
    message: "",
    state: "idle"
  });
  const [appleMusicImportStatus, setAppleMusicImportStatus] =
    useState<AppleMusicImportStatus>({
      message: "",
      state: "idle"
    });
  const [productionSaveStatus, setProductionSaveStatus] = useState<RefreshStatus>({
    message: "",
    state: "idle"
  });
  const [productionFocusTarget, setProductionFocusTarget] = useState<{
    elementId?: string;
    songId: string;
    token: number;
  } | null>(null);
  const [marketingFocusTarget, setMarketingFocusTarget] = useState<{
    campaignId: string;
    elementId?: string;
    token: number;
  } | null>(null);
  const [campaigns, setCampaigns] = useState(() =>
    sortCampaignsByReleaseDate(marketingCampaigns)
  );
  const [productionSongDrafts, setProductionSongDrafts] = useState(() =>
    sortProductionSongsByDeadline(
      normalizeProductionSongsWithBudgetDefaults(productionSongs)
    )
  );
  const [budgetEntryDrafts, setBudgetEntryDrafts] = useState(() =>
    sortBudgetEntriesByDate(budgetEntries)
  );
  const [deletedBudgetForecastIds, setDeletedBudgetForecastIds] = useState<string[]>([]);
  const [eventEntryDrafts, setEventEntryDrafts] = useState(() =>
    normalizeEventEntries(eventEntries)
  );
  const fallbackEventEntriesForAddressBook = useRef(eventEntryDrafts);
  const [locationAddressBook, setLocationAddressBook] = useState(() =>
    buildLocationAddressBookEntries(eventEntries)
  );
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  const [qrCodeLinks, setQrCodeLinks] =
    useState<QrCodeLink[]>(defaultQrCodeLinks);
  const [hasLoadedCampaignDrafts, setHasLoadedCampaignDrafts] = useState(false);
  const [hasLoadedProductionDrafts, setHasLoadedProductionDrafts] =
    useState(false);
  const [hasLoadedBudgetDrafts, setHasLoadedBudgetDrafts] = useState(false);
  const [hasLoadedQrCodeLinks, setHasLoadedQrCodeLinks] = useState(false);
  const [hasLoadedQrCodeSupabaseSnapshot, setHasLoadedQrCodeSupabaseSnapshot] =
    useState(false);
  const [hasLoadedEventDrafts, setHasLoadedEventDrafts] = useState(false);
  const [hasLoadedLocationAddressBook, setHasLoadedLocationAddressBook] =
    useState(false);
  const [hasLoadedOtherTasks, setHasLoadedOtherTasks] = useState(false);
  const [hasLoadedEventSupabaseSnapshot, setHasLoadedEventSupabaseSnapshot] =
    useState(false);
  const [hasLoadedBudgetSupabaseSnapshot, setHasLoadedBudgetSupabaseSnapshot] =
    useState(false);
  const hasCheckedOpeningMetricRefresh = useRef(false);
  const dashboardPlatformStats = getDashboardPlatformStats(platformStatsData);
  const budgetEntriesWithForecast = getBudgetEntriesWithForecast(
    budgetEntryDrafts,
    eventEntryDrafts,
    campaigns,
    productionSongDrafts,
    deletedBudgetForecastIds
  );

  function queueProductionSongSave(song: ProductionSongConfig) {
    const existingTimer = productionSaveTimers.current[song.id];

    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    productionSaveTimers.current[song.id] = window.setTimeout(() => {
      delete productionSaveTimers.current[song.id];
      setProductionSaveStatus({
        message: "Saving production changes...",
        state: "loading"
      });
      void saveProductionSongToSupabase(song).then((savedSong) => {
        if (!savedSong.ok) {
          setProductionSaveStatus({
            message: savedSong.error,
            state: "error"
          });
          return;
        }

        setProductionSaveStatus({
          message: "Production saved.",
          state: "success"
        });
      });
    }, 900);
  }

  function queueEventsSnapshotSave(snapshot: EventsSnapshot) {
    if (eventSaveTimer.current) {
      window.clearTimeout(eventSaveTimer.current);
    }

    eventSaveTimer.current = window.setTimeout(() => {
      eventSaveTimer.current = null;
      void saveEventsSnapshotToSupabase(snapshot);
    }, 900);
  }

  function queueBudgetSnapshotSave(snapshot: BudgetSnapshot) {
    if (budgetSaveTimer.current) {
      window.clearTimeout(budgetSaveTimer.current);
    }

    budgetSaveTimer.current = window.setTimeout(() => {
      budgetSaveTimer.current = null;
      void saveBudgetSnapshotToSupabase(snapshot);
    }, 900);
  }

  function queueOtherTaskSave(task: OtherTask) {
    const existingTimer = otherTaskSaveTimers.current[task.id];

    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    otherTaskSaveTimers.current[task.id] = window.setTimeout(() => {
      delete otherTaskSaveTimers.current[task.id];
      void saveOtherTasksToSupabase([task]);
    }, 650);
  }

  function queueQrCodeLinksSave(links: QrCodeLink[]) {
    if (qrCodeSaveTimer.current) {
      window.clearTimeout(qrCodeSaveTimer.current);
    }

    qrCodeSaveTimer.current = window.setTimeout(() => {
      qrCodeSaveTimer.current = null;
      void saveQrCodeLinksToSupabase(links);
    }, 650);
  }

  function recordDailyFocusStatus(
    item: Omit<DailyFocusProgressItem, "date">
  ) {
    const progressItem = { ...item, date: getViennaDateKey() };

    setDailyFocusProgress((currentItems) => [
      ...currentItems.filter(
        (currentItem) => currentItem.taskKey !== progressItem.taskKey
      ),
      progressItem
    ]);
    void saveDailyFocusProgress(progressItem);
  }

  const loadPlatformStats = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("platform_metric_snapshots")
        .select(
          `
            metric_name,
            metric_value,
            notes,
            source,
            snapshot_date,
            imported_at,
            platforms!inner(slug),
            content_posts(title),
            releases(title)
          `
        )
        .order("snapshot_date", { ascending: false })
        .order("imported_at", { ascending: false });

      if (error) {
        console.warn("Unable to load platform metrics from Supabase.", error);
        return [];
      }

      setPlatformMetricRows((data ?? []) as MetricRow[]);
      setPlatformStatsData((currentStats) =>
        mergePlatformMetricRows(currentStats, (data ?? []) as MetricRow[])
      );
      return (data ?? []) as MetricRow[];
    } catch (error) {
      console.warn("Using local platform metric fallback.", error);
      return [];
    }
  }, []);

  async function saveMarketingCampaignHeader(
    campaignId: string,
    updates: Partial<Pick<MarketingCampaignConfig, "albumArtUrl" | "releaseDate" | "releaseTitle">>
  ) {
    const campaign = campaigns.find((candidate) => candidate.id === campaignId);

    if (!campaign?.dbId) {
      return;
    }

    const payload: { albumArtUrl?: string; releaseDate?: string; title?: string } = {};

    if (updates.releaseDate) {
      const releaseDate = formatInputDateForDatabase(updates.releaseDate);

      if (releaseDate) {
        payload.releaseDate = releaseDate;
      }
    }

    if (updates.releaseTitle) {
      payload.title = updates.releaseTitle;
    }

    if (updates.albumArtUrl !== undefined) {
      payload.albumArtUrl = updates.albumArtUrl;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/marketing/campaigns", {
        body: JSON.stringify({ campaignId: campaign.dbId, updates: payload }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-love-strings-marketing": "write"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Campaign update failed with status ${response.status}.`);
      }
    } catch (error) {
      console.warn("Unable to save marketing campaign header.", error);
    }
  }

  async function deleteMarketingCampaign(campaignDbId: string) {
    try {
      const response = await fetch("/api/marketing/campaigns", {
        body: JSON.stringify({ campaignId: campaignDbId }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-love-strings-marketing": "write"
        },
        method: "DELETE"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Campaign delete failed with status ${response.status}.`);
      }
    } catch (error) {
      console.warn("Unable to delete marketing campaign from Supabase.", error);
    }
  }

  async function addCampaign(releaseTitle?: string) {
    const campaignReleaseTitle =
      releaseTitle?.trim() ||
      productionSongDrafts[0]?.title ||
      `New Campaign ${campaigns.length + 1}`;
    const releaseDate =
      parseCampaignDate(newMarketingCampaign.releaseDate) ??
      new Date(Date.UTC(2026, 6, 10));
    const localCampaign: MarketingCampaignConfig = {
      ...newMarketingCampaign,
      id: `campaign-${campaigns.length + 1}-${Date.now()}`,
      releaseTitle: campaignReleaseTitle,
      budgetLines: [],
      campaignDays: buildCampaignDays(newMarketingCampaign.releaseDate)
    };

    setCampaigns((currentCampaigns) =>
      sortCampaignsByReleaseDate([...currentCampaigns, localCampaign])
    );
    setMarketingFocusTarget({ campaignId: localCampaign.id, token: Date.now() });

    try {
      const slug = createCampaignSlug(localCampaign.releaseTitle);
      const response = await fetch("/api/marketing/campaigns", {
        body: JSON.stringify({
          albumArtUrl: localCampaign.albumArtUrl,
          releaseDate: releaseDate.toISOString().slice(0, 10),
          slug,
          title: localCampaign.releaseTitle
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-love-strings-marketing": "write"
        },
        method: "POST"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Campaign creation failed with status ${response.status}.`);
      }

      const result = (await response.json()) as {
        campaign?: { id: string; slug: string };
      };

      if (!result.campaign) throw new Error("Campaign creation returned no record.");

      const savedCampaign = {
        ...localCampaign,
        id: result.campaign.slug,
        dbId: result.campaign.id
      };

      setCampaigns((currentCampaigns) =>
        sortCampaignsByReleaseDate(
          currentCampaigns.map((campaign) =>
            campaign.id === localCampaign.id ? savedCampaign : campaign
          )
        )
      );
      setMarketingFocusTarget({ campaignId: savedCampaign.id, token: Date.now() });
      await saveMarketingCampaignDays(savedCampaign, savedCampaign.campaignDays ?? []);
    } catch (error) {
      console.warn("Unable to create marketing campaign in Supabase.", error);
    }
  }

  function updateCampaignReleaseDate(campaignId: string, releaseDate: string) {
    setMarketingFocusTarget({ campaignId, token: Date.now() });
    setCampaigns((currentCampaigns) =>
      sortCampaignsByReleaseDate(
        currentCampaigns.map((campaign) =>
          campaign.id === campaignId ? { ...campaign, releaseDate } : campaign
        )
      )
    );
    void saveMarketingCampaignHeader(campaignId, { releaseDate });
  }

  function updateCampaignTitle(campaignId: string, releaseTitle: string) {
    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              releaseTitle
            }
          : campaign
      )
    );
    void saveMarketingCampaignHeader(campaignId, { releaseTitle });
  }

  function updateCampaignBudgetLines(
    campaignId: string,
    budgetLines: ProductionBudgetLine[]
  ) {
    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              budgetLines
            }
          : campaign
      )
    );
  }

  async function refreshPlatformStats() {
    setRefreshStatus({
      message: "Collecting latest platform stats...",
      state: "loading"
    });

    try {
      const response = await fetch("/api/metrics/refresh", {
        credentials: "same-origin",
        headers: {
          "x-love-strings-refresh": "manual"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}.`);
      }

      const result = await response.json();
      await loadPlatformStats();

      const refreshedCount =
        result.results?.filter(
          (item: { status: string }) => item.status === "fulfilled"
        ).length ?? 0;
      const failedCount =
        result.results?.filter(
          (item: { status: string }) => item.status === "rejected"
        ).length ?? 0;
      const skippedCount =
        result.results?.filter(
          (item: { status: string }) => item.status === "skipped"
        ).length ?? 0;

      if (failedCount > 0) {
        throw new Error(
          `${failedCount} collector${failedCount === 1 ? "" : "s"} failed.`
        );
      }

      setRefreshStatus({
        message:
          skippedCount > 0
            ? `Updated ${refreshedCount}; skipped ${skippedCount}.`
            : `Updated ${refreshedCount} data collectors.`,
        state: refreshedCount > 0 ? "success" : "error"
      });
    } catch (error) {
      setRefreshStatus({
        message: error instanceof Error ? error.message : "Refresh failed.",
        state: "error"
      });
    }
  }

  const refreshPlatformStatsOnOpenIfMissing = useCallback(async () => {
    if (hasCheckedOpeningMetricRefresh.current) {
      return;
    }

    hasCheckedOpeningMetricRefresh.current = true;
    const todayKey = getViennaDateKey();
    const autoRefreshStorageKey = `love-strings-last-auto-metric-refresh-${todayKey}`;
    const metricRows = await loadPlatformStats();

    if (
      metricRows.some((row) => row.snapshot_date === todayKey) ||
      window.localStorage.getItem(autoRefreshStorageKey) === "done"
    ) {
      return;
    }

    try {
      window.localStorage.setItem(autoRefreshStorageKey, "done");
      const response = await fetch("/api/metrics/refresh", {
        credentials: "same-origin",
        headers: {
          "x-love-strings-refresh": "manual"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Opening refresh failed with status ${response.status}.`);
      }

      await loadPlatformStats();
    } catch (error) {
      window.localStorage.removeItem(autoRefreshStorageKey);
      console.warn("Unable to refresh platform metrics on app open.", error);
    }
  }, [loadPlatformStats]);

  async function importAppleMusicCsv(file: File) {
    setAppleMusicImportStatus({
      message: "Reading Apple Music CSV...",
      state: "loading"
    });

    try {
      const csvText = await file.text();
      const { reportEndDate, reportStartDate, rows } = parseAppleMusicCsvFile(
        file.name,
        csvText
      );
      const currentReleaseName =
        getPlatformMetric(platformStatsData, "apple-music", "current_release_name")?.value ??
        getPlatformMetric(platformStatsData, "apple-music", "current_release_plays")?.context ??
        "Flowers";
      const response = await fetch("/api/apple-music/import", {
        body: JSON.stringify({
          currentReleaseName,
          fileName: file.name,
          reportEndDate,
          reportStartDate,
          rows
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-love-strings-import": "apple-music-csv"
        },
        method: "POST"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Apple CSV import failed with status ${response.status}.`);
      }

      const result = await response.json();
      await loadPlatformStats();
      recordDailyFocusStatus({
        label: "Update Apple Music CSV",
        source: "Other",
        status: "done",
        taskKey: "other:apple-music-csv-update"
      });
      setAppleMusicImportStatus({
        message: `Imported ${result.songs} songs from ${formatDateForDisplay(result.reportEndDate)}.`,
        state: "success"
      });
    } catch (error) {
      setAppleMusicImportStatus({
        message: error instanceof Error ? error.message : "Apple CSV import failed.",
        state: "error"
      });
    }
  }

  const updateCampaignDays = useCallback(
    (campaignId: string, campaignDays: CampaignDay[]) => {
      const campaign = campaigns.find((candidate) => candidate.id === campaignId);

      if (campaign) {
        const previousDays =
          campaign.campaignDays ??
          buildCampaignDays(campaign.releaseDate, campaign.daySeeds);
        getChangedDailyProgressItems(
          getCampaignDailyProgressItems(campaign, previousDays),
          getCampaignDailyProgressItems(campaign, campaignDays)
        ).forEach(recordDailyFocusStatus);
      }

      setCampaigns((currentCampaigns) =>
        currentCampaigns.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                campaignDays
              }
            : campaign
        )
      );
      if (campaign?.dbId) {
        void saveMarketingCampaignDays(campaign, campaignDays);
      }
    },
    [campaigns]
  );

  function deleteCampaign(campaignId: string) {
    const campaign = campaigns.find((candidate) => candidate.id === campaignId);

    setCampaigns((currentCampaigns) =>
      currentCampaigns.filter((campaign) => campaign.id !== campaignId)
    );

    if (campaign?.dbId) {
      void deleteMarketingCampaign(campaign.dbId);
    }
  }

  function addProductionSong() {
    const newSongNumber = productionSongDrafts.length + 1;
    const newDeadline = getNextProductionSongDeadline(productionSongDrafts);
    const localSong = createProductionSongSeed({
      id: `production-song-${newSongNumber}-${Date.now()}`,
      title: `New Song ${newSongNumber}`,
      deadline: formatDateForInput(newDeadline),
      statusPattern: ["not-started"]
    });

    setProductionSongDrafts((currentSongs) =>
      sortProductionSongsByDeadline([...currentSongs, localSong])
    );
    setProductionFocusTarget({ songId: localSong.id, token: Date.now() });
    void saveProductionSongToSupabase(localSong).then((savedSong) => {
      if (!savedSong.ok) {
        setProductionSaveStatus({
          message: savedSong.error,
          state: "error"
        });
        return;
      }

      setProductionSongDrafts((currentSongs) =>
        sortProductionSongsByDeadline(
          currentSongs.map((song) =>
            song.id === localSong.id
              ? {
                  ...song,
                  dbId: savedSong.dbId,
                  id: savedSong.id
                }
              : song
          )
        )
      );
      setProductionFocusTarget({ songId: savedSong.id, token: Date.now() });
    });
  }

  function updateProductionSong(songId: string, updates: Partial<ProductionSongConfig>) {
    const currentSong = productionSongDrafts.find((song) => song.id === songId);
    const nextSong = currentSong
      ? {
          ...currentSong,
          ...updates,
          steps: updates.steps
            ? sortProductionStepsByDeadline(updates.steps)
            : currentSong.steps
        }
      : null;

    if (currentSong && nextSong && updates.steps) {
      getChangedDailyProgressItems(
        getProductionDailyProgressItems(currentSong),
        getProductionDailyProgressItems(nextSong)
      ).forEach(recordDailyFocusStatus);
    }

    setProductionSongDrafts((currentSongs) =>
      sortProductionSongsByDeadline(
        currentSongs.map((song) => (song.id === songId && nextSong ? nextSong : song))
      )
    );

    if (nextSong) {
      queueProductionSongSave(nextSong);
    }
  }

  function deleteProductionSong(songId: string) {
    const song = productionSongDrafts.find((candidate) => candidate.id === songId);

    setProductionSongDrafts((currentSongs) =>
      currentSongs.filter((song) => song.id !== songId)
    );

    if (song?.dbId) {
      void deleteProductionSongFromSupabase(song.dbId);
    }
  }

  function addBudgetEntry() {
    setBudgetEntryDrafts((currentEntries) =>
      sortBudgetEntriesByDate([
        {
          id: `budget-entry-${Date.now()}`,
          amount: 0,
          bucket: "events",
          date: formatDateForInput(getTodayUtcDate()),
          description: "New budget line",
          type: "one-off"
        },
        ...currentEntries
      ])
    );
  }

  function updateBudgetEntry(entryId: string, updates: Partial<BudgetEntry>) {
    setBudgetEntryDrafts((currentEntries) =>
      sortBudgetEntriesByDate(
        currentEntries.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        )
      )
    );
  }

  function deleteBudgetEntry(entryId: string) {
    const entryToDelete = budgetEntriesWithForecast.find((entry) => entry.id === entryId);

    if (!entryToDelete || !canDeleteBudgetEntryFromLedger(entryToDelete)) {
      return;
    }

    if (entryToDelete.sourceRecurringEntryId) {
      setDeletedBudgetForecastIds((currentIds) =>
        currentIds.includes(entryId) ? currentIds : [...currentIds, entryId]
      );
      return;
    }

    setBudgetEntryDrafts((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== entryId)
    );
  }

  function addEventEntry() {
    setEventEntryDrafts((currentEntries) =>
      sortEventEntriesByDate([
        {
          id: `event-entry-${Date.now()}`,
          date: formatDateForInput(getTodayUtcDate()),
          name: "New event",
          nameUrl: "",
          locationName: "Location name",
          locationUrl: "",
          address: "Address",
          addressUrl: "",
          posterUrl: "",
          budgetLines: [
            {
              id: `event-budget-line-${Date.now()}`,
              amount: 0,
              description: ""
            }
          ]
        },
        ...currentEntries
      ])
    );
  }

  function updateEventEntry(entryId: string, updates: Partial<EventEntry>) {
    setEventEntryDrafts((currentEntries) =>
      sortEventEntriesByDate(
        currentEntries.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        )
      )
    );
  }

  function deleteEventEntry(entryId: string) {
    setEventEntryDrafts((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== entryId)
    );
  }

  function addLocationAddressBookEntry() {
    setLocationAddressBook((currentLocations) => [
      {
        id: `location-${Date.now()}`,
        locationName: "New location",
        locationUrl: "",
        address: "Address",
        addressUrl: "",
        contactName: "",
        contactPhone: "",
        contactNotes: ""
      },
      ...currentLocations
    ]);
  }

  function updateLocationAddressBookEntry(
    locationId: string,
    updates: Partial<LocationAddressBookEntry>
  ) {
    setLocationAddressBook((currentLocations) =>
      currentLocations.map((location) =>
        location.id === locationId ? { ...location, ...updates } : location
      )
    );
  }

  function deleteLocationAddressBookEntry(locationId: string) {
    setLocationAddressBook((currentLocations) =>
      currentLocations.filter((location) => location.id !== locationId)
    );
  }

  function addOtherTask() {
    const existingEmptyTask = otherTasks.find(
      (task) => task.title.trim() === "" && task.notes.trim() === ""
    );

    if (existingEmptyTask) {
      return existingEmptyTask.id;
    }

    const newTaskId = `other-task-${Date.now()}`;
    const newTask: OtherTask = {
      dueDate: formatDateForInput(getTodayUtcDate()),
      id: newTaskId,
      notes: "",
      status: "not-started",
      title: ""
    };

    setOtherTasks((currentTasks) => {
      return [newTask, ...currentTasks];
    });
    queueOtherTaskSave(newTask);

    return newTaskId;
  }

  function updateOtherTask(taskId: string, updates: Partial<OtherTask>) {
    const previousTask = otherTasks.find((task) => task.id === taskId);

    if (!previousTask) return;

    const updatedTask = { ...previousTask, ...updates };
    setOtherTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? updatedTask : task))
    );
    queueOtherTaskSave(updatedTask);

    if (updates.status && previousTask.status !== updatedTask.status) {
      recordDailyFocusStatus({
        label: updatedTask.title || "Untitled task",
        source: "Other",
        status: updatedTask.status,
        taskKey: `other:${updatedTask.id}`
      });
    }
  }

  function deleteOtherTask(taskId: string) {
    const pendingSaveTimer = otherTaskSaveTimers.current[taskId];

    if (pendingSaveTimer) {
      window.clearTimeout(pendingSaveTimer);
      delete otherTaskSaveTimers.current[taskId];
    }

    setOtherTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId)
    );
    void deleteOtherTaskFromSupabase(taskId);
  }

  function addQrCodeLink() {
    setQrCodeLinks((currentLinks) => [
      ...currentLinks,
      {
        id: `qr-code-${Date.now()}`,
        name: "New QR Code",
        qrImageUrl: "",
        targetUrl: ""
      }
    ]);
  }

  function updateQrCodeLink(linkId: string, updates: Partial<QrCodeLink>) {
    setQrCodeLinks((currentLinks) =>
      currentLinks.map((link) =>
        link.id === linkId ? { ...link, ...updates } : link
      )
    );
  }

  function deleteQrCodeLink(linkId: string) {
    setQrCodeLinks((currentLinks) =>
      currentLinks.filter((link) => link.id !== linkId)
    );
  }

  useEffect(() => {
    const saveTimers = productionSaveTimers.current;
    const focusSaveTimers = otherTaskSaveTimers.current;

    return () => {
      Object.values(saveTimers).forEach((timer) => window.clearTimeout(timer));
      Object.values(focusSaveTimers).forEach((timer) => window.clearTimeout(timer));
      if (eventSaveTimer.current) {
        window.clearTimeout(eventSaveTimer.current);
      }
      if (budgetSaveTimer.current) {
        window.clearTimeout(budgetSaveTimer.current);
      }
      if (qrCodeSaveTimer.current) {
        window.clearTimeout(qrCodeSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedCampaigns = window.localStorage.getItem(campaignDraftStorageKey);

      if (storedCampaigns) {
        const parsedCampaigns = JSON.parse(storedCampaigns);

        if (Array.isArray(parsedCampaigns)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setCampaigns(sortCampaignsByReleaseDate(parsedCampaigns));
              setHasLoadedCampaignDrafts(true);
            }
          }, 0);
          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local campaign drafts.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedCampaignDrafts(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedCampaignDrafts) {
      return;
    }

    try {
      window.localStorage.setItem(campaignDraftStorageKey, JSON.stringify(campaigns));
    } catch (error) {
      console.warn("Unable to save local campaign drafts.", error);
    }
  }, [campaigns, hasLoadedCampaignDrafts]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedQrLinks = window.localStorage.getItem(qrCodeLinksStorageKey);

      if (storedQrLinks) {
        const parsedQrLinks = JSON.parse(storedQrLinks);

        if (Array.isArray(parsedQrLinks)) {
          const nextQrLinks = normalizeQrCodeLinks(parsedQrLinks);

          window.setTimeout(() => {
            if (!isCancelled) {
              setQrCodeLinks(nextQrLinks);
              setHasLoadedQrCodeLinks(true);
            }
          }, 0);

          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local QR code links.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedQrCodeLinks(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedQrCodeLinks) {
      return;
    }

    try {
      window.localStorage.setItem(
        qrCodeLinksStorageKey,
        JSON.stringify(qrCodeLinks)
      );
    } catch (error) {
      console.warn("Unable to save local QR code links.", error);
    }
  }, [hasLoadedQrCodeLinks, qrCodeLinks]);

  useEffect(() => {
    if (
      !hasLoadedQrCodeLinks ||
      hasRequestedQrCodeSupabaseLoad.current
    ) {
      return;
    }

    hasRequestedQrCodeSupabaseLoad.current = true;
    let isCancelled = false;

    async function loadSharedQrCodeLinks() {
      const remoteLinks = await loadQrCodeLinksFromSupabase();

      if (isCancelled || remoteLinks === null) {
        setHasLoadedQrCodeSupabaseSnapshot(true);
        return;
      }

      const savedLinks =
        remoteLinks.length === 0
          ? await saveQrCodeLinksToSupabase(qrCodeLinks)
          : remoteLinks;

      if (!isCancelled && savedLinks) {
        setQrCodeLinks(savedLinks);
      }

      if (!isCancelled) {
        setHasLoadedQrCodeSupabaseSnapshot(true);
      }
    }

    void loadSharedQrCodeLinks();

    return () => {
      isCancelled = true;
    };
  }, [hasLoadedQrCodeLinks, qrCodeLinks]);

  useEffect(() => {
    if (!hasLoadedQrCodeLinks || !hasLoadedQrCodeSupabaseSnapshot) {
      return;
    }

    queueQrCodeLinksSave(qrCodeLinks);
  }, [hasLoadedQrCodeLinks, hasLoadedQrCodeSupabaseSnapshot, qrCodeLinks]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedSongs = window.localStorage.getItem(productionDraftStorageKey);

      if (storedSongs) {
        const parsedSongs = JSON.parse(storedSongs);

        if (Array.isArray(parsedSongs)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setProductionSongDrafts(
                sortProductionSongsByDeadline(
                  normalizeProductionSongsWithBudgetDefaults(parsedSongs)
                )
              );
              setHasLoadedProductionDrafts(true);
            }
          }, 0);
          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local production drafts.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedProductionDrafts(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedProductionDrafts) {
      return;
    }

    try {
      window.localStorage.setItem(
        productionDraftStorageKey,
        JSON.stringify(productionSongDrafts)
      );
    } catch (error) {
      console.warn("Unable to save local production drafts.", error);
    }
  }, [productionSongDrafts, hasLoadedProductionDrafts]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedDeletedBudgetForecasts = window.localStorage.getItem(
        deletedBudgetForecastStorageKey
      );
      const storedBudgetEntries = window.localStorage.getItem(budgetDraftStorageKey);

      if (storedDeletedBudgetForecasts) {
        const parsedDeletedForecasts = JSON.parse(storedDeletedBudgetForecasts);

        if (Array.isArray(parsedDeletedForecasts)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setDeletedBudgetForecastIds(
                parsedDeletedForecasts.filter(
                  (forecastId): forecastId is string => typeof forecastId === "string"
                )
              );
            }
          }, 0);
        }
      }

      if (storedBudgetEntries) {
        const parsedEntries = JSON.parse(storedBudgetEntries);

        if (Array.isArray(parsedEntries)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setBudgetEntryDrafts(sortBudgetEntriesByDate(parsedEntries));
              setHasLoadedBudgetDrafts(true);
            }
          }, 0);
          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local budget drafts.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedBudgetDrafts(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedBudgetDrafts) {
      return;
    }

    try {
      window.localStorage.setItem(
        budgetDraftStorageKey,
        JSON.stringify(budgetEntryDrafts)
      );
      window.localStorage.setItem(
        deletedBudgetForecastStorageKey,
        JSON.stringify(deletedBudgetForecastIds)
      );
    } catch (error) {
      console.warn("Unable to save local budget drafts.", error);
    }
  }, [budgetEntryDrafts, deletedBudgetForecastIds, hasLoadedBudgetDrafts]);

  useEffect(() => {
    if (!hasLoadedBudgetDrafts || hasRequestedBudgetSupabaseLoad.current) {
      return;
    }

    hasRequestedBudgetSupabaseLoad.current = true;

    async function loadBudgetSnapshot() {
      const snapshot = await loadBudgetSnapshotFromSupabase();

      if (!snapshot) {
        setHasLoadedBudgetSupabaseSnapshot(true);
        return;
      }

      if (snapshot.entries.length === 0 && snapshot.deletedForecastIds.length === 0) {
        const seedSnapshot = await saveBudgetSnapshotToSupabase({
          deletedForecastIds: deletedBudgetForecastIds,
          entries: budgetEntryDrafts
        });

        if (seedSnapshot) {
          setBudgetEntryDrafts(seedSnapshot.entries);
          setDeletedBudgetForecastIds(seedSnapshot.deletedForecastIds);
        }

        setHasLoadedBudgetSupabaseSnapshot(true);
        return;
      }

      setBudgetEntryDrafts(snapshot.entries);
      setDeletedBudgetForecastIds(snapshot.deletedForecastIds);
      setHasLoadedBudgetSupabaseSnapshot(true);
    }

    void loadBudgetSnapshot();
  }, [budgetEntryDrafts, deletedBudgetForecastIds, hasLoadedBudgetDrafts]);

  useEffect(() => {
    if (!hasLoadedBudgetDrafts || !hasLoadedBudgetSupabaseSnapshot) {
      return;
    }

    queueBudgetSnapshotSave({
      deletedForecastIds: deletedBudgetForecastIds,
      entries: budgetEntryDrafts
    });
  }, [
    budgetEntryDrafts,
    deletedBudgetForecastIds,
    hasLoadedBudgetDrafts,
    hasLoadedBudgetSupabaseSnapshot
  ]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedEventEntries = window.localStorage.getItem(eventDraftStorageKey);

      if (storedEventEntries) {
        const parsedEntries = JSON.parse(storedEventEntries);

        if (Array.isArray(parsedEntries)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setEventEntryDrafts(normalizeEventEntries(parsedEntries));
              setHasLoadedEventDrafts(true);
            }
          }, 0);
          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local event drafts.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedEventDrafts(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedEventDrafts) {
      return;
    }

    try {
      window.localStorage.setItem(
        eventDraftStorageKey,
        JSON.stringify(eventEntryDrafts)
      );
    } catch (error) {
      console.warn("Unable to save local event drafts.", error);
    }
  }, [eventEntryDrafts, hasLoadedEventDrafts]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedLocationAddressBook = window.localStorage.getItem(
        locationAddressBookStorageKey
      );

      if (storedLocationAddressBook) {
        const parsedLocations = JSON.parse(storedLocationAddressBook);

        if (Array.isArray(parsedLocations)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setLocationAddressBook(
                mergeLocationAddressBookWithEvents(
                  normalizeLocationAddressBookEntries(parsedLocations),
                  fallbackEventEntriesForAddressBook.current
                )
              );
              setHasLoadedLocationAddressBook(true);
            }
          }, 0);

          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local location address book.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setLocationAddressBook(
          buildLocationAddressBookEntries(fallbackEventEntriesForAddressBook.current)
        );
        setHasLoadedLocationAddressBook(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedLocationAddressBook) {
      return;
    }

    try {
      window.localStorage.setItem(
        locationAddressBookStorageKey,
        JSON.stringify(locationAddressBook)
      );
    } catch (error) {
      console.warn("Unable to save local location address book.", error);
    }
  }, [hasLoadedLocationAddressBook, locationAddressBook]);

  useEffect(() => {
    let isCancelled = false;

    try {
      const storedOtherTasks = window.localStorage.getItem(otherTaskStorageKey);

      if (storedOtherTasks) {
        const parsedOtherTasks = JSON.parse(storedOtherTasks);

        if (Array.isArray(parsedOtherTasks)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setOtherTasks(normalizeOtherTasks(parsedOtherTasks));
              setHasLoadedOtherTasks(true);
            }
          }, 0);

          return () => {
            isCancelled = true;
          };
        }
      }
    } catch (error) {
      console.warn("Unable to load local focus other tasks.", error);
    }

    window.setTimeout(() => {
      if (!isCancelled) {
        setHasLoadedOtherTasks(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedOtherTasks) {
      return;
    }

    try {
      window.localStorage.setItem(otherTaskStorageKey, JSON.stringify(otherTasks));
    } catch (error) {
      console.warn("Unable to save local focus other tasks.", error);
    }
  }, [hasLoadedOtherTasks, otherTasks]);

  useEffect(() => {
    if (
      !hasLoadedOtherTasks ||
      hasRequestedOtherTaskSupabaseLoad.current
    ) {
      return;
    }

    hasRequestedOtherTaskSupabaseLoad.current = true;
    let isCancelled = false;

    async function loadSharedOtherTasks() {
      const remoteTasks = await loadOtherTasksFromSupabase();

      if (isCancelled || remoteTasks === null) {
        return;
      }

      const hasMigratedLocalTasks =
        window.localStorage.getItem(otherTaskSupabaseMigrationKey) === "done";
      const shouldMergeLocalTasks =
        otherTasks.length > 0 && (!hasMigratedLocalTasks || remoteTasks.length === 0);
      const mergedTasks = shouldMergeLocalTasks
        ? await saveOtherTasksToSupabase(otherTasks)
        : remoteTasks;

      if (isCancelled || mergedTasks === null) {
        return;
      }

      if (shouldMergeLocalTasks) {
        window.localStorage.setItem(otherTaskSupabaseMigrationKey, "done");
      }

      setOtherTasks(mergedTasks);
    }

    void loadSharedOtherTasks();

    return () => {
      isCancelled = true;
    };
  }, [hasLoadedOtherTasks, otherTasks]);

  useEffect(() => {
    if (
      !hasLoadedEventDrafts ||
      !hasLoadedLocationAddressBook ||
      hasRequestedEventSupabaseLoad.current
    ) {
      return;
    }

    hasRequestedEventSupabaseLoad.current = true;

    async function loadEventsSnapshot() {
      const snapshot = await loadEventsSnapshotFromSupabase();

      if (!snapshot) {
        setHasLoadedEventSupabaseSnapshot(true);
        return;
      }

      if (snapshot.entries.length === 0 && snapshot.locations.length === 0) {
        const seedSnapshot = await saveEventsSnapshotToSupabase({
          entries: eventEntryDrafts,
          locations: locationAddressBook
        });

        if (seedSnapshot) {
          setEventEntryDrafts(seedSnapshot.entries);
          setLocationAddressBook(
            mergeLocationAddressBookWithEvents(
              seedSnapshot.locations,
              seedSnapshot.entries
            )
          );
        }

        setHasLoadedEventSupabaseSnapshot(true);
        return;
      }

      setEventEntryDrafts(snapshot.entries);
      setLocationAddressBook(
        mergeLocationAddressBookWithEvents(snapshot.locations, snapshot.entries)
      );
      setHasLoadedEventSupabaseSnapshot(true);
    }

    void loadEventsSnapshot();
  }, [
    eventEntryDrafts,
    hasLoadedEventDrafts,
    hasLoadedLocationAddressBook,
    locationAddressBook
  ]);

  useEffect(() => {
    if (
      !hasLoadedEventDrafts ||
      !hasLoadedLocationAddressBook ||
      !hasLoadedEventSupabaseSnapshot
    ) {
      return;
    }

    queueEventsSnapshotSave({
      entries: eventEntryDrafts,
      locations: locationAddressBook
    });
  }, [
    eventEntryDrafts,
    hasLoadedEventDrafts,
    hasLoadedEventSupabaseSnapshot,
    hasLoadedLocationAddressBook,
    locationAddressBook
  ]);

  useEffect(() => {
    async function loadMarketingCampaigns() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from("marketing_campaigns")
          .select(
            `
              id,
              slug,
              title,
              release_date,
              album_art_url,
              marketing_campaign_days (
                id,
                day_number,
                campaign_date,
                release_offset,
                clip_name,
                is_default_day,
                marketing_campaign_tasks (
                  id,
                  task_kind,
                  title,
                  status,
                  position,
                  is_standard_task
                )
              )
            `
          )
          .order("release_date", { ascending: false })
          .order("day_number", {
            ascending: true,
            referencedTable: "marketing_campaign_days"
          })
          .order("position", {
            ascending: true,
            referencedTable: "marketing_campaign_days.marketing_campaign_tasks"
          });

        if (error) {
          console.warn("Unable to load marketing campaigns from Supabase.", error);
          return;
        }

        const nextCampaigns = mapMarketingCampaignRows(
          (data ?? []) as MarketingCampaignDbRow[]
        );

        if (nextCampaigns.length > 0) {
          setCampaigns((currentCampaigns) => {
            const mergedCampaigns = mergeMarketingCampaignLocalBudgetLines(
              nextCampaigns,
              currentCampaigns
            );

            window.localStorage.setItem(
              campaignDraftStorageKey,
              JSON.stringify(mergedCampaigns)
            );

            return mergedCampaigns;
          });
        }
      } catch (error) {
        console.warn("Using local marketing campaign fallback.", error);
      }
    }

    loadMarketingCampaigns();
  }, []);

  useEffect(() => {
    async function loadProductionSongs() {
      try {
        const supabase = createBrowserSupabaseClient();
        const [
          songsResult,
          stepsResult,
          tasksResult,
          budgetLinesResult
        ] = await Promise.all([
          supabase
            .from("production_songs")
            .select("id, slug, title, production_deadline, album_art_url")
            .order("production_deadline", { ascending: true }),
          supabase
            .from("production_steps")
            .select(
              "id, production_song_id, stable_key, label, step_deadline, status, notes, position, is_default_step"
            )
            .order("position", { ascending: true }),
          supabase
            .from("production_step_tasks")
            .select("id, production_step_id, title, status, position")
            .order("position", { ascending: true }),
          supabase
            .from("production_budget_lines")
            .select(
              "id, production_step_id, production_step_task_id, description, amount, budget_bucket, position"
            )
            .order("position", { ascending: true })
        ]);

        if (songsResult.error) throw songsResult.error;
        if (stepsResult.error) throw stepsResult.error;
        if (tasksResult.error) throw tasksResult.error;
        if (budgetLinesResult.error) throw budgetLinesResult.error;

        if ((songsResult.data ?? []).length === 0) {
          const seedSongs = normalizeProductionSongsWithBudgetDefaults(productionSongs);
          const savedSongs = await saveProductionSongsToSupabase(seedSongs);
          const savedSongById = new Map(
            savedSongs.map((song) => [song.id, song.dbId])
          );
          const nextSongs = seedSongs.map((song) => ({
            ...song,
            dbId: savedSongById.get(song.id)
          }));

          setProductionSongDrafts(sortProductionSongsByDeadline(nextSongs));
          window.localStorage.setItem(
            productionDraftStorageKey,
            JSON.stringify(nextSongs)
          );
          setHasLoadedProductionDrafts(true);
          return;
        }

        const nextSongs = normalizeProductionSongsWithBudgetDefaults(
          mapProductionRows({
            budgetLines: (budgetLinesResult.data ?? []) as ProductionBudgetLineDbRow[],
            songs: (songsResult.data ?? []) as ProductionSongDbRow[],
            steps: (stepsResult.data ?? []) as ProductionStepDbRow[],
            tasks: (tasksResult.data ?? []) as ProductionStepTaskDbRow[]
          })
        );

        setProductionSongDrafts(nextSongs);
        window.localStorage.setItem(
          productionDraftStorageKey,
          JSON.stringify(nextSongs)
        );
        setHasLoadedProductionDrafts(true);
      } catch (error) {
        console.warn("Using local production fallback.", error);
      }
    }

    loadProductionSongs();
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      void refreshPlatformStatsOnOpenIfMissing();
    }, 0);
  }, [refreshPlatformStatsOnOpenIfMissing]);

  useEffect(() => {
    let isCancelled = false;

    void loadDailyFocusProgress(getViennaDateKey()).then((items) => {
      if (!isCancelled && items) {
        setDailyFocusProgress(items);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setAppleMusicReminderDismissedDate(
        window.localStorage.getItem(appleMusicReminderDismissedDateKey) ?? ""
      );
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  function openAppleMusicImport() {
    setActiveSection("Platforms");
    window.setTimeout(() => {
      document.getElementById("platform-card-apple-music")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  function dismissAppleMusicReminderForToday() {
    const todayKey = getViennaDateKey();
    setAppleMusicReminderDismissedDate(todayKey);
    window.localStorage.setItem(appleMusicReminderDismissedDateKey, todayKey);
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-mark">
          <Image
            alt=""
            aria-hidden
            className="brand-logo"
            height={44}
            src="/love-strings-logo.jpeg"
            width={44}
          />
          <div>
            <strong>Love Strings</strong>
            <span>Sprint Dashboard</span>
            <span className="app-version-label">{appVersionLabel}</span>
          </div>
        </div>

        <nav className="nav-list">
          {sections.map((section) => (
            <button
              aria-current={activeSection === section ? "page" : undefined}
              key={section}
              onClick={() => setActiveSection(section)}
              type="button"
            >
              {section}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        {activeSection === "Roadmap" ? <RoadmapView /> : null}
        {activeSection === "Marketing" ? (
          <MarketingView
            campaigns={campaigns}
            focusTarget={marketingFocusTarget}
            onAddCampaign={addCampaign}
            onCampaignBudgetLinesChange={updateCampaignBudgetLines}
            onCampaignDaysChange={updateCampaignDays}
            onDeleteCampaign={deleteCampaign}
            onFocusCampaign={(campaignId, elementId) =>
              setMarketingFocusTarget({ campaignId, elementId, token: Date.now() })
            }
            onReleaseDateSave={updateCampaignReleaseDate}
            onTitleSave={updateCampaignTitle}
            recentProductionSongId={productionFocusTarget?.songId}
            productionSongs={productionSongDrafts}
          />
        ) : null}
        {activeSection === "Platforms" ? (
          <PlatformsView
            appleMusicImportStatus={appleMusicImportStatus}
            onAddQrCode={addQrCodeLink}
            onAppleMusicCsvImport={importAppleMusicCsv}
            onDeleteQrCode={deleteQrCodeLink}
            onQrCodeChange={updateQrCodeLink}
            onRefreshPlatformStats={refreshPlatformStats}
            platformMetricRows={platformMetricRows}
            platformStatsData={platformStatsData}
            qrCodeLinks={qrCodeLinks}
            refreshStatus={refreshStatus}
          />
        ) : null}
        {activeSection === "Production" ? (
          <ProductionView
            focusTarget={productionFocusTarget}
            onAddSong={addProductionSong}
            onDeleteSong={deleteProductionSong}
            onFocusSong={(songId, elementId) =>
              setProductionFocusTarget({ elementId, songId, token: Date.now() })
            }
            onSongChange={updateProductionSong}
            saveStatus={productionSaveStatus}
            songs={productionSongDrafts}
          />
        ) : null}
        {activeSection === "Budget" ? (
          <BudgetView
            entries={budgetEntriesWithForecast}
            onAddEntry={addBudgetEntry}
            onDeleteEntry={deleteBudgetEntry}
            onEntryChange={updateBudgetEntry}
          />
        ) : null}
        {activeSection === "Events" ? (
          <EventsView
            entries={eventEntryDrafts}
            isLoaded={hasLoadedEventSupabaseSnapshot}
            locations={locationAddressBook}
            onAddEntry={addEventEntry}
            onAddLocation={addLocationAddressBookEntry}
            onDeleteEntry={deleteEventEntry}
            onDeleteLocation={deleteLocationAddressBookEntry}
            onEntryChange={updateEventEntry}
            onLocationChange={updateLocationAddressBookEntry}
          />
        ) : null}
        {activeSection !== "Roadmap" &&
        activeSection !== "Platforms" &&
        activeSection !== "Marketing" &&
        activeSection !== "Production" &&
        activeSection !== "Events" &&
        activeSection !== "Budget" ? (
          <DashboardView
            budgetEntries={budgetEntriesWithForecast}
            campaigns={campaigns}
            dailyFocusProgress={dailyFocusProgress}
            dashboardPlatformStats={dashboardPlatformStats}
            eventEntries={eventEntryDrafts}
            eventsLoaded={hasLoadedEventSupabaseSnapshot}
            onAddQrCode={addQrCodeLink}
            onAddOtherTask={addOtherTask}
            onCampaignDaysChange={updateCampaignDays}
            onDeleteQrCode={deleteQrCodeLink}
            onDeleteOtherTask={deleteOtherTask}
            onDismissAppleMusicReminder={dismissAppleMusicReminderForToday}
            onOpenAppleMusicImport={openAppleMusicImport}
            onOtherTaskChange={updateOtherTask}
            onProductionSongChange={updateProductionSong}
            onQrCodeChange={updateQrCodeLink}
            otherTasks={otherTasks}
            appleMusicReminderDismissedDate={appleMusicReminderDismissedDate}
            platformMetricRows={platformMetricRows}
            productionSongs={productionSongDrafts}
            qrCodeLinks={qrCodeLinks}
          />
        ) : null}
      </section>
      <ScrollAssistButton />
    </main>
  );
}

function ScrollAssistButton() {
  function scrollToOpenCardOrTop() {
    const scrollTargetTop = 96;
    const openCards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-anchor='open-card']")
    )
      .filter((element) => !element.hidden && element.offsetParent !== null)
      .map((element) => ({
        element,
        top: element.getBoundingClientRect().top
      }))
      .filter((candidate) => candidate.top <= scrollTargetTop + 16)
      .sort((firstCandidate, secondCandidate) => secondCandidate.top - firstCandidate.top);
    const target = openCards[0];

    if (target && Math.abs(target.top - scrollTargetTop) > 18) {
      target.element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  return (
    <button
      aria-label="Scroll to open card or top"
      className="scroll-assist-button"
      onClick={scrollToOpenCardOrTop}
      type="button"
    >
      <ArrowUp size={20} aria-hidden />
    </button>
  );
}

function EventsView({
  entries,
  isLoaded,
  locations,
  onAddEntry,
  onAddLocation,
  onDeleteEntry,
  onDeleteLocation,
  onEntryChange,
  onLocationChange
}: {
  entries: EventEntry[];
  isLoaded: boolean;
  locations: LocationAddressBookEntry[];
  onAddEntry: () => void;
  onAddLocation: () => void;
  onDeleteEntry: (entryId: string) => void;
  onDeleteLocation: (locationId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<EventEntry>) => void;
  onLocationChange: (
    locationId: string,
    updates: Partial<LocationAddressBookEntry>
  ) => void;
}) {
  const nextEvent = getNextUpcomingEvent(entries);
  const nextEventDate = nextEvent ? parseFlexibleBudgetDate(nextEvent.date) : null;
  const nextEventDaysLeft = nextEventDate ? getDaysUntilDate(nextEventDate) : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Shows and appearances</p>
          <h1>Events</h1>
        </div>
        <ModuleHeaderDate />
      </header>

      <section className="events-summary-grid" aria-label="Events summary">
        <article className="metric-card event-summary-card">
          <div className="event-summary-card-title">
            <MapPin size={18} aria-hidden />
            <span>Next event</span>
          </div>
          {!isLoaded ? (
            <p className="event-card-loading">Loading events...</p>
          ) : (
            <>
              <strong>
                {nextEventDate
                  ? formatCampaignDate(nextEventDate)
                  : "No upcoming events planned yet"}
              </strong>
              <p>
                {nextEvent && nextEventDaysLeft !== null
                  ? `${nextEvent.locationName || "Location TBD"} - ${formatEventDaysLeft(nextEventDaysLeft)}`
                  : "No upcoming events planned yet"}
              </p>
            </>
          )}
        </article>
        <article className="metric-card event-summary-card">
          <div className="event-summary-card-title">
            <CalendarDays size={18} aria-hidden />
            <span>Total events</span>
          </div>
          <strong>{entries.length}</strong>
          <p>Seeded from the Love Strings News page.</p>
        </article>
      </section>

      <LocationAddressBook
        events={entries}
        locations={locations}
        onAddLocation={onAddLocation}
        onDeleteLocation={onDeleteLocation}
        onLocationChange={onLocationChange}
      />

      <section className="events-panel panel" aria-label="Events list">
        <div className="events-header">
          <div>
            <p className="eyebrow">Archive</p>
            <h2>Event records</h2>
          </div>
          <button className="add-campaign-button" onClick={onAddEntry} type="button">
            <Plus size={16} aria-hidden />
            Add event
          </button>
        </div>

        <div className="events-list">
          {entries.map((entry) => (
            <EventCard
              entry={entry}
              key={entry.id}
              locations={locations}
              onDelete={onDeleteEntry}
              onEntryChange={onEntryChange}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function LocationAddressBook({
  events,
  locations,
  onAddLocation,
  onDeleteLocation,
  onLocationChange
}: {
  events: EventEntry[];
  locations: LocationAddressBookEntry[];
  onAddLocation: () => void;
  onDeleteLocation: (locationId: string) => void;
  onLocationChange: (
    locationId: string,
    updates: Partial<LocationAddressBookEntry>
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="location-address-book" aria-label="Location address book">
      <button
        aria-expanded={isOpen}
        className="location-address-book-toggle"
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
        type="button"
      >
        <span>
          <MapPin size={18} aria-hidden />
          Location address book
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>

      {isOpen ? (
        <div className="location-address-book-panel">
          <div className="location-address-book-toolbar">
            <span>{locations.length} locations</span>
            <button className="add-campaign-button" onClick={onAddLocation} type="button">
              <Plus size={16} aria-hidden />
              Add location
            </button>
          </div>

          <div className="location-address-book-list">
            {locations.map((location) => (
              <LocationAddressBookCard
                events={events}
                key={location.id}
                location={location}
                onDeleteLocation={onDeleteLocation}
                onLocationChange={onLocationChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LocationAddressBookCard({
  events,
  location,
  onDeleteLocation,
  onLocationChange
}: {
  events: EventEntry[];
  location: LocationAddressBookEntry;
  onDeleteLocation: (locationId: string) => void;
  onLocationChange: (
    locationId: string,
    updates: Partial<LocationAddressBookEntry>
  ) => void;
}) {
  const pastEvents = getPastEventsForLocation(location, events);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  return (
    <article className="location-address-book-card">
      <div className="location-address-book-card-header">
        <strong>{location.locationName || "Location name"}</strong>
        <span>{location.address || "Address"}</span>
      </div>

      <div className="location-address-book-fields">
        <label>
          Location name
          <input
            onChange={(event) =>
              onLocationChange(location.id, { locationName: event.target.value })
            }
            value={location.locationName}
          />
        </label>
        <label>
          Location link
          <input
            onChange={(event) =>
              onLocationChange(location.id, { locationUrl: event.target.value })
            }
            placeholder="https://..."
            value={location.locationUrl}
          />
        </label>
        <label>
          Address
          <input
            onChange={(event) =>
              onLocationChange(location.id, { address: event.target.value })
            }
            value={location.address}
          />
        </label>
        <label>
          Address link
          <input
            onChange={(event) =>
              onLocationChange(location.id, { addressUrl: event.target.value })
            }
            placeholder="https://..."
            value={location.addressUrl}
          />
        </label>
        <label>
          Contact name
          <input
            onChange={(event) =>
              onLocationChange(location.id, { contactName: event.target.value })
            }
            placeholder="Booker / manager"
            value={location.contactName}
          />
        </label>
        <label>
          Contact phone
          <input
            onChange={(event) =>
              onLocationChange(location.id, { contactPhone: event.target.value })
            }
            inputMode="tel"
            placeholder="+43..."
            value={location.contactPhone}
          />
        </label>
        <label className="location-contact-notes-field">
          Contact notes
          <textarea
            onChange={(event) =>
              onLocationChange(location.id, { contactNotes: event.target.value })
            }
            placeholder="Booking notes, stage details, payment habits..."
            value={location.contactNotes}
          />
        </label>
      </div>

      <div className="location-event-history">
        <strong>Past events here</strong>
        {pastEvents.length > 0 ? (
          <ul>
            {pastEvents.map((event) => (
              <li key={event.id}>
                <span>{event.date}</span>
                <EventMaybeLink label={event.name} url={event.nameUrl} />
              </li>
            ))}
          </ul>
        ) : (
          <p>No past events linked yet.</p>
        )}
      </div>

      <div className="location-delete-row">
        <label>
          <input
            checked={isDeleteConfirmed}
            onChange={(event) => setIsDeleteConfirmed(event.target.checked)}
            type="checkbox"
          />
          Confirm delete
        </label>
        <button
          className="danger-action"
          disabled={!isDeleteConfirmed}
          onClick={() => onDeleteLocation(location.id)}
          type="button"
        >
          <Trash2 size={14} aria-hidden />
          Delete location
        </button>
      </div>
    </article>
  );
}

function EventCard({
  entry,
  locations,
  onDelete,
  onEntryChange
}: {
  entry: EventEntry;
  locations: LocationAddressBookEntry[];
  onDelete: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<EventEntry>) => void;
}) {
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const selectedLocation = getMatchingLocationAddressBookEntry(entry, locations);
  const eventBudgetLines =
    entry.budgetLines && entry.budgetLines.length > 0
      ? entry.budgetLines
      : ([
          {
            id: "event-budget-line-default",
            amount: 0,
            bucket: "events",
            description: ""
          }
        ] satisfies ProductionBudgetLine[]);

  function selectLocation(locationId: string) {
    const location = locations.find((candidate) => candidate.id === locationId);

    if (!location) {
      return;
    }

    onEntryChange(entry.id, {
      locationName: location.locationName,
      locationUrl: location.locationUrl,
      address: location.address,
      addressUrl: location.addressUrl
    });
  }

  function updateEventBudgetLine(
    lineId: string,
    updates: Partial<ProductionBudgetLine>
  ) {
    onEntryChange(entry.id, {
      budgetLines: eventBudgetLines.map((line) =>
        line.id === lineId ? { ...line, ...updates } : line
      )
    });
  }

  function addEventBudgetLine() {
    onEntryChange(entry.id, {
      budgetLines: [
        ...eventBudgetLines,
        {
          id: `event-budget-line-${Date.now()}`,
          amount: 0,
          bucket: "events",
          description: ""
        }
      ]
    });
  }

  function deleteEventBudgetLine(lineId: string) {
    const remainingLines = eventBudgetLines.filter((line) => line.id !== lineId);

    onEntryChange(entry.id, {
      budgetLines:
        remainingLines.length > 0
          ? remainingLines
          : ([
              {
                id: `event-budget-line-${Date.now()}`,
                amount: 0,
                bucket: "events",
                description: ""
              }
            ] satisfies ProductionBudgetLine[])
    });
  }

  return (
    <article className="event-card">
      <div className="event-card-header">
        <div className="event-card-main">
          {entry.posterUrl ? (
            <span
              aria-label={`${entry.name} poster preview`}
              className="event-header-poster-thumb"
              role="img"
              style={{ backgroundImage: `url("${entry.posterUrl}")` }}
            />
          ) : (
            <span className="event-header-poster-thumb event-header-poster-thumb-empty">
              <CalendarDays size={18} aria-hidden />
            </span>
          )}
          <strong className="event-date-display">{entry.date}</strong>
          <div className="event-title-block">
            <EventMaybeLink label={entry.name} url={entry.nameUrl} />
            <span>
              <MapPin size={14} aria-hidden />
              <EventMaybeLink
                label={entry.locationName || "Location name"}
                url={entry.locationUrl}
              />
            </span>
            <span>
              <LinkIcon size={14} aria-hidden />
              <EventMaybeLink
                label={entry.address || "Address"}
                url={entry.addressUrl}
              />
            </span>
          </div>
        </div>
        <button
          aria-controls={`${entry.id}-event-details`}
          aria-expanded={isEventOpen}
          aria-label={isEventOpen ? "Hide event details" : "Show event details"}
          className="campaign-toggle"
          onClick={() => setIsEventOpen((current) => !current)}
          type="button"
        >
          <ChevronDown size={20} aria-hidden />
        </button>
      </div>

      <div
        className="event-edit-panel"
        hidden={!isEventOpen}
        id={`${entry.id}-event-details`}
      >
        <div className="event-poster-section">
          <label>
            Poster image URL
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { posterUrl: event.target.value })
              }
              placeholder="https://..."
              value={entry.posterUrl ?? ""}
            />
          </label>
        </div>

        <div className="event-edit-grid">
          <label>
            Date
            <input
              inputMode="numeric"
              onChange={(event) =>
                onEntryChange(entry.id, { date: event.target.value })
              }
              value={entry.date}
            />
          </label>
          <label>
            Event name
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { name: event.target.value })
              }
              value={entry.name}
            />
          </label>
          <label>
            Event link
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { nameUrl: event.target.value })
              }
              placeholder="https://..."
              value={entry.nameUrl}
            />
          </label>
          <label>
            Location name
            <select
              aria-label={`${entry.name} location`}
              onChange={(event) => selectLocation(event.target.value)}
              value={selectedLocation?.id ?? ""}
            >
              <option value="">Choose location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location link
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { locationUrl: event.target.value })
              }
              placeholder="https://..."
              value={entry.locationUrl}
            />
          </label>
          <label>
            Address
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { address: event.target.value })
              }
              value={entry.address}
            />
          </label>
          <label>
            Address link
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { addressUrl: event.target.value })
              }
              placeholder="https://..."
              value={entry.addressUrl}
            />
          </label>
        </div>

        <div className="event-budget-section">
          <strong>Budget</strong>
          <div className="event-budget-lines">
            {eventBudgetLines.map((line) => (
              <EventBudgetLineRow
                key={line.id}
                line={line}
                onDelete={deleteEventBudgetLine}
                onUpdate={updateEventBudgetLine}
                showBucket
              />
            ))}
          </div>
          <button
            className="add-campaign-task-button production-budget-add-button"
            onClick={addEventBudgetLine}
            type="button"
          >
            <Plus size={16} aria-hidden />
            Add new budget line
          </button>
        </div>

        <div className="event-danger-zone">
          <label>
            <input
              checked={isDeleteConfirmed}
              onChange={(event) => setIsDeleteConfirmed(event.target.checked)}
              type="checkbox"
            />
            Enable delete for this event
          </label>
          <button
            className="delete-campaign-button"
            disabled={!isDeleteConfirmed}
            onClick={() => onDelete(entry.id)}
            type="button"
          >
            <Trash2 size={15} aria-hidden />
            Delete event
          </button>
        </div>
      </div>
    </article>
  );
}

function EventBudgetLineRow({
  line,
  onDelete,
  onUpdate,
  showBucket = false
}: {
  line: ProductionBudgetLine;
  onDelete: (lineId: string) => void;
  onUpdate: (lineId: string, updates: Partial<ProductionBudgetLine>) => void;
  showBucket?: boolean;
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  return (
    <div className={showBucket ? "event-budget-line event-budget-line-with-bucket" : "event-budget-line"}>
      {showBucket ? (
        <label>
          Bucket
          <select
            aria-label="Event budget bucket"
            onChange={(event) =>
              onUpdate(line.id, {
                bucket: event.target.value as BudgetSourceBucket
              })
            }
            value={getEventBudgetLineBucket(line)}
          >
            {eventBudgetBucketOptions.map((bucket) => (
              <option key={bucket.value} value={bucket.value}>
                {bucket.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Budget reason
        <input
          onChange={(event) =>
            onUpdate(line.id, {
              description: event.target.value
            })
          }
          placeholder="Income, travel, food, parking..."
          value={line.description}
        />
      </label>
      <label>
        Amount
        <ProductionBudgetAmountInput
          amount={line.amount}
          onChange={(amount) => onUpdate(line.id, { amount })}
        />
      </label>
      <div className="event-budget-actions-cell">
        <button
          aria-expanded={isActionsOpen}
          aria-label={`${isActionsOpen ? "Hide" : "Show"} event budget line actions`}
          className="budget-row-action-button"
          onClick={() => setIsActionsOpen((current) => !current)}
          type="button"
        >
          <Pencil size={15} aria-hidden />
        </button>
        {isActionsOpen ? (
          <div className="event-budget-action-panel">
            <label>
              <input
                checked={isDeleteConfirmed}
                onChange={(event) => setIsDeleteConfirmed(event.target.checked)}
                type="checkbox"
              />
              Enable
            </label>
            <button
              aria-label="Delete event budget line"
              className="delete-campaign-task-button"
              disabled={!isDeleteConfirmed}
              onClick={() => onDelete(line.id)}
              type="button"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EventMaybeLink({ label, url }: { label: string; url: string }) {
  const safeLabel = label.trim() || "TBD";
  const safeUrl = url.trim();

  if (!safeUrl) {
    return <span>{safeLabel}</span>;
  }

  return (
    <a href={safeUrl} rel="noreferrer" target="_blank">
      {safeLabel}
    </a>
  );
}

function BudgetView({
  entries,
  onAddEntry,
  onDeleteEntry,
  onEntryChange
}: {
  entries: BudgetEntry[];
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<BudgetEntry>) => void;
}) {
  const summary = getBudgetSummary(entries);
  const cashflowPoints = useMemo(() => getBudgetCashflowPoints(entries), [entries]);
  const monthlyIncomeSpend = useMemo(
    () => getBudgetMonthlyIncomeSpend(entries),
    [entries]
  );
  const [isHistoricalLedgerOpen, setIsHistoricalLedgerOpen] = useState(false);
  const [isMoreAnalyticsOpen, setIsMoreAnalyticsOpen] = useState(false);
  const [ledgerSort, setLedgerSort] = useState<{
    direction: SortDirection;
    key: BudgetLedgerSortKey;
  }>({
    direction: "descending",
    key: "date"
  });
  const sortedEntries = useMemo(
    () => sortBudgetEntriesForLedger(entries, ledgerSort.key, ledgerSort.direction),
    [entries, ledgerSort]
  );
  const { historicalEntries, upcomingEntries } = useMemo(() => {
    const todayTime = getTodayUtcDate().getTime();

    return sortedEntries.reduce(
      (groups, entry) => {
        const entryDate = parseFlexibleBudgetDate(entry.date);

        if (entryDate !== null && entryDate.getTime() > todayTime) {
          groups.upcomingEntries.push(entry);
        } else {
          groups.historicalEntries.push(entry);
        }

        return groups;
      },
      {
        historicalEntries: [] as BudgetEntry[],
        upcomingEntries: [] as BudgetEntry[]
      }
    );
  }, [sortedEntries]);

  function updateLedgerSort(nextKey: BudgetLedgerSortKey) {
    setLedgerSort((currentSort) => {
      if (currentSort.key !== nextKey) {
        return {
          direction: "ascending",
          key: nextKey
        };
      }

      return {
        direction:
          currentSort.direction === "ascending" ? "descending" : "ascending",
        key: nextKey
      };
    });
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Money tracker</p>
          <h1>Budget</h1>
        </div>
        <ModuleHeaderDate />
      </header>

      <section className="budget-summary-grid" aria-label="Budget summary">
        <article className="metric-card budget-metric-card">
          <span>Total earned</span>
          <strong className="amount-positive">{formatCurrency(summary.totalEarned)}</strong>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Total spent</span>
          <strong className="amount-expense">{formatSpentCurrency(summary.totalSpent)}</strong>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Current Balance</span>
          <strong className={getAmountToneClass(summary.balance)}>
            {formatCurrency(summary.balance)}
          </strong>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected earn month ahead</span>
          <strong className="amount-positive">{formatCurrency(summary.potentialEarn)}</strong>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected spend month ahead</span>
          <strong className="amount-expense">
            {formatSpentCurrency(summary.upcomingSpend)}
          </strong>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected balance month ahead</span>
          <strong className={getAmountToneClass(summary.upcomingBalance)}>
            {formatCurrency(summary.upcomingBalance)}
          </strong>
        </article>
      </section>

      <section className="budget-more-analytics" aria-label="More budget analytics">
        <button
          aria-expanded={isMoreAnalyticsOpen}
          className="budget-more-analytics-button"
          onClick={() => setIsMoreAnalyticsOpen((current) => !current)}
          type="button"
        >
          <span>More analytics</span>
          <ChevronDown size={20} aria-hidden />
        </button>
        <div className="budget-more-analytics-panel" hidden={!isMoreAnalyticsOpen}>
          <section className="budget-bucket-grid" aria-label="Budget source buckets">
            {budgetSummaryBucketOptions.map((bucket) => (
              <article className="metric-card budget-metric-card" key={`${bucket.value}-history`}>
                <span>{bucket.label} since start</span>
                <strong
                  className={getBudgetBucketToneClass(
                    bucket.value,
                    summary.bucketSummaries[bucket.value].historical
                  )}
                >
                  {formatCurrency(summary.bucketSummaries[bucket.value].historical)}
                </strong>
              </article>
            ))}
            {budgetSummaryBucketOptions.map((bucket) => (
              <article className="metric-card budget-metric-card" key={`${bucket.value}-upcoming`}>
                <span>{bucket.label} month ahead</span>
                <strong
                  className={getBudgetBucketToneClass(
                    bucket.value,
                    summary.bucketSummaries[bucket.value].upcoming
                  )}
                >
                  {formatCurrency(summary.bucketSummaries[bucket.value].upcoming)}
                </strong>
              </article>
            ))}
          </section>
          <section className="budget-graph-placeholder-grid" aria-label="Future budget graphs">
            <article className="budget-graph-placeholder">
              <span className="budget-graph-title-with-legend">
                <i className="budget-legend-square budget-legend-square-income" aria-hidden />
                Cashflow evolution
              </span>
              <BudgetCashflowChart points={cashflowPoints} />
            </article>
            <article className="budget-graph-placeholder">
              <span className="budget-graph-title-with-legend">
                <i className="budget-legend-square budget-legend-square-income" aria-hidden />
                Income vs
                <i className="budget-legend-square budget-legend-square-spend" aria-hidden />
                Spend
              </span>
              <BudgetIncomeSpendChart months={monthlyIncomeSpend} />
            </article>
          </section>
        </div>
      </section>

      <section className="budget-ledger panel" aria-label="Budget ledger">
        <div className="budget-ledger-header">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2>Budget lines</h2>
          </div>
          <button className="add-campaign-button" onClick={onAddEntry} type="button">
            <Plus size={16} aria-hidden />
            Add budget line
          </button>
        </div>

        <div className="budget-ledger-section">
          <div className="budget-ledger-subheader">
            <span>Upcoming amounts</span>
            <small>{upcomingEntries.length} lines</small>
          </div>
          <BudgetLedgerTable
            activeSort={ledgerSort}
            entries={upcomingEntries}
            emptyMessage="No upcoming budget lines."
            onDeleteEntry={onDeleteEntry}
            onEntryChange={onEntryChange}
            onSort={updateLedgerSort}
          />
        </div>

        <div className="budget-historical-ledger">
          <button
            aria-expanded={isHistoricalLedgerOpen}
            className="budget-more-analytics-button budget-see-more-button"
            onClick={() => setIsHistoricalLedgerOpen((current) => !current)}
            type="button"
          >
            <span>See more</span>
            <small>{historicalEntries.length} historical lines</small>
            <ChevronDown size={20} aria-hidden />
          </button>
          <div
            className="budget-historical-ledger-panel"
            hidden={!isHistoricalLedgerOpen}
          >
            <div className="budget-ledger-subheader">
              <span>Historical amounts</span>
              <small>{historicalEntries.length} lines</small>
            </div>
            <BudgetLedgerTable
              activeSort={ledgerSort}
              entries={historicalEntries}
              emptyMessage="No historical budget lines."
              onDeleteEntry={onDeleteEntry}
              onEntryChange={onEntryChange}
              onSort={updateLedgerSort}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function BudgetCashflowChart({
  points
}: {
  points: Array<{ balance: number; key: string; label: string }>;
}) {
  if (points.length === 0) {
    return <div className="budget-chart-empty">No cashflow data yet.</div>;
  }

  const width = 320;
  const height = 132;
  const padding = 14;
  const labelBandHeight = 20;
  const gridBottom = height - padding - labelBandHeight;
  const balances = points.map((point) => point.balance);
  const minBalance = Math.min(...balances, 0);
  const maxBalance = Math.max(...balances, 0);
  const balanceRange = Math.max(maxBalance - minBalance, 1);
  const chartWidth = width - padding * 2;
  const chartHeight = gridBottom - padding;
  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * chartWidth;
    const labelY =
      padding + ((maxBalance - point.balance) / balanceRange) * chartHeight;

    return {
      ...point,
      x,
      labelY,
      y: labelY + 8
    };
  });
  const linePoints = chartPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const middleIndex = Math.floor((chartPoints.length - 1) / 2);
  const labeledPointIndexes = new Set([0, middleIndex, chartPoints.length - 1]);
  const verticalGridLines = Array.from({ length: 6 }, (_, index) => {
    return padding + (index / 5) * chartWidth;
  });
  const horizontalGridLines = Array.from({ length: 4 }, (_, index) => {
    return padding + (index / 3) * chartHeight;
  });

  return (
    <div className="budget-line-chart">
      <svg aria-hidden role="presentation" viewBox={`0 0 ${width} ${height}`}>
        <rect
          className="budget-line-chart-grid-frame"
          height={chartHeight}
          width={chartWidth}
          x={padding}
          y={padding}
        />
        {verticalGridLines.map((x) => (
          <line
            className="budget-line-chart-grid-line"
            key={`vertical-${x.toFixed(1)}`}
            x1={x}
            x2={x}
            y1={padding}
            y2={gridBottom}
          />
        ))}
        {horizontalGridLines.map((y) => (
          <line
            className="budget-line-chart-grid-line"
            key={`horizontal-${y.toFixed(1)}`}
            x1={padding}
            x2={width - padding}
            y1={y}
            y2={y}
          />
        ))}
        <polyline points={linePoints} />
        {chartPoints.map((point, index) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            {labeledPointIndexes.has(index) ? (
              <text
                className="budget-line-chart-value"
                textAnchor={
                  index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"
                }
                x={point.x}
                y={Math.max(12, point.labelY - 8)}
              >
                {formatCompactCurrency(point.balance)}
              </text>
            ) : null}
            {labeledPointIndexes.has(index) ? (
              <text
                className="budget-line-chart-month"
                textAnchor={
                  index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"
                }
                x={point.x}
                y={height - 2}
              >
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function BudgetIncomeSpendChart({
  months
}: {
  months: Array<{ income: number; key: string; label: string; spend: number }>;
}) {
  if (months.length === 0) {
    return <div className="budget-chart-empty">No monthly data yet.</div>;
  }

  const maxMonthlyValue = Math.max(
    ...months.flatMap((month) => [month.income, month.spend]),
    1
  );

  return (
    <div className="budget-income-spend-chart">
      <div className="budget-bar-chart" aria-hidden>
        {months.map((month) => (
          <div className="budget-bar-group" key={month.key}>
            <div className="budget-bar">
              <b
                className="budget-income-bar"
                title={`Income ${formatCurrency(month.income)}`}
                style={{ height: `${Math.max(8, (month.income / maxMonthlyValue) * 100)}%` }}
              />
              <b
                className="budget-spend-bar"
                title={`Spend ${formatCurrency(month.spend)}`}
                style={{ height: `${Math.max(8, (month.spend / maxMonthlyValue) * 100)}%` }}
              />
            </div>
            <small>{month.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetLedgerTable({
  activeSort,
  emptyMessage,
  entries,
  onDeleteEntry,
  onEntryChange,
  onSort
}: {
  activeSort: {
    direction: SortDirection;
    key: BudgetLedgerSortKey;
  };
  emptyMessage: string;
  entries: BudgetEntry[];
  onDeleteEntry: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<BudgetEntry>) => void;
  onSort: (sortKey: BudgetLedgerSortKey) => void;
}) {
  return (
    <div className="budget-table-wrap">
      <table className="budget-table">
        <thead>
          <tr>
            <SortableBudgetHeader
              label="Date"
              sortKey="date"
              activeSort={activeSort}
              onSort={onSort}
            />
            <SortableBudgetHeader
              label="Bucket"
              sortKey="bucket"
              activeSort={activeSort}
              onSort={onSort}
            />
            <SortableBudgetHeader
              label="Description"
              sortKey="description"
              activeSort={activeSort}
              onSort={onSort}
            />
            <SortableBudgetHeader
              label="Amount"
              sortKey="amount"
              activeSort={activeSort}
              onSort={onSort}
            />
            <SortableBudgetHeader
              label="Type"
              sortKey="type"
              activeSort={activeSort}
              onSort={onSort}
            />
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.length > 0 ? (
            entries.map((entry) => (
              <BudgetEntryRow
                entry={entry}
                key={entry.id}
                onDelete={onDeleteEntry}
                onEntryChange={onEntryChange}
              />
            ))
          ) : (
            <tr>
              <td className="budget-empty-row" colSpan={6}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableBudgetHeader({
  activeSort,
  label,
  onSort,
  sortKey
}: {
  activeSort: {
    direction: SortDirection;
    key: BudgetLedgerSortKey;
  };
  label: string;
  onSort: (sortKey: BudgetLedgerSortKey) => void;
  sortKey: BudgetLedgerSortKey;
}) {
  const isActive = activeSort.key === sortKey;

  return (
    <th
      aria-sort={
        isActive
          ? activeSort.direction === "ascending"
            ? "ascending"
            : "descending"
          : "none"
      }
      scope="col"
    >
      <button
        className={isActive ? "budget-sort-button is-active" : "budget-sort-button"}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <ChevronDown
          aria-hidden
          className={
            isActive && activeSort.direction === "ascending"
              ? "budget-sort-icon is-ascending"
              : "budget-sort-icon"
          }
          size={14}
        />
      </button>
    </th>
  );
}

function BudgetEntryRow({
  entry,
  onDelete,
  onEntryChange
}: {
  entry: BudgetEntry;
  onDelete: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<BudgetEntry>) => void;
}) {
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(String(getBudgetSignedAmount(entry)));
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const signedAmount = getBudgetSignedAmount(entry);
  const paymentType = getBudgetPaymentType(entry);
  const isAutoRecurringEntry = Boolean(entry.generated && entry.sourceRecurringEntryId);
  const generatedSourceLabel = getBudgetGeneratedSourceLabel(entry);
  const canUseLedgerActions = canDeleteBudgetEntryFromLedger(entry);

  useEffect(() => {
    const input = descriptionInputRef.current;

    if (!input) {
      return;
    }

    const minHeight = Number.parseFloat(window.getComputedStyle(input).minHeight);
    input.style.height = "auto";
    input.style.height = `${Math.max(input.scrollHeight, minHeight || 0)}px`;
  }, [entry.description]);

  return (
    <tr className={entry.generated ? "budget-generated-row" : undefined}>
      <td className="budget-date-cell" data-label="Date">
        <input
          aria-label={`${entry.description} date`}
          disabled={entry.generated}
          inputMode="numeric"
          onChange={(event) =>
            onEntryChange(entry.id, { date: event.target.value })
          }
          value={entry.date}
        />
      </td>
      <td className="budget-bucket-column" data-label="Bucket">
        <select
          aria-label={`${entry.description} source bucket`}
          disabled={entry.generated}
          onChange={(event) =>
            onEntryChange(entry.id, {
              bucket: event.target.value as BudgetSourceBucket
            })
          }
          value={getBudgetSourceBucket(entry)}
        >
          {budgetSourceBucketOptions.map((bucket) => (
            <option key={bucket.value} value={bucket.value}>
              {bucket.label}
            </option>
          ))}
        </select>
      </td>
      <td className="budget-description-cell" data-label="Description">
        <textarea
          aria-label={`${entry.description} description`}
          disabled={entry.generated}
          onChange={(event) => {
            const minHeight = Number.parseFloat(
              window.getComputedStyle(event.target).minHeight
            );
            event.target.style.height = "auto";
            event.target.style.height = `${Math.max(
              event.target.scrollHeight,
              minHeight || 0
            )}px`;
            onEntryChange(entry.id, {
              description: event.target.value
            });
          }}
          ref={descriptionInputRef}
          rows={1}
          value={entry.description}
        />
      </td>
      <td className="budget-amount-cell" data-label="Amount">
        <input
          aria-label={`${entry.description} amount`}
          className={getTransactionAmountToneClass(signedAmount)}
          disabled={entry.generated}
          inputMode="decimal"
          onBlur={() => {
            const parsedAmount = parseEditableAmount(amountInput);
            setAmountInput(String(parsedAmount ?? signedAmount));
          }}
          onChange={(event) => {
            const nextAmountInput = event.target.value;
            const parsedAmount = parseEditableAmount(nextAmountInput);

            setAmountInput(nextAmountInput);

            if (parsedAmount === null) {
              return;
            }

            onEntryChange(entry.id, {
              amount: parsedAmount,
              type: entry.type === "recurring" ? "recurring" : "one-off"
            });
          }}
          value={entry.generated ? String(signedAmount) : amountInput}
        />
      </td>
      <td className="budget-type-column" data-label="Type">
        <div className="budget-type-cell">
          <select
            aria-label={`${entry.description} type`}
            disabled={entry.generated}
            onChange={(event) =>
              onEntryChange(entry.id, {
                recurringCadence:
                  event.target.value === "recurring"
                    ? entry.recurringCadence ?? "monthly"
                    : undefined,
                paymentPlanEndDate:
                  event.target.value === "recurring"
                    ? entry.paymentPlanEndDate ?? ""
                    : undefined,
                type: event.target.value as BudgetEntryType
              })
            }
            value={paymentType}
          >
            <option value="one-off">One off</option>
            <option value="recurring">Recurring</option>
          </select>
          {paymentType === "recurring" && !isAutoRecurringEntry ? (
            <div className="budget-recurring-options">
              <select
                aria-label={`${entry.description} recurring cadence`}
                disabled={entry.generated}
                onChange={(event) =>
                  onEntryChange(entry.id, {
                    recurringCadence: event.target.value as BudgetRecurringCadence
                  })
                }
                value={entry.recurringCadence ?? "monthly"}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                aria-label={`${entry.description} payment plan end date`}
                disabled={entry.generated}
                inputMode="numeric"
                onChange={(event) =>
                  onEntryChange(entry.id, {
                    paymentPlanEndDate: event.target.value
                  })
                }
                placeholder="End date"
                value={entry.paymentPlanEndDate ?? ""}
              />
            </div>
          ) : null}
        </div>
      </td>
      <td className="budget-actions-column" data-label="Actions">
        {canUseLedgerActions ? (
          <div className="budget-actions-cell">
            <button
              aria-expanded={isActionsOpen}
              aria-label={`${isActionsOpen ? "Hide" : "Show"} ${entry.description} actions`}
              className="budget-row-action-button"
              onClick={() => setIsActionsOpen((current) => !current)}
              type="button"
            >
              <Pencil size={15} aria-hidden />
            </button>
            {isActionsOpen ? (
              <div className="budget-action-panel">
                {isAutoRecurringEntry ? (
                  <div className="budget-auto-details">
                    <span>Auto-created</span>
                  </div>
                ) : null}
                <div className="budget-delete-cell">
                  <label>
                    <input
                      checked={isDeleteConfirmed}
                      onChange={(event) => setIsDeleteConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    Enable
                  </label>
                  <button
                    aria-label={`Delete ${entry.description}`}
                    className="delete-campaign-task-button"
                    disabled={!isDeleteConfirmed}
                    onClick={() => onDelete(entry.id)}
                    type="button"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <span className="budget-source-lock">
            Edit in {generatedSourceLabel ?? "source"}
          </span>
        )}
      </td>
    </tr>
  );
}

function ProductionView({
  focusTarget,
  onAddSong,
  onDeleteSong,
  onFocusSong,
  onSongChange,
  saveStatus,
  songs
}: {
  focusTarget: { elementId?: string; songId: string; token: number } | null;
  onAddSong: () => void;
  onDeleteSong: (songId: string) => void;
  onFocusSong: (songId: string, elementId?: string) => void;
  onSongChange: (songId: string, updates: Partial<ProductionSongConfig>) => void;
  saveStatus: RefreshStatus;
  songs: ProductionSongConfig[];
}) {
  const songElementRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    window.setTimeout(() => {
      const focusedElement = focusTarget.elementId
        ? document.getElementById(focusTarget.elementId)
        : null;

      (focusedElement ?? songElementRefs.current[focusTarget.songId])?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }, [focusTarget]);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Music production</p>
          <h1>Production</h1>
        </div>
        <div className="production-save-control">
          {saveStatus.message ? (
            <span className={`refresh-status refresh-status-${saveStatus.state}`}>
              {saveStatus.message}
            </span>
          ) : null}
          <ModuleHeaderDate />
        </div>
      </header>

      <div className="campaign-list">
        {songs.map((song) => (
          <ProductionSongBoard
            focusToken={
              focusTarget?.songId === song.id ? focusTarget.token : undefined
            }
            key={song.id}
            onChange={onSongChange}
            onDelete={onDeleteSong}
            onFocus={onFocusSong}
            refCallback={(element) => {
              songElementRefs.current[song.id] = element;
            }}
            song={song}
          />
        ))}

        <button className="add-campaign-button" onClick={onAddSong} type="button">
          <Plus size={16} aria-hidden />
          Add song
        </button>
      </div>
    </>
  );
}

function ProductionSongBoard({
  focusToken,
  onChange,
  onDelete,
  onFocus,
  refCallback,
  song
}: {
  focusToken?: number;
  onChange: (songId: string, updates: Partial<ProductionSongConfig>) => void;
  onDelete: (songId: string) => void;
  onFocus: (songId: string, elementId?: string) => void;
  refCallback: (element: HTMLElement | null) => void;
  song: ProductionSongConfig;
}) {
  const [songTitle, setSongTitle] = useState(song.title);
  const [songTitleInput, setSongTitleInput] = useState(song.title);
  const [deadlineInput, setDeadlineInput] = useState(song.deadline);
  const [appliedDeadlineInput, setAppliedDeadlineInput] = useState(song.deadline);
  const [albumArtUrl, setAlbumArtUrl] = useState(song.albumArtUrl);
  const [isAlbumArtEditorOpen, setIsAlbumArtEditorOpen] = useState(false);
  const [isFocusHighlighted, setIsFocusHighlighted] = useState(false);
  const [isSongOpen, setIsSongOpen] = useState(false);
  const [isSongTitleEditorOpen, setIsSongTitleEditorOpen] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const deadlineDate = parseCampaignDate(appliedDeadlineInput);
  const deadlineDisplay = deadlineDate ? formatCampaignDate(deadlineDate) : null;
  const daysToDeadline = deadlineDate ? getDaysToRelease(deadlineDate) : null;
  const nextTasks = getNextProductionTasks(song.steps).slice(0, 3);
  const hasPendingDeadline = deadlineInput !== appliedDeadlineInput;
  const canUpdateDeadline = Boolean(parseCampaignDate(deadlineInput));
  const canSaveSongTitle = songTitleInput.trim().length > 0;

  useEffect(() => {
    window.setTimeout(() => {
      setSongTitle(song.title);
      setSongTitleInput(song.title);
      setDeadlineInput(song.deadline);
      setAppliedDeadlineInput(song.deadline);
      setAlbumArtUrl(song.albumArtUrl);
    }, 0);
  }, [song.albumArtUrl, song.deadline, song.title]);

  useEffect(() => {
    if (albumArtUrl === song.albumArtUrl) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      onChange(song.id, { albumArtUrl });
    }, 700);

    return () => window.clearTimeout(saveTimer);
  }, [albumArtUrl, onChange, song.albumArtUrl, song.id]);

  useEffect(() => {
    if (!focusToken) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      setIsSongOpen(true);
      setIsFocusHighlighted(true);
    }, 0);

    const highlightTimer = window.setTimeout(() => {
      setIsFocusHighlighted(false);
    }, 2600);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [focusToken]);

  function saveSongTitle() {
    if (!canSaveSongTitle) {
      return;
    }

    const nextTitle = songTitleInput.trim();
    setSongTitle(nextTitle);
    onChange(song.id, { title: nextTitle });
    setIsSongTitleEditorOpen(false);
  }

  function applyDeadlineUpdate() {
    const nextDeadline = parseCampaignDate(deadlineInput);

    if (!nextDeadline) {
      return;
    }

    setAppliedDeadlineInput(deadlineInput);
    onFocus(song.id);
    onChange(song.id, {
      deadline: deadlineInput,
      steps: shiftProductionStepDeadlines(song.steps, nextDeadline)
    });
  }

  function updateSteps(updater: (currentSteps: ProductionStep[]) => ProductionStep[]) {
    onChange(song.id, {
      steps: sortProductionStepsByDeadline(updater(song.steps))
    });
  }

  function updateStep(stepId: string, updates: Partial<ProductionStep>) {
    onFocus(song.id, getProductionStepElementId(song.id, stepId));
    updateSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  }

  function addProductionStep() {
    const latestDeadline = song.steps
      .map((step) => parseCampaignDate(step.deadline))
      .filter((date): date is Date => Boolean(date))
      .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0];
    const nextDeadline = latestDeadline
      ? addUtcDays(latestDeadline, 1)
      : parseCampaignDate(appliedDeadlineInput) ?? getTodayUtcDate();

    const newStepId = `extra-step-${Date.now()}`;
    onFocus(song.id, getProductionStepElementId(song.id, newStepId));
    updateSteps((currentSteps) => [
      ...currentSteps,
      {
        id: newStepId,
        label: "New production step",
        deadline: formatDateForInput(nextDeadline),
        isDefaultStep: false,
        notes: "",
        budgetLines: [],
        status: "not-started",
        extraTasks: []
      }
    ]);
  }

  function deleteProductionStep(stepId: string) {
    updateSteps((currentSteps) =>
      currentSteps.filter((step) => step.isDefaultStep || step.id !== stepId)
    );
  }

  function addStepTask(stepId: string) {
    const currentStep = song.steps.find((step) => step.id === stepId);
    const newTaskId = `${stepId}-extra-${(currentStep?.extraTasks.length ?? 0) + 1}`;
    onFocus(song.id, getProductionTaskElementId(song.id, stepId, newTaskId));
    updateSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              extraTasks: [
                ...step.extraTasks,
                {
                  id: newTaskId,
                  budgetLines: [],
                  title: "New task",
                  status: "not-started"
                }
              ]
            }
          : step
      )
    );
  }

  function updateStepTask(
    stepId: string,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) {
    onFocus(song.id, getProductionTaskElementId(song.id, stepId, taskId));
    updateSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              extraTasks: step.extraTasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
              )
            }
          : step
      )
    );
  }

  function deleteStepTask(stepId: string, taskId: string) {
    updateSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              extraTasks: step.extraTasks.filter((task) => task.id !== taskId)
            }
          : step
      )
    );
  }

  return (
    <section
      className={`campaign-board production-song-board${
        isFocusHighlighted ? " production-song-board-focused" : ""
      }`}
      aria-label={`${songTitle} production plan`}
      data-scroll-anchor={isSongOpen ? "open-card" : undefined}
      ref={refCallback}
    >
      <div className="campaign-board-header production-board-header">
        <div className="album-art-control">
          <button
            aria-label="Add production artwork URL"
            className="album-art-placeholder"
            onClick={() => setIsAlbumArtEditorOpen((current) => !current)}
            type="button"
          >
            {albumArtUrl ? (
              <span
                aria-label={`${songTitle} artwork preview`}
                className="album-art-image"
                role="img"
                style={{ backgroundImage: `url("${albumArtUrl}")` }}
              />
            ) : (
              <>
                <Music2 size={26} aria-hidden />
                <span>Artwork</span>
              </>
            )}
            <span className="album-art-url-action">
              <Plus size={13} aria-hidden />
              URL
            </span>
          </button>
        </div>
        <div className="campaign-title-block">
          <div className="campaign-title-row">
            {isSongTitleEditorOpen ? (
              <>
                <input
                  aria-label="Song name"
                  onChange={(event) => setSongTitleInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveSongTitle();
                    }
                  }}
                  value={songTitleInput}
                />
                <button
                  aria-label="Save song name"
                  disabled={!canSaveSongTitle}
                  onClick={saveSongTitle}
                  type="button"
                >
                  <Save size={16} aria-hidden />
                </button>
              </>
            ) : (
              <>
                <h2>{songTitle}</h2>
                <button
                  aria-label="Edit song name"
                  onClick={() => {
                    setSongTitleInput(songTitle);
                    setIsSongTitleEditorOpen(true);
                  }}
                  type="button"
                >
                  <Pencil size={15} aria-hidden />
                </button>
              </>
            )}
          </div>
          <HeaderTaskList tasks={nextTasks} />
        </div>
        <label className="release-date-field">
          <span>Production deadline</span>
          <div className="release-date-input-row">
            <input
              aria-label="Production deadline in dd/mm/yyyy format"
              inputMode="numeric"
              onChange={(event) => setDeadlineInput(event.target.value)}
              placeholder="dd/mm/yyyy"
              value={deadlineInput}
            />
            <button
              aria-label="Update production deadline"
              disabled={!hasPendingDeadline || !canUpdateDeadline}
              onClick={applyDeadlineUpdate}
              type="button"
            >
              <Save size={16} aria-hidden />
            </button>
          </div>
          <strong className="release-date-summary">
            <span>{formatDaysToProductionDeadline(daysToDeadline)}</span>
            {deadlineDisplay ? <span>{deadlineDisplay}</span> : null}
          </strong>
        </label>
        <button
          aria-expanded={isSongOpen}
          aria-label={isSongOpen ? "Hide production details" : "Show production details"}
          className="campaign-toggle"
          onClick={() => setIsSongOpen((current) => !current)}
          type="button"
        >
          <ChevronDown size={20} aria-hidden />
        </button>
        {isAlbumArtEditorOpen ? (
          <label className="album-art-url-field">
            <span>Artwork URL</span>
            <input
              onChange={(event) => setAlbumArtUrl(event.target.value.trim())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onChange(song.id, { albumArtUrl });
                  setIsAlbumArtEditorOpen(false);
                }
              }}
              placeholder="https://example.com/cover.jpg"
              type="url"
              value={albumArtUrl}
            />
          </label>
        ) : null}
      </div>

      <ProductionProgressStrip steps={song.steps} />

      <div
        className="campaign-details"
        hidden={!isSongOpen}
        id={`${song.id}-production-details`}
      >
        <div className="campaign-table-wrap">
          <table className="campaign-table production-table">
            <thead>
              <tr>
                <th scope="col">Deadline</th>
                <th scope="col">Production tasks</th>
              </tr>
            </thead>
            <tbody>
              {song.steps.map((step) => (
                <ProductionStepRow
                  key={step.id}
                  onAddTask={addStepTask}
                  onDeleteStep={deleteProductionStep}
                  onDeleteTask={deleteStepTask}
                  onStepChange={updateStep}
                  onTaskChange={updateStepTask}
                  songId={song.id}
                  step={step}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="campaign-day-actions">
          <button
            className="add-campaign-day-button"
            onClick={addProductionStep}
            type="button"
          >
            <Plus size={16} aria-hidden />
            Add production step
          </button>
        </div>
        <details className="campaign-danger-zone">
          <summary>Song options</summary>
          <div>
            <label>
              <input
                checked={isDeleteConfirmed}
                onChange={(event) =>
                  setIsDeleteConfirmed(event.target.checked)
                }
                type="checkbox"
              />
              Enable delete for this song
            </label>
            <button
              className="delete-campaign-button"
              disabled={!isDeleteConfirmed}
              onClick={() => onDelete(song.id)}
              type="button"
            >
              <Trash2 size={15} aria-hidden />
              Delete song
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}

function ProductionProgressStrip({
  steps
}: {
  steps: ProductionStep[];
}) {
  return (
    <div className="campaign-progress-strip" aria-label="Production step progress">
      <strong className="campaign-progress-percent">
        {calculateProductionCompletion(steps)}%
      </strong>
      <div className="campaign-progress-boxes">
        {steps.map((step) => {
          const status = getProductionStepProgressStatus(step);
          return (
            <span
              aria-label={`${step.label}: ${campaignDayStatusLabels[status]}`}
              className={[
                "campaign-progress-box",
                `campaign-progress-box-${status}`
              ].join(" ")}
              key={step.id}
              title={`${step.label}: ${campaignDayStatusLabels[status]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function getProductionStepElementId(songId: string, stepId: string) {
  return `production-step-${songId}-${stepId}`;
}

function getProductionTaskElementId(
  songId: string,
  stepId: string,
  taskId: string
) {
  return `production-task-${songId}-${stepId}-${taskId}`;
}

function ProductionStepRow({
  onAddTask,
  onDeleteStep,
  onDeleteTask,
  onStepChange,
  onTaskChange,
  songId,
  step
}: {
  onAddTask: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onDeleteTask: (stepId: string, taskId: string) => void;
  onStepChange: (stepId: string, updates: Partial<ProductionStep>) => void;
  onTaskChange: (
    stepId: string,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) => void;
  songId: string;
  step: ProductionStep;
}) {
  return (
    <tr id={getProductionStepElementId(songId, step.id)}>
      <td>
        <label className="production-step-date-field">
          <span>{formatCampaignDateKey(formatInputDateForDatabase(step.deadline) ?? "")}</span>
          <input
            aria-label={`${step.label} deadline`}
            inputMode="numeric"
            onChange={(event) =>
              onStepChange(step.id, { deadline: event.target.value })
            }
            placeholder="dd/mm/yyyy"
            value={step.deadline}
          />
        </label>
        {!step.isDefaultStep ? (
          <button
            aria-label={`Delete ${step.label}`}
            className="delete-campaign-day-button"
            onClick={() => onDeleteStep(step.id)}
            type="button"
          >
            <Trash2 size={14} aria-hidden />
            Delete step
          </button>
        ) : null}
      </td>
      <td>
        <div className="campaign-cell">
          <div className="production-step-task-row">
            <label className="clip-name-field">
              <span>Production step</span>
              <input
                aria-label={`${step.label} production step name`}
                disabled={step.isDefaultStep}
                onChange={(event) =>
                  onStepChange(step.id, { label: event.target.value })
                }
                value={step.label}
              />
            </label>
            <select
              aria-label={`${step.label} status`}
              onChange={(event) =>
                onStepChange(step.id, {
                  status: event.target.value as MarketingStatus
                })
              }
              value={step.status}
            >
              {marketingStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <label className="clip-name-field">
            <span>Notes</span>
            <input
              aria-label={`${step.label} notes`}
              onChange={(event) =>
                onStepChange(step.id, { notes: event.target.value })
              }
              value={step.notes}
            />
          </label>
          <ProductionBudgetLineEditor
            budgetLines={step.budgetLines ?? []}
            idPrefix={`${step.id}-budget`}
            onChange={(budgetLines) => onStepChange(step.id, { budgetLines })}
          />
          {step.extraTasks.map((task) => (
            <ExtraCampaignTaskRow
              budgetIdPrefix={`${step.id}-${task.id}-budget`}
              dayNumber={0}
              elementId={getProductionTaskElementId(songId, step.id, task.id)}
              key={task.id}
              onChange={(_, taskId, updates) =>
                onTaskChange(step.id, taskId, updates)
              }
              onDelete={(_, taskId) => onDeleteTask(step.id, taskId)}
              task={task}
            />
          ))}
          <button
            aria-label={`Add new subtask for ${step.label}`}
            className="add-campaign-task-button"
            onClick={() => onAddTask(step.id)}
            type="button"
          >
            <Plus size={16} aria-hidden />
            Add new Subtask
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductionBudgetLineEditor({
  budgetLines,
  idPrefix,
  onChange
}: {
  budgetLines: ProductionBudgetLine[];
  idPrefix: string;
  onChange: (budgetLines: ProductionBudgetLine[]) => void;
}) {
  const visibleBudgetLines =
    budgetLines.length > 0
      ? budgetLines
      : ([
          {
            amount: 0,
            bucket: "production",
            description: "",
            id: `${idPrefix}-empty`
          }
        ] satisfies ProductionBudgetLine[]);

  function updateBudgetLine(
    lineId: string,
    updates: Partial<ProductionBudgetLine>
  ) {
    const nextBudgetLines = visibleBudgetLines.map((line) =>
      line.id === lineId ? { ...line, ...updates } : line
    );
    onChange(normalizeProductionBudgetLines(nextBudgetLines));
  }

  function addBudgetLine() {
    onChange([
      ...normalizeProductionBudgetLines(visibleBudgetLines),
      {
        amount: 0,
        bucket: "production",
        description: "",
        id: `${idPrefix}-${Date.now()}`
      }
    ]);
  }

  function deleteBudgetLine(lineId: string) {
    onChange(budgetLines.filter((line) => line.id !== lineId));
  }

  return (
    <div className="production-budget-lines">
      {visibleBudgetLines.map((line) => (
        <ProductionBudgetLineRow
          canDelete={budgetLines.some((budgetLine) => budgetLine.id === line.id)}
          key={line.id}
          line={line}
          onDelete={deleteBudgetLine}
          onUpdate={updateBudgetLine}
        />
      ))}
      <button
        className="add-campaign-task-button production-budget-add-button"
        onClick={addBudgetLine}
        type="button"
      >
        <Plus size={16} aria-hidden />
        Add new budget line
      </button>
    </div>
  );
}

function ProductionBudgetAmountInput({
  amount,
  onChange
}: {
  amount: number;
  onChange: (amount: number) => void;
}) {
  const [amountInput, setAmountInput] = useState(
    amount === 0 ? "" : formatEditableAmount(amount)
  );
  const [isFocused, setIsFocused] = useState(false);

  return (
    <input
      aria-label="Production budget amount"
      className={getTransactionAmountToneClass(amount)}
      inputMode="decimal"
      onBlur={() => {
        const parsedAmount = parseEditableAmount(amountInput);
        setIsFocused(false);
        setAmountInput(parsedAmount ? formatEditableAmount(parsedAmount) : "");
      }}
      onChange={(event) => {
        const nextAmountInput = event.target.value;
        const parsedAmount = parseEditableAmount(nextAmountInput);

        setAmountInput(nextAmountInput);

        if (parsedAmount === null) {
          return;
        }

        onChange(parsedAmount);
      }}
      onFocus={() => setIsFocused(true)}
      placeholder="-20 or 100"
      value={amountInput}
    />
  );
}

function ProductionBudgetLineRow({
  canDelete,
  line,
  onDelete,
  onUpdate
}: {
  canDelete: boolean;
  line: ProductionBudgetLine;
  onDelete: (lineId: string) => void;
  onUpdate: (lineId: string, updates: Partial<ProductionBudgetLine>) => void;
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  return (
    <div className="production-budget-line">
      <label>
        <span>Budget</span>
        <input
          aria-label="Production budget description"
          onChange={(event) =>
            onUpdate(line.id, { description: event.target.value })
          }
          placeholder="Budget reason"
          value={line.description}
        />
      </label>
      <label>
        <span>Amount</span>
        <ProductionBudgetAmountInput
          amount={line.amount}
          onChange={(amount) => onUpdate(line.id, { amount })}
        />
      </label>
      <div className="production-budget-actions-cell">
        <button
          aria-expanded={isActionsOpen}
          aria-label={`${isActionsOpen ? "Hide" : "Show"} production budget line actions`}
          className="budget-row-action-button"
          onClick={() => setIsActionsOpen((current) => !current)}
          type="button"
        >
          <Pencil size={15} aria-hidden />
        </button>
        {isActionsOpen ? (
          <div className="production-budget-action-panel">
            <label>
              <input
                checked={isDeleteConfirmed}
                disabled={!canDelete}
                onChange={(event) => setIsDeleteConfirmed(event.target.checked)}
                type="checkbox"
              />
              Enable
            </label>
            <button
              aria-label={`Delete ${line.description || "production budget line"}`}
              className="delete-campaign-task-button production-budget-delete-button"
              disabled={!canDelete || !isDeleteConfirmed}
              onClick={() => onDelete(line.id)}
              type="button"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeProductionBudgetLines(budgetLines: ProductionBudgetLine[]) {
  return budgetLines.filter(
    (line) => line.amount !== 0 || line.description.trim().length > 0
  ).map((line) => ({
    ...line,
    bucket: normalizeBudgetSourceBucket(line.bucket ?? "production")
  }));
}

function MarketingView({
  campaigns,
  focusTarget,
  onAddCampaign,
  onCampaignBudgetLinesChange,
  onCampaignDaysChange,
  onDeleteCampaign,
  onFocusCampaign,
  onReleaseDateSave,
  onTitleSave,
  recentProductionSongId,
  productionSongs
}: {
  campaigns: MarketingCampaignConfig[];
  focusTarget: { campaignId: string; elementId?: string; token: number } | null;
  onAddCampaign: (releaseTitle?: string) => void;
  onCampaignBudgetLinesChange: (
    campaignId: string,
    budgetLines: ProductionBudgetLine[]
  ) => void;
  onCampaignDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onFocusCampaign: (campaignId: string, elementId?: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
  recentProductionSongId?: string;
  productionSongs: ProductionSongConfig[];
}) {
  const campaignElementRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selectedProductionSongId, setSelectedProductionSongId] = useState(
    productionSongs[0]?.id ?? ""
  );
  const recentProductionSong = productionSongs.find(
    (song) => song.id === recentProductionSongId
  );
  const orderedProductionSongs = useMemo(
    () =>
      recentProductionSong
        ? [
            recentProductionSong,
            ...productionSongs.filter(
              (song) => song.id !== recentProductionSong.id
            )
          ]
        : productionSongs,
    [productionSongs, recentProductionSong]
  );
  const selectedProductionSong =
    productionSongs.find((song) => song.id === selectedProductionSongId) ??
    orderedProductionSongs[0] ??
    null;

  useEffect(() => {
    if (!recentProductionSongId) {
      return;
    }

    if (productionSongs.some((song) => song.id === recentProductionSongId)) {
      const selectTimer = window.setTimeout(() => {
        setSelectedProductionSongId(recentProductionSongId);
      }, 0);

      return () => window.clearTimeout(selectTimer);
    }
  }, [productionSongs, recentProductionSongId]);

  useEffect(() => {
    if (
      selectedProductionSongId &&
      productionSongs.some((song) => song.id === selectedProductionSongId)
    ) {
      return;
    }

    if (orderedProductionSongs[0]) {
      const selectTimer = window.setTimeout(() => {
        setSelectedProductionSongId(orderedProductionSongs[0].id);
      }, 0);

      return () => window.clearTimeout(selectTimer);
    }
  }, [orderedProductionSongs, productionSongs, selectedProductionSongId]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    window.setTimeout(() => {
      const focusedElement = focusTarget.elementId
        ? document.getElementById(focusTarget.elementId)
        : null;

      (
        focusedElement ?? campaignElementRefs.current[focusTarget.campaignId]
      )?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }, [focusTarget]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Campaign execution</p>
          <h1>Marketing</h1>
        </div>
        <ModuleHeaderDate />
      </header>

      <div className="campaign-list">
        {campaigns.map((campaign) => (
          <MarketingCampaignBoard
            campaign={campaign}
            focusToken={
              focusTarget?.campaignId === campaign.id ? focusTarget.token : undefined
            }
            key={campaign.id}
            onBudgetLinesChange={onCampaignBudgetLinesChange}
            onDaysChange={onCampaignDaysChange}
            onDelete={onDeleteCampaign}
            onFocus={onFocusCampaign}
            onReleaseDateSave={onReleaseDateSave}
            onTitleSave={onTitleSave}
            productionSongs={productionSongs}
            refCallback={(element) => {
              campaignElementRefs.current[campaign.id] = element;
            }}
          />
        ))}

        <div className="add-campaign-control">
          <select
            aria-label="Choose production song for new campaign"
            disabled={productionSongs.length === 0}
            onChange={(event) => setSelectedProductionSongId(event.target.value)}
            value={selectedProductionSong?.id ?? ""}
          >
            {orderedProductionSongs.length > 0 ? (
              orderedProductionSongs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))
            ) : (
              <option value="">No production songs yet</option>
            )}
          </select>
          <button
            className="add-campaign-button"
            onClick={() => onAddCampaign(selectedProductionSong?.title)}
            type="button"
          >
            <Plus size={16} aria-hidden />
            Add campaign
          </button>
        </div>
      </div>
    </>
  );
}

function MarketingCampaignBoard({
  campaign,
  focusToken,
  onBudgetLinesChange,
  onDaysChange,
  onDelete,
  onFocus,
  onReleaseDateSave,
  onTitleSave,
  productionSongs,
  refCallback
}: {
  campaign: MarketingCampaignConfig;
  focusToken?: number;
  onBudgetLinesChange: (
    campaignId: string,
    budgetLines: ProductionBudgetLine[]
  ) => void;
  onDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDelete: (campaignId: string) => void;
  onFocus: (campaignId: string, elementId?: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
  productionSongs: ProductionSongConfig[];
  refCallback: (element: HTMLElement | null) => void;
}) {
  const [releaseDateInput, setReleaseDateInput] = useState(
    campaign.releaseDate
  );
  const [appliedReleaseDateInput, setAppliedReleaseDateInput] = useState(
    campaign.releaseDate
  );
  const [campaignTitle, setCampaignTitle] = useState(campaign.releaseTitle);
  const [campaignTitleInput, setCampaignTitleInput] = useState(
    campaign.releaseTitle
  );
  const [isCampaignTitleEditorOpen, setIsCampaignTitleEditorOpen] =
    useState(false);
  const [isCampaignOpen, setIsCampaignOpen] = useState(false);
  const [isFocusHighlighted, setIsFocusHighlighted] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [campaignDays, setCampaignDays] = useState(() =>
    campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds)
  );
  const albumArtUrl = getProductionAlbumArtForRelease(
    campaignTitle,
    productionSongs
  );
  const linkedProductionSong = getProductionSongForRelease(
    campaignTitle,
    productionSongs
  );
  const displayedCampaignTitle = linkedProductionSong?.title ?? campaignTitle;
  const campaignTitleOptions = productionSongs.some(
    (song) => song.title === displayedCampaignTitle
  )
    ? productionSongs
    : [
        ...productionSongs,
        {
          albumArtUrl: "",
          deadline: "",
          id: "current-marketing-title",
          steps: [],
          title: displayedCampaignTitle
        }
      ];
  const releaseDate = parseCampaignDate(appliedReleaseDateInput);
  const releaseDateDisplay = releaseDate ? formatCampaignDate(releaseDate) : null;
  const daysToRelease = releaseDate ? getDaysToRelease(releaseDate) : null;
  const nextCampaignTasks = getNextCampaignTasks(campaignDays).slice(0, 3);
  const campaignBudgetLines =
    campaign.budgetLines && campaign.budgetLines.length > 0
      ? campaign.budgetLines
      : [
          {
            amount: 0,
            description: "",
            id: `${campaign.id}-marketing-budget-line-1`
          }
        ];
  const hasPendingReleaseDate = releaseDateInput !== appliedReleaseDateInput;
  const canUpdateReleaseDate = Boolean(parseCampaignDate(releaseDateInput));
  const canSaveCampaignTitle = campaignTitleInput.trim().length > 0;

  useEffect(() => {
    if (!campaign.campaignDays) {
      return;
    }

    window.setTimeout(() => setCampaignDays(campaign.campaignDays ?? []), 0);
  }, [campaign.campaignDays]);

  useEffect(() => {
    window.setTimeout(() => {
      setReleaseDateInput(campaign.releaseDate);
      setAppliedReleaseDateInput(campaign.releaseDate);
      setCampaignTitle(campaign.releaseTitle);
      setCampaignTitleInput(campaign.releaseTitle);
    }, 0);
  }, [campaign.releaseDate, campaign.releaseTitle]);

  useEffect(() => {
    if (!focusToken) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      setIsCampaignOpen(true);
      setIsFocusHighlighted(true);
    }, 0);

    const highlightTimer = window.setTimeout(() => {
      setIsFocusHighlighted(false);
    }, 2600);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [focusToken]);

  function updateCampaignDaysState(
    updater: (currentDays: CampaignDay[]) => CampaignDay[]
  ) {
    setCampaignDays((currentDays) => {
      const nextDays = updater(currentDays);

      window.setTimeout(() => {
        onDaysChange(campaign.id, nextDays);
      }, 0);

      return nextDays;
    });
  }

  function updateCampaignBudgetLine(
    lineId: string,
    updates: Partial<ProductionBudgetLine>
  ) {
    const nextBudgetLines = campaignBudgetLines.map((line) =>
      line.id === lineId ? { ...line, ...updates } : line
    );

    onBudgetLinesChange(campaign.id, nextBudgetLines);
  }

  function addCampaignBudgetLine() {
    onBudgetLinesChange(campaign.id, [
      ...normalizeProductionBudgetLines(campaignBudgetLines),
      {
        amount: 0,
        description: "",
        id: `${campaign.id}-marketing-budget-line-${Date.now()}`
      }
    ]);
  }

  function deleteCampaignBudgetLine(lineId: string) {
    const nextBudgetLines = campaignBudgetLines.filter(
      (line) => line.id !== lineId
    );

    onBudgetLinesChange(
      campaign.id,
      nextBudgetLines.length > 0
        ? nextBudgetLines
        : [
            {
              amount: 0,
              description: "",
              id: `${campaign.id}-marketing-budget-line-${Date.now()}`
            }
          ]
    );
  }

  function scrollToCurrentCampaignDay() {
    const activeDayNumber = getActiveCampaignDayNumber(campaignDays);

    if (!activeDayNumber) {
      return;
    }

    window.setTimeout(() => {
      document
        .getElementById(
          getMarketingCampaignDayElementId(campaign.id, activeDayNumber)
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }, 120);
  }

  function toggleCampaignDetails() {
    setIsCampaignOpen((current) => {
      const nextIsOpen = !current;

      if (nextIsOpen) {
        scrollToCurrentCampaignDay();
      }

      return nextIsOpen;
    });
  }

  function saveCampaignTitle() {
    if (!canSaveCampaignTitle) {
      return;
    }

    setCampaignTitle(campaignTitleInput.trim());
    onTitleSave(campaign.id, campaignTitleInput.trim());
    setIsCampaignTitleEditorOpen(false);
  }

  function applyReleaseDateUpdate() {
    const nextReleaseDate = parseCampaignDate(releaseDateInput);

    if (!nextReleaseDate) {
      return;
    }

    setAppliedReleaseDateInput(releaseDateInput);
    onFocus(campaign.id);
    onReleaseDateSave(campaign.id, releaseDateInput);
    shiftCampaignDates(nextReleaseDate);
  }

  function shiftCampaignDates(nextReleaseDate: Date) {
    updateCampaignDaysState((currentDays) =>
      Array.from({ length: currentDays.length }, (_, index) =>
        buildCampaignDay(nextReleaseDate, index)
      ).map((nextDay) => {
        const currentDay = currentDays.find(
          (day) => day.dayNumber === nextDay.dayNumber
        );

        return currentDay
          ? {
              ...nextDay,
              clipName: currentDay.clipName,
              extraTasks: currentDay.extraTasks,
              statuses: currentDay.statuses
            }
          : nextDay;
      })
    );
  }

  function updateReleaseDateInput(value: string) {
    setReleaseDateInput(value);
  }

  function updateClipName(dayNumber: number, clipName: string) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber ? { ...day, clipName } : day
      )
    );
  }

  function updateTaskStatus(
    dayNumber: number,
    task: keyof CampaignDay["statuses"],
    status: MarketingStatus
  ) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber
          ? { ...day, statuses: { ...day.statuses, [task]: status } }
          : day
      )
    );
  }

  function addExtraTask(dayNumber: number) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber
          ? {
              ...day,
              extraTasks: [
                ...day.extraTasks,
                {
                  id: `day-${dayNumber}-extra-${day.extraTasks.length + 1}`,
                  title: "New task",
                  status: "not-started"
                }
              ]
            }
          : day
      )
    );
  }

  function updateExtraTask(
    dayNumber: number,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber
          ? {
              ...day,
              extraTasks: day.extraTasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
              )
            }
          : day
      )
    );
  }

  function deleteExtraTask(dayNumber: number, taskId: string) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber
          ? {
              ...day,
              extraTasks: day.extraTasks.filter((task) => task.id !== taskId)
            }
          : day
      )
    );
  }

  function addCampaignDay() {
    const releaseDate =
      parseCampaignDate(appliedReleaseDateInput) ??
      new Date(Date.UTC(2026, 6, 10));

    const nextDayNumber = campaignDays.length + 1;
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, nextDayNumber));
    updateCampaignDaysState((currentDays) => [
      ...currentDays,
      buildCampaignDay(releaseDate, currentDays.length)
    ]);
  }

  function deleteCampaignDay(dayNumber: number) {
    onFocus(campaign.id, getMarketingCampaignDayElementId(campaign.id, dayNumber));
    updateCampaignDaysState((currentDays) =>
      currentDays.filter(
        (day) => day.isDefaultDay || day.dayNumber !== dayNumber
      )
    );
  }

  return (
      <section
        className={`campaign-board marketing-campaign-board${
          isFocusHighlighted ? " production-song-board-focused" : ""
        }`}
        aria-label={`${displayedCampaignTitle} marketing campaign`}
        data-scroll-anchor={isCampaignOpen ? "open-card" : undefined}
        ref={refCallback}
      >
        <div className="campaign-board-header">
          <div className="album-art-control">
            <div className="album-art-placeholder album-art-placeholder-readonly">
              {albumArtUrl ? (
                <span
                  aria-label={`${displayedCampaignTitle} album art preview`}
                  className="album-art-image"
                  role="img"
                  style={{ backgroundImage: `url("${albumArtUrl}")` }}
                />
              ) : (
                <>
                  <Music2 size={26} aria-hidden />
                  <span>Album art pending</span>
                </>
              )}
            </div>
          </div>
          <div className="campaign-title-block">
            <div className="campaign-title-row">
              {isCampaignTitleEditorOpen ? (
                <>
                  <select
                    aria-label="Campaign sprint name"
                    disabled={productionSongs.length === 0}
                    onChange={(event) => setCampaignTitleInput(event.target.value)}
                    value={campaignTitleInput}
                  >
                    {campaignTitleOptions.length > 0 ? (
                      campaignTitleOptions.map((song) => (
                        <option key={song.id} value={song.title}>
                          {song.title}
                        </option>
                      ))
                    ) : (
                      <option value={campaignTitle}>{campaignTitle}</option>
                    )}
                  </select>
                  <button
                    aria-label="Save campaign sprint name"
                    disabled={!canSaveCampaignTitle}
                    onClick={saveCampaignTitle}
                    type="button"
                  >
                    <Save size={16} aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <h2>{displayedCampaignTitle}</h2>
                  <button
                    aria-label="Edit campaign sprint name"
                    onClick={() => {
                      setCampaignTitleInput(displayedCampaignTitle);
                      setIsCampaignTitleEditorOpen(true);
                    }}
                    type="button"
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                </>
              )}
            </div>
            <HeaderTaskList tasks={nextCampaignTasks} />
          </div>
          <label className="release-date-field">
            <span>Release date</span>
            <div className="release-date-input-row">
              <input
                aria-label="Release date in dd/mm/yyyy format"
                inputMode="numeric"
                onChange={(event) => updateReleaseDateInput(event.target.value)}
                placeholder="dd/mm/yyyy"
                value={releaseDateInput}
              />
              <button
                aria-label="Update release date"
                disabled={!hasPendingReleaseDate || !canUpdateReleaseDate}
                onClick={applyReleaseDateUpdate}
                type="button"
              >
                <Save size={16} aria-hidden />
              </button>
            </div>
            <strong className="release-date-summary">
              <span>{formatDaysToRelease(daysToRelease)}</span>
              {releaseDateDisplay ? <span>{releaseDateDisplay}</span> : null}
            </strong>
          </label>
          <button
            aria-expanded={isCampaignOpen}
            aria-label={isCampaignOpen ? "Hide campaign details" : "Show campaign details"}
            className="campaign-toggle"
            onClick={toggleCampaignDetails}
            type="button"
          >
            <ChevronDown size={20} aria-hidden />
          </button>
        </div>

        <CampaignProgressStrip
          completion={calculateCampaignCompletion(campaignDays)}
          days={campaignDays}
        />

        <div
          className="campaign-details"
          hidden={!isCampaignOpen}
          id={`${campaign.id}-details`}
        >
          <div className="event-budget-section marketing-budget-section">
            <strong>Budget</strong>
            <div className="event-budget-lines">
              {campaignBudgetLines.map((line) => (
                <EventBudgetLineRow
                  key={line.id}
                  line={line}
                  onDelete={deleteCampaignBudgetLine}
                  onUpdate={updateCampaignBudgetLine}
                />
              ))}
            </div>
            <button
              className="add-campaign-task-button production-budget-add-button"
              onClick={addCampaignBudgetLine}
              type="button"
            >
              <Plus size={16} aria-hidden />
              Add new budget line
            </button>
          </div>
          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Campaign tasks</th>
                </tr>
              </thead>
              <tbody>
                {campaignDays.map((day) => (
                  <tr
                    id={getMarketingCampaignDayElementId(campaign.id, day.dayNumber)}
                    key={day.dayNumber}
                  >
                    <td>
                      <strong>{day.date}</strong>
                      <span>{formatReleaseOffset(day.releaseOffset)}</span>
                      {!day.isDefaultDay ? (
                        <button
                          aria-label={`Delete campaign day ${day.dayNumber}`}
                          className="delete-campaign-day-button"
                          onClick={() => deleteCampaignDay(day.dayNumber)}
                          type="button"
                        >
                          <Trash2 size={14} aria-hidden />
                          Delete day
                        </button>
                      ) : null}
                    </td>
                    <MarketingCampaignTaskCell
                      onAddTask={addExtraTask}
                      day={day}
                      onClipNameChange={updateClipName}
                      onExtraTaskChange={updateExtraTask}
                      onExtraTaskDelete={deleteExtraTask}
                      onStatusChange={updateTaskStatus}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="campaign-day-actions">
            <button
              className="add-campaign-day-button"
              onClick={addCampaignDay}
              type="button"
            >
              <Plus size={16} aria-hidden />
              Add campaign day
            </button>
          </div>
          <details className="campaign-danger-zone">
            <summary>Campaign options</summary>
            <div>
              <label>
                <input
                  checked={isDeleteConfirmed}
                  onChange={(event) =>
                    setIsDeleteConfirmed(event.target.checked)
                  }
                  type="checkbox"
                />
                Enable delete for this campaign
              </label>
              <button
                className="delete-campaign-button"
                disabled={!isDeleteConfirmed}
                onClick={() => onDelete(campaign.id)}
                type="button"
              >
                <Trash2 size={15} aria-hidden />
                Delete campaign
              </button>
            </div>
          </details>
        </div>
      </section>
  );
}

function HeaderTaskList({
  tasks
}: {
  tasks: CampaignTaskItem[];
}) {
  return (
    <ul className="campaign-header-tasks" aria-label="Next campaign tasks">
      {tasks.map((task) => (
        <li key={task.id}>
          <StatusDot status={task.status} label={statusLabels[task.status]} />
          <span>{task.label}</span>
        </li>
      ))}
    </ul>
  );
}

function CampaignProgressStrip({
  completion,
  days
}: {
  completion: number;
  days: CampaignDay[];
}) {
  const activeDayNumber = getActiveCampaignDayNumber(days);

  return (
    <div className="campaign-progress-strip" aria-label="Campaign day progress">
      <strong className="campaign-progress-percent">{completion}%</strong>
      <div className="campaign-progress-boxes">
        {days.map((day) => {
          const status = getCampaignDayStatus(day);
          return (
            <span
              aria-label={`Day ${day.dayNumber}: ${campaignDayStatusLabels[status]}`}
              className={[
                "campaign-progress-box",
                `campaign-progress-box-${status}`,
                activeDayNumber === day.dayNumber ? "campaign-progress-box-active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={day.dayNumber}
              title={`Day ${day.dayNumber}: ${campaignDayStatusLabels[status]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function getMarketingCampaignDayElementId(campaignId: string, dayNumber: number) {
  return `marketing-campaign-day-${campaignId}-${dayNumber}`;
}

function MarketingCampaignTaskCell({
  day,
  onAddTask,
  onClipNameChange,
  onExtraTaskChange,
  onExtraTaskDelete,
  onStatusChange
}: {
  day: CampaignDay;
  onAddTask: (dayNumber: number) => void;
  onClipNameChange: (dayNumber: number, clipName: string) => void;
  onExtraTaskChange: (
    dayNumber: number,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) => void;
  onExtraTaskDelete: (dayNumber: number, taskId: string) => void;
  onStatusChange: (
    dayNumber: number,
    task: keyof CampaignDay["statuses"],
    status: MarketingStatus
  ) => void;
}) {
  return (
    <td>
      <div className="campaign-cell">
        <label className="clip-name-field">
          <span>Clip name</span>
          <input
            aria-label={`Clip name for ${day.date}`}
            onChange={(event) =>
              onClipNameChange(day.dayNumber, event.target.value)
            }
            value={day.clipName}
          />
        </label>
        <CampaignTaskStatus
          label="Make video / post"
          status={day.statuses.production}
          onChange={(status) =>
            onStatusChange(day.dayNumber, "production", status)
          }
        />
        <CampaignTaskStatus
          label="IG Upload"
          options={marketingUploadStatusOptions}
          status={day.statuses.instagramUpload}
          onChange={(status) =>
            onStatusChange(day.dayNumber, "instagramUpload", status)
          }
        />
        <CampaignTaskStatus
          label="YT upload"
          options={marketingUploadStatusOptions}
          status={day.statuses.youtubeUpload}
          onChange={(status) =>
            onStatusChange(day.dayNumber, "youtubeUpload", status)
          }
        />
        {hasReleaseDayDefaultTasks(day) ? (
          <>
            <CampaignTaskStatus
              label="Update website"
              status={day.statuses.websiteUpdate}
              onChange={(status) =>
                onStatusChange(day.dayNumber, "websiteUpdate", status)
              }
            />
            <CampaignTaskStatus
              label="Facebook post"
              status={day.statuses.facebookPost}
              onChange={(status) =>
                onStatusChange(day.dayNumber, "facebookPost", status)
              }
            />
            <CampaignTaskStatus
              label="YouTube post"
              status={day.statuses.youtubePost}
              onChange={(status) =>
                onStatusChange(day.dayNumber, "youtubePost", status)
              }
            />
          </>
        ) : null}
        {day.extraTasks.map((task) => (
          <ExtraCampaignTaskRow
            dayNumber={day.dayNumber}
            key={task.id}
            onChange={onExtraTaskChange}
            onDelete={onExtraTaskDelete}
            task={task}
          />
        ))}
        <button
          aria-label={`Add task for ${day.date}`}
          className="add-campaign-task-button"
          onClick={() => onAddTask(day.dayNumber)}
          type="button"
        >
          <Plus size={16} aria-hidden />
          Add task
        </button>
      </div>
    </td>
  );
}

function ExtraCampaignTaskRow({
  budgetIdPrefix,
  dayNumber,
  elementId,
  onChange,
  onDelete,
  task
}: {
  budgetIdPrefix?: string;
  dayNumber: number;
  elementId?: string;
  onChange: (
    dayNumber: number,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) => void;
  onDelete: (dayNumber: number, taskId: string) => void;
  task: ExtraCampaignTask;
}) {
  return (
    <div className="extra-campaign-task" id={elementId}>
      <label className="extra-campaign-task-name">
        <span>
          <StatusDot status={task.status} label={statusLabels[task.status]} />
          Extra task
        </span>
        <input
          aria-label={`Extra task name ${task.id}`}
          onChange={(event) =>
            onChange(dayNumber, task.id, { title: event.target.value })
          }
          value={task.title}
        />
      </label>
      <select
        aria-label={`${task.title} status`}
        onChange={(event) =>
          onChange(dayNumber, task.id, {
            status: event.target.value as MarketingStatus
          })
        }
        value={task.status}
      >
        {marketingStatusOptions.map((option) => (
          <option key={option} value={option}>
          {statusLabels[option]}
          </option>
        ))}
      </select>
      <button
        aria-label={`Delete ${task.title}`}
        className="delete-campaign-task-button"
        onClick={() => onDelete(dayNumber, task.id)}
        type="button"
      >
        <Trash2 size={16} aria-hidden />
      </button>
      {budgetIdPrefix ? (
        <ProductionBudgetLineEditor
          budgetLines={task.budgetLines ?? []}
          idPrefix={budgetIdPrefix}
          onChange={(budgetLines) =>
            onChange(dayNumber, task.id, { budgetLines })
          }
        />
      ) : null}
    </div>
  );
}

function CampaignTaskStatus({
  label,
  onChange,
  options = marketingStatusOptions,
  status
}: {
  label: string;
  onChange: (status: MarketingStatus) => void;
  options?: MarketingStatus[];
  status: MarketingStatus;
}) {
  return (
    <label className="campaign-task-status">
      <span>
        <StatusDot status={status} label={statusLabels[status]} />
        {label}
      </span>
      <select
        aria-label={`${label} status`}
        onChange={(event) => onChange(event.target.value as MarketingStatus)}
        value={status}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusDot({
  label,
  status
}: {
  label: string;
  status: MarketingStatus;
}) {
  return <span aria-label={label} className={`status-dot status-dot-${status}`} />;
}

function AppleMusicCsvImportControl({
  hideTitle = false,
  importStatus,
  onImport,
  variant = "standalone"
}: {
  hideTitle?: boolean;
  importStatus: AppleMusicImportStatus;
  onImport: (file: File) => void;
  variant?: "embedded" | "header" | "standalone";
}) {
  const importActions = (
    <div className="apple-import-actions">
      <label className="apple-import-button">
        <Upload size={16} aria-hidden />
        Import CSV
        <input
          accept=".csv,text/csv"
          disabled={importStatus.state === "loading"}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onImport(file);
            }

            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {importStatus.message ? (
        <span className={`refresh-status refresh-status-${importStatus.state}`}>
          {importStatus.message}
        </span>
      ) : null}
    </div>
  );

  if (hideTitle) {
    return importActions;
  }

  return (
    <section
      className={`apple-import-panel apple-import-panel-${variant}`}
      aria-label="Apple Music CSV import"
    >
      {hideTitle ? null : (
        <div>
          <p className="eyebrow">Apple Music</p>
          <h2>CSV Import</h2>
        </div>
      )}
      {importActions}
    </section>
  );
}

function DashboardView({
  appleMusicReminderDismissedDate,
  budgetEntries,
  campaigns,
  dailyFocusProgress,
  dashboardPlatformStats,
  eventEntries,
  eventsLoaded,
  onAddQrCode,
  onAddOtherTask,
  onCampaignDaysChange,
  onDeleteQrCode,
  onDeleteOtherTask,
  onDismissAppleMusicReminder,
  onOpenAppleMusicImport,
  onOtherTaskChange,
  onProductionSongChange,
  onQrCodeChange,
  otherTasks,
  platformMetricRows,
  productionSongs,
  qrCodeLinks
}: {
  appleMusicReminderDismissedDate: string;
  budgetEntries: BudgetEntry[];
  campaigns: MarketingCampaignConfig[];
  dailyFocusProgress: DailyFocusProgressItem[];
  dashboardPlatformStats: typeof platformStats;
  eventEntries: EventEntry[];
  eventsLoaded: boolean;
  onAddQrCode: () => void;
  onAddOtherTask: () => string;
  onCampaignDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDeleteQrCode: (linkId: string) => void;
  onDeleteOtherTask: (taskId: string) => void;
  onDismissAppleMusicReminder: () => void;
  onOpenAppleMusicImport: () => void;
  onOtherTaskChange: (taskId: string, updates: Partial<OtherTask>) => void;
  onProductionSongChange: (songId: string, updates: Partial<ProductionSongConfig>) => void;
  onQrCodeChange: (linkId: string, updates: Partial<QrCodeLink>) => void;
  otherTasks: OtherTask[];
  platformMetricRows: MetricRow[];
  productionSongs: ProductionSongConfig[];
  qrCodeLinks: QrCodeLink[];
}) {
  const campaignPreview = getDashboardCampaignPreview(campaigns);
  const budgetSummary = getBudgetSummary(budgetEntries);
  const nextEvent = getNextUpcomingEvent(eventEntries);
  const productionPreview = getDashboardProductionPreview(productionSongs);
  const productionPreviewSongs = [
    productionPreview.current,
    productionPreview.next
  ].filter((song): song is ProductionSongConfig => Boolean(song));
  const appleMusicLastUpdate = getAppleMusicLastUpdateDate(
    dashboardPlatformStats,
    platformMetricRows
  );
  const isCampaignStartToday = isMarketingCampaignStartToday(campaigns);
  const appleMusicUpdateTask =
    appleMusicReminderDismissedDate === getViennaDateKey()
      ? null
      : getAppleMusicUpdateTask(appleMusicLastUpdate, isCampaignStartToday);
  const focusQueue = getDashboardFocusQueue(
    campaignPreview,
    productionPreviewSongs,
    otherTasks,
    appleMusicUpdateTask ? [appleMusicUpdateTask] : []
  );
  const phaseOne = roadmapPhases[0];

  function updateFocusTaskStatus(task: FocusQueueItem, nextStatus: MarketingStatus) {
    const target = task.actionTarget;

    if (!target) {
      return;
    }

    if (target.kind === "production" && nextStatus === "irrelevant") {
      return;
    }

    if (target.kind === "marketing") {
      const campaign = campaigns.find((candidate) => candidate.id === target.campaignId);

      if (!campaign) {
        return;
      }

      const currentDays =
        campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds);
      const nextDays = currentDays.map((day) => {
        if (day.dayNumber !== target.dayNumber) {
          return day;
        }

        if (target.taskKey) {
          return {
            ...day,
            statuses: {
              ...day.statuses,
              [target.taskKey]: nextStatus
            }
          };
        }

        return {
          ...day,
          extraTasks: day.extraTasks.map((extraTask) =>
            extraTask.id === target.extraTaskId
              ? { ...extraTask, status: nextStatus }
              : extraTask
          )
        };
      });

      onCampaignDaysChange(campaign.id, nextDays);
      return;
    }

    const song = productionSongs.find((candidate) => candidate.id === target.songId);

    if (!song) {
      return;
    }

    const nextSteps = song.steps.map((step) => {
      if (step.id !== target.stepId) {
        return step;
      }

      if (target.taskKey === "main") {
        return { ...step, status: nextStatus };
      }

      return {
        ...step,
        extraTasks: step.extraTasks.map((extraTask) =>
          extraTask.id === target.extraTaskId
            ? { ...extraTask, status: nextStatus }
            : extraTask
        )
      };
    });

    onProductionSongChange(song.id, { steps: nextSteps });
  }

  return (
    <>
      <header className="topbar dashboard-main-topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Daily command screen</p>
          <h1 className="dashboard-main-title">Love Strings Dashboard</h1>
        </div>
        <ModuleHeaderDate />
      </header>

      <DashboardNextEventCard event={nextEvent} isLoaded={eventsLoaded} />

      <DashboardFocusQueueCard
        dailyProgress={dailyFocusProgress}
        focusQueue={focusQueue}
        onAddOtherTask={onAddOtherTask}
        onDeleteOtherTask={onDeleteOtherTask}
        onDismissAppleMusicReminder={onDismissAppleMusicReminder}
        onOpenAppleMusicImport={onOpenAppleMusicImport}
        onOtherTaskChange={onOtherTaskChange}
        onTaskStatusChange={updateFocusTaskStatus}
        otherTasks={otherTasks}
      />

      <PlatformStatsSection
        hideHeading
        platforms={dashboardPlatformStats}
        title="Platform Snapshot"
        description="Key audience and consumption signals from the main platforms."
        variant="dashboard"
        renderCardHeaderMeta={(platform) => {
          const updateDate =
            platform.slug === "apple-music"
              ? appleMusicLastUpdate
              : getPlatformLastSnapshotDate(platformMetricRows, platform.slug);

          return updateDate ? (
            <span className={getPlatformUpdateMetaClass(platform.slug, updateDate)}>
              Last update: {formatDateWithDots(updateDate)}
            </span>
          ) : null;
        }}
      />

      <DashboardCampaignPreview
        preview={campaignPreview}
        productionSongs={productionSongs}
      />

      <DashboardProductionPreview preview={productionPreview} />

      <DashboardBudgetPreview summary={budgetSummary} />

      <DashboardRoadmapPhasePreview phase={phaseOne} />

      <QrCodeLinksSection
        links={qrCodeLinks}
        onAddLink={onAddQrCode}
        onDeleteLink={onDeleteQrCode}
        onLinkChange={onQrCodeChange}
      />
    </>
  );
}

function DashboardCampaignPreview({
  preview,
  productionSongs
}: {
  preview: {
    benchmark: MarketingCampaignConfig | null;
    current: MarketingCampaignConfig | null;
    next: MarketingCampaignConfig | null;
  };
  productionSongs: ProductionSongConfig[];
}) {
  return (
    <section className="dashboard-campaigns" aria-label="Campaign preview">
      <div className="dashboard-campaign-grid">
        <DashboardCampaignCard
          campaign={preview.benchmark}
          emptyText="No benchmark campaign yet."
          label="Benchmark campaign"
          productionSongs={productionSongs}
          showDate={false}
          showTasks={false}
        />
        <DashboardCampaignCard
          campaign={preview.current}
          emptyText="No campaign is currently running."
          label="Current"
          productionSongs={productionSongs}
        />
        <DashboardCampaignCard
          campaign={preview.next}
          emptyText="No upcoming campaign is scheduled."
          label="Next"
          productionSongs={productionSongs}
        />
      </div>
    </section>
  );
}

function DashboardCampaignCard({
  campaign,
  emptyText,
  label,
  productionSongs,
  showDate = true,
  showTasks = true
}: {
  campaign: MarketingCampaignConfig | null;
  emptyText: string;
  label: string;
  productionSongs: ProductionSongConfig[];
  showDate?: boolean;
  showTasks?: boolean;
}) {
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);

  if (!campaign) {
    return (
      <article
        className={`dashboard-campaign-card dashboard-campaign-card-empty${
          label === "Next" ? " dashboard-campaign-card-empty-next" : ""
        }`}
      >
        <p className="eyebrow">{label}</p>
        <h3>{emptyText}</h3>
      </article>
    );
  }

  const releaseDate = parseCampaignDate(campaign.releaseDate);
  const days =
    campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds);
  const unfinishedTasks = getNextCampaignTasks(days);
  const visibleTasks = isTaskListOpen ? unfinishedTasks : unfinishedTasks.slice(0, 3);
  const hiddenTaskCount = unfinishedTasks.length - visibleTasks.length;
  const displayedCampaignTitle =
    getProductionSongForRelease(campaign.releaseTitle, productionSongs)?.title ??
    campaign.releaseTitle;
  const campaignAlbumArtUrl = getProductionAlbumArtForRelease(
    campaign.releaseTitle,
    productionSongs
  );
  const campaignCompletion = calculateCampaignCompletion(days);

  return (
    <article
      className={
        showTasks
          ? "dashboard-campaign-card"
          : "dashboard-campaign-card dashboard-campaign-card-compact"
      }
    >
      <div className="dashboard-campaign-card-header">
        <div className={showTasks ? undefined : "dashboard-benchmark-title-row"}>
          {!showTasks ? (
            campaignAlbumArtUrl ? (
              <span
                aria-label={`${displayedCampaignTitle} album art preview`}
                className="dashboard-production-art"
                role="img"
                style={{ backgroundImage: `url("${campaignAlbumArtUrl}")` }}
              />
            ) : (
              <span className="dashboard-production-art dashboard-production-art-empty">
                <Music2 size={18} aria-hidden />
              </span>
            )
          ) : null}
          <div>
            <p className="eyebrow">{label}</p>
            <h3>
              {displayedCampaignTitle}
              {!showTasks ? ` - ${campaignCompletion}%` : ""}
            </h3>
          </div>
        </div>
        {showDate ? (
          <div className="dashboard-campaign-date">
            <strong>{formatDaysToRelease(releaseDate ? getDaysToRelease(releaseDate) : null)}</strong>
            {releaseDate ? <span>{formatCampaignDate(releaseDate)}</span> : null}
          </div>
        ) : null}
      </div>

      {showTasks ? (
        <CampaignProgressStrip completion={campaignCompletion} days={days} />
      ) : null}
      {showTasks ? <HeaderTaskList tasks={visibleTasks} /> : null}
      {showTasks && unfinishedTasks.length > 3 ? (
        <button
          className="dashboard-task-toggle"
          onClick={() => setIsTaskListOpen((current) => !current)}
          type="button"
        >
          {isTaskListOpen
            ? "Show 3 tasks"
            : `Show all unfinished tasks (${hiddenTaskCount} more)`}
        </button>
      ) : null}
    </article>
  );
}

function DashboardNextEventCard({
  event,
  isLoaded
}: {
  event: EventEntry | null;
  isLoaded: boolean;
}) {
  const eventDate = event ? parseFlexibleBudgetDate(event.date) : null;
  const daysLeft = eventDate ? getDaysUntilDate(eventDate) : null;

  return (
    <section className="dashboard-latest-event" aria-label="Next event">
      <article className="metric-card event-summary-card dashboard-event-card">
        <div className="event-summary-card-title">
          <MapPin size={18} aria-hidden />
          <span>Next event</span>
        </div>
        {!isLoaded ? (
          <p className="event-card-loading">Loading events...</p>
        ) : eventDate ? (
          <strong>{formatCampaignDate(eventDate)}</strong>
        ) : (
          <p className="dashboard-event-empty">No upcoming events planned yet</p>
        )}
        {isLoaded && event && daysLeft !== null ? (
          <p>
            <>
              <EventMaybeLink label={event.name} url={event.nameUrl} />
              <span className="dashboard-event-location">
                <EventMaybeLink
                  label={event.locationName || "Location TBD"}
                  url={event.locationUrl}
                />
                {` - ${formatEventDaysLeft(daysLeft)}`}
              </span>
            </>
          </p>
        ) : null}
      </article>
    </section>
  );
}

function DashboardFocusQueueCard({
  dailyProgress,
  focusQueue,
  onAddOtherTask,
  onDeleteOtherTask,
  onDismissAppleMusicReminder,
  onOpenAppleMusicImport,
  onOtherTaskChange,
  onTaskStatusChange,
  otherTasks
}: {
  dailyProgress: DailyFocusProgressItem[];
  focusQueue: {
    allTasks: FocusQueueItem[];
    visibleTasks: FocusQueueItem[];
  };
  onAddOtherTask: () => string;
  onDeleteOtherTask: (taskId: string) => void;
  onDismissAppleMusicReminder: () => void;
  onOpenAppleMusicImport: () => void;
  onOtherTaskChange: (taskId: string, updates: Partial<OtherTask>) => void;
  onTaskStatusChange: (task: FocusQueueItem, status: MarketingStatus) => void;
  otherTasks: OtherTask[];
}) {
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [editingOtherTaskId, setEditingOtherTaskId] = useState<string | null>(null);
  const [openStatusTaskId, setOpenStatusTaskId] = useState<string | null>(null);
  const [showCompletedOtherTasks, setShowCompletedOtherTasks] = useState(false);
  const eligibleDailyProgress = dailyProgress.filter(
    (item) => item.status !== "irrelevant"
  );
  const dailyPoints = eligibleDailyProgress.reduce(
    (total, item) =>
      total + (item.status === "done" ? 2 : item.status === "in-progress" ? 1 : 0),
    0
  );
  const dailyPercent = Math.round((dailyPoints / 6) * 100);
  const dailyProgressSlots = [
    ...eligibleDailyProgress,
    ...Array.from(
      { length: Math.max(0, 3 - eligibleDailyProgress.length) },
      (_, index) => ({
        date: getViennaDateKey(),
        label: `Daily target slot ${eligibleDailyProgress.length + index + 1}`,
        source: "Other" as const,
        status: "not-started" as const,
        taskKey: `daily-target-slot-${index}`
      })
    )
  ];
  const tasks = focusQueue.visibleTasks;
  const activeOtherTasks = otherTasks
    .filter((task) => task.status !== "done" && task.status !== "irrelevant")
    .sort(
      (firstTask, secondTask) =>
        getBudgetDateSortTime(firstTask.dueDate) -
          getBudgetDateSortTime(secondTask.dueDate) ||
        firstTask.title.localeCompare(secondTask.title)
    );
  const expandedOtherTasks = activeOtherTasks.slice(3);
  const editingActiveHeaderTask =
    editingOtherTaskId && !expandedOtherTasks.some((task) => task.id === editingOtherTaskId)
      ? activeOtherTasks.find((task) => task.id === editingOtherTaskId) ?? null
      : null;
  const displayedExpandedOtherTasks = editingActiveHeaderTask
    ? [editingActiveHeaderTask, ...expandedOtherTasks]
    : expandedOtherTasks;
  const completedOtherTasks = otherTasks
    .filter((task) => task.status === "done" || task.status === "irrelevant")
    .sort(
      (firstTask, secondTask) =>
        getBudgetDateSortTime(secondTask.dueDate) -
          getBudgetDateSortTime(firstTask.dueDate) ||
        firstTask.title.localeCompare(secondTask.title)
    );
  const getEditableOtherTaskId = (task: FocusQueueItem) =>
    task.source === "Other" && task.id.startsWith("other-other-task-")
      ? task.id.replace(/^other-/, "")
      : null;

  return (
    <section className="dashboard-focus" aria-label="Focus queue">
      <article className="dashboard-focus-card">
        <div className="dashboard-focus-card-header">
          <Clock3 size={18} aria-hidden />
          <h2>Focus Queue</h2>
          <div
            aria-label={`Daily focus progress: ${dailyPoints} of 6 points, ${dailyPercent}%`}
            className="dashboard-focus-score"
          >
            <div className="dashboard-focus-score-boxes">
              {dailyProgressSlots.map((item) => {
                const progressStatus =
                  item.status === "done"
                    ? "complete"
                    : item.status === "in-progress"
                      ? "partial"
                      : "empty";

                return (
                  <span
                    aria-label={`${item.label}: ${statusLabels[item.status]}`}
                    className={`campaign-progress-box campaign-progress-box-${progressStatus}`}
                    key={item.taskKey}
                    title={`${item.label}: ${statusLabels[item.status]}`}
                  />
                );
              })}
            </div>
            <strong>{dailyPercent}%</strong>
          </div>
        </div>
        {tasks.length > 0 ? (
          <ul className="dashboard-focus-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className="dashboard-focus-task-topline">
                  <span className="dashboard-focus-task-header">
                    <span className="dashboard-focus-source">{task.source}</span>
                    <StatusDot status={task.status} label={statusLabels[task.status]} />
                  </span>
                  <span className="dashboard-focus-task-label">{task.label}</span>
                  <div className="dashboard-focus-status-menu-wrap">
                    <button
                      aria-expanded={openStatusTaskId === task.id}
                      aria-label={`Change status for ${task.label}`}
                      className="dashboard-focus-status-button"
                      onClick={() =>
                        setOpenStatusTaskId((currentId) =>
                          currentId === task.id ? null : task.id
                        )
                      }
                      title="Change status"
                      type="button"
                    >
                      <ChevronDown size={14} aria-hidden />
                    </button>
                    {openStatusTaskId === task.id ? (
                      <div className="dashboard-focus-status-menu">
                        {task.id === "other-apple-music-csv-update" ? (
                          <>
                            <button
                              className="dashboard-focus-status-option"
                              onClick={() => {
                                setOpenStatusTaskId(null);
                                onOpenAppleMusicImport();
                              }}
                              type="button"
                            >
                              <ArrowUpRight size={14} aria-hidden />
                              Open Apple Music import
                            </button>
                            <button
                              className="dashboard-focus-status-option"
                              onClick={() => {
                                setOpenStatusTaskId(null);
                                onDismissAppleMusicReminder();
                              }}
                              type="button"
                            >
                              <Clock3 size={14} aria-hidden />
                              Dismiss until tomorrow
                            </button>
                          </>
                        ) : (
                          <>
                            {getEditableOtherTaskId(task) ? (
                              <button
                                className="dashboard-focus-status-option"
                                onClick={() => {
                                  setEditingOtherTaskId(getEditableOtherTaskId(task));
                                  setIsTaskListOpen(true);
                                  setOpenStatusTaskId(null);
                                }}
                                type="button"
                              >
                                <Pencil size={14} aria-hidden />
                                Edit
                              </button>
                            ) : null}
                            {getFocusQueueStatusOptions(task).map((status) => (
                              <button
                                className="dashboard-focus-status-option"
                                disabled={
                                  !task.actionTarget &&
                                  getEditableOtherTaskId(task) === null
                                }
                                key={status}
                                onClick={() => {
                                  const editableOtherTaskId =
                                    getEditableOtherTaskId(task);

                                  if (editableOtherTaskId) {
                                    onOtherTaskChange(editableOtherTaskId, { status });
                                  } else {
                                    onTaskStatusChange(task, status);
                                  }
                                  setOpenStatusTaskId(null);
                                }}
                                title={
                                  task.actionTarget || getEditableOtherTaskId(task)
                                    ? statusLabels[status]
                                    : "This automatic reminder is updated from its source"
                                }
                                type="button"
                              >
                                <StatusDot
                                  status={status}
                                  label={statusLabels[status]}
                                />
                                {statusLabels[status]}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-focus-empty">
            No focus tasks are scheduled yet.
          </p>
        )}
        <div className="dashboard-focus-actions">
          <button
            className="dashboard-task-toggle"
            onClick={() => setIsTaskListOpen((current) => !current)}
            type="button"
          >
            {isTaskListOpen ? "Hide focus details" : "Show focus details"}
          </button>
          <button
            className="dashboard-other-add dashboard-other-add-compact"
            onClick={() => {
              const newTaskId = onAddOtherTask();
              setEditingOtherTaskId(newTaskId);
              setIsTaskListOpen(true);
            }}
            type="button"
          >
            <Plus size={14} aria-hidden />
            Other task
          </button>
        </div>
        {isTaskListOpen ? (
          <div className="dashboard-other-tasks">
            <OtherTaskList
              editingTaskId={editingOtherTaskId}
              emptyText={
                activeOtherTasks.length > 0
                  ? "No extra active other tasks beyond the header."
                  : "No active other tasks yet."
              }
              onDeleteTask={onDeleteOtherTask}
              onEditTask={setEditingOtherTaskId}
              onTaskChange={onOtherTaskChange}
              tasks={displayedExpandedOtherTasks}
            />
            {completedOtherTasks.length > 0 ? (
              <>
                <button
                  className="dashboard-task-toggle"
                  onClick={() => setShowCompletedOtherTasks((current) => !current)}
                  type="button"
                >
                  {showCompletedOtherTasks
                    ? "Hide completed other tasks"
                    : `Show completed other tasks (${completedOtherTasks.length})`}
                </button>
                {showCompletedOtherTasks ? (
                  <OtherTaskList
                    editingTaskId={editingOtherTaskId}
                    emptyText=""
                    onDeleteTask={onDeleteOtherTask}
                    onEditTask={setEditingOtherTaskId}
                    onTaskChange={onOtherTaskChange}
                    tasks={completedOtherTasks}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function OtherTaskList({
  editingTaskId,
  emptyText,
  onDeleteTask,
  onEditTask,
  onTaskChange,
  tasks
}: {
  editingTaskId: string | null;
  emptyText: string;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string | null) => void;
  onTaskChange: (taskId: string, updates: Partial<OtherTask>) => void;
  tasks: OtherTask[];
}) {
  const [openOtherMenuTaskId, setOpenOtherMenuTaskId] = useState<string | null>(null);
  const editingTaskRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editingTaskId) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      editingTaskRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    }, 60);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [editingTaskId]);

  if (tasks.length === 0) {
    return emptyText ? <p className="dashboard-focus-empty">{emptyText}</p> : null;
  }

  return (
    <div className="dashboard-other-task-list">
      {tasks.map((task) =>
        editingTaskId === task.id ? (
          <OtherTaskEditor
            key={task.id}
            onClose={() => onEditTask(null)}
            onDeleteTask={onDeleteTask}
            onTaskChange={onTaskChange}
            ref={editingTaskRef}
            task={task}
          />
        ) : (
          <div className="dashboard-other-task-row" key={task.id}>
            <div className="dashboard-focus-task-topline">
              <span className="dashboard-focus-task-header">
                <span className="dashboard-focus-source">Other</span>
                <StatusDot status={task.status} label={statusLabels[task.status]} />
              </span>
              <span className="dashboard-focus-task-label">
                {toOtherFocusQueueItem(task).label}
              </span>
              <div className="dashboard-focus-status-menu-wrap">
                <button
                  aria-expanded={openOtherMenuTaskId === task.id}
                  aria-label={`Change status for ${task.title || "other task"}`}
                  className="dashboard-focus-status-button"
                  onClick={() =>
                    setOpenOtherMenuTaskId((currentId) =>
                      currentId === task.id ? null : task.id
                    )
                  }
                  title="Task actions"
                  type="button"
                >
                  <ChevronDown size={14} aria-hidden />
                </button>
                {openOtherMenuTaskId === task.id ? (
                  <div className="dashboard-focus-status-menu">
                    <button
                      className="dashboard-focus-status-option"
                      onClick={() => {
                        onEditTask(task.id);
                        setOpenOtherMenuTaskId(null);
                      }}
                      type="button"
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </button>
                    {marketingUploadStatusOptions.map((status) => (
                      <button
                        className="dashboard-focus-status-option"
                        key={status}
                        onClick={() => {
                          onTaskChange(task.id, { status });
                          setOpenOtherMenuTaskId(null);
                        }}
                        type="button"
                      >
                        <StatusDot status={status} label={statusLabels[status]} />
                        {statusLabels[status]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

const OtherTaskEditor = forwardRef<HTMLDivElement, {
  onClose: () => void;
  onDeleteTask: (taskId: string) => void;
  onTaskChange: (taskId: string, updates: Partial<OtherTask>) => void;
  task: OtherTask;
}>(function OtherTaskEditor({
  onClose,
  onDeleteTask,
  onTaskChange,
  task
}, ref) {
  return (
    <div className="dashboard-other-task-editor" ref={ref}>
      <label>
        <span>Task</span>
        <input
          onChange={(event) =>
            onTaskChange(task.id, { title: event.target.value })
          }
          placeholder="Short description"
          value={task.title}
        />
      </label>
      <label>
        <span>Due date</span>
        <input
          onChange={(event) =>
            onTaskChange(task.id, { dueDate: event.target.value })
          }
          placeholder="24/07/2026"
          value={task.dueDate}
        />
      </label>
      <label>
        <span>Status</span>
        <select
          onChange={(event) =>
            onTaskChange(task.id, {
              status: event.target.value as MarketingStatus
            })
          }
          value={task.status}
        >
          {marketingUploadStatusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="dashboard-other-task-notes">
        <span>Notes</span>
        <textarea
          onChange={(event) =>
            onTaskChange(task.id, { notes: event.target.value })
          }
          placeholder="Optional context"
          rows={1}
          value={task.notes}
        />
      </label>
      <div className="dashboard-other-task-editor-actions">
        <button
          aria-label={`Delete ${task.title || "other task"}`}
          className="icon-button danger ghost dashboard-other-task-delete"
          onClick={() => onDeleteTask(task.id)}
          title="Delete task"
          type="button"
        >
          <Trash2 size={16} aria-hidden />
        </button>
        <button
          aria-label="Close edit mode"
          className="icon-button ghost dashboard-other-task-collapse"
          onClick={onClose}
          title="Close edit"
          type="button"
        >
          <ChevronDown className="dashboard-other-task-collapse-icon" size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
});

function getFocusQueueStatusOptions(task: FocusQueueItem) {
  return task.source === "Production"
    ? marketingStatusOptions
    : marketingUploadStatusOptions;
}

function DashboardProductionPreview({
  preview
}: {
  preview: ReturnType<typeof getDashboardProductionPreview>;
}) {
  return (
    <section className="dashboard-production" aria-label="Production preview">
      <div className="dashboard-production-grid">
        <DashboardProductionCard
          compact
          emptyText="No benchmark production song yet."
          label="Benchmark production"
          song={preview.benchmark}
        />
        <DashboardProductionCard
          emptyText="No current production song yet."
          label="Current song"
          song={preview.current}
        />
        <DashboardProductionCard
          emptyText="No next production song yet."
          label="Next song"
          song={preview.next}
        />
      </div>
    </section>
  );
}

function DashboardProductionCard({
  compact = false,
  emptyText,
  label,
  song
}: {
  compact?: boolean;
  emptyText: string;
  label: string;
  song: ProductionSongConfig | null;
}) {
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);

  if (!song) {
    return (
      <article className="dashboard-production-card dashboard-production-card-empty">
        <p className="eyebrow">{label}</p>
        <h3>{emptyText}</h3>
      </article>
    );
  }

  const deadlineDate = parseCampaignDate(song.deadline);
  const allTasks = getProductionTaskList(song.steps);
  const nextTasks = getNextProductionTasks(song.steps);
  const benchmarkDays = getProductionBenchmarkDays(song);
  const visibleTasks = isTaskListOpen
    ? allTasks
    : nextTasks.length > 0
      ? nextTasks.slice(0, 3)
      : allTasks.slice(0, 3);
  const hiddenTaskCount = allTasks.length - visibleTasks.length;

  return (
    <article
      className={`dashboard-production-card${compact ? " dashboard-production-card-compact" : ""}`}
    >
      <div className="dashboard-production-card-header">
        <div className="dashboard-production-title-row">
          {song.albumArtUrl ? (
            <span
              aria-label={`${song.title} album art preview`}
              className="dashboard-production-art"
              role="img"
              style={{ backgroundImage: `url("${song.albumArtUrl}")` }}
            />
          ) : (
            <span className="dashboard-production-art dashboard-production-art-empty">
              <Music2 size={18} aria-hidden />
            </span>
          )}
          <div>
            <p className="eyebrow">{label}</p>
            <h3>
              {song.title}
              {compact && benchmarkDays !== null ? ` - ${benchmarkDays} days` : ""}
            </h3>
          </div>
        </div>
        {compact ? null : (
          <div className="dashboard-campaign-date">
            <strong>
              {formatDaysToProductionDeadline(
                deadlineDate ? getDaysToRelease(deadlineDate) : null
              )}
            </strong>
            {deadlineDate ? <span>{formatCampaignDate(deadlineDate)}</span> : null}
          </div>
        )}
      </div>

      {compact ? null : (
        <div className="dashboard-production-progress-row">
          <ProductionProgressStrip steps={song.steps} />
        </div>
      )}
      {compact ? null : <HeaderTaskList tasks={visibleTasks} />}
      {!compact && allTasks.length > 3 ? (
        <button
          className="dashboard-task-toggle"
          onClick={() => setIsTaskListOpen((current) => !current)}
          type="button"
        >
          {isTaskListOpen
            ? "Show 3 tasks"
            : `Show all song tasks (${hiddenTaskCount} more)`}
        </button>
      ) : null}
    </article>
  );
}

function DashboardBudgetPreview({
  summary
}: {
  summary: ReturnType<typeof getBudgetSummary>;
}) {
  return (
    <section className="dashboard-budget" aria-label="Budget preview">
      <div className="dashboard-budget-grid">
        <article className="metric-card budget-metric-card dashboard-budget-current">
          <span>Current balance</span>
          <strong className={getAmountToneClass(summary.balance)}>
            {formatCurrency(summary.balance)}
          </strong>
        </article>
        <article className="metric-card budget-metric-card dashboard-budget-projected-earn">
          <span>Projected earn month ahead</span>
          <strong className="amount-positive">{formatCurrency(summary.potentialEarn)}</strong>
        </article>
        <article className="metric-card budget-metric-card dashboard-budget-projected-spend">
          <span>Projected spend month ahead</span>
          <strong className="amount-expense">
            {formatSpentCurrency(summary.upcomingSpend)}
          </strong>
        </article>
        <article className="metric-card budget-metric-card dashboard-budget-projected-balance">
          <span>Projected balance month ahead</span>
          <strong className={getAmountToneClass(summary.upcomingBalance)}>
            {formatCurrency(summary.upcomingBalance)}
          </strong>
        </article>
      </div>
    </section>
  );
}

function DashboardRoadmapPhasePreview({ phase }: { phase: RoadmapPhase }) {
  return (
    <section className="dashboard-roadmap" aria-label="Roadmap phase preview">
      <article className={`roadmap-phase-card roadmap-phase-${phase.accent}`}>
        <div className="roadmap-phase-heading">
          <div>
            <p className="eyebrow">Phase {phase.phaseNumber}</p>
            <h2>{phase.title}</h2>
          </div>
          <span>{phase.period}</span>
        </div>

        <div className="roadmap-phase-counts">
          <strong>
            {phase.releasedCount} / {phase.targetCount}
          </strong>
          <span>
            {phase.releasedCount} released
            {phase.activeCount ? `, ${phase.activeCount} active` : ""}
          </span>
        </div>

        <RoadmapReleaseStrip phase={phase} />

        <p>{phase.summary}</p>
      </article>
    </section>
  );
}

function PlatformsView({
  appleMusicImportStatus,
  onAddQrCode,
  onAppleMusicCsvImport,
  onDeleteQrCode,
  onQrCodeChange,
  onRefreshPlatformStats,
  platformMetricRows,
  platformStatsData,
  qrCodeLinks,
  refreshStatus
}: {
  appleMusicImportStatus: AppleMusicImportStatus;
  onAddQrCode: () => void;
  onAppleMusicCsvImport: (file: File) => void;
  onDeleteQrCode: (linkId: string) => void;
  onQrCodeChange: (linkId: string, updates: Partial<QrCodeLink>) => void;
  onRefreshPlatformStats: () => void;
  platformMetricRows: MetricRow[];
  platformStatsData: typeof platformStats;
  qrCodeLinks: QrCodeLink[];
  refreshStatus: RefreshStatus;
}) {
  const instagramFollowerTrend = getPlatformMetricTrend(
    platformMetricRows,
    "instagram",
    "followers",
    instagramFollowerHistory
  );
  const instagramReachTrend = getPlatformMetricTrend(
    platformMetricRows,
    "instagram",
    "accounts_reached_30d",
    []
  );
  const instagramViewsTrend = getPlatformMetricTrend(
    platformMetricRows,
    "instagram",
    "views_30d",
    []
  );
  const instagramLastUpdate = getPlatformLastSnapshotDate(
    platformMetricRows,
    "instagram"
  );
  const youtubeSubscriberTrend = getYouTubeSubscriberTrend(platformMetricRows);
  const youtubeTotalViewsTrend = getPlatformMetricTrend(
    platformMetricRows,
    "youtube",
    "total_channel_views",
    []
  );
  const youtubeLastUpdate = getPlatformLastSnapshotDate(platformMetricRows, "youtube");
  const youtubeMusicSubscriberTrend = getPlatformMetricTrend(
    platformMetricRows,
    "youtube-music",
    "subscribers",
    []
  );
  const youtubeMusicTotalPlaysTrend = getPlatformMetricTrend(
    platformMetricRows,
    "youtube-music",
    "total_plays",
    []
  );
  const youtubeMusicLastUpdate = getPlatformLastSnapshotDate(
    platformMetricRows,
    "youtube-music"
  );
  const appleMusicTotalPlaysTrend = getPlatformMetricTrend(
    platformMetricRows,
    "apple-music",
    "total_plays",
    []
  );
  const appleMusicLastUpdate = getAppleMusicLastUpdateDate(
    platformStatsData,
    platformMetricRows
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Detailed platform statistics</p>
          <h1>Platforms</h1>
        </div>
        <div className="dashboard-refresh-control platform-refresh-control">
          <ModuleHeaderDate />
          <button
            className="refresh-button"
            disabled={refreshStatus.state === "loading"}
            onClick={onRefreshPlatformStats}
            type="button"
          >
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
          {refreshStatus.message ? (
            <span className={`refresh-status refresh-status-${refreshStatus.state}`}>
              {refreshStatus.message}
            </span>
          ) : null}
        </div>
      </header>

      <PlatformStatsSection
        hideHeading
        platforms={getPlatformsViewStats(platformStatsData)}
        title="All Platform Metrics"
        description="Manual seed values now; later these cards will read daily snapshots from Supabase."
        variant="full"
        renderCardAddon={(platform) =>
          <>
            {platform.slug === "instagram" ? (
              <PlatformTrendPanelGroup
                charts={[
                  {
                    color: "#1f7a58",
                    label: "Followers",
                    points: instagramFollowerTrend
                  },
                  {
                    color: "#c79522",
                    label: "Accounts reached, last 30 days",
                    points: instagramReachTrend
                  },
                  {
                    color: "#2f75a8",
                    label: "Views, last 30 days",
                    points: instagramViewsTrend
                  }
                ]}
                title="Evolution graphs"
              />
            ) : null}
            {platform.slug === "youtube" ? (
              <PlatformTrendPanelGroup
                charts={[
                  {
                    color: "#1f7a58",
                    label: "Subscribers",
                    points: youtubeSubscriberTrend
                  },
                  {
                    color: "#2f75a8",
                    label: "Lifetime views",
                    points: youtubeTotalViewsTrend
                  }
                ]}
                title="Evolution graphs"
              />
            ) : null}
            {platform.slug === "youtube-music" ? (
              <PlatformTrendPanelGroup
                charts={[
                  {
                    color: "#1f7a58",
                    label: "Subscribers",
                    points: youtubeMusicSubscriberTrend
                  },
                  {
                    color: "#2f75a8",
                    label: "Total plays",
                    points: youtubeMusicTotalPlaysTrend
                  }
                ]}
                title="Evolution graphs"
              />
            ) : null}
            {platform.slug === "apple-music" ? (
              <PlatformTrendPanel
                color="#2f75a8"
                label="Total plays"
                points={appleMusicTotalPlaysTrend}
                title="Evolution graphs"
              />
            ) : null}
          </>
        }
        renderCardHeaderMeta={(platform) =>
          platform.slug === "instagram" && instagramLastUpdate ? (
            <span className="platform-card-header-meta">
              Last update: {formatDateWithDots(instagramLastUpdate)}
            </span>
          ) : platform.slug === "youtube" && youtubeLastUpdate ? (
            <span className="platform-card-header-meta">
              Last update: {formatDateWithDots(youtubeLastUpdate)}
            </span>
          ) : platform.slug === "youtube-music" && youtubeMusicLastUpdate ? (
            <span className="platform-card-header-meta">
              Last update: {formatDateWithDots(youtubeMusicLastUpdate)}
            </span>
          ) : platform.slug === "apple-music" ? (
            <div className="platform-card-header-meta apple-import-actions">
              {appleMusicLastUpdate ? (
                <span
                  className={getPlatformUpdateMetaClass(
                    platform.slug,
                    appleMusicLastUpdate
                  )}
                >
                  Last update: {formatDateWithDots(appleMusicLastUpdate)}
                </span>
              ) : null}
              <AppleMusicCsvImportControl
                hideTitle
                importStatus={appleMusicImportStatus}
                onImport={onAppleMusicCsvImport}
                variant="header"
              />
            </div>
          ) : null
        }
      />

      <QrCodeLinksSection
        links={qrCodeLinks}
        onAddLink={onAddQrCode}
        onDeleteLink={onDeleteQrCode}
        onLinkChange={onQrCodeChange}
      />
    </>
  );
}

function QrCodeLinksSection({
  links,
  onAddLink,
  onDeleteLink,
  onLinkChange
}: {
  links: QrCodeLink[];
  onAddLink: () => void;
  onDeleteLink: (linkId: string) => void;
  onLinkChange: (linkId: string, updates: Partial<QrCodeLink>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmations, setDeleteConfirmations] = useState<
    Record<string, boolean>
  >({});

  function setDeleteConfirmation(linkId: string, checked: boolean) {
    setDeleteConfirmations((currentConfirmations) => ({
      ...currentConfirmations,
      [linkId]: checked
    }));
  }

  function deleteLink(linkId: string) {
    onDeleteLink(linkId);
    setDeleteConfirmations((currentConfirmations) => {
      const nextConfirmations = { ...currentConfirmations };
      delete nextConfirmations[linkId];
      return nextConfirmations;
    });
  }

  return (
    <section className="qr-links-section" aria-label="QR code links">
      <button
        aria-expanded={isOpen}
        className="qr-links-toggle"
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
        type="button"
      >
        <span>
          <LinkIcon size={18} aria-hidden />
          QR Codes
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>

      {isOpen ? (
        <div className="qr-links-panel">
          <div className="qr-links-grid">
            {links.map((link) => {
              const canDelete = Boolean(deleteConfirmations[link.id]);

              return (
                <article className="qr-link-card" key={link.id}>
                  {link.qrImageUrl ? (
                    <a
                      aria-label={`Open ${link.name || "QR code"} link`}
                      className="qr-code-preview"
                      href={link.targetUrl || link.qrImageUrl}
                      rel="noreferrer"
                      style={{ backgroundImage: `url("${link.qrImageUrl}")` }}
                      target="_blank"
                    />
                  ) : (
                    <div className="qr-code-placeholder">
                      <LinkIcon size={26} aria-hidden />
                      <span>QR image URL needed</span>
                    </div>
                  )}

                  <div className="qr-link-fields">
                    <label>
                      Name
                      <input
                        onChange={(event) =>
                          onLinkChange(link.id, { name: event.target.value })
                        }
                        value={link.name}
                      />
                    </label>
                    <label>
                      QR image URL
                      <input
                        onChange={(event) =>
                          onLinkChange(link.id, {
                            qrImageUrl: event.target.value
                          })
                        }
                        placeholder="https://..."
                        value={link.qrImageUrl}
                      />
                    </label>
                    <label>
                      Link opens
                      <input
                        onChange={(event) =>
                          onLinkChange(link.id, {
                            targetUrl: event.target.value
                          })
                        }
                        placeholder="https://..."
                        value={link.targetUrl}
                      />
                    </label>
                  </div>

                  <div className="qr-link-delete-row">
                    <label>
                      <input
                        checked={canDelete}
                        onChange={(event) =>
                          setDeleteConfirmation(link.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      Confirm delete
                    </label>
                    <button
                      className="danger-action"
                      disabled={!canDelete}
                      onClick={() => deleteLink(link.id)}
                      type="button"
                    >
                      <Trash2 size={14} aria-hidden />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <button className="add-task-button qr-add-button" onClick={onAddLink} type="button">
            <Plus size={16} aria-hidden />
            Add QR code
          </button>
        </div>
      ) : null}
    </section>
  );
}

const instagramFollowerHistory: MetricTrendPoint[] = [
  { date: "2026-05-22", source: "manual", value: 148 },
  { date: "2026-06-04", source: "manual", value: 158 },
  { date: "2026-06-11", source: "manual", value: 174 },
  { date: "2026-06-14", source: "manual", value: 177 }
];

const youtubeSubscriberHistory: MetricTrendPoint[] = [
  { date: "2026-05-22", source: "manual", value: 18 },
  { date: "2026-06-04", source: "manual", value: 22 },
  { date: "2026-06-11", source: "manual", value: 28 },
  { date: "2026-06-14", source: "manual", value: 38 }
];

function getYouTubeSubscriberTrend(rows: MetricRow[]) {
  return getPlatformMetricTrend(
    rows,
    "youtube",
    "subscribers",
    youtubeSubscriberHistory
  );
}

function getPlatformMetricTrend(
  rows: MetricRow[],
  platformSlug: string,
  metricName: string,
  manualHistory: MetricTrendPoint[]
) {
  const pointsByDate = new Map<string, MetricTrendPoint>();

  manualHistory.forEach((point) => {
    pointsByDate.set(point.date, point);
  });

  rows
    .filter(
      (row) =>
        getSingle(row.platforms)?.slug === platformSlug &&
        row.metric_name === metricName &&
        (manualHistory.length === 0 || row.snapshot_date > "2026-06-14")
    )
    .forEach((row) => {
      const value = Number(row.metric_value);

      if (!Number.isFinite(value)) {
        return;
      }

      pointsByDate.set(row.snapshot_date, {
        date: row.snapshot_date,
        source: "supabase",
        value
      });
    });

  return [...pointsByDate.values()].sort((firstPoint, secondPoint) =>
    firstPoint.date.localeCompare(secondPoint.date)
  );
}

function getPlatformLastSnapshotDate(rows: MetricRow[], platformSlug: string) {
  return rows
    .filter((row) => getSingle(row.platforms)?.slug === platformSlug)
    .map((row) => row.snapshot_date)
    .sort((firstDate, secondDate) => secondDate.localeCompare(firstDate))[0];
}

function getAppleMusicLastUpdateDate(
  platformStatsData: typeof platformStats,
  platformMetricRows: MetricRow[]
) {
  return (
    getPlatformMetric(platformStatsData, "apple-music", "last_update_date")?.value ??
    getPlatformLastSnapshotDate(platformMetricRows, "apple-music")
  );
}

function getAppleMusicUpdateTask(
  updateDate: string | undefined,
  isCampaignStartToday: boolean
): FocusQueueItem | null {
  const needsCampaignStartSnapshot =
    isCampaignStartToday && !wasPlatformUpdatedToday(updateDate);

  if (!isPlatformUpdateStale(updateDate) && !needsCampaignStartSnapshot) {
    return null;
  }

  return {
    id: "other-apple-music-csv-update",
    label: `Update Apple Music CSV${
      needsCampaignStartSnapshot ? " - campaign starts today" : ""
    }${
      updateDate ? ` - last update ${formatDateWithDots(updateDate)}` : ""
    }`,
    source: "Other",
    status: "not-started"
  };
}

function isMarketingCampaignStartToday(campaigns: MarketingCampaignConfig[]) {
  const todayKey = getViennaDateKey();

  return campaigns.some((campaign) => {
    const campaignDays =
      campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds);
    const firstDay = [...campaignDays].sort((first, second) =>
      first.dateKey.localeCompare(second.dateKey)
    )[0];

    return firstDay?.dateKey === todayKey;
  });
}

function wasPlatformUpdatedToday(updateDate?: string) {
  const parsedDate = updateDate ? parsePlatformUpdateDate(updateDate) : null;
  return parsedDate?.toISOString().slice(0, 10) === getViennaDateKey();
}

function getPlatformUpdateMetaClass(platformSlug: string, updateDate?: string) {
  return [
    "platform-card-header-meta",
    platformSlug === "apple-music" && isPlatformUpdateStale(updateDate)
      ? "platform-card-header-meta-stale"
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function isPlatformUpdateStale(updateDate?: string) {
  const parsedDate = updateDate ? parsePlatformUpdateDate(updateDate) : null;

  if (!parsedDate) {
    return false;
  }

  const ageInDays =
    (getTodayUtcDate().getTime() - parsedDate.getTime()) / (24 * 60 * 60 * 1000);

  return ageInDays > 7;
}

function parsePlatformUpdateDate(value: string) {
  return parseCampaignDateKey(value) ?? parseFlexibleBudgetDate(value);
}

function PlatformTrendPanel({
  color = "#1f7a58",
  label,
  points,
  title
}: {
  color?: string;
  label: string;
  points: MetricTrendPoint[];
  title: string;
}) {
  return (
    <PlatformTrendPanelGroup
      charts={[
        {
          color,
          label,
          points
        }
      ]}
      title={title}
    />
  );
}

function PlatformTrendPanelGroup({
  charts,
  title
}: {
  charts: Array<{
    color?: string;
    label: string;
    points: MetricTrendPoint[];
  }>;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="platform-trend-panel"
      data-scroll-anchor={isOpen ? "open-card" : undefined}
    >
      <button
        aria-expanded={isOpen}
        className="platform-trend-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{title}</span>
        <ChevronDown
          className={isOpen ? "platform-trend-toggle-icon-open" : undefined}
          size={16}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div className="platform-trend-body">
          {charts.map((chart) => (
            <PlatformTrendChartBlock
              color={chart.color}
              key={chart.label}
              label={chart.label}
              points={chart.points}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlatformTrendChartBlock({
  color = "#1f7a58",
  label,
  points
}: {
  color?: string;
  label: string;
  points: MetricTrendPoint[];
}) {
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  const change =
    firstPoint && lastPoint ? lastPoint.value - firstPoint.value : 0;

  return (
    <div className="platform-trend-chart-block">
      <div className="platform-trend-summary">
        <span className="platform-trend-title-with-legend">
          <i
            aria-hidden
            className="platform-trend-legend-square"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>
        <strong>
          {firstPoint && lastPoint
            ? `${formatMetricValue(firstPoint.value)} -> ${formatMetricValue(lastPoint.value)}`
            : "No data yet"}
        </strong>
        <em>{change >= 0 ? `+${formatMetricValue(change)}` : formatMetricValue(change)}</em>
      </div>
      <PlatformLineChart color={color} label={label} points={points} />
    </div>
  );
}

function PlatformLineChart({
  color = "#1f7a58",
  label,
  points
}: {
  color?: string;
  label: string;
  points: MetricTrendPoint[];
}) {
  if (points.length < 2) {
    return <p className="platform-trend-empty">Not enough history yet.</p>;
  }

  const width = 320;
  const height = 132;
  const padding = 14;
  const labelBandHeight = 20;
  const gridBottom = height - padding - labelBandHeight;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const firstTime = Date.parse(points[0].date);
  const lastTime = Date.parse(points.at(-1)?.date ?? points[0].date);
  const valueRange = Math.max(maxValue - minValue, 1);
  const timeRange = Math.max(lastTime - firstTime, 1);
  const chartWidth = width - padding * 2;
  const chartHeight = gridBottom - padding;

  const coordinates = points.map((point) => {
    const time = Date.parse(point.date);
    const x = padding + ((time - firstTime) / timeRange) * chartWidth;
    const labelY =
      padding +
      chartHeight -
      ((point.value - minValue) / valueRange) * chartHeight;

    return {
      ...point,
      x,
      labelY,
      y: labelY + 8
    };
  });
  const linePoints = coordinates
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const middleIndex = Math.floor((coordinates.length - 1) / 2);
  const labeledPointIndexes = new Set([0, middleIndex, coordinates.length - 1]);
  const verticalGridLines = Array.from({ length: 6 }, (_, index) => {
    return padding + (index / 5) * chartWidth;
  });
  const horizontalGridLines = Array.from({ length: 4 }, (_, index) => {
    return padding + (index / 3) * chartHeight;
  });

  return (
    <div
      className="platform-line-chart"
      style={{ "--platform-chart-color": color } as React.CSSProperties}
    >
      <svg
        aria-label={`${label} over time`}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          className="platform-line-chart-grid-frame"
          height={chartHeight}
          width={chartWidth}
          x={padding}
          y={padding}
        />
        {verticalGridLines.map((x) => (
          <line
            className="platform-line-chart-grid-line"
            key={`vertical-${x.toFixed(1)}`}
            x1={x}
            x2={x}
            y1={padding}
            y2={gridBottom}
          />
        ))}
        {horizontalGridLines.map((y) => (
          <line
            className="platform-line-chart-grid-line"
            key={`horizontal-${y.toFixed(1)}`}
            x1={padding}
            x2={width - padding}
            y1={y}
            y2={y}
          />
        ))}
        <polyline className="platform-line-chart-line" points={linePoints} />
        {coordinates.map((point, index) => (
          <g key={`${point.date}-${point.value}`}>
            <circle className="platform-line-chart-dot" cx={point.x} cy={point.y} r="4" />
            {labeledPointIndexes.has(index) ? (
              <text
                className="platform-line-chart-value"
                textAnchor={
                  index === 0 ? "start" : index === coordinates.length - 1 ? "end" : "middle"
                }
                x={point.x}
                y={Math.max(12, point.labelY - 8)}
              >
                {formatMetricValue(point.value)}
              </text>
            ) : null}
            {labeledPointIndexes.has(index) ? (
              <text
                className="platform-line-chart-month"
                textAnchor={
                  index === 0 ? "start" : index === coordinates.length - 1 ? "end" : "middle"
                }
                x={point.x}
                y={height - 2}
              >
                {formatTrendDate(points[index].date)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatTrendDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00Z`);

  return parsedDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short"
  });
}

function mergePlatformMetricRows(
  currentStats: typeof platformStats,
  rows: MetricRow[]
) {
  return currentStats.map((platform) => ({
    ...platform,
    metrics: platform.metrics.map((metric) => {
      const row = rows
        .filter(
          (candidate) =>
            getSingle(candidate.platforms)?.slug === platform.slug &&
            candidate.metric_name === metric.metricName
        )
        .sort(compareMetricRows)[0];

      if (!row) {
        return metric;
      }

      const context = getMetricDisplayContext(platform.slug, metric.metricName, row, metric.context);
      const dailyDelta = getPlatformMetricDelta(platform.slug, metric.metricName, row, rows);

      return {
        ...metric,
        value: getMetricDisplayValue(metric.metricName, row),
        context,
        ...(dailyDelta ? { dailyDelta } : {})
      };
    })
  }));
}

const platformMetricDeltaKeys = new Set([
  "instagram:followers",
  "instagram:accounts_reached_30d",
  "instagram:views_30d",
  "youtube:subscribers",
  "youtube:total_channel_views",
  "youtube-music:subscribers",
  "youtube-music:total_plays",
  "apple-music:total_plays",
  "apple-music:total_shazams"
]);

function getPlatformMetricDelta(
  platformSlug: string,
  metricName: string,
  currentRow: MetricRow,
  rows: MetricRow[]
): PlatformMetricDelta | null {
  if (!platformMetricDeltaKeys.has(`${platformSlug}:${metricName}`)) {
    return null;
  }

  const currentValue = Number(currentRow.metric_value);

  if (!Number.isFinite(currentValue)) {
    return null;
  }

  const previousRow = rows
    .filter(
      (candidate) =>
        getSingle(candidate.platforms)?.slug === platformSlug &&
        candidate.metric_name === metricName &&
        candidate.snapshot_date < currentRow.snapshot_date &&
        Number.isFinite(Number(candidate.metric_value))
    )
    .sort(compareMetricRows)[0];

  if (!previousRow) {
    return null;
  }

  const delta = currentValue - Number(previousRow.metric_value);

  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    value: delta
  };
}

function getMetricDisplayContext(
  platformSlug: string,
  metricName: string,
  row: MetricRow,
  fallbackContext?: string
) {
  if (
    platformSlug === "apple-music" &&
    (metricName === "last_update_date" ||
      metricName === "total_plays" ||
      metricName === "total_shazams")
  ) {
    return undefined;
  }

  return (
    row.notes ??
    getSingle(row.content_posts)?.title ??
    getSingle(row.releases)?.title ??
    fallbackContext
  );
}

function getMetricDisplayValue(metricName: string, row: MetricRow) {
  if (metricName === "last_update_date" || metricName === "current_release_name") {
    return row.notes ?? "";
  }

  return formatMetricValue(row.metric_value);
}

function parseAppleMusicCsvFile(fileName: string, csvText: string) {
  const [reportStartDate, reportEndDate] = parseAppleMusicCsvDates(fileName);
  const [headerRow, ...dataRows] = parseCsv(csvText.trim());

  if (!headerRow) {
    throw new Error("Apple Music CSV is empty.");
  }

  const headerMap = new Map(
    headerRow.map((header, index) => [normalizeCsvHeader(header), index])
  );
  const rows = dataRows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => ({
      avgDailyListeners: readCsvNumber(row, headerMap, "avg daily listeners"),
      plays: readCsvNumber(row, headerMap, "plays"),
      purchases: readCsvNumber(row, headerMap, "purchases"),
      radioSpins: readCsvNumber(row, headerMap, "radio spins"),
      shazams: readCsvNumber(row, headerMap, "shazam count"),
      song: readCsvText(row, headerMap, "song")
    }));

  if (rows.length === 0) {
    throw new Error("Apple Music CSV has no song rows.");
  }

  return {
    reportEndDate,
    reportStartDate,
    rows
  };
}

function parseAppleMusicCsvDates(fileName: string) {
  const matches = Array.from(fileName.matchAll(/\d{4}-\d{2}-\d{2}/g)).map(
    (match) => match[0]
  );

  if (matches.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return [today, today];
  }

  return [matches[0], matches[matches.length - 1]];
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"" && nextChar === "\"") {
      currentCell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows;
}

function readCsvText(row: string[], headerMap: Map<string, number>, header: string) {
  const index = headerMap.get(header);

  if (index === undefined) {
    throw new Error(`Apple Music CSV is missing "${header}".`);
  }

  return row[index]?.trim() ?? "";
}

function readCsvNumber(row: string[], headerMap: Map<string, number>, header: string) {
  const value = readCsvText(row, headerMap, header);
  return Number(value.replaceAll(",", "")) || 0;
}

function normalizeCsvHeader(header: string) {
  return header.trim().replaceAll(".", "").toLowerCase();
}

function formatDateForDisplay(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateWithDots(date: string) {
  if (date.includes("/")) {
    const [day, month, year] = date.split("/");
    return `${day}.${month}.${year}`;
  }

  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function compareMetricRows(first: MetricRow, second: MetricRow) {
  const snapshotDiff =
    Date.parse(second.snapshot_date) - Date.parse(first.snapshot_date);

  if (snapshotDiff !== 0) {
    return snapshotDiff;
  }

  const sourceDiff = getMetricSourcePriority(second) - getMetricSourcePriority(first);

  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return Date.parse(second.imported_at) - Date.parse(first.imported_at);
}

function getMetricSourcePriority(row: MetricRow) {
  return row.source?.includes("manual") ? 0 : 1;
}

function getDashboardPlatformStats(stats: typeof platformStats) {
  const dashboardOrder = [
    "instagram",
    "youtube",
    "spotify",
    "youtube-music",
    "apple-music"
  ];

  return dashboardOrder
    .map((slug) => stats.find((platform) => platform.slug === slug))
    .filter((platform): platform is (typeof platformStats)[number] => Boolean(platform));
}

function getPlatformMetric(stats: typeof platformStats, platformSlug: string, metricName: string) {
  return stats
    .find((platform) => platform.slug === platformSlug)
    ?.metrics.find((metric) => metric.metricName === metricName);
}

function getPlatformsViewStats(stats: typeof platformStats) {
  const platformOrder = [
    "instagram",
    "youtube",
    "youtube-music",
    "spotify",
    "apple-music",
    "deezer",
    "amazon-music"
  ];

  return [
    ...platformOrder
      .map((slug) => stats.find((platform) => platform.slug === slug))
      .filter((platform): platform is (typeof platformStats)[number] => Boolean(platform)),
    platformPlaceholder
  ];
}

function getSingle<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMetricValue(value: number | string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  if (numericValue >= 1_000_000) {
    return `${trimMetricDecimal(numericValue / 1_000_000)}M`;
  }

  if (numericValue >= 1_000) {
    return `${trimMetricDecimal(numericValue / 1_000)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(numericValue);
}

function trimMetricDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function getPlaceholderStatus(index: number, offset: number): MarketingStatus {
  const statusCycle: MarketingStatus[] = ["done", "in-progress", "not-started"];
  return statusCycle[Math.min(Math.floor((index + offset) / 3), 2)];
}

function getPlaceholderExtraTasks(dayNumber: number): ExtraCampaignTask[] {
  if (dayNumber === 3) {
    return [
      {
        id: "day-3-extra-1",
        title: "Prepare alternate hook",
        status: "in-progress"
      }
    ];
  }

  if (dayNumber === 14) {
    return [
      {
        id: "day-14-extra-1",
        title: "Reply to comments and pin best one",
        status: "not-started"
      }
    ];
  }

  return [];
}

function parseCampaignDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const parsedDate = new Date(
    Date.UTC(fullYear, Number(month) - 1, Number(day))
  );

  if (
    parsedDate.getUTCFullYear() !== fullYear ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return parsedDate;
}

function parseCampaignDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return parsedDate;
}

function formatDateKeyForInput(dateKey: string) {
  const date = parseCampaignDateKey(dateKey);

  if (!date) {
    return "";
  }

  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear()
  ].join("/");
}

function formatInputDateForDatabase(value: string) {
  const date = parseCampaignDate(value);

  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatCampaignDateKey(dateKey: string) {
  const date = parseCampaignDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  return formatCampaignDate(date);
}

function formatCampaignDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function getDaysToRelease(releaseDate: Date) {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const releaseUtc = Date.UTC(
    releaseDate.getUTCFullYear(),
    releaseDate.getUTCMonth(),
    releaseDate.getUTCDate()
  );

  return Math.ceil((releaseUtc - todayUtc) / 86_400_000);
}

function formatDaysToRelease(days: number | null) {
  if (days === null) {
    return "Invalid date";
  }

  if (days === 0) {
    return "Release today";
  }

  if (days > 0) {
    return `${days} days before release`;
  }

  return `${Math.abs(days)} days after release`;
}

function formatDaysToProductionDeadline(days: number | null) {
  if (days === null) {
    return "Invalid date";
  }

  if (days === 0) {
    return "Due today";
  }

  if (days > 0) {
    return `${days} days before deadline`;
  }

  return `${Math.abs(days)} days after deadline`;
}

function shiftProductionStepDeadlines(
  steps: ProductionStep[],
  nextProductionDeadline: Date
) {
  const defaultSteps = steps.filter((step) => step.isDefaultStep);
  const extraSteps = steps.filter((step) => !step.isDefaultStep);
  const shiftedDefaultSteps = defaultSteps.map((step) => {
    const template = defaultProductionStepTemplates.find(
      (candidate) => candidate.label === step.label
    );

    if (!template) {
      return step;
    }

    return {
      ...step,
      deadline: formatDateForInput(addUtcDays(nextProductionDeadline, template.offset))
    };
  });

  return sortProductionStepsByDeadline([...shiftedDefaultSteps, ...extraSteps]);
}

function calculateProductionCompletion(steps: ProductionStep[]) {
  const statuses = steps.flatMap((step) => [
    step.status,
    ...step.extraTasks.map((task) => task.status)
  ]);
  const doneCount = statuses.filter((status) => status === "done").length;

  return Math.round((doneCount / statuses.length) * 100);
}

function getNextProductionTasks(steps: ProductionStep[]): CampaignTaskItem[] {
  return sortProductionStepsByDeadline(steps).flatMap((step) => {
    const tasks: CampaignTaskItem[] = [];

    if (step.status !== "done") {
      tasks.push({
        id: `${step.id}-main`,
        label: getProductionStepTaskLabel(step),
        status: step.status
      });
    }

    return [
      ...tasks,
      ...step.extraTasks
        .filter((task) => task.status !== "done")
        .map((task) => ({
          id: `${step.id}-${task.id}`,
          label: `${formatProductionStepDate(step.deadline)}: ${task.title}`,
          status: task.status
        }))
    ];
  });
}

function getProductionTaskList(steps: ProductionStep[]): CampaignTaskItem[] {
  return sortProductionStepsByDeadline(steps).flatMap((step) => [
    {
      id: `${step.id}-main`,
      label: getProductionStepTaskLabel(step),
      status: step.status
    },
    ...step.extraTasks.map((task) => ({
      id: `${step.id}-${task.id}`,
      label: `${formatProductionStepDate(step.deadline)}: ${task.title}`,
      status: task.status
    }))
  ]);
}

function getProductionStepTaskLabel(step: ProductionStep) {
  const cleanNotes = step.notes.trim();
  const stepLabel = `${formatProductionStepDate(step.deadline)} - ${step.label}`;

  return cleanNotes ? `${stepLabel} - ${cleanNotes}` : stepLabel;
}

function getProductionStepProgressStatus(step: ProductionStep): CampaignDayProgressStatus {
  const statuses = [
    step.status,
    ...step.extraTasks.map((task) => task.status)
  ];
  const doneCount = statuses.filter((status) => status === "done").length;

  if (doneCount === statuses.length) {
    return "complete";
  }

  if (doneCount === 0) {
    return "empty";
  }

  return "partial";
}

function formatProductionStepDate(value: string) {
  const date = parseCampaignDate(value);

  if (!date) {
    return value;
  }

  return formatCampaignDate(date);
}

function isRelevantMarketingStatus(status: MarketingStatus) {
  return status !== "irrelevant";
}

function isUnfinishedRelevantStatus(status: MarketingStatus) {
  return status !== "done" && isRelevantMarketingStatus(status);
}

function hasReleaseDayDefaultTasks(day: CampaignDay) {
  return (
    day.releaseOffset === 0 &&
    [
      day.statuses.websiteUpdate,
      day.statuses.facebookPost,
      day.statuses.youtubePost
    ].some(isRelevantMarketingStatus)
  );
}

function calculateCampaignCompletion(days: CampaignDay[]) {
  const statuses = days
    .flatMap((day) => [
      ...Object.values(day.statuses),
      ...day.extraTasks.map((task) => task.status)
    ])
    .filter(isRelevantMarketingStatus);
  const doneCount = statuses.filter((status) => status === "done").length;

  if (statuses.length === 0) {
    return 100;
  }

  return Math.round((doneCount / statuses.length) * 100);
}

function getNextCampaignTasks(days: CampaignDay[]): CampaignTaskItem[] {
  return days
    .flatMap((day) => {
      const tasks: CampaignTaskItem[] = [];

      if (isUnfinishedRelevantStatus(day.statuses.production)) {
        tasks.push({
          id: `${day.dayNumber}-production`,
          label: `${day.date} - ${day.clipName} - Make video / post`,
          status: day.statuses.production
        });
      } else {
        if (isUnfinishedRelevantStatus(day.statuses.instagramUpload)) {
          tasks.push({
            id: `${day.dayNumber}-instagram`,
            label: `${day.date} - ${day.clipName} - IG Upload`,
            status: day.statuses.instagramUpload
          });
        }

        if (isUnfinishedRelevantStatus(day.statuses.youtubeUpload)) {
          tasks.push({
            id: `${day.dayNumber}-youtube`,
            label: `${day.date} - ${day.clipName} - YT upload`,
            status: day.statuses.youtubeUpload
          });
        }
      }

      if (hasReleaseDayDefaultTasks(day)) {
        [
          {
            id: `${day.dayNumber}-website-update`,
            label: `${day.date} - Update website`,
            status: day.statuses.websiteUpdate
          },
          {
            id: `${day.dayNumber}-facebook-post`,
            label: `${day.date} - Facebook post`,
            status: day.statuses.facebookPost
          },
          {
            id: `${day.dayNumber}-youtube-post`,
            label: `${day.date} - YouTube post`,
            status: day.statuses.youtubePost
          }
        ]
          .filter((task) => isUnfinishedRelevantStatus(task.status))
          .forEach((task) => tasks.push(task));
      }

      return [
        ...tasks,
        ...day.extraTasks
          .filter((task) => isUnfinishedRelevantStatus(task.status))
          .map((task) => ({
            id: `${day.dayNumber}-${task.id}`,
            label: `${day.date}: ${task.title}`,
            status: task.status
          }))
      ];
    });
}

function getCampaignDayStatus(day: CampaignDay): CampaignDayProgressStatus {
  const statuses = [
    ...Object.values(day.statuses),
    ...day.extraTasks.map((task) => task.status)
  ].filter(isRelevantMarketingStatus);
  const doneCount = statuses.filter((status) => status === "done").length;

  if (statuses.length === 0) {
    return "complete";
  }

  if (doneCount === statuses.length) {
    return "complete";
  }

  if (doneCount === 0) {
    return "empty";
  }

  return "partial";
}

function getActiveCampaignDayNumber(days: CampaignDay[]) {
  if (days.length === 0) {
    return null;
  }

  const today = new Date();
  const todayKey = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  )
    .toISOString()
    .slice(0, 10);
  const matchingDay = days.find((day) => day.dateKey === todayKey);

  if (matchingDay) {
    return matchingDay.dayNumber;
  }

  return null;
}

function formatReleaseOffset(offset: number) {
  if (offset === 0) {
    return "Release day";
  }

  return offset < 0 ? `${Math.abs(offset)} days before` : `${offset} days after`;
}

function PlatformStatsSection({
  description,
  hideHeading = false,
  platforms,
  renderCardAddon,
  renderCardHeaderMeta,
  title,
  variant
}: {
  description: string;
  hideHeading?: boolean;
  platforms: Array<(typeof platformStats)[number] | typeof platformPlaceholder>;
  renderCardAddon?: (
    platform: (typeof platformStats)[number] | typeof platformPlaceholder
  ) => ReactNode;
  renderCardHeaderMeta?: (
    platform: (typeof platformStats)[number] | typeof platformPlaceholder
  ) => ReactNode;
  title: string;
  variant: "dashboard" | "full";
}) {
  return (
    <section className="platform-section" aria-label={title}>
      {hideHeading ? null : (
        <div className="section-heading">
          <div>
            <p className="eyebrow">Platform statistics</p>
            <h2>{title}</h2>
          </div>
          <p>{description}</p>
        </div>
      )}

      <div className={`platform-grid platform-grid-${variant}`}>
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const cardAddon = renderCardAddon?.(platform) ?? null;
          const cardHeaderMeta = renderCardHeaderMeta?.(platform) ?? null;

          return (
            <article
              className={`platform-card platform-card-${platform.slug}`}
              id={`platform-card-${platform.slug}`}
              key={platform.platform}
            >
              <div className="platform-card-header">
                <div className="platform-card-title">
                  <Icon size={20} aria-hidden />
                  <h3>
                    {"profileUrl" in platform && platform.profileUrl ? (
                      <a
                        href={platform.profileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {platform.platform}
                      </a>
                    ) : (
                      platform.platform
                    )}
                  </h3>
                </div>
                {cardHeaderMeta}
              </div>
              <dl className="platform-metrics">
                {platform.metrics
                  .filter(
                    (metric) =>
                      !(
                        platform.slug === "apple-music" &&
                        metric.metricName === "last_update_date"
                      )
                  )
                  .map((metric) => {
                    const dailyDelta = (metric as { dailyDelta?: PlatformMetricDelta })
                      .dailyDelta;

                    return (
                      <div
                        className={
                          metric.metricName === "last_update_date"
                            ? "platform-metric-row platform-metric-row-inline"
                            : "platform-metric-row"
                        }
                        key={`${platform.platform}-${metric.label}`}
                      >
                        <dt>
                          {metric.label}
                          {metric.context ? <span>{metric.context}</span> : null}
                        </dt>
                        <dd>
                          {metric.value}
                          {dailyDelta ? (
                            <span
                              className={`platform-metric-delta platform-metric-delta-${dailyDelta.direction}`}
                            >
                              ({dailyDelta.value > 0 ? "+" : ""}
                              {formatMetricValue(dailyDelta.value)})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    );
                  })}
              </dl>
              {cardAddon}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoadmapView() {
  const releasedSongs = roadmapPhases.reduce(
    (sum, phase) => sum + phase.releasedCount,
    0
  );
  const totalTargetSongs = roadmapPhases.reduce(
    (sum, phase) => sum + phase.targetCount,
    0
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-title-block">
          <p className="eyebrow">Strategic overview</p>
          <h1>Roadmap</h1>
        </div>
        <ModuleHeaderDate />
      </header>

      <section className="roadmap-overview panel" aria-label="General roadmap progress">
        <div className="roadmap-overview-header">
          <div>
            <p className="eyebrow">General Roadmap Progress</p>
            <h2>{releasedSongs} / {totalTargetSongs}+ releases</h2>
          </div>
          <span>Apr 2026 - 2028+</span>
        </div>

        <RoadmapMonthStrip months={roadmapMonths} />
        <RoadmapLegend includePartial />
      </section>

      <section className="roadmap-phase-grid" aria-label="Roadmap phases">
        {roadmapPhases.map((phase) => (
          <article
            className={`roadmap-phase-card roadmap-phase-${phase.accent}`}
            key={phase.id}
          >
            <div className="roadmap-phase-heading">
              <div>
                <p className="eyebrow">Phase {phase.phaseNumber}</p>
                <h2>{phase.title}</h2>
              </div>
              <span>{phase.period}</span>
            </div>

            <div className="roadmap-phase-counts">
              <strong>
                {phase.releasedCount} / {phase.targetCount}
              </strong>
              <span>
                {phase.releasedCount} released
                {phase.activeCount ? `, ${phase.activeCount} active` : ""}
              </span>
            </div>

            <RoadmapReleaseStrip phase={phase} />

            <p>{phase.summary}</p>

            <ul className="roadmap-milestones">
              {phase.milestones.map((milestone) => (
                <li key={milestone}>{milestone}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}

function RoadmapMonthStrip({ months }: { months: RoadmapMonth[] }) {
  return (
    <div className="roadmap-month-strip">
      {months.map((month) => {
        const status = getRoadmapMonthStatus(month);

        return (
          <div
            aria-label={`${month.label}: ${month.released} of ${month.planned} planned releases`}
            className={`roadmap-month-box roadmap-box-${status} roadmap-month-phase-${month.phase}`}
            key={month.id}
            title={`${month.label}: ${month.released}/${month.planned}`}
          >
            <span>{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RoadmapReleaseStrip({ phase }: { phase: RoadmapPhase }) {
  return (
    <div className="roadmap-release-strip">
      {Array.from({ length: phase.targetCount }, (_, index) => {
        const status = getRoadmapReleaseStatus(index, phase);

        return (
          <span
            aria-label={`Phase ${phase.phaseNumber} release ${index + 1}: ${status}`}
            className={`roadmap-release-box roadmap-box-${status}`}
            key={`${phase.id}-${index}`}
            title={`Release ${index + 1}: ${status}`}
          />
        );
      })}
    </div>
  );
}

function RoadmapLegend({ includePartial = false }: { includePartial?: boolean }) {
  return (
    <div className="roadmap-legend">
      <span><i className="roadmap-box-done" /> Released</span>
      <span><i className="roadmap-box-active" /> Active</span>
      {includePartial ? <span><i className="roadmap-box-partial" /> Partial month</span> : null}
      <span><i className="roadmap-box-planned" /> Planned</span>
    </div>
  );
}

function getRoadmapMonthStatus(month: RoadmapMonth): RoadmapBoxStatus {
  if (month.released > 0 && month.released >= month.planned) {
    return "done";
  }

  if (month.released > 0) {
    return "partial";
  }

  return "planned";
}

function getRoadmapReleaseStatus(
  releaseIndex: number,
  phase: RoadmapPhase
): RoadmapBoxStatus {
  if (releaseIndex < phase.releasedCount) {
    return "done";
  }

  if (releaseIndex < phase.releasedCount + phase.activeCount) {
    return "active";
  }

  return "planned";
}
