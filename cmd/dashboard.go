package main

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/knadh/listmonk/internal/auth"
	"github.com/knadh/listmonk/models"
	"github.com/labstack/echo/v4"
)

// dashboardCampaignCount is the number of recent campaigns to show on the dashboard.
const dashboardCampaignCount = 6

// processStartedAt starts process start time to compute uptime.
var processStartedAt = time.Now()

// systemStats holds system metrics.
type systemStats struct {
	Uptime   string `json:"uptime"`
	NumCPU   int    `json:"num_cpu"`
	AppMemMB uint64 `json:"app_mem_mb"`

	HasHostMem bool   `json:"has_host_mem"`
	MemUsedMB  uint64 `json:"mem_used_mb"`
	MemTotalMB uint64 `json:"mem_total_mb"`
	MemPct     int    `json:"mem_pct"`

	HasLoad bool   `json:"has_load"`
	Load1   string `json:"load_1"`
	Load5   string `json:"load_5"`
	Load15  string `json:"load_15"`
	LoadPct int    `json:"load_pct"`

	// Whether the slow dashboard queries are served from a cache.
	CacheSlowQueries bool `json:"cache_slow_queries"`
}

// GetDashboardSystem returns system stats to show on the dashboard.
func (a *App) GetDashboardSystem(c echo.Context) error {
	s := getSystemStats()
	s.CacheSlowQueries = ko.Bool("app.cache_slow_queries")

	return c.JSON(http.StatusOK, okResp{s})
}

// GetDashboardCampaigns returns recent campaigns to show on the dashboard,
// with scheduled campaigns on top.
func (a *App) GetDashboardCampaigns(c echo.Context) error {
	camps, err := a.getDashboardCampaigns(c)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, okResp{camps})
}

// getDashboardCampaigns queries recent campaigns to show on the dashboard.
func (a *App) getDashboardCampaigns(c echo.Context) (models.Campaigns, error) {
	user := auth.GetUser(c)

	// Either the user has campaigns:get_all permission and can view all campaigns,
	// or the campaigns are filtered by the lists the user has get|manage access to.
	hasAllPerm := user.HasPerm(auth.PermCampaignsGetAll)
	var permittedLists []int
	if !hasAllPerm {
		hasAllPerm, permittedLists = user.GetPermittedLists(auth.PermTypeGet | auth.PermTypeManage)
	}

	// Get scheduled campaigns to show on top of the dashboard.
	camps, _, err := a.core.QueryCampaigns("", []string{models.CampaignStatusScheduled}, nil, "", "created_at", "desc", hasAllPerm, permittedLists, 0, dashboardCampaignCount)
	if err != nil {
		return nil, err
	}

	// Remaining is non-scheduled campaigns.
	if rem := dashboardCampaignCount - len(camps); rem > 0 {
		others, _, err := a.core.QueryCampaigns("", []string{
			models.CampaignStatusDraft,
			models.CampaignStatusRunning,
			models.CampaignStatusPaused,
			models.CampaignStatusFinished,
			models.CampaignStatusCancelled,
		}, nil, "", "created_at", "desc", hasAllPerm, permittedLists, 0, rem)
		if err != nil {
			return nil, err
		}
		camps = append(camps, others...)
	}

	// The dashboard card only needs status, name and date, so strip the bodies.
	for i := range camps {
		camps[i].Body = ""
		camps[i].BodySource.Valid = false
	}

	return camps, nil
}

// getSystemStats collects host and runtime stats.
func getSystemStats() systemStats {
	s := systemStats{
		Uptime: niceDuration(time.Since(processStartedAt)),
		NumCPU: runtime.NumCPU(),
	}

	// Process memory (RSS on Linux, otherwise memory reserved by the Go runtime).
	if rss, ok := readProcRSS(); ok {
		s.AppMemMB = rss / 1024 / 1024
	} else {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		s.AppMemMB = m.Sys / 1024 / 1024
	}

	if total, avail, ok := readMemInfo(); ok && total > 0 {
		used := total - avail
		s.HasHostMem = true
		s.MemUsedMB = used / 1024 / 1024
		s.MemTotalMB = total / 1024 / 1024
		s.MemPct = int(float64(used) / float64(total) * 100)
	}

	if l1, l5, l15, ok := readLoadAvg(); ok {
		s.HasLoad = true
		s.Load1 = fmt.Sprintf("%.2f", l1)
		s.Load5 = fmt.Sprintf("%.2f", l5)
		s.Load15 = fmt.Sprintf("%.2f", l15)
		s.LoadPct = min(int(l1/float64(s.NumCPU)*100), 100)
	}

	return s
}

// readProcRSS returns current process RSS bytes from /proc/self/status. Linux only.
func readProcRSS() (uint64, bool) {
	b, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return 0, false
	}

	for _, ln := range strings.Split(string(b), "\n") {
		if f := strings.Fields(ln); len(f) >= 2 && f[0] == "VmRSS:" {
			kb, _ := strconv.ParseUint(f[1], 10, 64)
			return kb * 1024, true
		}
	}

	return 0, false
}

// readMemInfo returns total and available system memory bytes from /proc/meminfo. Linux-only.
func readMemInfo() (uint64, uint64, bool) {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, false
	}

	var (
		total, avail       uint64
		hasTotal, hasAvail bool
	)
	for _, ln := range strings.Split(string(b), "\n") {
		f := strings.Fields(ln)
		if len(f) < 2 {
			continue
		}

		kb, _ := strconv.ParseUint(f[1], 10, 64)
		switch f[0] {
		case "MemTotal:":
			total, hasTotal = kb*1024, true
		case "MemAvailable:":
			avail, hasAvail = kb*1024, true
		}
	}

	return total, avail, hasTotal && hasAvail
}

// readLoadAvg returns CPU load avg from /proc/loadavg. Linux-only.
func readLoadAvg() (float64, float64, float64, bool) {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, false
	}

	f := strings.Fields(string(b))
	if len(f) < 3 {
		return 0, 0, 0, false
	}

	var (
		l1, _  = strconv.ParseFloat(f[0], 64)
		l5, _  = strconv.ParseFloat(f[1], 64)
		l15, _ = strconv.ParseFloat(f[2], 64)
	)

	return l1, l5, l15, true
}

// niceDuration formats duration to human-readable string, eg: 1h, 3s etc.
func niceDuration(d time.Duration) string {
	d = d.Round(time.Second)
	var (
		days  = int(d.Hours()) / 24
		hours = int(d.Hours()) % 24
		mins  = int(d.Minutes()) % 60
		secs  = int(d.Seconds()) % 60
	)

	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh %dm", days, hours, mins)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, mins)
	case mins > 0:
		return fmt.Sprintf("%dm %ds", mins, secs)
	default:
		return fmt.Sprintf("%ds", secs)
	}
}
