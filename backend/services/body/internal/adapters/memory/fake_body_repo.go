package memory

import (
	"context"
	"sort"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type FakeBodyRepo struct {
	mu   sync.RWMutex
	logs map[string]*body.BodyLog
}

func NewFakeBodyRepo() *FakeBodyRepo {
	return &FakeBodyRepo{
		logs: make(map[string]*body.BodyLog),
	}
}

func (r *FakeBodyRepo) key(userID uuid.UUID, logDate string) string {
	return userID.String() + ":" + logDate
}

func (r *FakeBodyRepo) GetByDate(ctx context.Context, userID uuid.UUID, logDate string) (*body.BodyLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	l, ok := r.logs[r.key(userID, logDate)]
	if !ok {
		return nil, body.ErrBodyLogNotFound
	}
	return l, nil
}

func (r *FakeBodyRepo) ListRange(ctx context.Context, userID uuid.UUID, fromDate, toDate string) ([]*body.BodyLog, error) {
	all, err := r.ListAll(ctx, userID)
	if err != nil {
		return nil, err
	}

	var res []*body.BodyLog
	for _, l := range all {
		if l.LogDate() >= fromDate && l.LogDate() <= toDate {
			res = append(res, l)
		}
	}
	return res, nil
}

func (r *FakeBodyRepo) ListAll(ctx context.Context, userID uuid.UUID) ([]*body.BodyLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []*body.BodyLog
	for _, l := range r.logs {
		if l.UserID() == userID {
			res = append(res, l)
		}
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].LogDate() < res[j].LogDate()
	})

	return res, nil
}

func (r *FakeBodyRepo) Save(ctx context.Context, log *body.BodyLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.logs[r.key(log.UserID(), log.LogDate())] = log
	return nil
}

func (r *FakeBodyRepo) Delete(ctx context.Context, userID uuid.UUID, logDate string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.logs, r.key(userID, logDate))
	return nil
}
