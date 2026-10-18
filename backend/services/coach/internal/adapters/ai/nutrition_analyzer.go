package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func (p *CompositeAIProvider) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGeminiVision(ctx, imageBase64, mimeType, notes, lang)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Vision meal analysis failed, falling back to rule engine", "error", err)
	}

	if notes != "" {
		return p.ruleEngine.AnalyzeMealText(ctx, notes, lang)
	}
	return p.ruleEngine.AnalyzeMealText(ctx, "Сбалансированное блюдо", lang)
}

func (p *CompositeAIProvider) AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGeminiTextNutrition(ctx, description, lang)
		if err == nil && res.MealName != "" {
			return res, nil
		}
		slog.Warn("Gemini Text Nutrition failed, falling back to rule engine", "error", err)
	}

	return p.ruleEngine.AnalyzeMealText(ctx, description, lang)
}

func (p *CompositeAIProvider) callGeminiTextNutrition(ctx context.Context, description, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini api key is not configured")
	}

	langTarget := "Russian"
	if lang == "uz" {
		langTarget = "Uzbek (Latin script)"
	} else if lang == "en" {
		langTarget = "English"
	}

	prompt := fmt.Sprintf(`You are an elite AI sports nutritionist and precision nutrition calculation engine for the NeverPaidHealth (duda.uz) fitness ecosystem.
Analyze the user's meal description and return STRICTLY valid JSON without code fences or extra text.

Target Language: %s. All string fields ("meal_name", item "name", "visual_description", "advice") MUST be written in %s.

Rules for precision macro calculation:
1. Parse every food component and estimate portion weights in grams.
2. Standard defaults if not explicitly stated:
   - 1 whole egg: ~55g, 75 kcal, 6.5g P, 0.5g C, 5g F
   - 1 standard chicken breast portion: ~150g, 248 kcal, 46.5g P, 0g C, 5.4g F
   - 1 portion cooked rice/buckwheat/pasta: ~150g, 165-195 kcal, 4-5g P, 35-43g C, 1g F
   - 1 scoop whey protein: ~30g powder, 120-140 kcal, 24-26g P
   - 1 standard banana: ~120g, 105 kcal, 1.3g P, 27g C, 0.3g F
   - Traditional Central Asian dishes:
     - Uzbek Plov: ~320g, 680 kcal, 28g P, 76g C, 29g F
     - Samsa: ~160g, 420 kcal, 16g P, 38g C, 24g F
     - Manti (4 pcs): ~280g, 540 kcal, 24g P, 52g C, 26g F
     - Tandir Flatbread (1/2 non): ~150g, 390 kcal, 11g P, 76g C, 3g F
3. Calculate exact total calories, total protein (g), carbs (g), and fat (g).
4. Give a practical 1-2 sentence evidence-based athlete advice.

User Meal Description:
"%s"

Required JSON Structure:
{
  "meal_name": "string",
  "visual_description": "string",
  "items": [
    {
      "name": "string",
      "portion": "string (e.g. 150g)",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "confidence": "high" | "medium" | "low",
  "health_score": number,
  "advice": "string"
}`, langTarget, langTarget, description)

	payload := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: prompt},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 8*time.Second, "TextNutrition")
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	return parseMealAnalysisJSON(extractCandidateText(geminiResp))
}

func (p *CompositeAIProvider) callGeminiVision(ctx context.Context, imageBase64, mimeType, notes, lang string) (coach.MealAnalysisResult, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.MealAnalysisResult{}, fmt.Errorf("gemini api key is not configured")
	}

	imgPart := createInlineDataPart(imageBase64, mimeType)
	if imgPart == nil {
		return coach.MealAnalysisResult{}, fmt.Errorf("empty image data for vision analysis")
	}

	langTarget := "Russian"
	if lang == "uz" {
		langTarget = "Uzbek (Latin script)"
	} else if lang == "en" {
		langTarget = "English"
	}

	prompt := fmt.Sprintf(`You are an elite AI sports nutritionist and computer vision food recognition expert.
Analyze this meal/food photo carefully:
1. Identify the specific dish or food item.
2. In "visual_description", explain in detail what you see in the photo (visual texture, shape, color, container/packaging, estimated weight in grams).
3. Break down the detected ingredients with portion weights in grams.
4. Calculate total calories (kcal), protein (g), carbohydrates (g), and fat (g).
5. Give practical nutritional advice for an athlete.
6. Target Language: %s. All string fields ("meal_name", item "name", "visual_description", "advice") MUST be in %s.
7. Return STRICTLY valid JSON without markdown code blocks, backticks, or other text.

Format:
{
  "meal_name": "string",
  "visual_description": "string",
  "items": [
    {"name": "string", "portion": "230g", "calories": 590, "protein_g": 18.0, "carbs_g": 115.0, "fat_g": 5.0}
  ],
  "total_calories": 590,
  "total_protein_g": 18.0,
  "total_carbs_g": 115.0,
  "total_fat_g": 5.0,
  "confidence": "high",
  "health_score": 8,
  "advice": "string"
}`, langTarget, langTarget)

	if notes != "" {
		prompt += fmt.Sprintf("\nUser context note: %s", notes)
	}

	payload := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: prompt},
					*imgPart,
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 10*time.Second, "VisionNutrition")
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}

	return parseMealAnalysisJSON(extractCandidateText(geminiResp))
}

func parseMealAnalysisJSON(rawText string) (coach.MealAnalysisResult, error) {
	jsonStr, err := extractJSON(rawText)
	if err != nil {
		return coach.MealAnalysisResult{}, err
	}
	var analysis coach.MealAnalysisResult
	if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
		return coach.MealAnalysisResult{}, fmt.Errorf("failed to parse meal json (%w): %s", err, jsonStr)
	}
	if analysis.TotalCalories == 0 && len(analysis.Items) > 0 {
		for _, item := range analysis.Items {
			analysis.TotalCalories += item.Calories
			analysis.TotalProteinG += item.ProteinG
			analysis.TotalCarbsG += item.CarbsG
			analysis.TotalFatG += item.FatG
		}
	}
	return analysis, nil
}
