package outbox_test

import (
	"testing"
	"time"

	"github.com/neverpaidhealth/backend/pkg/outbox"
)

func TestMessage_NewMessage_ValidSubjectAndPayload(t *testing.T) {
	type TestEvent struct {
		Name string `json:"name"`
	}

	msg, err := outbox.NewMessage("TEST.subject", TestEvent{Name: "workout_finished"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if msg.Subject != "TEST.subject" {
		t.Errorf("expected subject TEST.subject, got %s", msg.Subject)
	}
	if msg.PublishedAt != nil {
		t.Errorf("expected PublishedAt to be nil upon creation")
	}
}

func TestMessage_MarkPublished_SetsPublishedTimestamp(t *testing.T) {
	msg, _ := outbox.NewMessage("TEST.subject", map[string]string{"foo": "bar"})
	now := time.Now().UTC()

	msg.MarkPublished(now)
	if msg.PublishedAt == nil || !msg.PublishedAt.Equal(now) {
		t.Errorf("expected PublishedAt to be set to %v, got %v", now, msg.PublishedAt)
	}
}
