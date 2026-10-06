package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type AIProvider interface {
	GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error)
}

type CompositeAIProvider struct {
	geminiKey  string
	ruleEngine *RuleEngineProvider
	httpClient *http.Client
}

func NewCompositeAIProvider() *CompositeAIProvider {
	key := os.Getenv("GEMINI_API_KEY")
	return &CompositeAIProvider{
		geminiKey:  key,
		ruleEngine: NewRuleEngineProvider(),
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (p *CompositeAIProvider) GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	// If Gemini API Key is configured, try calling Gemini API first
	if p.geminiKey != "" {
		res, err := p.callGemini(ctx, req, telemetry, userName)
		if err == nil && res.Reply != "" {
			return res, nil
		}
	}

	// Intelligent Rule-Based Sports Science Engine Fallback (Zero external dependencies)
	return p.ruleEngine.GenerateChatResponse(ctx, req, telemetry, userName)
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
	SystemInstruction *geminiContent `json:"systemInstruction,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (p *CompositeAIProvider) callGemini(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string) (coach.ChatResponse, error) {
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", p.geminiKey)

	systemPrompt := fmt.Sprintf(`You are NeverPaidHealth AI Coach — an elite, evidence-based strength & conditioning coach and sports scientist.
The user is named %s.
Current User Telemetry:
- Readiness Score: %d/100 (%s)
- Weekly Workouts: %d
- Weekly Total Tonnage: %.1f kg
- Days Since Last Workout: %d
- Suggested Split: %s
- Top Overload Recommendations: %v
- Active Plateau Alerts: %v

Guidelines:
- Give concise, motivating, actionable, and scientific fitness advice.
- Answer in the same language as the user (Russian if user asks in Russian, English if user asks in English).
- Focus on progressive overload, recovery, biomechanics, and periodization.`,
		userName, telemetry.ReadinessScore, telemetry.RecoveryStatus, telemetry.WeeklyWorkoutsCount,
		telemetry.WeeklyVolumeKg, telemetry.DaysSinceLastTrain, telemetry.SuggestedSplit,
		telemetry.OverloadTargets, telemetry.PlateauAlerts)

	contents := make([]geminiContent, 0)
	for _, h := range req.History {
		role := "user"
		if h.Role == "coach" {
			role = "model"
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: h.Content}},
		})
	}
	contents = append(contents, geminiContent{
		Role:  "user",
		Parts: []geminiPart{{Text: req.Message}},
	})

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

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return coach.ChatResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return coach.ChatResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return coach.ChatResponse{}, fmt.Errorf("gemini api error: %s", string(raw))
	}

	var geminiResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return coach.ChatResponse{}, err
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		reply := geminiResp.Candidates[0].Content.Parts[0].Text
		return coach.ChatResponse{
			Reply: strings.TrimSpace(reply),
			Suggestions: []string{
				"Прогрессивная перегрузка для жима лежа",
				"Что тренировать сегодня?",
				"Как избежать плато?",
			},
		}, nil
	}

	return coach.ChatResponse{}, fmt.Errorf("empty gemini response")
}
