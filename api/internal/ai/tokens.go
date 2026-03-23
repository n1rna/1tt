package ai

// ExtractTokens reads prompt/completion token counts from a GenerationInfo map.
// It handles both OpenAI-style keys ("PromptTokens"/"CompletionTokens") and
// Anthropic-style keys ("InputTokens"/"OutputTokens").
func ExtractTokens(info map[string]any) (inputTokens, outputTokens int) {
	if info == nil {
		return 0, 0
	}

	if v, ok := info["PromptTokens"]; ok {
		inputTokens = toInt(v)
	}
	if v, ok := info["CompletionTokens"]; ok {
		outputTokens = toInt(v)
	}

	if inputTokens == 0 {
		if v, ok := info["InputTokens"]; ok {
			inputTokens = toInt(v)
		}
	}
	if outputTokens == 0 {
		if v, ok := info["OutputTokens"]; ok {
			outputTokens = toInt(v)
		}
	}

	return inputTokens, outputTokens
}

func toInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float32:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}
