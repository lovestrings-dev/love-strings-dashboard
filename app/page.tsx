"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Disc3,
  Headphones,
  Upload,
  Music2,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Video
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Section = (typeof sections)[number];
type MarketingStatus = "not-started" | "in-progress" | "done";
type CampaignDayProgressStatus = "empty" | "partial" | "complete";
type ExtraCampaignTask = {
  id: string;
  title: string;
  status: MarketingStatus;
};
type CampaignTaskItem = {
  id: string;
  label: string;
  status: MarketingStatus;
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
        label: "Current Release",
        metricName: "current_release_name",
        value: "Flowers"
      },
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

const todayTasks = [
  "Confirm current song sprint",
  "Import production workbook data",
  "Add first platform metric snapshot",
  "Prepare release checklist template"
];

const appVersionLabel = "Beta 1.1";

const sections = [
  "Dashboard",
  "Marketing",
  "Production",
  "Platforms",
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

const newMarketingCampaign: Omit<MarketingCampaignConfig, "id"> = {
  releaseTitle: "New Campaign",
  releaseDate: "10/07/2026",
  albumArtUrl: ""
};

const defaultCampaignDayCount = 14;

function sortCampaignsByReleaseDate(campaigns: MarketingCampaignConfig[]) {
  return [...campaigns].sort(
    (firstCampaign, secondCampaign) =>
      getCampaignSortTime(secondCampaign.releaseDate) -
      getCampaignSortTime(firstCampaign.releaseDate)
  );
}

function getCampaignSortTime(releaseDateInput: string) {
  return parseCampaignDate(releaseDateInput)?.getTime() ?? 0;
}

function getDashboardCampaignPreview(campaigns: MarketingCampaignConfig[]) {
  const today = getTodayUtcDate();
  const sortedCampaigns = sortCampaignsByReleaseDate(campaigns);
  const current =
    sortedCampaigns.find((campaign) => isCampaignActive(campaign, today)) ??
    null;
  const previous =
    sortedCampaigns
      .filter((campaign) => {
        const endDate = getCampaignEndDate(campaign);
        return endDate ? endDate.getTime() < today.getTime() : false;
      })
      .sort(
        (firstCampaign, secondCampaign) =>
          (getCampaignEndDate(secondCampaign)?.getTime() ?? 0) -
          (getCampaignEndDate(firstCampaign)?.getTime() ?? 0)
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

  return { current, next, previous };
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
  const [hasLoadedCampaignDrafts, setHasLoadedCampaignDrafts] = useState(false);
  const dashboardPlatformStats = getDashboardPlatformStats(platformStatsData);

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

  async function addCampaign() {
    const releaseDate =
      parseCampaignDate(newMarketingCampaign.releaseDate) ??
      new Date(Date.UTC(2026, 6, 10));
    const localCampaign: MarketingCampaignConfig = {
      ...newMarketingCampaign,
      id: `campaign-${campaigns.length + 1}-${Date.now()}`,
      releaseTitle: `New Campaign ${campaigns.length + 1}`,
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

  function updateCampaignAlbumArt(campaignId: string, albumArtUrl: string) {
    setCampaigns((currentCampaigns) =>
      currentCampaigns.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              albumArtUrl
            }
          : campaign
      )
    );
    void saveMarketingCampaignHeader(campaignId, { albumArtUrl });
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
            onAlbumArtSave={updateCampaignAlbumArt}
            onCampaignDaysChange={updateCampaignDays}
            onDeleteCampaign={deleteCampaign}
            onReleaseDateSave={updateCampaignReleaseDate}
            onTitleSave={updateCampaignTitle}
          />
        ) : null}
        {activeSection === "Platforms" ? (
          <PlatformsView platformStatsData={platformStatsData} />
        ) : null}
        {activeSection !== "Roadmap" &&
        activeSection !== "Platforms" &&
        activeSection !== "Marketing" ? (
          <DashboardView
            appleMusicImportStatus={appleMusicImportStatus}
            campaigns={campaigns}
            dashboardPlatformStats={dashboardPlatformStats}
            onAppleMusicCsvImport={importAppleMusicCsv}
            onRefreshPlatformStats={refreshPlatformStats}
            refreshStatus={refreshStatus}
          />
        ) : null}
      </section>
    </main>
  );
}

