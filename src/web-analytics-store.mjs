import pg from "pg";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

const rangeDays = (value) => [7, 30, 90].includes(Number(value)) ? Number(value) : 30;
const numberRows = (rows) => rows.map((row) => ({ ...row, count: Number(row.count || 0) }));

export function webAnalyticsStore({ db = database() } = {}) {
  if (!db) throw new Error("DATABASE_URL is required for web analytics");
  return {
    async record(event) {
      const result = await db.query(`INSERT INTO web_analytics_pageviews
        (bucket_started_at,visitor_hash,path,referrer_host,traffic_source,country_code,browser_language,device_type)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (visitor_hash,path,bucket_started_at) DO NOTHING RETURNING id`, [
        event.bucketStartedAt, event.visitorHash, event.path, event.referrerHost || null,
        event.trafficSource, event.countryCode || null, event.browserLanguage || null, event.deviceType
      ]);
      return Boolean(result.rows[0]);
    },
    async summary(days = 30) {
      const selectedDays = rangeDays(days);
      const params = [selectedDays];
      const where = "occurred_at >= NOW() - ($1::int * INTERVAL '1 day')";
      const [overview, daily, pages, sources, referrers, countries, languages, devices] = await Promise.all([
        db.query(`SELECT COUNT(*)::int page_views,COUNT(DISTINCT visitor_hash)::int unique_visitors FROM web_analytics_pageviews WHERE ${where}`, params),
        db.query(`SELECT TO_CHAR(series.day_start,'YYYY-MM-DD') AS day,COUNT(v.id)::int AS count
          FROM generate_series(
            CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day'),
            CURRENT_DATE,
            INTERVAL '1 day'
          ) AS series(day_start)
          LEFT JOIN web_analytics_pageviews v
            ON v.occurred_at >= series.day_start
           AND v.occurred_at < series.day_start + INTERVAL '1 day'
          GROUP BY series.day_start
          ORDER BY series.day_start`, params),
        db.query(`SELECT path label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY path ORDER BY count DESC,label LIMIT 10`, params),
        db.query(`SELECT traffic_source label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY traffic_source ORDER BY count DESC,label`, params),
        db.query(`SELECT COALESCE(referrer_host,'Direct') label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY COALESCE(referrer_host,'Direct') ORDER BY count DESC,label LIMIT 10`, params),
        db.query(`SELECT COALESCE(country_code,'Onbekend') label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY COALESCE(country_code,'Onbekend') ORDER BY count DESC,label LIMIT 10`, params),
        db.query(`SELECT COALESCE(browser_language,'Onbekend') label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY COALESCE(browser_language,'Onbekend') ORDER BY count DESC,label LIMIT 10`, params),
        db.query(`SELECT device_type label,COUNT(*)::int count FROM web_analytics_pageviews WHERE ${where} GROUP BY device_type ORDER BY count DESC,label`, params)
      ]);
      const totals = overview.rows[0] || { page_views: 0, unique_visitors: 0 };
      return {
        days: selectedDays,
        pageViews: Number(totals.page_views || 0),
        uniqueVisitors: Number(totals.unique_visitors || 0),
        pagesPerVisitor: Number(totals.unique_visitors) ? Number((Number(totals.page_views) / Number(totals.unique_visitors)).toFixed(1)) : 0,
        daily: numberRows(daily.rows), pages: numberRows(pages.rows), sources: numberRows(sources.rows),
        referrers: numberRows(referrers.rows), countries: numberRows(countries.rows),
        languages: numberRows(languages.rows), devices: numberRows(devices.rows)
      };
    }
  };
}
