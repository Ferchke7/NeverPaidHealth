package postgres

import "strings"

func normalizeExerciseName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	for {
		start := strings.Index(s, "(")
		if start == -1 {
			break
		}
		end := strings.Index(s, ")")
		if end > start {
			s = strings.TrimSpace(s[:start] + " " + s[end+1:])
		} else {
			s = strings.TrimSpace(s[:start])
			break
		}
	}
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r >= 'а' && r <= 'я') {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func cleanStringAlphanumeric(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r >= 'а' && r <= 'я') {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}
