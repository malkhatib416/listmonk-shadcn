package main

import (
	"net/http"
	"time"

	"github.com/knadh/listmonk/internal/auth"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v4"
)

// analyticsData is the chart data returned for the analytics page.
type analyticsData struct {
	Items           []models.AnalyticsItem          `json:"items"`
	Subscriptions   []models.CampaignAnalyticsCount `json:"subscriptions"`
	Unsubscriptions []models.CampaignAnalyticsCount `json:"unsubscriptions"`
	Views           []models.CampaignAnalyticsCount `json:"views"`
	Clicks          []models.CampaignAnalyticsCount `json:"clicks"`
	Bounces         []models.CampaignAnalyticsCount `json:"bounces"`
	Links           []models.CampaignAnalyticsLink  `json:"links"`
}

// analyticsResponse is the JSON response of the shared campaign / list analytics endpoint.
type analyticsResponse struct {
	Resource              string `json:"resource"`
	CanViewCampaignCharts bool   `json:"can_view_campaign_charts"`
	From                  string `json:"from"`
	To                    string `json:"to"`
	Interval              string `json:"interval"`
	DisableTracking       bool   `json:"disable_tracking"`
	IndividualTracking    bool   `json:"individual_tracking"`

	HasData bool `json:"has_data"`
	Counts  struct {
		Subscriptions   int `json:"subscriptions"`
		Unsubscriptions int `json:"unsubscriptions"`
		Views           int `json:"views"`
		Clicks          int `json:"clicks"`
		Bounces         int `json:"bounces"`
	} `json:"counts"`
	Data analyticsData `json:"data"`
}

// GetAnalytics returns the analytics (time series and link counts) for the selected
// campaigns or lists: GET /api/analytics/:resource?id=1&id=2&from=...&to=...&interval=day.
func (a *App) GetAnalytics(c echo.Context) error {
	resource := c.Param("resource")
	if resource != "campaigns" && resource != "lists" {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("globals.messages.invalidData"))
	}

	// Campaign analytics need the analytics permission (as on the old page route).
	user := auth.GetUser(c)
	if resource == "campaigns" && !user.HasPerm(auth.PermCampaignsGetAnalytics) {
		return echo.NewHTTPError(http.StatusForbidden, a.i18n.Ts("globals.messages.permissionDenied", "name", "campaigns:get_analytics"))
	}

	out, err := a.buildAnalytics(c, resource)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

