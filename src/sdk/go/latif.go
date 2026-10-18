package latif

import "net/http"

type Client struct {
    BaseURL string
    APIKey  string
    http    *http.Client
}

func NewClient(baseURL string) *Client {
    return &Client{
        BaseURL: baseURL,
        http:    &http.Client{},
    }
}

func (c *Client) Chat(messages []Message, model string) (*ChatResponse, error) {
    // Implementation
    return nil, nil
}

type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type ChatResponse struct {
    Content string `json:"content"`
    Model   string `json:"model"`
}
