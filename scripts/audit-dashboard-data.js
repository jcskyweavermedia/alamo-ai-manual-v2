const SUPABASE_URL = "https://nxeorbwqsovybfttemrw.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54ZW9yYndxc292eWJmdHRlbXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY3MDExNywiZXhwIjoyMDg2MjQ2MTE3fQ.Agc1tfz8lMQ6Uk_G1hcNMNJ3xY160kKGkFibEoUGhJs";
const OWN_ID = "11111111-1111-1111-1111-111111111111";
const ALL_IDS = ["11111111-1111-1111-1111-111111111111","22222222-2222-2222-2222-222222222222","33333333-3333-3333-3333-333333333333","44444444-4444-4444-4444-444444444444","55555555-5555-5555-5555-555555555555","66666666-6666-6666-6666-666666666666"];
const FROM_DATE = "2025-12-01";
const TO_DATE = "2026-03-01";
const PREV_FROM = "2025-09-01";
const PREV_TO = "2025-11-30";

async function rpc(fn, params) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": "Bearer " + SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return { status: res.status, data: await res.json() };
}

async function query(table, select, filters, opts) {
  filters = filters || "";
  opts = opts || {};
  var url = SUPABASE_URL + "/rest/v1/" + table + "?select=" + encodeURIComponent(select) + filters;
  var headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SERVICE_ROLE_KEY,
  };
  if (opts.count) headers["Prefer"] = "count=exact";
  var res = await fetch(url, { headers: headers });
  var data = await res.json();
  var range = res.headers.get("content-range");
  return { data: data, count: range ? range.split("/")[1] : null };
}

