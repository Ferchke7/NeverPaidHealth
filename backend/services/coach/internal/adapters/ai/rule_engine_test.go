package ai_test

import (
	"context"
	"testing"

	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/ai"
)

func TestRuleEngine_AnalyzeMealText_Multilingual(t *testing.T) {
	engine := ai.NewRuleEngineProvider()
	ctx := context.Background()

	// 1. Russian multi-item test
	resRu, err := engine.AnalyzeMealText(ctx, "2 яйца, 150г куриного филе и 150г гречки", "ru")
	if err != nil {
		t.Fatalf("unexpected error in ru analysis: %v", err)
	}
	if len(resRu.Items) < 3 {
		t.Errorf("expected at least 3 items detected in Russian meal, got %d", len(resRu.Items))
	}
	if resRu.TotalCalories < 400 || resRu.TotalProteinG < 40 {
		t.Errorf("expected valid calories and protein, got %d kcal, %v g protein", resRu.TotalCalories, resRu.TotalProteinG)
	}

	// 2. Uzbek test
	resUz, err := engine.AnalyzeMealText(ctx, "Osh va 1 ta somsa", "uz")
	if err != nil {
		t.Fatalf("unexpected error in uz analysis: %v", err)
	}
	if len(resUz.Items) < 2 {
		t.Errorf("expected at least 2 items detected in Uzbek meal, got %d", len(resUz.Items))
	}
	if resUz.TotalCalories < 800 {
		t.Errorf("expected high calories for Osh and Somsa, got %d", resUz.TotalCalories)
	}

	// 3. English test
	resEn, err := engine.AnalyzeMealText(ctx, "Chicken breast and oatmeal", "en")
	if err != nil {
		t.Fatalf("unexpected error in en analysis: %v", err)
	}
	if len(resEn.Items) < 2 {
		t.Errorf("expected at least 2 items in English meal, got %d", len(resEn.Items))
	}
}
