package memory

import (
	"context"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
)

type FakeProgramRepo struct {
	mu       sync.RWMutex
	programs map[uuid.UUID]*program.Program
}

func NewFakeProgramRepo() *FakeProgramRepo {
	return &FakeProgramRepo{
		programs: make(map[uuid.UUID]*program.Program),
	}
}

func (r *FakeProgramRepo) GetByID(_ context.Context, id uuid.UUID) (*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.programs[id]
	if !ok {
		return nil, program.ErrProgramNotFound
	}
	return p, nil
}

func (r *FakeProgramRepo) ListLibrary(_ context.Context, splitType string, search string) ([]*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.Program
	for _, p := range r.programs {
		if p.IsSystem() && matchesFilter(p, splitType, search) {
			list = append(list, p)
		}
	}
	return list, nil
}

func (r *FakeProgramRepo) ListCommunity(_ context.Context, splitType string, search string, limit int, offset int) ([]*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.Program
	for _, p := range r.programs {
		if p.IsPublic() && matchesFilter(p, splitType, search) {
			list = append(list, p)
		}
	}
	return list, nil
}

func matchesFilter(p *program.Program, splitType, search string) bool {
	if splitType != "" && splitType != "all" && string(p.SplitType()) != splitType {
		return false
	}
	if search != "" && !strings.Contains(strings.ToLower(p.Name()), strings.ToLower(search)) {
		return false
	}
	return true
}

func (r *FakeProgramRepo) ListByUserID(_ context.Context, userID uuid.UUID) ([]*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.Program
	for _, p := range r.programs {
		if p.UserID() == userID {
			list = append(list, p)
		}
	}
	return list, nil
}

func (r *FakeProgramRepo) Save(_ context.Context, p *program.Program) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.programs[p.ID()] = p
	return nil
}

func (r *FakeProgramRepo) Delete(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.programs, id)
	return nil
}

type FakeUserProgramRepo struct {
	mu           sync.RWMutex
	userPrograms map[uuid.UUID]*program.UserProgram
}

func NewFakeUserProgramRepo() *FakeUserProgramRepo {
	return &FakeUserProgramRepo{
		userPrograms: make(map[uuid.UUID]*program.UserProgram),
	}
}

func (r *FakeUserProgramRepo) GetByID(_ context.Context, id uuid.UUID) (*program.UserProgram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	up, ok := r.userPrograms[id]
	if !ok {
		return nil, program.ErrUserProgramNotFound
	}
	return up, nil
}

func (r *FakeUserProgramRepo) GetActive(_ context.Context, userID uuid.UUID) (*program.UserProgram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, up := range r.userPrograms {
		if up.UserID() == userID && up.IsActive() {
			return up, nil
		}
	}
	return nil, nil
}

func (r *FakeUserProgramRepo) ListByUserID(_ context.Context, userID uuid.UUID) ([]*program.UserProgram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.UserProgram
	for _, up := range r.userPrograms {
		if up.UserID() == userID {
			list = append(list, up)
		}
	}
	return list, nil
}

func (r *FakeUserProgramRepo) Save(_ context.Context, up *program.UserProgram) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.userPrograms[up.ID()] = up
	return nil
}

func (r *FakeUserProgramRepo) SetActive(_ context.Context, userID uuid.UUID, userProgramID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, up := range r.userPrograms {
		if up.UserID() == userID {
			up.SetActive(up.ID() == userProgramID)
		}
	}
	return nil
}

func (r *FakeUserProgramRepo) Delete(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.userPrograms, id)
	return nil
}