function MarketingView({
  campaigns,
  onAddCampaign,
  onAlbumArtSave,
  onCampaignDaysChange,
  onDeleteCampaign,
  onReleaseDateSave,
  onTitleSave
}: {
  campaigns: MarketingCampaignConfig[];
  onAddCampaign: () => void;
  onAlbumArtSave: (campaignId: string, albumArtUrl: string) => void;
  onCampaignDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
}) {
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
            onAlbumArtSave={onAlbumArtSave}
            onDaysChange={onCampaignDaysChange}
            onDelete={onDeleteCampaign}
            onReleaseDateSave={onReleaseDateSave}
            onTitleSave={onTitleSave}
          />
        ))}

        <button className="add-campaign-button" onClick={onAddCampaign} type="button">
          <Plus size={16} aria-hidden />
          Add campaign
        </button>
      </div>
    </>
  );
}

function MarketingCampaignBoard({
  campaign,
  onDaysChange,
  onAlbumArtSave,
  onDelete,
  onReleaseDateSave,
  onTitleSave
}: {
  campaign: MarketingCampaignConfig;
  onDaysChange: (campaignId: string, campaignDays: CampaignDay[]) => void;
  onAlbumArtSave: (campaignId: string, albumArtUrl: string) => void;
  onDelete: (campaignId: string) => void;
  onReleaseDateSave: (campaignId: string, releaseDate: string) => void;
  onTitleSave: (campaignId: string, releaseTitle: string) => void;
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
  const [isAlbumArtEditorOpen, setIsAlbumArtEditorOpen] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);
  const [albumArtUrl, setAlbumArtUrl] = useState(campaign.albumArtUrl);
  const [campaignDays, setCampaignDays] = useState(() =>
    campaign.campaignDays ?? buildCampaignDays(campaign.releaseDate, campaign.daySeeds)
  );
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
      setAlbumArtUrl(campaign.albumArtUrl);
    }, 0);
  }, [campaign.albumArtUrl, campaign.releaseDate, campaign.releaseTitle]);

  useEffect(() => {
    if (albumArtUrl === campaign.albumArtUrl) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      onAlbumArtSave(campaign.id, albumArtUrl);
    }, 700);

    return () => window.clearTimeout(saveTimer);
  }, [albumArtUrl, campaign.albumArtUrl, campaign.id, onAlbumArtSave]);

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
    updates: Partial<Pick<ExtraCampaignTask, "status" | "title">>
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
      <section className="campaign-board" aria-label={`${campaignTitle} marketing campaign`}>
        <div className="campaign-board-header">
          <div className="album-art-control">
            <button
              aria-label="Add album art URL"
              className="album-art-placeholder"
              onClick={() => setIsAlbumArtEditorOpen((current) => !current)}
              type="button"
            >
              {albumArtUrl ? (
                <span
                  aria-label={`${campaignTitle} album art preview`}
                  className="album-art-image"
                  role="img"
                  style={{ backgroundImage: `url("${albumArtUrl}")` }}
                />
              ) : (
                <>
                  <Music2 size={26} aria-hidden />
                  <span>Album art</span>
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
              {isCampaignTitleEditorOpen ? (
                <>
                  <input
                    aria-label="Campaign sprint name"
                    onChange={(event) =>
                      setCampaignTitleInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        saveCampaignTitle();
                      }
                    }}
                    value={campaignTitleInput}
                  />
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
                  <h2>{campaignTitle}</h2>
                  <button
                    aria-label="Edit campaign sprint name"
                    onClick={() => {
                      setCampaignTitleInput(campaignTitle);
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
          {isAlbumArtEditorOpen ? (
            <label className="album-art-url-field">
              <span>Album art URL</span>
              <input
                onChange={(event) => setAlbumArtUrl(event.target.value.trim())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onAlbumArtSave(campaign.id, albumArtUrl);
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
    updates: Partial<Pick<ExtraCampaignTask, "status" | "title">>
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
  dayNumber,
  onChange,
  onDelete,
  task
}: {
  dayNumber: number;
  onChange: (
    dayNumber: number,
    taskId: string,
    updates: Partial<Pick<ExtraCampaignTask, "status" | "title">>
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
  importStatus,
  onImport
}: {
  importStatus: AppleMusicImportStatus;
  onImport: (file: File) => void;
}) {
  return (
    <section className="apple-import-panel" aria-label="Apple Music CSV import">
      <div>
        <p className="eyebrow">Apple Music</p>
        <h2>CSV Import</h2>
      </div>
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
    </section>
  );
}

function DashboardView({
  appleMusicImportStatus,
  campaigns,
  dashboardPlatformStats,
  onAppleMusicCsvImport,
  onRefreshPlatformStats,
  refreshStatus
}: {
  appleMusicImportStatus: AppleMusicImportStatus;
  campaigns: MarketingCampaignConfig[];
  dashboardPlatformStats: typeof platformStats;
  onAppleMusicCsvImport: (file: File) => void;
  onRefreshPlatformStats: () => void;
  refreshStatus: RefreshStatus;
}) {
  const campaignPreview = getDashboardCampaignPreview(campaigns);

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

      <PlatformStatsSection
        platforms={dashboardPlatformStats}
        title="Platform Snapshot"
        description="Key audience and consumption signals from the main platforms."
        variant="dashboard"
      />

      <AppleMusicCsvImportControl
        importStatus={appleMusicImportStatus}
        onImport={onAppleMusicCsvImport}
      />

      <DashboardCampaignPreview preview={campaignPreview} />

      <section className="main-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Focus Queue</h2>
            </div>
            <Clock3 size={18} aria-hidden />
          </div>
          <ul className="task-list">
            {todayTasks.map((task) => (
              <li key={task}>
                <CheckCircle2 size={18} aria-hidden />
                <span>{task}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel status-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Infrastructure</p>
              <h2>System Status</h2>
            </div>
            <Radio size={18} aria-hidden />
          </div>
          <div className="status-list">
            <span>
              <Sparkles size={17} aria-hidden />
              Supabase schema applied
            </span>
            <span>
              <CheckCircle2 size={17} aria-hidden />
              GitHub integration connected
            </span>
            <span>
              <AlertTriangle size={17} aria-hidden />
              Workbook import pending
            </span>
          </div>
        </article>
      </section>
    </>
  );
}

function DashboardCampaignPreview({
  preview
}: {
  preview: {
    current: MarketingCampaignConfig | null;
    next: MarketingCampaignConfig | null;
    previous: MarketingCampaignConfig | null;
  };
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
          campaign={preview.previous}
          emptyText="No previous campaign yet."
          label="Previous"
          showTasks={false}
        />
        <DashboardCampaignCard
          campaign={preview.current}
          emptyText="No campaign is currently running."
          label="Current"
        />
        <DashboardCampaignCard
          campaign={preview.next}
          emptyText="No upcoming campaign is scheduled."
          label="Next"
        />
      </div>
    </section>
  );
}

function DashboardCampaignCard({
  campaign,
  emptyText,
  label,
  showTasks = true
}: {
  campaign: MarketingCampaignConfig | null;
  emptyText: string;
  label: string;
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
          <h3>{campaign.releaseTitle}</h3>
        </div>
        <div className="dashboard-campaign-date">
          <strong>{formatDaysToRelease(releaseDate ? getDaysToRelease(releaseDate) : null)}</strong>
          {releaseDate ? <span>{formatCampaignDate(releaseDate)}</span> : null}
        </div>
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

function PlatformsView({
  platformStatsData
}: {
  platformStatsData: typeof platformStats;
}) {
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
      />
    </>
  );
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

      const context =
        row.notes ??
        getSingle(row.content_posts)?.title ??
        getSingle(row.releases)?.title ??
        metric.context;

      return {
        ...metric,
        value: getMetricDisplayValue(metric.metricName, row),
        context
      };
    })
  }));
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
    "spotify",
    "youtube-music",
    "apple-music",
    "amazon-music",
    "deezer"
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
  title,
  variant
}: {
  description: string;
  platforms: Array<(typeof platformStats)[number] | typeof platformPlaceholder>;
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
          return (
            <article className="platform-card" key={platform.platform}>
              <div className="platform-card-header">
                <Icon size={20} aria-hidden />
                <h3>{platform.platform}</h3>
              </div>
              <dl className="platform-metrics">
                {platform.metrics.map((metric) => (
                  <div key={`${platform.platform}-${metric.label}`}>
                    <dt>
                      {metric.label}
                      {metric.context ? <span>{metric.context}</span> : null}
                    </dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoadmapView() {
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

      <section className="roadmap-band" aria-label="Strategic roadmap">
        <div>
          <p className="eyebrow">Strategic Roadmap</p>
          <h2>Phase 1: English Covers / Brand Formation</h2>
          <p>
            Current milestone: launch repeatable release cycles and build toward
            5 releases by October 2026.
          </p>
        </div>
        <div className="progress-block" aria-label="Roadmap progress">
          <span>0 / 5 releases</span>
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
        </div>
      </section>
    </>
  );
}
