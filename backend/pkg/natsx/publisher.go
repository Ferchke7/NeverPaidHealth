package natsx

import (
	"fmt"

	"github.com/nats-io/nats.go"
)

type JetStreamClient struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

func Connect(url string) (*JetStreamClient, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS at %s: %w", url, err)
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to get JetStream context: %w", err)
	}

	return &JetStreamClient{nc: nc, js: js}, nil
}

func (c *JetStreamClient) Close() {
	if c.nc != nil {
		c.nc.Close()
	}
}

func (c *JetStreamClient) Publish(subject string, data []byte) error {
	_, err := c.js.Publish(subject, data)
	return err
}

func (c *JetStreamClient) EnsureStream(streamName string, subjects []string) error {
	_, err := c.js.StreamInfo(streamName)
	if err == nil {
		return nil
	}

	_, err = c.js.AddStream(&nats.StreamConfig{
		Name:     streamName,
		Subjects: subjects,
		Storage:  nats.FileStorage,
	})
	return err
}
