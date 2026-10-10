package memory

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type FakeUserRepo struct {
	mu    sync.RWMutex
	users map[uuid.UUID]*user.User
}

func NewFakeUserRepo() *FakeUserRepo {
	return &FakeUserRepo{
		users: make(map[uuid.UUID]*user.User),
	}
}

func (r *FakeUserRepo) GetByID(_ context.Context, id uuid.UUID) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.users[id]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return u, nil
}

func (r *FakeUserRepo) GetByGoogleSub(_ context.Context, sub string) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, u := range r.users {
		if u.GoogleSub() == sub {
			return u, nil
		}
	}
	return nil, user.ErrUserNotFound
}

func (r *FakeUserRepo) GetByEmail(_ context.Context, email user.Email) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, u := range r.users {
		if u.Email().String() == email.String() {
			return u, nil
		}
	}
	return nil, user.ErrUserNotFound
}

func (r *FakeUserRepo) Save(_ context.Context, u *user.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.users[u.ID()] = u
	return nil
}
