package outbox

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrEmptyPayload   = errors.New("outbox payload cannot be empty")
	ErrInvalidSubject = errors.New("outbox subject cannot be empty")
)

type Message struct {
	ID          uuid.UUID
	Subject     string
	Payload     []byte
	CreatedAt   time.Time
	PublishedAt *time.Time
}

func NewMessage(subject string, payload any) (Message, error) {
	if subject == "" {
		return Message{}, ErrInvalidSubject
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return Message{}, err
	}
	if len(bytes) == 0 {
		return Message{}, ErrEmptyPayload
	}

	return Message{
		ID:        uuid.New(),
		Subject:   subject,
		Payload:   bytes,
		CreatedAt: time.Now().UTC(),
	}, nil
}

func (m *Message) MarkPublished(at time.Time) {
	m.PublishedAt = &at
}
