package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type AIProvider interface {
	GenerateChatResponse(ctx context.Context, req coach.ChatRequest, telemetry coach.CoachInsights, userName string, lang string) (coach.ChatResponse, error)
	AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string, lang string) (coach.MealAnalysisResult, error)
	AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error)
}

type CompositeAIProvider struct {
	geminiKey        string
	ruleEngine       *RuleEngineProvider
	httpClient       *http.Client
	discoveredOnce   sync.Once
	cachedModels     []string
	lastWorkingModel string
	modelsMutex      sync.RWMutex
}

func NewCompositeAIProvider() *CompositeAIProvider {
	key := os.Getenv("GEMINI_API_KEY")
	return &CompositeAIProvider{
		geminiKey:  key,
		ruleEngine: NewRuleEngineProvider(),
		httpClient: &http.Client{Timeout: 40 * time.Second},
	}
}

func (p *CompositeAIProvider) recordWorkingModel(model string) {
	p.modelsMutex.Lock()
	defer p.modelsMutex.Unlock()
	p.lastWorkingModel = model
}

type listModelsResponse struct {
	Models []struct {
		Name                       string   `json:"name"`
		SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
	} `json:"models"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

type geminiRequest struct {
	Contents          []geminiContent `json:"contents"`
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inline_data,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func (p *CompositeAIProvider) getCandidateModels(ctx context.Context, key string) []string {
	p.modelsMutex.RLock()
	lastWorking := p.lastWorkingModel
	if len(p.cachedModels) > 0 {
		models := make([]string, 0, len(p.cachedModels))
		if lastWorking != "" {
			models = append(models, lastWorking)
		}
		for _, m := range p.cachedModels {
			if m != lastWorking {
				models = append(models, m)
			}
		}
		p.modelsMutex.RUnlock()
		return models
	}
	p.modelsMutex.RUnlock()

	var discovered []string
	if envModel := os.Getenv("GEMINI_MODEL"); envModel != "" {
		discovered = append(discovered, strings.TrimPrefix(envModel, "models/"))
	}

	p.discoveredOnce.Do(func() {
		if key == "" {
			return
		}
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", key)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			slog.Warn("Failed to create ListModels request", "error", err)
			return
		}

		resp, err := p.httpClient.Do(req)
		if err != nil {
			slog.Warn("ListModels HTTP call failed", "error", err)
			return
		}
		defer func(Body io.ReadCloser) {
			_ = Body.Close()
		}(resp.Body)

		rawBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			slog.Error("Google Gemini ListModels API error", "status", resp.StatusCode, "response", string(rawBody))
			return
		}

		var res listModelsResponse
		if err := json.Unmarshal(rawBody, &res); err != nil {
			slog.Warn("Failed to parse ListModels JSON", "error", err, "raw", string(rawBody))
			return
		}

		if res.Error != nil {
			slog.Error("Google Gemini reported API error in ListModels", "code", res.Error.Code, "message", res.Error.Message)
			return
		}

		priorityKeywords := []string{
			"gemini-3.8-flash",
			"gemini-3.5-flash",
			"gemini-flash-latest",
			"gemini-3.1-flash-lite",
			"gemini-2.0-flash",
			"gemini-1.5-flash",
		}

		var rawValid []string
		for _, m := range res.Models {
			name := strings.TrimPrefix(m.Name, "models/")
			if strings.Contains(name, "tts") ||
				strings.Contains(name, "lyria") ||
				strings.Contains(name, "transcribe") ||
				strings.Contains(name, "clip") ||
				strings.Contains(name, "image") ||
				strings.Contains(name, "embedding") ||
				strings.Contains(name, "banana") ||
				strings.Contains(name, "deep-research") ||
				strings.Contains(name, "antigravity") ||
				strings.Contains(name, "customtools") ||
				strings.HasPrefix(name, "gemma-") ||
				name == "gemini-2.5-flash" ||
				name == "gemini-2.5-pro" ||
				name == "gemini-2.5-flash-lite" {
				continue
			}
			if slices.Contains(m.SupportedGenerationMethods, "generateContent") {
				rawValid = append(rawValid, name)
			}
		}

		for _, pref := range priorityKeywords {
			for _, m := range rawValid {
				if m == pref || strings.HasPrefix(m, pref) {
					if !slices.Contains(discovered, m) {
						discovered = append(discovered, m)
					}
				}
			}
		}
		for _, m := range rawValid {
			if !slices.Contains(discovered, m) {
				discovered = append(discovered, m)
			}
		}

		if len(discovered) > 6 {
			discovered = discovered[:6]
		}

		slog.Info("Filtered active multimodal Gemini models", "count", len(discovered), "models", discovered)
	})

	if len(discovered) > 0 {
		p.modelsMutex.Lock()
		p.cachedModels = discovered
		p.modelsMutex.Unlock()
		return discovered
	}

	return []string{
		"gemini-3.8-flash",
		"gemini-3.5-flash",
		"gemini-flash-latest",
		"gemini-3.1-flash-lite",
	}
}

func (p *CompositeAIProvider) executeGenerateContent(ctx context.Context, key string, bodyBytes []byte, timeout time.Duration, logTag string) (*geminiResponse, error) {
	models := p.getCandidateModels(ctx, key)
	var lastErr error

	for _, model := range models {
		apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, key)
		reqCtx, cancel := context.WithTimeout(ctx, timeout)
		httpReq, err := http.NewRequestWithContext(reqCtx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}

		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		cancel()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("model %s returned %d: %s", model, resp.StatusCode, string(raw))
			slog.Warn("Gemini model candidate failed, trying next", "tag", logTag, "model", model, "status", resp.StatusCode)
			continue
		}

		var geminiResp geminiResponse
		if err := json.Unmarshal(raw, &geminiResp); err != nil {
			lastErr = err
			continue
		}

		p.recordWorkingModel(model)
		return &geminiResp, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("no gemini model candidate succeeded for %s", logTag)
}

func createInlineDataPart(imageBase64, mimeType string) *geminiPart {
	clean := strings.TrimSpace(imageBase64)
	if clean == "" {
		return nil
	}
	mime := mimeType
	if mime == "" {
		mime = "image/jpeg"
	}
	if idx := strings.Index(clean, ","); idx != -1 {
		clean = clean[idx+1:]
	}
	return &geminiPart{
		InlineData: &geminiInlineData{
			MimeType: mime,
			Data:     clean,
		},
	}
}

func extractCandidateText(resp *geminiResponse) string {
	if resp == nil {
		return ""
	}
	var rawText string
	for _, cand := range resp.Candidates {
		for _, part := range cand.Content.Parts {
			if part.Text != "" {
				rawText += part.Text
			}
		}
	}
	return strings.TrimSpace(rawText)
}

func extractJSON(rawText string) (string, error) {
	trimmed := strings.TrimSpace(rawText)
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start == -1 || end == -1 || end <= start {
		return "", fmt.Errorf("could not find JSON object in response: %s", rawText)
	}
	return trimmed[start : end+1], nil
}

func (p *CompositeAIProvider) getAPIKey() string {
	if k := os.Getenv("GEMINI_API_KEY"); k != "" {
		return k
	}
	return p.geminiKey
}
