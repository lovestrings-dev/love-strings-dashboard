"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
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
type MarketingStatus = "not-started" | "in-progress" | "done";
type CampaignDayProgressStatus = "empty" | "partial" | "complete";
type ProductionBudgetLine = {
  id: string;
  amount: number;
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
type FocusQueueItem = CampaignTaskItem & {
  source: "Marketing" | "Production" | "Other";
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
type BudgetRecurringCadence = "monthly" | "yearly";
type BudgetEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: BudgetEntryType;
  recurringCadence?: BudgetRecurringCadence;
  paymentPlanEndDate?: string;
  generated?: boolean;
  sourceRecurringEntryId?: string;
  sourceEventEntryId?: string;
  sourceProductionItemId?: string;
};
type EventEntry = {
  id: string;
  date: string;
  name: string;
  nameUrl: string;
  locationName: string;
  locationUrl: string;
  address: string;
  addressUrl: string;
  earnedAmount?: number;
  earnedDescription?: string;
  spentAmount?: number;
  spentDescription?: string;
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
type RefreshStatus = {
  message: string;
  state: "error" | "idle" | "loading" | "success";
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
  task_kind: "production" | "instagram_upload" | "youtube_upload" | "extra";
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

const platformStats = [
  {
    platform: "Instagram",
    slug: "instagram",
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
    icon: Video,
    dashboard: true,
    metrics: [
      { label: "Subscribers", metricName: "subscribers", value: "39" },
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

const appVersionLabel = "Beta 1.2";

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

const statusLabels: Record<MarketingStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  done: "Done"
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
        description: "License",
        id: "default-license-budget"
      }
    ];
  }

  if (stepLabel === "Distributor") {
    return [
      {
        amount: -10,
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

function sortBudgetEntriesByDate(entries: BudgetEntry[]) {
  return [...entries].sort(
    (firstEntry, secondEntry) =>
      getBudgetDateSortTime(secondEntry.date) - getBudgetDateSortTime(firstEntry.date)
  );
}

function sortEventEntriesByDate(entries: EventEntry[]) {
  return [...entries].sort(
    (firstEntry, secondEntry) =>
      getBudgetDateSortTime(secondEntry.date) - getBudgetDateSortTime(firstEntry.date)
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

  return {
    balance,
    potentialEarn,
    upcomingSpend,
    totalEarned,
    totalSpent,
    upcomingBalance
  };
}

function getBudgetEntriesWithForecast(
  entries: BudgetEntry[],
  events: EventEntry[],
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
        !deletedIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry))
    )
  );
  const productionEntries = productionSongs.flatMap((song) =>
    generateProductionBudgetEntries(song).filter(
      (generatedEntry) =>
        isBudgetEntryInProjectionWindow(generatedEntry) &&
        !existingIds.has(generatedEntry.id) &&
        !deletedIds.has(generatedEntry.id) &&
        !existingFingerprints.has(getBudgetEntryFingerprint(generatedEntry)) &&
        !existingDateAmountFingerprints.has(
          getBudgetEntryDateAmountFingerprint(generatedEntry)
        )
    )
  );

  return sortBudgetEntriesByDate([
    ...entries,
    ...recurringEntries,
    ...eventEntries,
    ...productionEntries
  ]);
}

function isBudgetEntryInProjectionWindow(entry: BudgetEntry) {
  const entryDate = parseFlexibleBudgetDate(entry.date);
  const today = getTodayUtcDate();
  const oneMonthAhead = addMonthsToDate(today, 1);

  return (
    entryDate !== null &&
    entryDate.getTime() > today.getTime() &&
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
  const generatedEntries: BudgetEntry[] = [];

  if (event.earnedAmount && event.earnedAmount > 0) {
    generatedEntries.push({
      amount: Math.abs(event.earnedAmount),
      date: event.date,
      description: getEventBudgetDescription(
        event.name,
        "earned",
        event.earnedDescription
      ),
      generated: true,
      id: getBudgetEventGeneratedEntryId(event.id, "earned", event.earnedAmount),
      sourceEventEntryId: event.id,
      type: "one-off"
    });
  }

  if (event.spentAmount && event.spentAmount > 0) {
    generatedEntries.push({
      amount: -Math.abs(event.spentAmount),
      date: event.date,
      description: getEventBudgetDescription(
        event.name,
        "spent",
        event.spentDescription
      ),
      generated: true,
      id: getBudgetEventGeneratedEntryId(event.id, "spent", event.spentAmount),
      sourceEventEntryId: event.id,
      type: "one-off"
    });
  }

  return generatedEntries;
}

function generateProductionBudgetEntries(song: ProductionSongConfig) {
  return song.steps.flatMap((step) => {
    const stepEntries = generateProductionBudgetLineEntries({
      budgetLines: step.budgetLines ?? [],
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
  moneyType: "earned" | "spent",
  amount: number
) {
  return `budget-event-${eventId}-${moneyType}-${Math.abs(amount).toFixed(2)}`;
}

function getEventBudgetDescription(
  eventName: string,
  moneyType: "earned" | "spent",
  description?: string
) {
  const cleanDescription = description?.trim();

  if (!cleanDescription) {
    return `${eventName} ${moneyType}`;
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

function parseEditableAmount(value: string) {
  const normalizedValue = value.trim();

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
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
    sortedCampaigns
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

function getDashboardFocusQueue(
  campaignPreview: ReturnType<typeof getDashboardCampaignPreview>,
  productionPreviewSongs: ProductionSongConfig[]
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
  const primaryMarketingTask = marketingTasks[0]
    ? toFocusQueueItem(marketingTasks[0], "Marketing")
    : null;
  const primaryProductionTask = productionTasks[0]
    ? toFocusQueueItem(productionTasks[0], "Production")
    : null;
  const otherTask =
    [...marketingTasks.slice(1), ...productionTasks.slice(1)]
      .sort((firstTask, secondTask) =>
        getTaskDateSortTime(firstTask.label) - getTaskDateSortTime(secondTask.label)
      )
      .map((task) => toFocusQueueItem(task, "Other"))[0] ?? null;

  return {
    allTasks: [
      ...marketingTasks.map((task) => toFocusQueueItem(task, "Marketing")),
      ...productionTasks.map((task) => toFocusQueueItem(task, "Production")),
      ...(otherTask ? [otherTask] : [])
    ],
    visibleTasks: [primaryMarketingTask, primaryProductionTask, otherTask].filter(
      (task): task is FocusQueueItem => Boolean(task)
    )
  };
}

function toFocusQueueItem(
  task: CampaignTaskItem,
  source: FocusQueueItem["source"]
): FocusQueueItem {
  return {
    ...task,
    id: `${source.toLowerCase()}-${task.id}`,
    source
  };
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
      campaignDays: mapMarketingCampaignDayRows(campaign.marketing_campaign_days ?? [])
    }))
  );
}

function mapMarketingCampaignDayRows(rows: MarketingCampaignDayDbRow[]) {
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
    const supabase = createBrowserSupabaseClient();
    const { error: deleteError } = await supabase
      .from("marketing_campaign_days")
      .delete()
      .eq("campaign_id", campaign.dbId);

    if (deleteError) {
      throw deleteError;
    }

    if (campaignDays.length === 0) {
      return;
    }

    const { data: savedDays, error: dayInsertError } = await supabase
      .from("marketing_campaign_days")
      .insert(
        campaignDays.map((day) => ({
          campaign_id: campaign.dbId,
          day_number: day.dayNumber,
          campaign_date: day.dateKey,
          release_offset: day.releaseOffset,
          clip_name: day.clipName,
          is_default_day: day.isDefaultDay
        }))
      )
      .select("id, day_number");

    if (dayInsertError) {
      throw dayInsertError;
    }

    const dayIdByNumber = new Map(
      (savedDays ?? []).map((day) => [day.day_number, day.id])
    );
    const taskRows = campaignDays.flatMap((day) => {
      const campaignDayId = dayIdByNumber.get(day.dayNumber);

      if (!campaignDayId) {
        return [];
      }

      return [
        {
          campaign_day_id: campaignDayId,
          task_kind: "production",
          title: "Make video / post",
          status: day.statuses.production,
          position: 1,
          is_standard_task: true
        },
        {
          campaign_day_id: campaignDayId,
          task_kind: "instagram_upload",
          title: "IG Upload",
          status: day.statuses.instagramUpload,
          position: 2,
          is_standard_task: true
        },
        {
          campaign_day_id: campaignDayId,
          task_kind: "youtube_upload",
          title: "YT upload",
          status: day.statuses.youtubeUpload,
          position: 3,
          is_standard_task: true
        },
        ...day.extraTasks.map((task, index) => ({
          campaign_day_id: campaignDayId,
          task_kind: "extra",
          title: task.title,
          status: task.status,
          position: index + 4,
          is_standard_task: false
        }))
      ];
    });

    if (taskRows.length === 0) {
      return;
    }

    const { error: taskInsertError } = await supabase
      .from("marketing_campaign_tasks")
      .insert(taskRows);

    if (taskInsertError) {
      throw taskInsertError;
    }
  } catch (error) {
    console.warn("Unable to save marketing campaign days.", error);
  }
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
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
    sortEventEntriesByDate(eventEntries)
  );
  const [hasLoadedCampaignDrafts, setHasLoadedCampaignDrafts] = useState(false);
  const [hasLoadedProductionDrafts, setHasLoadedProductionDrafts] =
    useState(false);
  const [hasLoadedBudgetDrafts, setHasLoadedBudgetDrafts] = useState(false);
  const [hasLoadedEventDrafts, setHasLoadedEventDrafts] = useState(false);
  const dashboardPlatformStats = getDashboardPlatformStats(platformStatsData);
  const budgetEntriesWithForecast = getBudgetEntriesWithForecast(
    budgetEntryDrafts,
    eventEntryDrafts,
    productionSongDrafts,
    deletedBudgetForecastIds
  );

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
        return;
      }

      setPlatformMetricRows((data ?? []) as MetricRow[]);
      setPlatformStatsData((currentStats) =>
        mergePlatformMetricRows(currentStats, (data ?? []) as MetricRow[])
      );
    } catch (error) {
      console.warn("Using local platform metric fallback.", error);
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

    const payload: { album_art_url?: string; release_date?: string; title?: string } = {};

    if (updates.releaseDate) {
      const releaseDate = formatInputDateForDatabase(updates.releaseDate);

      if (releaseDate) {
        payload.release_date = releaseDate;
      }
    }

    if (updates.releaseTitle) {
      payload.title = updates.releaseTitle;
    }

    if (updates.albumArtUrl !== undefined) {
      payload.album_art_url = updates.albumArtUrl;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from("marketing_campaigns")
        .update(payload)
        .eq("id", campaign.dbId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn("Unable to save marketing campaign header.", error);
    }
  }

  async function deleteMarketingCampaign(campaignDbId: string) {
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from("marketing_campaigns")
        .delete()
        .eq("id", campaignDbId);

      if (error) {
        throw error;
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
      campaignDays: buildCampaignDays(newMarketingCampaign.releaseDate)
    };

    setCampaigns((currentCampaigns) =>
      sortCampaignsByReleaseDate([...currentCampaigns, localCampaign])
    );

    try {
      const supabase = createBrowserSupabaseClient();
      const slug = createCampaignSlug(localCampaign.releaseTitle);
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .insert({
          slug,
          title: localCampaign.releaseTitle,
          release_date: releaseDate.toISOString().slice(0, 10),
          album_art_url: localCampaign.albumArtUrl,
          status: "planned",
          source: "app"
        })
        .select("id, slug")
        .single();

      if (error) {
        throw error;
      }

      const savedCampaign = {
        ...localCampaign,
        id: data.slug,
        dbId: data.id
      };

      setCampaigns((currentCampaigns) =>
        sortCampaignsByReleaseDate(
          currentCampaigns.map((campaign) =>
            campaign.id === localCampaign.id ? savedCampaign : campaign
          )
        )
      );
      await saveMarketingCampaignDays(savedCampaign, savedCampaign.campaignDays ?? []);
    } catch (error) {
      console.warn("Unable to create marketing campaign in Supabase.", error);
    }
  }

  function updateCampaignReleaseDate(campaignId: string, releaseDate: string) {
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
      const campaign = campaigns.find((candidate) => candidate.id === campaignId);

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
    const newDeadline = addUtcDays(getTodayUtcDate(), 28);
    const localSong = createProductionSongSeed({
      id: `production-song-${newSongNumber}-${Date.now()}`,
      title: `New Song ${newSongNumber}`,
      deadline: formatDateForInput(newDeadline),
      statusPattern: ["not-started"]
    });

    setProductionSongDrafts((currentSongs) =>
      sortProductionSongsByDeadline([...currentSongs, localSong])
    );
  }

  function updateProductionSong(songId: string, updates: Partial<ProductionSongConfig>) {
    setProductionSongDrafts((currentSongs) =>
      sortProductionSongsByDeadline(
        currentSongs.map((song) =>
          song.id === songId
            ? {
                ...song,
                ...updates,
                steps: updates.steps
                  ? sortProductionStepsByDeadline(updates.steps)
                  : song.steps
              }
            : song
        )
      )
    );
  }

  function deleteProductionSong(songId: string) {
    setProductionSongDrafts((currentSongs) =>
      currentSongs.filter((song) => song.id !== songId)
    );
  }

  function addBudgetEntry() {
    setBudgetEntryDrafts((currentEntries) =>
      sortBudgetEntriesByDate([
        {
          id: `budget-entry-${Date.now()}`,
          amount: 0,
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
    if (
      entryId.startsWith("budget-forecast-") ||
      entryId.startsWith("budget-event-") ||
      entryId.startsWith("budget-production-")
    ) {
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
          earnedAmount: 0,
          earnedDescription: "",
          spentAmount: 0,
          spentDescription: ""
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
    let isCancelled = false;

    try {
      const storedEventEntries = window.localStorage.getItem(eventDraftStorageKey);

      if (storedEventEntries) {
        const parsedEntries = JSON.parse(storedEventEntries);

        if (Array.isArray(parsedEntries)) {
          window.setTimeout(() => {
            if (!isCancelled) {
              setEventEntryDrafts(sortEventEntriesByDate(parsedEntries));
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
          setCampaigns(nextCampaigns);
          window.localStorage.setItem(
            campaignDraftStorageKey,
            JSON.stringify(nextCampaigns)
          );
        }
      } catch (error) {
        console.warn("Using local marketing campaign fallback.", error);
      }
    }

    loadMarketingCampaigns();
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      void loadPlatformStats();
    }, 0);
  }, [loadPlatformStats]);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-mark">
          <Music2 size={22} aria-hidden />
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
            onAddCampaign={addCampaign}
            onCampaignDaysChange={updateCampaignDays}
            onDeleteCampaign={deleteCampaign}
            onReleaseDateSave={updateCampaignReleaseDate}
            onTitleSave={updateCampaignTitle}
            productionSongs={productionSongDrafts}
          />
        ) : null}
        {activeSection === "Platforms" ? (
          <PlatformsView
            appleMusicImportStatus={appleMusicImportStatus}
            onAppleMusicCsvImport={importAppleMusicCsv}
            platformMetricRows={platformMetricRows}
            platformStatsData={platformStatsData}
          />
        ) : null}
        {activeSection === "Production" ? (
          <ProductionView
            onAddSong={addProductionSong}
            onDeleteSong={deleteProductionSong}
            onSongChange={updateProductionSong}
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
            onAddEntry={addEventEntry}
            onDeleteEntry={deleteEventEntry}
            onEntryChange={updateEventEntry}
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
            dashboardPlatformStats={dashboardPlatformStats}
            eventEntries={eventEntryDrafts}
            onRefreshPlatformStats={refreshPlatformStats}
            productionSongs={productionSongDrafts}
            refreshStatus={refreshStatus}
          />
        ) : null}
      </section>
    </main>
  );
}

function EventsView({
  entries,
  onAddEntry,
  onDeleteEntry,
  onEntryChange
}: {
  entries: EventEntry[];
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<EventEntry>) => void;
}) {
  const nextEvent = getNextUpcomingEvent(entries);
  const nextEventDate = nextEvent ? parseFlexibleBudgetDate(nextEvent.date) : null;
  const nextEventDaysLeft = nextEventDate ? getDaysUntilDate(nextEventDate) : null;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Shows and appearances</p>
          <h1>Events</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
      </header>

      <section className="events-summary-grid" aria-label="Events summary">
        <article className="metric-card event-summary-card">
          <MapPin size={18} aria-hidden />
          <span>Next event</span>
          <strong>
            {nextEventDate ? formatCampaignDate(nextEventDate) : "No upcoming events planned yet"}
          </strong>
          <p>
            {nextEvent && nextEventDaysLeft !== null
              ? `${nextEvent.locationName || "Location TBD"} - ${formatEventDaysLeft(nextEventDaysLeft)}`
              : "No upcoming events planned yet"}
          </p>
        </article>
        <article className="metric-card event-summary-card">
          <CalendarDays size={18} aria-hidden />
          <span>Total events</span>
          <strong>{entries.length}</strong>
          <p>Seeded from the Love Strings News page.</p>
        </article>
      </section>

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
              onDelete={onDeleteEntry}
              onEntryChange={onEntryChange}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function EventCard({
  entry,
  onDelete,
  onEntryChange
}: {
  entry: EventEntry;
  onDelete: (entryId: string) => void;
  onEntryChange: (entryId: string, updates: Partial<EventEntry>) => void;
}) {
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);

  return (
    <article className="event-card">
      <div className="event-card-header">
        <div className="event-card-main">
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
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { locationName: event.target.value })
              }
              value={entry.locationName}
            />
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
          <label>
            Earned
            <input
              inputMode="decimal"
              onChange={(event) =>
                onEntryChange(entry.id, {
                  earnedAmount: Number(event.target.value) || 0
                })
              }
              value={String(entry.earnedAmount ?? 0)}
            />
          </label>
          <label>
            Earned reason
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { earnedDescription: event.target.value })
              }
              placeholder="Event income reason"
              value={entry.earnedDescription ?? ""}
            />
          </label>
          <label>
            Spent
            <input
              inputMode="decimal"
              onChange={(event) =>
                onEntryChange(entry.id, {
                  spentAmount: Number(event.target.value) || 0
                })
              }
              value={String(entry.spentAmount ?? 0)}
            />
          </label>
          <label>
            Spent reason
            <input
              onChange={(event) =>
                onEntryChange(entry.id, { spentDescription: event.target.value })
              }
              placeholder="Event expense reason"
              value={entry.spentDescription ?? ""}
            />
          </label>
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

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Money tracker</p>
          <h1>Budget</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
      </header>

      <section className="budget-summary-grid" aria-label="Budget summary">
        <article className="metric-card budget-metric-card">
          <span>Total earned</span>
          <strong className="amount-positive">{formatCurrency(summary.totalEarned)}</strong>
          <p>Since start.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Total spent</span>
          <strong className="amount-expense">{formatCurrency(summary.totalSpent)}</strong>
          <p>Since start.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Current Balance</span>
          <strong className={getAmountToneClass(summary.balance)}>
            {formatCurrency(summary.balance)}
          </strong>
          <p>Earned minus spent.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected earn</span>
          <strong>{formatCurrency(summary.potentialEarn)}</strong>
          <p>From tomorrow, one month ahead.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected spend</span>
          <strong>{formatCurrency(summary.upcomingSpend)}</strong>
          <p>From tomorrow, one month ahead.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected balance</span>
          <strong className={getAmountToneClass(summary.upcomingBalance)}>
            {formatCurrency(summary.upcomingBalance)}
          </strong>
          <p>Current balance plus projected earn minus projected spend.</p>
        </article>
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

        <div className="budget-table-wrap">
          <table className="budget-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Amount</th>
                <th scope="col">Type</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <BudgetEntryRow
                  entry={entry}
                  key={entry.id}
                  onDelete={onDeleteEntry}
                  onEntryChange={onEntryChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
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
  const signedAmount = getBudgetSignedAmount(entry);
  const paymentType = getBudgetPaymentType(entry);
  const isAutoRecurringEntry = Boolean(entry.generated && entry.sourceRecurringEntryId);

  return (
    <tr className={entry.generated ? "budget-generated-row" : undefined}>
      <td>
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
      <td>
        <input
          aria-label={`${entry.description} description`}
          disabled={entry.generated}
          onChange={(event) =>
            onEntryChange(entry.id, {
              description: event.target.value
            })
          }
          value={entry.description}
        />
      </td>
      <td>
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
          value={amountInput}
        />
      </td>
      <td>
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
          {entry.generated ? <span className="budget-generated-note">Auto-created</span> : null}
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
      <td>
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
      </td>
    </tr>
  );
}

function ProductionView({
  onAddSong,
  onDeleteSong,
  onSongChange,
  songs
}: {
  onAddSong: () => void;
  onDeleteSong: (songId: string) => void;
  onSongChange: (songId: string, updates: Partial<ProductionSongConfig>) => void;
  songs: ProductionSongConfig[];
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Music production</p>
          <h1>Production</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
      </header>

      <div className="campaign-list">
        {songs.map((song) => (
          <ProductionSongBoard
            key={song.id}
            onChange={onSongChange}
            onDelete={onDeleteSong}
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
  onChange,
  onDelete,
  song
}: {
  onChange: (songId: string, updates: Partial<ProductionSongConfig>) => void;
  onDelete: (songId: string) => void;
  song: ProductionSongConfig;
}) {
  const [songTitle, setSongTitle] = useState(song.title);
  const [songTitleInput, setSongTitleInput] = useState(song.title);
  const [deadlineInput, setDeadlineInput] = useState(song.deadline);
  const [appliedDeadlineInput, setAppliedDeadlineInput] = useState(song.deadline);
  const [albumArtUrl, setAlbumArtUrl] = useState(song.albumArtUrl);
  const [isAlbumArtEditorOpen, setIsAlbumArtEditorOpen] = useState(false);
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

    updateSteps((currentSteps) => [
      ...currentSteps,
      {
        id: `extra-step-${Date.now()}`,
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
    updateSteps((currentSteps) =>
      currentSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              extraTasks: [
                ...step.extraTasks,
                {
                  id: `${step.id}-extra-${step.extraTasks.length + 1}`,
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
    <section className="campaign-board" aria-label={`${songTitle} production plan`}>
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

function ProductionStepRow({
  onAddTask,
  onDeleteStep,
  onDeleteTask,
  onStepChange,
  onTaskChange,
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
  step: ProductionStep;
}) {
  return (
    <tr>
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
      : [{ amount: 0, description: "", id: `${idPrefix}-empty` }];

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
        <div className="production-budget-line" key={line.id}>
          <label>
            <span>Budget</span>
            <input
              aria-label="Production budget description"
              onChange={(event) =>
                updateBudgetLine(line.id, { description: event.target.value })
              }
              placeholder="Budget reason"
              value={line.description}
            />
          </label>
          <label>
            <span>Amount</span>
            <ProductionBudgetAmountInput
              amount={line.amount}
              onChange={(amount) => updateBudgetLine(line.id, { amount })}
            />
          </label>
          <button
            aria-label={`Delete ${line.description || "production budget line"}`}
            className="delete-campaign-task-button production-budget-delete-button"
            disabled={!budgetLines.some((budgetLine) => budgetLine.id === line.id)}
            onClick={() => deleteBudgetLine(line.id)}
            type="button"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
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
    amount === 0 ? "" : String(amount)
  );

  return (
    <input
      aria-label="Production budget amount"
      className={getTransactionAmountToneClass(amount)}
      inputMode="decimal"
      onBlur={() => {
        const parsedAmount = parseEditableAmount(amountInput);
        setAmountInput(parsedAmount ? String(parsedAmount) : "");
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
      placeholder="-20 or 100"
      value={amountInput}
    />
  );
}

function normalizeProductionBudgetLines(budgetLines: ProductionBudgetLine[]) {
  return budgetLines.filter(
    (line) => line.amount !== 0 || line.description.trim().length > 0
  );
}

function MarketingView({
  campaigns,
  onAddCampaign,
  onCampaignDaysChange,
  onDeleteCampaign,
  onReleaseDateSave,
  onTitleSave,
  productionSongs
}: {
  campaigns: MarketingCampaignConfig[];
  onAddCampaign: (releaseTitle?: string) => void;
  onCampaignDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
  productionSongs: ProductionSongConfig[];
}) {
  const [selectedProductionSongId, setSelectedProductionSongId] = useState(
    productionSongs[0]?.id ?? ""
  );
  const selectedProductionSong =
    productionSongs.find((song) => song.id === selectedProductionSongId) ??
    productionSongs[0] ??
    null;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Campaign execution</p>
          <h1>Marketing</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
      </header>

      <div className="campaign-list">
        {campaigns.map((campaign) => (
          <MarketingCampaignBoard
            campaign={campaign}
            key={campaign.id}
            onDaysChange={onCampaignDaysChange}
            onDelete={onDeleteCampaign}
            onReleaseDateSave={onReleaseDateSave}
            onTitleSave={onTitleSave}
            productionSongs={productionSongs}
          />
        ))}

        <div className="add-campaign-control">
          <select
            aria-label="Choose production song for new campaign"
            disabled={productionSongs.length === 0}
            onChange={(event) => setSelectedProductionSongId(event.target.value)}
            value={selectedProductionSong?.id ?? ""}
          >
            {productionSongs.length > 0 ? (
              productionSongs.map((song) => (
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
  onDaysChange,
  onDelete,
  onReleaseDateSave,
  onTitleSave,
  productionSongs
}: {
  campaign: MarketingCampaignConfig;
  onDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDelete: (campaignId: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
  productionSongs: ProductionSongConfig[];
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
    updateCampaignDaysState((currentDays) =>
      currentDays.map((day) =>
        day.dayNumber === dayNumber
          ? { ...day, statuses: { ...day.statuses, [task]: status } }
          : day
      )
    );
  }

  function addExtraTask(dayNumber: number) {
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

    updateCampaignDaysState((currentDays) => [
      ...currentDays,
      buildCampaignDay(releaseDate, currentDays.length)
    ]);
  }

  function deleteCampaignDay(dayNumber: number) {
    updateCampaignDaysState((currentDays) =>
      currentDays.filter(
        (day) => day.isDefaultDay || day.dayNumber !== dayNumber
      )
    );
  }

  return (
      <section
        className="campaign-board"
        aria-label={`${displayedCampaignTitle} marketing campaign`}
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
            onClick={() => setIsCampaignOpen((current) => !current)}
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
                  <tr key={day.dayNumber}>
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
          status={day.statuses.instagramUpload}
          onChange={(status) =>
            onStatusChange(day.dayNumber, "instagramUpload", status)
          }
        />
        <CampaignTaskStatus
          label="YT upload"
          status={day.statuses.youtubeUpload}
          onChange={(status) =>
            onStatusChange(day.dayNumber, "youtubeUpload", status)
          }
        />
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
  onChange,
  onDelete,
  task
}: {
  budgetIdPrefix?: string;
  dayNumber: number;
  onChange: (
    dayNumber: number,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "budgetLines" | "status" | "title">>
  ) => void;
  onDelete: (dayNumber: number, taskId: string) => void;
  task: ExtraCampaignTask;
}) {
  return (
    <div className="extra-campaign-task">
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
  status
}: {
  label: string;
  onChange: (status: MarketingStatus) => void;
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
        {marketingStatusOptions.map((option) => (
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
  budgetEntries,
  campaigns,
  dashboardPlatformStats,
  eventEntries,
  onRefreshPlatformStats,
  productionSongs,
  refreshStatus
}: {
  budgetEntries: BudgetEntry[];
  campaigns: MarketingCampaignConfig[];
  dashboardPlatformStats: typeof platformStats;
  eventEntries: EventEntry[];
  onRefreshPlatformStats: () => void;
  productionSongs: ProductionSongConfig[];
  refreshStatus: RefreshStatus;
}) {
  const campaignPreview = getDashboardCampaignPreview(campaigns);
  const budgetSummary = getBudgetSummary(budgetEntries);
  const nextEvent = getNextUpcomingEvent(eventEntries);
  const productionPreviewSongs = productionSongs.slice(0, 2);
  const focusQueue = getDashboardFocusQueue(campaignPreview, productionPreviewSongs);
  const phaseOne = roadmapPhases[0];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Daily command screen</p>
          <h1>Love Strings Dashboard</h1>
        </div>
        <div className="dashboard-refresh-control">
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

      <DashboardNextEventCard event={nextEvent} />

      <DashboardFocusQueueCard focusQueue={focusQueue} />

      <PlatformStatsSection
        platforms={dashboardPlatformStats}
        title="Platform Snapshot"
        description="Key audience and consumption signals from the main platforms."
        variant="dashboard"
      />

      <DashboardCampaignPreview
        preview={campaignPreview}
        productionSongs={productionSongs}
      />

      <DashboardProductionPreview songs={productionPreviewSongs} />

      <DashboardBudgetPreview summary={budgetSummary} />

      <DashboardRoadmapPhasePreview phase={phaseOne} />
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h2>Now & Next</h2>
        </div>
      </div>
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
      <article className="dashboard-campaign-card dashboard-campaign-card-empty">
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

  return (
    <article
      className={
        showTasks
          ? "dashboard-campaign-card"
          : "dashboard-campaign-card dashboard-campaign-card-compact"
      }
    >
      <div className="dashboard-campaign-card-header">
        <div>
          <p className="eyebrow">{label}</p>
          <h3>{displayedCampaignTitle}</h3>
        </div>
        {showDate ? (
          <div className="dashboard-campaign-date">
            <strong>{formatDaysToRelease(releaseDate ? getDaysToRelease(releaseDate) : null)}</strong>
            {releaseDate ? <span>{formatCampaignDate(releaseDate)}</span> : null}
          </div>
        ) : null}
      </div>

      <CampaignProgressStrip
        completion={calculateCampaignCompletion(days)}
        days={days}
      />
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

function DashboardNextEventCard({ event }: { event: EventEntry | null }) {
  const eventDate = event ? parseFlexibleBudgetDate(event.date) : null;
  const daysLeft = eventDate ? getDaysUntilDate(eventDate) : null;

  return (
    <section className="dashboard-latest-event" aria-label="Next event">
      <article className="metric-card event-summary-card dashboard-event-card">
        <MapPin size={18} aria-hidden />
        <span>Next event</span>
        <strong>
          {eventDate ? formatCampaignDate(eventDate) : "No upcoming events planned yet"}
        </strong>
        <p>
          {event && daysLeft !== null ? (
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
          ) : (
            "No upcoming events planned yet"
          )}
        </p>
      </article>
    </section>
  );
}

function DashboardFocusQueueCard({
  focusQueue
}: {
  focusQueue: {
    allTasks: FocusQueueItem[];
    visibleTasks: FocusQueueItem[];
  };
}) {
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const tasks = isTaskListOpen ? focusQueue.allTasks : focusQueue.visibleTasks;
  const hiddenTaskCount = focusQueue.allTasks.length - focusQueue.visibleTasks.length;

  return (
    <section className="dashboard-focus" aria-label="Today focus queue">
      <article className="dashboard-focus-card">
        <div className="dashboard-focus-card-header">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Focus Queue</h2>
          </div>
          <Clock3 size={18} aria-hidden />
        </div>
        {tasks.length > 0 ? (
          <ul className="dashboard-focus-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <span className="dashboard-focus-source">{task.source}</span>
                <StatusDot status={task.status} label={statusLabels[task.status]} />
                <span>{task.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-focus-empty">
            No focus tasks are scheduled yet.
          </p>
        )}
        {focusQueue.allTasks.length > focusQueue.visibleTasks.length ? (
          <button
            className="dashboard-task-toggle"
            onClick={() => setIsTaskListOpen((current) => !current)}
            type="button"
          >
            {isTaskListOpen
              ? "Show 3 focus tasks"
              : `Show all focus tasks (${hiddenTaskCount} more)`}
          </button>
        ) : null}
      </article>
    </section>
  );
}

function DashboardProductionPreview({
  songs
}: {
  songs: ProductionSongConfig[];
}) {
  const [currentSong, nextSong] = songs;

  return (
    <section className="dashboard-production" aria-label="Production preview">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Production</p>
          <h2>Current & Next Songs</h2>
        </div>
      </div>
      <div className="dashboard-production-grid">
        <DashboardProductionCard
          emptyText="No current production song yet."
          label="Current song"
          song={currentSong ?? null}
        />
        <DashboardProductionCard
          emptyText="No next production song yet."
          label="Next song"
          song={nextSong ?? null}
        />
      </div>
    </section>
  );
}

function DashboardProductionCard({
  emptyText,
  label,
  song
}: {
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
  const visibleTasks = isTaskListOpen
    ? allTasks
    : nextTasks.length > 0
      ? nextTasks.slice(0, 3)
      : allTasks.slice(0, 3);
  const hiddenTaskCount = allTasks.length - visibleTasks.length;

  return (
    <article className="dashboard-production-card">
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
            <h3>{song.title}</h3>
          </div>
        </div>
        <div className="dashboard-campaign-date">
          <strong>
            {formatDaysToProductionDeadline(
              deadlineDate ? getDaysToRelease(deadlineDate) : null
            )}
          </strong>
          {deadlineDate ? <span>{formatCampaignDate(deadlineDate)}</span> : null}
        </div>
      </div>

      <ProductionProgressStrip steps={song.steps} />
      <HeaderTaskList tasks={visibleTasks} />
      {allTasks.length > 3 ? (
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">Budget</p>
          <h2>Balance Snapshot</h2>
        </div>
      </div>
      <div className="dashboard-budget-grid">
        <article className="metric-card budget-metric-card">
          <span>Current balance</span>
          <strong className={getAmountToneClass(summary.balance)}>
            {formatCurrency(summary.balance)}
          </strong>
          <p>Earned minus spent.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected earn</span>
          <strong>{formatCurrency(summary.potentialEarn)}</strong>
          <p>From tomorrow, one month ahead.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected spend</span>
          <strong>{formatCurrency(summary.upcomingSpend)}</strong>
          <p>From tomorrow, one month ahead.</p>
        </article>
        <article className="metric-card budget-metric-card">
          <span>Projected balance</span>
          <strong className={getAmountToneClass(summary.upcomingBalance)}>
            {formatCurrency(summary.upcomingBalance)}
          </strong>
          <p>Current balance plus projected earn minus projected spend.</p>
        </article>
      </div>
    </section>
  );
}

function DashboardRoadmapPhasePreview({ phase }: { phase: RoadmapPhase }) {
  return (
    <section className="dashboard-roadmap" aria-label="Roadmap phase preview">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>Phase 1</h2>
        </div>
      </div>
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
  onAppleMusicCsvImport,
  platformMetricRows,
  platformStatsData
}: {
  appleMusicImportStatus: AppleMusicImportStatus;
  onAppleMusicCsvImport: (file: File) => void;
  platformMetricRows: MetricRow[];
  platformStatsData: typeof platformStats;
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
  const youtubeLastUpdate = getPlatformLastSnapshotDate(platformMetricRows, "youtube");
  const youtubeMusicLastUpdate = getPlatformLastSnapshotDate(
    platformMetricRows,
    "youtube-music"
  );
  const appleMusicLastUpdate =
    getPlatformMetric(platformStatsData, "apple-music", "last_update_date")?.value ??
    getPlatformLastSnapshotDate(platformMetricRows, "apple-music");

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Detailed platform statistics</p>
          <h1>Platforms</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
      </header>

      <PlatformStatsSection
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
                    label: "Followers",
                    points: instagramFollowerTrend
                  },
                  {
                    label: "Accounts reached, last 30 days",
                    points: instagramReachTrend
                  },
                  {
                    label: "Views, last 30 days",
                    points: instagramViewsTrend
                  }
                ]}
                title="Evolution graphs"
              />
            ) : null}
            {platform.slug === "youtube" ? (
              <PlatformTrendPanel
                label="Subscribers"
                points={youtubeSubscriberTrend}
                title="Subscriber evolution"
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
                <span>Last update: {formatDateWithDots(appleMusicLastUpdate)}</span>
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
    </>
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

function PlatformTrendPanel({
  label,
  points,
  title
}: {
  label: string;
  points: MetricTrendPoint[];
  title: string;
}) {
  return (
    <PlatformTrendPanelGroup
      charts={[
        {
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
    label: string;
    points: MetricTrendPoint[];
  }>;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="platform-trend-panel">
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
  label,
  points
}: {
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
        <span>{label}</span>
        <strong>
          {firstPoint && lastPoint
            ? `${formatMetricValue(firstPoint.value)} -> ${formatMetricValue(lastPoint.value)}`
            : "No data yet"}
        </strong>
        <em>{change >= 0 ? `+${formatMetricValue(change)}` : formatMetricValue(change)}</em>
      </div>
      <PlatformLineChart label={label} points={points} />
    </div>
  );
}

function PlatformLineChart({
  label,
  points
}: {
  label: string;
  points: MetricTrendPoint[];
}) {
  if (points.length < 2) {
    return <p className="platform-trend-empty">Not enough history yet.</p>;
  }

  const width = 360;
  const height = 160;
  const padding = 24;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const firstTime = Date.parse(points[0].date);
  const lastTime = Date.parse(points.at(-1)?.date ?? points[0].date);
  const valueRange = Math.max(maxValue - minValue, 1);
  const timeRange = Math.max(lastTime - firstTime, 1);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const coordinates = points.map((point) => {
    const time = Date.parse(point.date);
    const x = padding + ((time - firstTime) / timeRange) * chartWidth;
    const y =
      padding +
      chartHeight -
      ((point.value - minValue) / valueRange) * chartHeight;

    return {
      ...point,
      x,
      y
    };
  });
  const pathData = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaData = `${pathData} L ${
    coordinates.at(-1)?.x ?? padding
  } ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="platform-line-chart">
      <svg
        aria-label={`${label} over time`}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="platform-line-chart-grid"
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <line
          className="platform-line-chart-grid"
          x1={padding}
          x2={width - padding}
          y1={padding}
          y2={padding}
        />
        <path className="platform-line-chart-area" d={areaData} />
        <path className="platform-line-chart-line" d={pathData} />
        {coordinates.map((point) => (
          <circle
            className={`platform-line-chart-dot platform-line-chart-dot-${point.source}`}
            cx={point.x}
            cy={point.y}
            key={`${point.date}-${point.value}`}
            r={point.source === "manual" ? 3.5 : 4}
          />
        ))}
      </svg>
      <div className="platform-line-chart-axis">
        <span>{formatTrendDate(points[0].date)}</span>
        <span>{maxValue}</span>
        <span>{formatTrendDate(points.at(-1)?.date ?? points[0].date)}</span>
      </div>
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

      return {
        ...metric,
        value: getMetricDisplayValue(metric.metricName, row),
        context
      };
    })
  }));
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

function calculateCampaignCompletion(days: CampaignDay[]) {
  const statuses = days.flatMap((day) => [
    ...Object.values(day.statuses),
    ...day.extraTasks.map((task) => task.status)
  ]);
  const doneCount = statuses.filter((status) => status === "done").length;

  return Math.round((doneCount / statuses.length) * 100);
}

function getNextCampaignTasks(days: CampaignDay[]): CampaignTaskItem[] {
  return days
    .flatMap((day) => {
      const tasks: CampaignTaskItem[] = [];

      if (day.statuses.production !== "done") {
        tasks.push({
          id: `${day.dayNumber}-production`,
          label: `${day.date} - ${day.clipName} - Make video / post`,
          status: day.statuses.production
        });
      } else {
        if (day.statuses.instagramUpload !== "done") {
          tasks.push({
            id: `${day.dayNumber}-instagram`,
            label: `${day.date} - ${day.clipName} - IG Upload`,
            status: day.statuses.instagramUpload
          });
        }

        if (day.statuses.youtubeUpload !== "done") {
          tasks.push({
            id: `${day.dayNumber}-youtube`,
            label: `${day.date} - ${day.clipName} - YT upload`,
            status: day.statuses.youtubeUpload
          });
        }
      }

      return [
        ...tasks,
        ...day.extraTasks
          .filter((task) => task.status !== "done")
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
  platforms,
  renderCardAddon,
  renderCardHeaderMeta,
  title,
  variant
}: {
  description: string;
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">Platform statistics</p>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      <div className={`platform-grid platform-grid-${variant}`}>
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const cardAddon = renderCardAddon?.(platform) ?? null;
          const cardHeaderMeta = renderCardHeaderMeta?.(platform) ?? null;

          return (
            <article
              className={`platform-card platform-card-${platform.slug}`}
              key={platform.platform}
            >
              <div className="platform-card-header">
                <div className="platform-card-title">
                  <Icon size={20} aria-hidden />
                  <h3>{platform.platform}</h3>
                </div>
                {cardHeaderMeta}
              </div>
              <dl className="platform-metrics">
                {platform.metrics
                  .filter(
                    (metric) =>
                      !(
                        variant === "full" &&
                        platform.slug === "apple-music" &&
                        metric.metricName === "last_update_date"
                      )
                  )
                  .map((metric) => (
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
                    <dd>{metric.value}</dd>
                  </div>
                ))}
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
        <div>
          <p className="eyebrow">Strategic overview</p>
          <h1>Roadmap</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open project setup">
          <ArrowUpRight size={18} aria-hidden />
        </button>
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
