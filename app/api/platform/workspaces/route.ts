import { NextResponse, type NextRequest } from "next/server";
import {
  requirePlatformOwner,
  WorkspaceAccessError
} from "@/lib/server/workspace-owner";

export async function GET(request: NextRequest) {
  try {
    const { serviceClient } = await requirePlatformOwner(request);
    const [{ data: workspaces, error: workspaceError }, { data: invitations, error: invitationError }, { data: guidanceInvitations, error: guidanceInvitationError }, { data: members, error: memberError }, { data: profiles, error: profileError }, { data: settings, error: settingsError }, { data: songs, error: songError }, { data: googleConnections, error: googleError }, { data: metaConnections, error: metaError }, { data: metrics, error: metricError }, { data: importLogs, error: importLogError }, { data: campaigns, error: campaignError }, { data: otherTasks, error: otherTaskError }, { data: guidanceProgress, error: guidanceError }, { data: template, error: templateError }] = await Promise.all([
      serviceClient.from("app_workspaces").select("id, name, setup_state, access_state, slug, created_at, guidance_eligible_at").order("created_at", { ascending: false }),
      serviceClient.from("app_workspace_invitations").select("workspace_id, email, accepted_at, revoked_at, expires_at")
        .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
      serviceClient.from("app_workspace_invitations").select("workspace_id, email, role, created_at"),
      serviceClient.from("app_workspace_members").select("workspace_id, user_id, role"),
      serviceClient.from("app_profiles").select("id, display_name, avatar_path"),
      serviceClient.from("app_workspace_settings").select("workspace_id, logo_path, onboarding_release_frequency, onboarding_distributor_answer"),
      serviceClient.from("production_songs").select("workspace_id"),
      serviceClient.from("app_google_connections").select("workspace_id, youtube_enabled, youtube_channel_id, youtube_topic_channel_id, analytics_enabled, analytics_property_id"),
      serviceClient.from("app_meta_connections").select("workspace_id, connection_kind, connection_state"),
      serviceClient.from("platform_metric_snapshots").select("workspace_id").limit(10000),
      serviceClient.from("import_logs").select("workspace_id, source").eq("import_status", "completed").not("finished_at", "is", null).in("source", ["spotify-audience-csv", "spotify-songs-csv", "spotify-playlists-csv", "apple-music-csv"]),
      serviceClient.from("marketing_campaigns").select("workspace_id, campaign_kind"),
      serviceClient.from("focus_other_tasks").select("workspace_id, stable_key, source, created_at, updated_at"),
      serviceClient.from("app_guidance_program_progress").select("workspace_id, skipped_steps, dismissed_at").eq("program_key", "getting_started_v1"),
      serviceClient.from("platform_dashboard_preference_templates").select("template_key, version, visible_cards, card_order, theme").eq("template_key", "new-member-dashboard").is("retired_at", null).single()
    ]);
    if (workspaceError) throw workspaceError;
    if (invitationError || guidanceInvitationError) throw invitationError || guidanceInvitationError;
    if (memberError || profileError || settingsError || songError || googleError || metaError || metricError || importLogError || campaignError || otherTaskError || guidanceError || templateError) throw memberError || profileError || settingsError || songError || googleError || metaError || metricError || importLogError || campaignError || otherTaskError || guidanceError || templateError;
    const pendingEmailByWorkspaceId = new Map((invitations ?? []).map((invitation) => [invitation.workspace_id, invitation.email]));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const settingByWorkspaceId = new Map((settings ?? []).map((setting) => [setting.workspace_id, setting]));
    const songWorkspaceIds = new Set((songs ?? []).map((song) => song.workspace_id));
    const metricWorkspaceIds = new Set((metrics ?? []).map((metric) => metric.workspace_id));
    const guidanceByWorkspaceId = new Map((guidanceProgress ?? []).map((progress) => [progress.workspace_id, progress]));
    return NextResponse.json({
      canCreateWorkspaces: true,
      onboardingDefaults: template,
      workspaces: (workspaces ?? []).map((workspace) => {
        const workspaceMembers = (members ?? []).filter((member) => member.workspace_id === workspace.id);
        const adminMember = workspaceMembers.find((member) => member.role === "admin" || member.role === "owner");
        const adminProfile = adminMember ? profileById.get(adminMember.user_id) : null;
        const setting = settingByWorkspaceId.get(workspace.id);
        const googleConnection = (googleConnections ?? []).find((connection) => connection.workspace_id === workspace.id);
        const googleServices = [
          googleConnection?.youtube_enabled && googleConnection.youtube_channel_id ? "YouTube Channel" : null,
          googleConnection?.youtube_topic_channel_id ? "YouTube Topic" : null,
          googleConnection?.analytics_enabled && googleConnection.analytics_property_id ? "Google Analytics" : null
        ].filter((service): service is string => Boolean(service));
        const hasGoogleYoutube = googleServices.includes("YouTube Channel");
        const hasCreatorInstagram = (metaConnections ?? []).some((connection) => connection.workspace_id === workspace.id && connection.connection_kind === "creator_social_instagram" && connection.connection_state === "connected");
        const metaServices = [
          (metaConnections ?? []).some((connection) => connection.workspace_id === workspace.id && connection.connection_kind === "fstats_login_facebook_page" && connection.connection_state === "connected") ? "Facebook Page" : null,
          hasCreatorInstagram ? "Instagram" : null,
          (metaConnections ?? []).some((connection) => connection.workspace_id === workspace.id && connection.connection_kind === "creator_social_threads" && connection.connection_state === "connected") ? "Threads" : null
        ].filter((service): service is string => Boolean(service));
        const hasInvite = Boolean(pendingEmailByWorkspaceId.get(workspace.id));
        const onboardingSteps = [
          Boolean(adminProfile?.display_name?.trim()), Boolean(setting?.logo_path || workspace.setup_state === "active"), songWorkspaceIds.has(workspace.id), hasGoogleYoutube, hasCreatorInstagram, metricWorkspaceIds.has(workspace.id), workspaceMembers.length > 1 || hasInvite
        ];
        const progress = guidanceByWorkspaceId.get(workspace.id);
        const guidance = !workspace.guidance_eligible_at ? { applicable: false } : (() => {
          const steps = { basics: workspace.setup_state === "active", firstSong: songWorkspaceIds.has(workspace.id), googleYoutube: hasGoogleYoutube, inviteMember: (guidanceInvitations ?? []).some((invitation) => invitation.workspace_id === workspace.id && invitation.created_at >= workspace.guidance_eligible_at) };
          const skippedSteps = progress?.skipped_steps ?? {};
          const state = progress?.dismissed_at ? "Completed" : Object.values(steps).every(Boolean) ? "4 of 4 — ready to close" : Object.values(steps).some(Boolean) || Object.values(skippedSteps).some(Boolean) ? "In progress" : "Not started";
          return { applicable: true, overall: state, steps: Object.fromEntries(Object.entries(steps).map(([key, complete]) => [key, complete ? "Complete" : skippedSteps[key] ? "Skipped" : "Pending"])) };
        })();
        const firstAdminInvitation = (guidanceInvitations ?? [])
          .filter((invitation) => invitation.workspace_id === workspace.id && invitation.role === "admin")
          .sort((first, second) => first.created_at.localeCompare(second.created_at))[0];
        const workspaceImports = (importLogs ?? []).filter((item) => item.workspace_id === workspace.id);
        const campaignKinds = [...new Set((campaigns ?? [])
          .filter((campaign) => campaign.workspace_id === workspace.id)
          .map((campaign) => campaign.campaign_kind)
          .filter((kind): kind is "song" | "general" => kind === "song" || kind === "general"))];
        const workspaceOtherTasks = (otherTasks ?? []).filter((task) => task.workspace_id === workspace.id);
        const hasCreatedOtherTask = workspaceOtherTasks.some((task) => !task.stable_key.startsWith("starter-"));
        // The current bulk upsert resets `source` and the update trigger advances
        // `updated_at` for every submitted starter task. Those fields therefore
        // cannot establish that a starter was meaningfully edited.
        const onboardingOutcome = !workspace.guidance_eligible_at ? { applicable: false } : {
          applicable: true,
          adminIdentity: firstAdminInvitation?.email ?? adminProfile?.display_name ?? "First Admin not recorded",
          essentials: workspace.setup_state === "active" ? "Complete" : "Pending",
          song: songWorkspaceIds.has(workspace.id) ? "Created" : "Pending",
          google: googleServices,
          meta: metaServices,
          spotifyCsv: workspaceImports.some((item) => item.source === "spotify-audience-csv" || item.source === "spotify-songs-csv" || item.source === "spotify-playlists-csv") ? "Uploaded / Imported" : "Pending",
          appleMusicCsv: workspaceImports.some((item) => item.source === "apple-music-csv") ? "Uploaded / Imported" : "Pending",
          marketing: campaignKinds,
          focusQueue: hasCreatedOtherTask ? "Created" : "Pending",
          starterTaskModification: "Not tracked" as const
        };
        return {
          ...workspace,
          admin: adminMember ? { displayName: adminProfile?.display_name || "Unnamed admin", hasAvatar: Boolean(adminProfile?.avatar_path), role: adminMember.role } : null,
          connectedServices: { googleYoutube: hasGoogleYoutube, instagramCreator: hasCreatorInstagram },
          onboarding: { completed: onboardingSteps.filter(Boolean).length, total: onboardingSteps.length, steps: onboardingSteps },
          guidance,
          onboardingOutcome,
          pendingAdminEmail: pendingEmailByWorkspaceId.get(workspace.id) ?? null,
          settings: { hasLogo: Boolean(setting?.logo_path), releaseFrequency: setting?.onboarding_release_frequency ?? null, distributorAnswer: setting?.onboarding_distributor_answer ?? null },
          statistics: metricWorkspaceIds.has(workspace.id) ? "configured" : "unknown"
        };
      })
    });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json({ canCreateWorkspaces: false }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
  }

  try {
    const { serviceClient, user } = await requirePlatformOwner(request);
    const payload = (await request.json()) as { name?: string; slug?: string };
    const name = payload.name?.trim() ?? "";
    const slug = normalizeSlug(payload.slug);
    if (!isValidName(name) || !slug) {
      return NextResponse.json({ error: "Enter a valid workspace name and slug." }, { status: 400 });
    }

    const { data: workspaceId, error } = await serviceClient.rpc("provision_workspace", {
      p_initial_admin_id: user.id,
      p_name: name,
      p_slug: slug
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That workspace name or slug is already in use." }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ name, slug, status: "created", workspaceId });
  } catch (error) {
    const status = error instanceof WorkspaceAccessError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace creation failed." },
      { status }
    );
  }
}

function normalizeSlug(value?: string) {
  const slug = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? slug : null;
}

function isValidName(value: string) {
  return value.length >= 2 && value.length <= 120;
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
