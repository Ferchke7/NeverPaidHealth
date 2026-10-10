package program

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type UserProgram struct {
	id              uuid.UUID
	userID          uuid.UUID
	programID       uuid.UUID
	customName      string
	isActive        bool
	currentDayIndex int
	installedAt     time.Time
}

func NewUserProgram(
	userID uuid.UUID,
	programID uuid.UUID,
	customName string,
	isActive bool,
	now time.Time,
) *UserProgram {
	return &UserProgram{
		id:              uuid.New(),
		userID:          userID,
		programID:       programID,
		customName:      strings.TrimSpace(customName),
		isActive:        isActive,
		currentDayIndex: 0,
		installedAt:     now,
	}
}

func ReconstituteUserProgram(
	id uuid.UUID,
	userID uuid.UUID,
	programID uuid.UUID,
	customName string,
	isActive bool,
	currentDayIndex int,
	installedAt time.Time,
) *UserProgram {
	return &UserProgram{
		id:              id,
		userID:          userID,
		programID:       programID,
		customName:      customName,
		isActive:        isActive,
		currentDayIndex: currentDayIndex,
		installedAt:     installedAt,
	}
}

func (up *UserProgram) ID() uuid.UUID          { return up.id }
func (up *UserProgram) UserID() uuid.UUID      { return up.userID }
func (up *UserProgram) ProgramID() uuid.UUID   { return up.programID }
func (up *UserProgram) CustomName() string     { return up.customName }
func (up *UserProgram) IsActive() bool         { return up.isActive }
func (up *UserProgram) CurrentDayIndex() int   { return up.currentDayIndex }
func (up *UserProgram) InstalledAt() time.Time { return up.installedAt }

func (up *UserProgram) SetActive(active bool) {
	up.isActive = active
}

func (up *UserProgram) SetCurrentDayIndex(index int) {
	if index < 0 {
		index = 0
	}
	up.currentDayIndex = index
}

func (up *UserProgram) AdvanceDay(totalDays int) {
	if totalDays <= 0 {
		return
	}
	up.currentDayIndex = (up.currentDayIndex + 1) % totalDays
}
