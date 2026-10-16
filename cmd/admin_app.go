package main

import (
	"net/http"

	"github.com/knadh/listmonk/internal/adminapp"
	"github.com/labstack/echo/v4"
)

// ServeAdminApp serves the SPA shell of the new admin frontend. Client side
// routing handles the rest of the path.
func (a *App) ServeAdminApp(c echo.Context) error {
	shell, err := a.fs.Read(adminapp.ShellPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "admin frontend is not built")
	}

	// The shell embeds the root path, so it must not be cached across config changes.
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.HTMLBlob(http.StatusOK, adminapp.RewriteShell(shell, a.urlCfg.RootPath, a.urlCfg.FaviconURL))
}
