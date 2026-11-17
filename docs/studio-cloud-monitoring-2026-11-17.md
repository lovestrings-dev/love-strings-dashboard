# Studio cloud usage dashboard

Dashboard: https://console.cloud.google.com/monitoring/dashboards/builder/5f8fd1e1-b3d3-4f8f-8ed2-32cc27258d01;customDuration=today?project=project-eda6605c-73e6-4361-9ad

Configuration: `studio-cloud-monitoring-dashboard.json`. The existing empty dashboard was updated, rather than creating duplicates. No application deployment is required.

- Inbound: `adstudio-staging-1023633877337`.
- Output: `adstudio-renders-1023633877337`.
- Compute: only `adstudio-ffmpeg-renderer`, `europe-west3`.
- Summary compute cards follow the selected range; use Today for local midnight onward.
- History charts independently show 14 days, with 86400-second aggregation buckets (UTC).
- Compute measures allocated vCPU-seconds and billable instance seconds, plus completed execution counts. These are resource usage, not cost or actual CPU utilization.
- Storage uses built-in daily measurements: live bytes and soft-deleted recovery bytes are separate. Both buckets retain deleted objects for seven days.

## Verification and outstanding data gap

Saved via Cloud Monitoring dashboard API and verified in the signed-in Cloud Console. Compute history contains allocation, instance-time, and completed-execution series. The Today summary has no samples at verification time; missing data is not interpreted as zero.

Storage size queries currently return no samples, including on Google's own bucket Observability page over 14 days. Both v2 state-aware and legacy size queries were checked; the final dashboard uses v2. This is an unresolved reporting gap, not evidence that either bucket is empty. No collector, scheduler, custom metric, IAM change, rendering run, or media deletion was introduced. The user explicitly chose daily snapshots.

A separate read-only live object inventory around 11:15 CET on 17 November 2026 found:

| Bucket | Live bytes | Decimal MB |
| --- | ---: | ---: |
| Inbound | 134376779 | 134.4 |
| Output | 190682764 | 190.7 |

These one-off values are recorded in the dashboard notes and do not update automatically. Storage charts will display any samples Google supplies; historical usage cannot be reconstructed from today's inventory.

Metric reference: https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z
