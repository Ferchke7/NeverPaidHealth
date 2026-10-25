package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func (p *CompositeAIProvider) GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string, lang string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key != "" {
		res, err := p.callGemini(ctx, req, telemetry, userName, lang)
		if err == nil && res.Reply != "" {
			return res, nil
		}
		slog.Warn("Gemini API call failed, using rule engine fallback", "error", err)
	}

	return p.ruleEngine.GenerateChatResponse(ctx, req, telemetry, userName, lang)
}

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName, lang string) (coach.ChatResponse, error) {
	key := p.getAPIKey()
	if key == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini api key is empty")
	}

	// Execute Hybrid RAG retrieval (Personal Episodic Memory + Sports Science Knowledge Base)
	ragCtx := coach.RetrieveHybridRAGContext(req.Message, telemetry)
	profileDossier := formatAthleteProfileAndRAG(telemetry, ragCtx, userName)

	systemPrompt := buildCoachSystemPrompt(userName, telemetry, profileDossier, lang)

	contents := make([]geminiContent, 0)
	history := req.History
	if len(history) > 8 {
		history = history[len(history)-8:]
	}
	for _, h := range history {
		role := "user"
		if h.Role == "coach" {
			role = "model"
		}
		parts := make([]geminiPart, 0)
		if part := createInlineDataPart(h.ImageBase64, h.MimeType); part != nil {
			parts = append(parts, *part)
		}
		if h.Content != "" {
			parts = append(parts, geminiPart{Text: h.Content})
		}
		if len(parts) > 0 {
			contents = append(contents, geminiContent{
				Role:  role,
				Parts: parts,
			})
		}
	}

	userParts := make([]geminiPart, 0)
	if part := createInlineDataPart(req.ImageBase64, req.MimeType); part != nil {
		userParts = append(userParts, *part)
	}
	userText := req.Message
	if userText == "" && req.ImageBase64 != "" {
		userText = "Проанализируй фото с привязкой к моему досье и дай точные рекомендации."
	}
	if userText != "" {
		userParts = append(userParts, geminiPart{Text: userText})
	}
	if len(userParts) > 0 {
		contents = append(contents, geminiContent{
			Role:  "user",
			Parts: userParts,
		})
	}

	payload := geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return coach.ChatResponse{}, err
	}

	geminiResp, err := p.executeGenerateContent(ctx, key, bodyBytes, 12*time.Second, "Chat")
	if err != nil {
		return coach.ChatResponse{}, err
	}

	reply := extractCandidateText(geminiResp)
	if reply == "" {
		return coach.ChatResponse{}, fmt.Errorf("gemini returned empty response")
	}

	return coach.ChatResponse{
		Reply:            strings.TrimSpace(reply),
		Suggestions:      buildContextualSuggestions(telemetry, lang),
		SuggestedWorkout: coach.BuildWorkoutForChatQuery(req.Message, telemetry),
	}, nil
}

func buildContextualSuggestions(telemetry coach.CoachInsights, lang string) []string {
	if lang == "uz" {
		return []string{
			"Bugungi mashg'ulot uchun aniq vazn va takrorlar",
			"Mening 1RM rekordlarim va o'sish dinamikam",
			"Tana vaznimga mos kunlik oqsil va kaloriya",
		}
	}
	if lang == "en" {
		return []string{
			"Exact weights & reps for today's session",
			"Analyze my CNS recovery & weekly volume (MEV/MAV)",
			"My body recomposition macros & protein target",
		}
	}
	if len(telemetry.AllTimePRs) > 0 {
		topEx := telemetry.AllTimePRs[0].ExerciseName
		return []string{
			fmt.Sprintf("План прогрессии в «%s»", topEx),
			"Разбор моего восстановления ЦНС и объема по мышцам",
			"Мои точные КБЖУ для рекомпозиции",
		}
	}
	return []string{
		"Что тренировать сегодня с рабочими весами?",
		"Разбор восстановления ЦНС и недельного объема",
		"Рассчитай мои КБЖУ для рекомпозиции",
	}
}