func (a *App) buildAnalytics(c echo.Context, resource string) (analyticsResponse, error) {
	var out analyticsResponse

	user := auth.GetUser(c)
	ids, err := getQueryInts("id", c.QueryParams())
	if err != nil {
		return out, echo.NewHTTPError(http.StatusBadRequest,
			a.i18n.Ts("globals.messages.errorInvalidIDs", "error", err.Error()))
	}

	getAll, permittedLists := user.GetPermittedLists(auth.PermTypeGet)
	if resource == "campaigns" {
		getAll, permittedLists = user.GetPermittedLists(auth.PermTypeGet | auth.PermTypeManage)
		getAll = getAll || user.HasPerm(auth.PermCampaignsGetAll)
	}

	items, err := a.core.GetAnalyticsItems(resource, ids, getAll, permittedLists)
	if err != nil {
		return out, err
	}

	// Resolve the date range, defaulting to the last 7 days.
	to := time.Now()
	from := to.AddDate(0, 0, -7)
	if t, ok := parseAnalyticsDate(c.QueryParam("from")); ok {
		from = t
	}
	if t, ok := parseAnalyticsDate(c.QueryParam("to")); ok {
		to = t
	}

	out.Resource = resource
	out.From = from.Format("2006-01-02T15:04")
	out.To = to.Format("2006-01-02T15:04")
	out.Interval = c.QueryParam("interval")
	out.DisableTracking = a.cfg.Privacy.DisableTracking
	out.IndividualTracking = a.cfg.Privacy.IndividualTracking
	out.CanViewCampaignCharts = resource == "campaigns" ||
		(can(user, "campaigns:get", "campaigns:get_all") && can(user, "campaigns:get_analytics"))
	if out.Interval == "" {
		out.Interval = "day"
	}

	// Pull analytics for the selected campaigns or lists.
	out.Data.Items = items
	if len(items) == 0 {
		return out, nil
	}

	var (
		fromStr = from.Format("2006-01-02 15:04:05")
		toStr   = to.Format("2006-01-02 15:04:05")
		itemIDs = make([]int, len(items))
	)
	for i, item := range items {
		itemIDs[i] = item.ID
	}

	out.HasData = true
	getCounts := a.core.GetCampaignAnalyticsCounts
	getLinks := a.core.GetCampaignAnalyticsLinks

	if resource == "lists" {
		getCounts = a.core.GetListAnalyticsCounts
		getLinks = a.core.GetListAnalyticsLinks

		rows, err := getCounts(itemIDs, "subscriptions", fromStr, toStr, out.Interval)
		if err != nil {
			return out, err
		}
		out.Data.Subscriptions = rows
		out.Counts.Subscriptions = sumAnalyticsCounts(rows)

		rows, err = getCounts(itemIDs, "unsubscriptions", fromStr, toStr, out.Interval)
		if err != nil {
			return out, err
		}
		out.Data.Unsubscriptions = rows
		out.Counts.Unsubscriptions = sumAnalyticsCounts(rows)
	}

	if out.CanViewCampaignCharts {
		if out.Data.Views, err = getCounts(itemIDs, "views", fromStr, toStr, out.Interval); err != nil {
			return out, err
		}
		if out.Data.Clicks, err = getCounts(itemIDs, "clicks", fromStr, toStr, out.Interval); err != nil {
			return out, err
		}
		if out.Data.Bounces, err = getCounts(itemIDs, "bounces", fromStr, toStr, out.Interval); err != nil {
			return out, err
		}
		if out.Data.Links, err = getLinks(itemIDs, fromStr, toStr); err != nil {
			return out, err
		}

		out.Counts.Views = sumAnalyticsCounts(out.Data.Views)
		out.Counts.Clicks = sumAnalyticsCounts(out.Data.Clicks)
		out.Counts.Bounces = sumAnalyticsCounts(out.Data.Bounces)
	}

	return out, nil
}

// GetCampaignViewAnalytics retrieves view counts for a campaign.
func (a *App) GetCampaignViewAnalytics(c echo.Context) error {
	ids, err := parseStringIDs(c.Request().URL.Query()["id"])
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest,
			a.i18n.Ts("globals.messages.errorInvalidIDs", "error", err.Error()))
	}

	if len(ids) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest,
			a.i18n.Ts("globals.messages.missingFields", "name", "`id`"))
	}

	// Ensure the user has access to campaigns via lists.
	for _, id := range ids {
		if err := a.checkCampaignPerm(auth.PermTypeGet, id, c); err != nil {
			return err
		}
	}

	var (
		typ  = c.Param("type")
		from = c.QueryParams().Get("from")
		to   = c.QueryParams().Get("to")
	)
	if !strHasLen(from, 10, 30) || !strHasLen(to, 10, 30) {
		return echo.NewHTTPError(http.StatusBadRequest, a.i18n.T("analytics.invalidDates"))
	}

	// Campaign link stats.
	if typ == "links" {
		out, err := a.core.GetCampaignAnalyticsLinks(ids, from, to)
		if err != nil {
			return err
		}

		return c.JSON(http.StatusOK, okResp{out})
	}

	interval := c.QueryParam("interval")
	if interval == "" {
		interval = "day"
	}

	// Get the analytics numbers from the DB for the campaigns.
	out, err := a.core.GetCampaignAnalyticsCounts(ids, typ, from, to, interval)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{out})
}

// parseAnalyticsDate parses a `datetime-local` form value (with or without seconds).
func parseAnalyticsDate(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}

	var layout string
	switch len(s) {
	case 16:
		layout = "2006-01-02T15:04"
	case 19:
		layout = "2006-01-02T15:04:05"
	default:
		return time.Time{}, false
	}
	t, err := time.ParseInLocation(layout, s, time.Local)

	return t, err == nil
}

// sumAnalyticsCounts returns the total count across the given analytics rows.
func sumAnalyticsCounts(rows []models.CampaignAnalyticsCount) int {
	total := 0
	for _, r := range rows {
		total += r.Count
	}

	return total
}