async function main() {
  console.log("=== COMPREHENSIVE DASHBOARD DATA AUDIT ===");
  console.log("Date range: " + FROM_DATE + " to " + TO_DATE);
  console.log("Previous:   " + PREV_FROM + " to " + PREV_TO + "\n");

  // 1. compute_flavor_index_range - CURRENT period
  console.log("--- 1. FLAVOR INDEX (Current Period) ---");
  var fi = await rpc("compute_flavor_index_range", {
    p_restaurant_id: OWN_ID, p_start_date: FROM_DATE, p_end_date: TO_DATE,
  });
  console.log("Status:", fi.status);
  var fiData = Array.isArray(fi.data) ? fi.data[0] : fi.data;
  console.log("Result:", JSON.stringify(fiData));
  console.log("total_reviews:", fiData?.total_reviews, "five_star:", fiData?.five_star, "four_star:", fiData?.four_star, "low_star:", fiData?.low_star);
  console.log("flavor_index:", fiData?.flavor_index, "avg_rating:", fiData?.avg_rating);
  if (fiData?.total_reviews > 0) {
    var expectedFI = ((fiData.five_star / fiData.total_reviews) * 100 - (fiData.low_star / fiData.total_reviews) * 100).toFixed(2);
    console.log("Expected FI:", expectedFI, "| Match:", Math.abs(Number(expectedFI) - Number(fiData.flavor_index)) < 0.1 ? "YES" : "NO");
  }

  // 2. compute_flavor_index_range - PREVIOUS period
  console.log("\n--- 2. FLAVOR INDEX (Previous Period) ---");
  var fiPrev = await rpc("compute_flavor_index_range", {
    p_restaurant_id: OWN_ID, p_start_date: PREV_FROM, p_end_date: PREV_TO,
  });
  var fiPrevData = Array.isArray(fiPrev.data) ? fiPrev.data[0] : fiPrev.data;
  console.log("Result:", JSON.stringify(fiPrevData));
  console.log("total_reviews:", fiPrevData?.total_reviews, "flavor_index:", fiPrevData?.flavor_index);
  if (fiData && fiPrevData && fiPrevData.total_reviews > 0) {
    console.log("Delta:", (Number(fiData.flavor_index) - Number(fiPrevData.flavor_index)).toFixed(2));
  } else {
    console.log("Delta: NULL (previous period has 0 reviews)");
  }

  // 3. get_dashboard_competitors
  console.log("\n--- 3. COMPETITORS ---");
  var comp = await rpc("get_dashboard_competitors", {
    p_unit_id: OWN_ID, p_start_date: FROM_DATE, p_end_date: TO_DATE,
  });
  console.log("Status:", comp.status);
  console.log("Count:", Array.isArray(comp.data) ? comp.data.length : "ERROR");
  if (Array.isArray(comp.data)) {
    for (var c of comp.data) {
      console.log("  " + (c.is_own ? "*OWN*" : "     ") + " " + (c.name || "?").padEnd(50) + " FI:" + c.flavor_index + " delta:" + c.delta + " rating:" + c.avg_rating + " reviews:" + c.total_reviews);
    }
  } else {
    console.log("ERROR response:", JSON.stringify(comp.data));
  }

  // 4. review_intelligence - latest month for own
  console.log("\n--- 4. REVIEW INTELLIGENCE (Latest Month, Own) ---");
  var riMonth = await query("review_intelligence", "*",
    "&restaurant_id=eq." + OWN_ID + "&period_type=eq.month&order=period_start.desc&limit=1");
  var riOwn = riMonth.data?.[0];
  if (riOwn) {
    console.log("Period:", riOwn.period_start, "to", riOwn.period_end);
    console.log("Reviews:", riOwn.total_reviews, "FI:", riOwn.flavor_index, "Delta:", riOwn.flavor_index_change);
    console.log("Sentiments: food=", riOwn.food_sentiment, "service=", riOwn.service_sentiment, "ambience=", riOwn.ambience_sentiment, "value=", riOwn.value_sentiment);
    console.log("top_strengths:", JSON.stringify(riOwn.top_strengths)?.slice(0, 300));
    console.log("top_opportunities:", JSON.stringify(riOwn.top_opportunities)?.slice(0, 300));
    console.log("top_positive_items:", JSON.stringify(riOwn.top_positive_items)?.slice(0, 300));
    console.log("top_complaints:", JSON.stringify(riOwn.top_complaints)?.slice(0, 300));
    console.log("top_staff:", JSON.stringify(riOwn.top_staff)?.slice(0, 300));
    console.log("platform_breakdown:", JSON.stringify(riOwn.platform_breakdown));
    console.log("emotion_distribution:", JSON.stringify(riOwn.emotion_distribution));
    console.log("high_severity_count:", riOwn.high_severity_count);
    console.log("return_likely_pct:", riOwn.return_likely_pct, "return_unlikely_pct:", riOwn.return_unlikely_pct);
  } else {
    console.log("NO DATA for latest month");
  }

  // 5. Monthly scores - last 12 months per restaurant
  console.log("\n--- 5. MONTHLY SCORES (Last 12 per restaurant) ---");
  var monthly = await query("review_intelligence", "period_start,flavor_index,food_sentiment,service_sentiment,ambience_sentiment,value_sentiment,restaurant_id",
    "&restaurant_id=in.(" + ALL_IDS.join(",") + ")&period_type=eq.month&order=period_start.desc&limit=100");
  var byRest = {};
  for (var r of (monthly.data || [])) {
    if (!byRest[r.restaurant_id]) byRest[r.restaurant_id] = [];
    byRest[r.restaurant_id].push(r);
  }
  for (var [rid, rows] of Object.entries(byRest)) {
    var latest12 = rows.slice(0, 12).reverse();
    console.log("  " + rid.slice(0, 8) + "... : " + latest12.length + " months, range: " + latest12[0]?.period_start + " to " + latest12[latest12.length - 1]?.period_start);
    for (var r2 of latest12.slice(-3)) {
      console.log("    " + r2.period_start + " FI:" + r2.flavor_index + " food:" + r2.food_sentiment + " svc:" + r2.service_sentiment + " amb:" + r2.ambience_sentiment + " val:" + r2.value_sentiment);
    }
  }

  // 6. Weekly intelligence - for trend + sparkline
  console.log("\n--- 6. WEEKLY INTELLIGENCE (for trend chart) ---");
  var weekly = await query("review_intelligence", "period_start,flavor_index,restaurant_id",
    "&restaurant_id=in.(" + ALL_IDS.join(",") + ")&period_type=eq.week&period_start=gte." + FROM_DATE + "&period_start=lte." + TO_DATE + "&order=period_start.asc&limit=200");
  console.log("Total weekly rows:", weekly.data?.length);
  var weeklyByRest = {};
  for (var wr of (weekly.data || [])) {
    weeklyByRest[wr.restaurant_id] = (weeklyByRest[wr.restaurant_id] || 0) + 1;
  }
  for (var [wrid, wcount] of Object.entries(weeklyByRest)) {
    console.log("  " + wrid.slice(0, 8) + "... : " + wcount + " weeks");
  }

  // 7. Staff mentions
  console.log("\n--- 7. STAFF MENTIONS ---");
  var staffMonth = await rpc("aggregate_staff_mentions", {
    p_restaurant_id: OWN_ID, p_start_date: FROM_DATE, p_end_date: TO_DATE, p_limit: 10,
  });
  console.log("Status:", staffMonth.status);
  console.log("Date range staff:");
  var staffData = Array.isArray(staffMonth.data) ? staffMonth.data : (staffMonth.data ? [staffMonth.data] : []);
  for (var s of staffData) {
    console.log("  " + (s.name || "?").padEnd(20) + " role:" + (s.role || "?").padEnd(12) + " mentions:" + s.mentions + " +" + s.positive + "/-" + s.negative);
  }
  if (staffData.length === 0) console.log("  (no staff data)");

  var staffYear = await rpc("aggregate_staff_mentions", {
    p_restaurant_id: OWN_ID, p_start_date: "2026-01-01", p_end_date: TO_DATE, p_limit: 10,
  });
  console.log("Year range:");
  var staffYearData = Array.isArray(staffYear.data) ? staffYear.data : [];
  for (var sy of staffYearData) {
    console.log("  " + (sy.name || "?").padEnd(20) + " role:" + (sy.role || "?").padEnd(12) + " mentions:" + sy.mentions + " +" + sy.positive + "/-" + sy.negative);
  }
  if (staffYearData.length === 0) console.log("  (no staff data)");

  // 8. Severity alerts
  console.log("\n--- 8. SEVERITY ALERTS ---");
  var alerts = await rpc("get_severity_alerts", {
    p_restaurant_ids: ALL_IDS, p_start_date: FROM_DATE, p_end_date: TO_DATE, p_limit: 20,
  });
  console.log("Status:", alerts.status);
  console.log("Count:", Array.isArray(alerts.data) ? alerts.data.length : "ERROR");
  if (Array.isArray(alerts.data)) {
    for (var a of alerts.data.slice(0, 5)) {
      console.log("  " + a.review_date + " | " + a.alert_type + " | " + (a.restaurant_name || "?").padEnd(30) + " | " + (a.summary || "").slice(0, 80));
    }
  } else {
    console.log("ERROR response:", JSON.stringify(alerts.data));
  }

  // 9. Subcategory breakdowns (all 4)
  console.log("\n--- 9. SUBCATEGORY BREAKDOWNS ---");
  for (var bucket of ["food", "service", "ambience", "value"]) {
    var sub = await rpc("get_subcategory_breakdown", {
      p_restaurant_id: OWN_ID, p_start_date: FROM_DATE, p_end_date: TO_DATE, p_bucket: bucket, p_limit: 10,
    });
    console.log("  Status for " + bucket + ":", sub.status);
    var items = Array.isArray(sub.data) ? sub.data : [];
    console.log("  " + bucket.padEnd(10) + ": " + items.length + " categories");
    for (var si of items) {
      console.log("    " + (si.category || "?").padEnd(25) + " intensity:" + si.avg_intensity + " mentions:" + si.mentions + " trend:" + si.trend_delta);
    }
    if (!Array.isArray(sub.data)) {
      console.log("  ERROR: " + JSON.stringify(sub.data));
    }
  }

  // 10. Category trend weekly (all 4)
  console.log("\n--- 10. CATEGORY TRENDS WEEKLY ---");
  for (var cat of ["food", "service", "ambience", "value"]) {
    var trend = await rpc("get_category_trend_weekly", {
      p_restaurant_ids: ALL_IDS, p_category: cat, p_start_date: FROM_DATE, p_end_date: TO_DATE,
    });
    console.log("  Status for " + cat + ":", trend.status);
    var tRows = Array.isArray(trend.data) ? trend.data : [];
    console.log("  " + cat.padEnd(10) + ": " + tRows.length + " data points");
    if (tRows.length > 0) {
      console.log("    Sample: " + JSON.stringify(tRows.slice(0, 2)));
    }
    if (!Array.isArray(trend.data)) {
      console.log("  ERROR: " + JSON.stringify(trend.data));
    }
  }

  // 11. Restaurant items (per-restaurant top/worst from latest monthly RI)
  console.log("\n--- 11. RESTAURANT ITEMS (per-restaurant) ---");
  for (var itemRid of ALL_IDS) {
    var ri = await query("review_intelligence", "top_positive_items,top_complaints",
      "&restaurant_id=eq." + itemRid + "&period_type=eq.month&order=period_start.desc&limit=1");
    var row = ri.data?.[0];
    var tops = Array.isArray(row?.top_positive_items) ? row.top_positive_items.length : 0;
    var worst = Array.isArray(row?.top_complaints) ? row.top_complaints.length : 0;
    console.log("  " + itemRid.slice(0, 8) + "... top:" + tops + " worst:" + worst);
    if (tops > 0) console.log("    Top: " + JSON.stringify(row.top_positive_items.slice(0, 3)).slice(0, 200));
    if (worst > 0) console.log("    Worst: " + JSON.stringify(row.top_complaints.slice(0, 3)).slice(0, 200));
  }

  console.log("\n=== AUDIT COMPLETE ===");
}
main().catch(console.error);
