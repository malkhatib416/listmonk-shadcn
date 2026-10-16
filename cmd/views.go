package main

import (
	"net/http"
	"strings"

	"github.com/knadh/listmonk/internal/auth"
	"github.com/labstack/echo/v4"
)

func can(user auth.User, perms ...string) bool {
	for _, perm := range perms {
		if before, ok := strings.CutSuffix(perm, "*"); ok {
			prefix := before
			for _, p := range user.UserRole.Permissions {
				if strings.HasPrefix(p, prefix) {
					return true
				}
			}
			continue
		}
		if user.HasPerm(perm) {
			return true
		}
	}
	return false
}

// renderAdminMessage renders a plain message page (permission denied and the like).
func (a *App) renderAdminMessage(c echo.Context, title, description string) error {
	return c.Render(http.StatusForbidden, tplMessage, makeMsgTpl(title, "", description))
}
