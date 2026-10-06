package memory

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type FakeProgressRepo struct {
	mu          sync.RWMutex
	records     map[string]*record.ExerciseRecordBook
	series      map[string]*history.ExerciseHistorySeries
	eventsSeen  map[uuid.UUID]bool
}

func NewFakeProgressRepo() *FakeProgressRepo {
	return &FakeProgressRepo{
		records:    make(map[string]*record.ExerciseRecordBook),
		series:     make(map[string]*history.ExerciseHistorySeries),
		eventsSeen: make(map[uuid.UUID]bool),
	}
}

func (r *FakeProgressRepo) key(userID, exerciseID uuid.UUID) string {
	return userID.String() + ":" + exerciseID.String()
}

func (r *FakeProgressRepo) Get(ctx context.Context, userID, exerciseID uuid.UUID) (*record.ExerciseRecordBook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rb, ok := r.records[r.key(userID, exerciseID)]
	if !ok {
		return nil, nil
	}
	return rb, nil
}

func (r *FakeProgressRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*record.ExerciseRecordBook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*record.ExerciseRecordBook
	for _, rb := range r.records {
		if rb.UserID() == userID {
			list = append(list, rb)
		}
	}
	return list, nil
}

func (r *FakeProgressRepo) Save(ctx context.Context, rb *record.ExerciseRecordBook) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.records[r.key(rb.UserID(), rb.ExerciseID())] = rb
	return nil
}

func (r *FakeProgressRepo) AppendDataPoint(ctx context.Context, userID, exerciseID uuid.UUID, exerciseName string, point history.HistoryDataPoint) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	k := r.key(userID, exerciseID)
	s, ok := r.series[k]
	if !ok {
		s = &history.ExerciseHistorySeries{
			ExerciseID:   exerciseID,
			ExerciseName: exerciseName,
			DataPoints:   nil,
		}
		r.series[k] = s
	}

	s.DataPoints = append(s.DataPoints, point)
	return nil
}

func (r *FakeProgressRepo) GetSeries(ctx context.Context, userID, exerciseID uuid.UUID) (*history.ExerciseHistorySeries, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	s, ok := r.series[r.key(userID, exerciseID)]
	if !ok {
		return &history.ExerciseHistorySeries{ExerciseID: exerciseID, ExerciseName: "Exercise", DataPoints: nil}, nil
	}
	return s, nil
}

func (r *FakeProgressRepo) IsProcessed(ctx context.Context, eventID uuid.UUID) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.eventsSeen[eventID], nil
}

func (r *FakeProgressRepo) MarkProcessed(ctx context.Context, eventID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.eventsSeen[eventID] = true
	return nil
}
