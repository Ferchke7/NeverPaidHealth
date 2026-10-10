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

func (r *FakeProgramRepo) GetByID(ctx context.Context, id uuid.UUID) (*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.programs[id]
	if !ok {
		return nil, program.ErrProgramNotFound
	}
	return p, nil
}

func (r *FakeProgramRepo) ListLibrary(ctx context.Context, splitType string, search string) ([]*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.Program
	for _, p := range r.programs {
		if p.IsSystem() {
			if splitType != "" && splitType != "all" && string(p.SplitType()) != splitType {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(p.Name()), strings.ToLower(search)) {
				continue
			}
			list = append(list, p)
		}
	}
	return list, nil
}

func (r *FakeProgramRepo) ListCommunity(ctx context.Context, splitType string, search string, limit int, offset int) ([]*program.Program, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*program.Program
	for _, p := range r.programs {
		if p.IsPublic() {
			if splitType != "" && splitType != "all" && string(p.SplitType()) != splitType {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(p.Name()), strings.ToLower(search)) {
				continue
			}
			list = append(list, p)
		}
	}
	return list, nil
}

func (r *FakeProgramRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*program.Program, error) {
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

func (r *FakeProgramRepo) Save(ctx context.Context, p *program.Program) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.programs[p.ID()] = p
	return nil
}

func (r *FakeProgramRepo) Delete(ctx context.Context, id uuid.UUID) error {
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

func (r *FakeUserProgramRepo) GetByID(ctx context.Context, id uuid.UUID) (*program.UserProgram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	up, ok := r.userPrograms[id]
	if !ok {
		return nil, program.ErrUserProgramNotFound
	}
	return up, nil
}

func (r *FakeUserProgramRepo) GetActive(ctx context.Context, userID uuid.UUID) (*program.UserProgram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, up := range r.userPrograms {
		if up.UserID() == userID && up.IsActive() {
			return up, nil
		}
	}
	return nil, nil
}

func (r *FakeUserProgramRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*program.UserProgram, error) {
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

func (r *FakeUserProgramRepo) Save(ctx context.Context, up *program.UserProgram) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.userPrograms[up.ID()] = up
	return nil
}

func (r *FakeUserProgramRepo) SetActive(ctx context.Context, userID uuid.UUID, userProgramID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, up := range r.userPrograms {
		if up.UserID() == userID {
			up.SetActive(up.ID() == userProgramID)
		}
	}
	return nil
}

func (r *FakeUserProgramRepo) Delete(ctx context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.userPrograms, id)
	return nil
}
