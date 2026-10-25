package ai

import (
	"strings"
	"testing"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func TestBuildCoachSystemPrompt(t *testing.T) {
	telemetry := coach.CoachInsights{
		ReadinessScore: 88,
		RecoveryStatus: "Optimal",
		CNS: coach.CNSMetrics{
			ACWR: 1.05,
		},
	}
	dossier := "=== БИОМЕТРИЧЕСКИЙ ПРОФИЛЬ ===\nВес: 75.0 кг"

	t.Run("Russian prompt formatting", func(t *testing.T) {
		prompt := buildCoachSystemPrompt("Алиса", telemetry, dossier, "ru")
		if !strings.Contains(prompt, "Алиса") {
			t.Errorf("expected prompt to contain user name Алиса")
		}
		if !strings.Contains(prompt, "NeverPaidHealth") {
			t.Errorf("expected prompt to reference NeverPaidHealth")
		}
		if strings.Contains(prompt, "duda.uz") {
			t.Errorf("prompt must NOT contain legacy domain duda.uz")
		}
		if strings.Contains(prompt, "50–95 слов максимум") {
			t.Errorf("prompt must NOT clamp response to 50-95 words")
		}
		if !strings.Contains(prompt, "88/100") {
			t.Errorf("expected prompt to contain readiness score 88/100")
		}
		if !strings.Contains(prompt, "1.05") {
			t.Errorf("expected prompt to contain ACWR 1.05")
		}
		if !strings.Contains(prompt, "Вес: 75.0 кг") {
			t.Errorf("expected prompt to contain dossier")
		}
	})

	t.Run("Uzbek prompt formatting", func(t *testing.T) {
		prompt := buildCoachSystemPrompt("Bobur", telemetry, dossier, "uz")
		if !strings.Contains(prompt, "O'zbek tilida") {
			t.Errorf("expected prompt to contain Uzbek language instruction")
		}
	})
}
